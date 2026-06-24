"""
Shared helpers for equipment history Excel extraction scripts.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, datetime

KNOWN_INTERVALS = (
    "Daily",
    "Weekly",
    "Monthly",
    "Quarterly",
    "Half - Yearly",
    "Yearly",
    "2 - Years",
    "3 - Years",
    "4 - Years",
)

INTERVAL_NORM = {re.sub(r"\s+", " ", k.strip()).upper(): k for k in KNOWN_INTERVALS}

INACTIVE_INTERVAL_MARKS = frozenset({"X", "x", "-", "NO", "N", "NA", "N/A"})

# Index of Action Taken in standard history output rows (after date columns).
HISTORY_ACTION_IDX = 7

DEFAULT_SPEC_SECTION_HEADERS = (
    ("MECHANICAL PART", "mechanical"),
    ("INSTRUMENT PART", "instrument"),
    ("ELECTRICALT PART", "electrical"),
    ("ELECTRIC PART", "electrical"),
    ("ELECTRICAL PART", "electrical"),
    ("ELECTRONIC PART", "electrical"),
)


def norm(text) -> str:
    return re.sub(r"\s+", " ", str(text or "").strip()).upper()


def cell_text(value) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def normalize_interval_value(raw) -> str:
    """Map checkmarks / X to Yes or blank for extracted Excel output."""
    s = cell_text(raw)
    if not s:
        return ""
    if s in INACTIVE_INTERVAL_MARKS or norm(s) in INACTIVE_INTERVAL_MARKS:
        return ""
    if s in ("√", "✓", "v", "V") or norm(s) in ("Y", "YES", "1"):
        return "Yes"
    return s


def row_cells(ws, row_idx: int) -> list[str]:
    return [cell_text(ws.cell(row_idx, c).value) for c in range(1, ws.max_column + 1)]


def is_schedule_serial_header(text: str) -> bool:
    h = norm(text)
    return h in {"SN", "SR.NO", "SR.NO.", "S.NO.", "S.NO"} or h.startswith("SR.NO")


def is_schedule_table_header_row(row: list[str]) -> bool:
    joined = norm(" ".join(row))
    has_serial = any(is_schedule_serial_header(cell) for cell in row if cell)
    return has_serial and "NAME OF EQUIPMENT" in joined and "MAINTENANCE" in joined


def is_schedule_interval_label_row(row: list[str], remarks_col: int | None) -> int:
    """Return count of interval labels found (excluding remarks column)."""
    count = 0
    for idx, cell in enumerate(row, start=1):
        if remarks_col and idx == remarks_col:
            continue
        if norm(cell) in INTERVAL_NORM:
            count += 1
    return count


@dataclass
class ScheduleLayout:
    header_row: int
    data_start: int
    sr_col: int | None = None
    comp_col: int | None = None
    act_col: int | None = None
    remarks_col: int | None = None
    interval_cols: dict[int, str] = field(default_factory=dict)


def parse_schedule_layout(
    ws,
    schedule_start: int,
    schedule_end: int,
) -> ScheduleLayout | None:
    header_row = None
    for r in range(schedule_start + 1, min(schedule_start + 6, schedule_end)):
        if is_schedule_table_header_row(row_cells(ws, r)):
            header_row = r
            break
    if header_row is None:
        return None

    sr_col = comp_col = act_col = remarks_col = None
    for c in range(1, ws.max_column + 1):
        h = norm(ws.cell(header_row, c).value)
        if is_schedule_serial_header(h):
            sr_col = c
        elif "NAME OF EQUIPMENT" in h:
            comp_col = c
        elif "MAINTENANCE" in h and "ACTIVIT" in h:
            act_col = c
        elif "REMARKS" in h:
            remarks_col = c

    interval_cols: dict[int, str] = {}
    data_start = header_row + 1
    for r in range(header_row + 1, min(header_row + 4, schedule_end)):
        row = row_cells(ws, r)
        if is_schedule_interval_label_row(row, remarks_col) >= 2:
            for c in range(1, ws.max_column + 1):
                key = norm(ws.cell(r, c).value)
                if key in INTERVAL_NORM:
                    interval_cols[c] = INTERVAL_NORM[key]
            data_start = r + 1

    if remarks_col and remarks_col in interval_cols:
        del interval_cols[remarks_col]

    while data_start < schedule_end:
        row = row_cells(ws, data_start)
        if is_schedule_table_header_row(row):
            data_start += 1
            continue
        if is_schedule_interval_label_row(row, remarks_col) >= 2:
            data_start += 1
            continue
        if act_col and cell_text(ws.cell(data_start, act_col).value):
            break
        if sr_col and cell_text(ws.cell(data_start, sr_col).value):
            break
        if any(
            normalize_interval_value(ws.cell(data_start, c).value)
            for c in interval_cols
        ):
            break
        data_start += 1
        if data_start - header_row > 5:
            break

    return ScheduleLayout(
        header_row=header_row,
        data_start=data_start,
        sr_col=sr_col,
        comp_col=comp_col,
        act_col=act_col,
        remarks_col=remarks_col,
        interval_cols=interval_cols,
    )


def extract_schedule_rows(
    ws,
    layout: ScheduleLayout,
    schedule_end: int,
    sheet_id: str,
    sheet_name: str,
    output_intervals: tuple[str, ...],
    section_markers: tuple[str, ...],
) -> list[list[str]]:
    rows: list[list[str]] = []
    current_sr = ""
    current_comp = ""
    current_remarks = ""

    for r in range(layout.data_start, schedule_end):
        row = row_cells(ws, r)
        joined = norm(" ".join(row))
        if any(marker in joined for marker in section_markers):
            continue
        if is_schedule_table_header_row(row):
            continue
        if is_schedule_interval_label_row(row, layout.remarks_col) >= 2:
            continue

        sr = cell_text(ws.cell(r, layout.sr_col).value) if layout.sr_col else ""
        comp = cell_text(ws.cell(r, layout.comp_col).value) if layout.comp_col else ""
        activity = cell_text(ws.cell(r, layout.act_col).value) if layout.act_col else ""
        remarks = (
            cell_text(ws.cell(r, layout.remarks_col).value)
            if layout.remarks_col
            else ""
        )

        interval_values: dict[str, str] = {}
        for col_idx, label in layout.interval_cols.items():
            interval_values[label] = normalize_interval_value(ws.cell(r, col_idx).value)

        if sr:
            current_sr = sr
            current_comp = ""
            current_remarks = ""
        if comp:
            current_comp = comp
        if remarks:
            current_remarks = remarks

        resolved_remarks = remarks or current_remarks
        resolved_intervals = [
            interval_values.get(label, "")
            for label in output_intervals
        ]

        if (
            not activity
            and not any(resolved_intervals)
            and not resolved_remarks
            and not sr
            and not comp
        ):
            continue

        rows.append([
            sheet_id,
            sheet_name,
            sr or current_sr,
            comp or current_comp,
            activity,
            *resolved_intervals,
            resolved_remarks,
        ])

    return rows


def clean_param_label(label: str) -> str:
    return re.sub(r"\s*:\s*$", "", label.strip())


def non_empty_indexed(row: list[str]) -> list[tuple[int, str]]:
    return [(i, x) for i, x in enumerate(row) if x]


def extract_spec_pairs_from_row(row: list[str]) -> list[tuple[str, str]]:
    ne = non_empty_indexed(row)
    if not ne:
        return []
    pairs: list[tuple[str, str]] = []
    i = 0
    while i < len(ne):
        _, lbl_text = ne[i]
        lbl_clean = clean_param_label(lbl_text)
        if not lbl_clean:
            i += 1
            continue
        try:
            float(lbl_clean)
            i += 1
            continue
        except ValueError:
            pass
        if i + 1 < len(ne):
            val_text = ne[i + 1][1]
            if val_text and val_text != lbl_clean:
                pairs.append((lbl_clean, val_text))
            i += 2
        else:
            i += 1
    return pairs


def detect_spec_section(row: list[str], section_headers=DEFAULT_SPEC_SECTION_HEADERS) -> str | None:
    joined = norm(" ".join(row))
    for key, section in section_headers:
        if key in joined:
            return section
    return None


def clean_subsection_title(text: str) -> str:
    lines = [re.sub(r"\s+", " ", line).strip() for line in str(text).split("\n") if line.strip()]
    for line in lines:
        if re.match(r"^\d+\.", line):
            continue
        cleaned = line.rstrip(":-").strip()
        if cleaned:
            return cleaned
    return lines[0].rstrip(":-").strip() if lines else ""


def is_spec_subsection_title(text: str) -> bool:
    n = norm(text)
    if not n or len(n) > 100:
        return False
    if "PART SPECIFICATION" in n or "SPECIFICATION DATA" in n:
        return False
    if "DETAILS" in n:
        return True
    if "VFD" in n and "OTHER" in n:
        return True
    return False


def parse_subsection_header_row(row: list[str]) -> list[tuple[int, str]]:
    headers: list[tuple[int, str]] = []
    for idx, cell in enumerate(row):
        if not cell.strip():
            continue
        title = clean_subsection_title(cell)
        if is_spec_subsection_title(title):
            headers.append((idx, title))
    return headers


def build_spec_column_blocks(
    headers: list[tuple[int, str]],
    row_len: int,
) -> list[tuple[int, int, str]]:
    if not headers:
        return []
    sorted_headers = sorted(headers, key=lambda item: item[0])
    blocks: list[tuple[int, int, str]] = []
    for i, (col, title) in enumerate(sorted_headers):
        end = sorted_headers[i + 1][0] - 1 if i + 1 < len(sorted_headers) else row_len - 1
        blocks.append((col, end, title))
    return blocks


def is_spec_data_skip_row(row: list[str], section_headers=DEFAULT_SPEC_SECTION_HEADERS) -> bool:
    joined = norm(" ".join(row))
    if "EQUIPMENT SPECIFICATION" in joined:
        return True
    if any(key in joined for key, _ in section_headers):
        return True
    skip = (
        "SR.NO", "SN", "NAME OF EQUIPMENT", "MAINTENANCE / INSPECTION",
        "SEASON", "OEM MAINTENANCE", "REMARKS", "INTERVAL",
    )
    return any(s in joined for s in skip)


def extract_specification_rows(
    ws,
    spec_start: int,
    spec_end: int,
    sheet_id: str,
    sheet_name: str,
    section_stop_markers: tuple[str, ...],
    section_headers=DEFAULT_SPEC_SECTION_HEADERS,
) -> list[list[str]]:
    rows: list[list[str]] = []
    current_section = ""
    spec_blocks: list[tuple[int, int, str]] = []

    for r in range(spec_start + 1, spec_end):
        row = row_cells(ws, r)
        if not any(row):
            continue

        joined = norm(" ".join(row))
        if any(marker in joined for marker in section_stop_markers):
            continue

        sec = detect_spec_section(row, section_headers)
        if sec:
            current_section = sec
            spec_blocks = []
            continue

        if is_spec_data_skip_row(row, section_headers):
            continue

        if row[0].endswith(":-") or (len(row) > 1 and row[1].endswith(":-")):
            continue

        header_pairs = parse_subsection_header_row(row)
        if header_pairs:
            spec_blocks = build_spec_column_blocks(header_pairs, len(row))
            continue

        if spec_blocks:
            for start, end, sub_section in spec_blocks:
                slice_row = row[start : end + 1]
                for label, value in extract_spec_pairs_from_row(slice_row):
                    if not label or not value:
                        continue
                    rows.append([sheet_id, sheet_name, current_section, sub_section, label, value])
        else:
            for label, value in extract_spec_pairs_from_row(row):
                if not label or not value:
                    continue
                rows.append([sheet_id, sheet_name, current_section, "", label, value])

    return rows


def map_history_header_columns(ws, header_row: int) -> dict[str, int]:
    mapping: dict[str, int] = {}
    for c in range(1, ws.max_column + 1):
        h = norm(ws.cell(header_row, c).value)
        if not h:
            continue
        if "SEASON" in h and "OFF" in h:
            mapping["season"] = c
        elif h in ("YEAR", "YEAR ") or h.startswith("YEAR/") or h.startswith("YEAR /"):
            mapping["year"] = c
        elif "DATE OF START" in h:
            mapping["date_start"] = c
        elif "DATE OF FINISH" in h:
            mapping["date_finish"] = c
        elif "OUTAGE" in h or "OBSERVATION" in h:
            mapping["obs"] = c
        elif "ACTION TAKEN" in h or h == "ACTION TAKEN":
            mapping["act"] = c
        elif "REPAIR COST" in h:
            mapping["cost"] = c
        elif "SERVICE" in h and "INTERNAL" in h:
            mapping["svc"] = c
        elif "RESPONSIBILITY" in h:
            mapping["resp"] = c
        elif "REMARKS" in h:
            mapping["rem"] = c
    return mapping


def is_history_header_row(row: list[str]) -> bool:
    joined = norm(" ".join(row))
    return "SEASON" in joined and (
        "YEAR" in joined or "OUTAGE" in joined or "OBSERVATION" in joined
    )


def is_history_continuation_row(row: list[str], cols: dict[str, int]) -> bool:
    season = row[cols["season"] - 1] if cols.get("season") else ""
    year = row[cols["year"] - 1] if cols.get("year") else ""
    obs = row[cols["obs"] - 1] if cols.get("obs") else ""
    act = row[cols["act"] - 1] if cols.get("act") else ""
    return not season and not year and not obs and bool(act)


def extract_history_rows_flexible(
    ws,
    history_row: int,
    sheet_id: str,
    sheet_name: str,
    stop_markers: tuple[str, ...],
) -> list[list[str]]:
    header_row = None
    for r in range(history_row + 1, min(history_row + 6, ws.max_row + 1)):
        if is_history_header_row(row_cells(ws, r)):
            header_row = r
            break
    if header_row is None:
        return []

    cols = map_history_header_columns(ws, header_row)
    rows: list[list[str]] = []

    for r in range(header_row + 1, ws.max_row + 1):
        row = row_cells(ws, r)
        if not any(row):
            continue
        if is_history_header_row(row):
            continue
        joined = norm(" ".join(row))
        if any(marker in joined for marker in stop_markers):
            break

        season = cell_text(ws.cell(r, cols["season"]).value) if cols.get("season") else ""
        year = cell_text(ws.cell(r, cols["year"]).value) if cols.get("year") else ""
        date_start = (
            cell_text(ws.cell(r, cols["date_start"]).value) if cols.get("date_start") else ""
        )
        date_finish = (
            cell_text(ws.cell(r, cols["date_finish"]).value) if cols.get("date_finish") else ""
        )
        obs = cell_text(ws.cell(r, cols["obs"]).value) if cols.get("obs") else ""
        act = cell_text(ws.cell(r, cols["act"]).value) if cols.get("act") else ""

        if is_history_continuation_row(row, cols) and rows:
            prev = rows[-1]
            prev[HISTORY_ACTION_IDX] = (
                f"{prev[HISTORY_ACTION_IDX]}\n{act}".strip() if prev[HISTORY_ACTION_IDX] else act
            )
            continue

        if not season and not year and not date_start and not date_finish and not obs and not act:
            continue
        if norm(season) in {"SEASON / OFF SEASON", "SEASON /OFF SEASON"}:
            continue
        if norm(season) in {"SR.NO.", "SR NO", "SR.NO"}:
            continue

        rows.append([
            sheet_id,
            sheet_name,
            season,
            year,
            date_start,
            date_finish,
            obs,
            act,
            cell_text(ws.cell(r, cols["cost"]).value) if cols.get("cost") else "",
            cell_text(ws.cell(r, cols["svc"]).value) if cols.get("svc") else "",
            cell_text(ws.cell(r, cols["resp"]).value) if cols.get("resp") else "",
            cell_text(ws.cell(r, cols["rem"]).value) if cols.get("rem") else "",
        ])

    return rows
