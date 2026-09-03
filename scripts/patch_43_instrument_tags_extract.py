"""
Extract Instrument card data for the 43 Sugar tags that were missing OEM
schedule (and the 3 SCVS UPS tags that also needed specs/history).

Source:
  DigiLog/backend/backlog-data/mill data/migration files-24-08-26/
    Turbine & Instrument Equipment life histroy 20-06-2026 (2).xlsx

Sheets used: D.B.F 14, I.E.R 49, Ground floor 19, UPS HISTORY

Output JSON (for backend import):
  DigiLog/backend/backlog-data/mill data/migration files-24-08-26/
    patch-43-instrument-tags-extract.json

Requires the Sr.No. / Sr. No. / SrNo header fix in
equipment_history_extract_lib.is_schedule_serial_header.

Usage (from DigiLog/scripts/):
  py -3 patch_43_instrument_tags_extract.py
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import openpyxl

from extract_shn_life_history_table import (
    extract_life_fields,
    extract_maintenance_history,
    extract_maintenance_schedule,
    extract_specification_rows,
    find_equipment_subcards,
)

ROOT = Path(__file__).resolve().parent.parent
SOURCE = (
    ROOT
    / "backend"
    / "backlog-data"
    / "mill data"
    / "migration files-24-08-26"
    / "Turbine & Instrument Equipment life histroy 20-06-2026 (2).xlsx"
)
OUT = (
    ROOT
    / "backend"
    / "backlog-data"
    / "mill data"
    / "migration files-24-08-26"
    / "patch-43-instrument-tags-extract.json"
)

SHEETS = ["D.B.F 14", "I.E.R 49", "Ground floor 19", "UPS HISTORY"]

# mode: oem = schedule only; full = specs + schedule + history
TAGS = [
    ("ZIL/GSM/SCVS-MILL", "full"),
    ("ZIL/GSM/SCVS-RAW", "full"),
    ("ZIL/GSM/SCVS-REFINRY", "full"),
    ("ZIL/SUG./001  (40FCV101)", "oem"),
    ("ZIL/SUG./001  (40XV102)", "oem"),
    ("ZIL/SUG./001  (40XV103)", "oem"),
    ("ZIL/SUG./001  (40XV105)", "oem"),
    ("ZIL/SUG./001  (40XV106)", "oem"),
    ("ZIL/SUG./001  (40XV107)", "oem"),
    ("ZIL/SUG./001  (40XV108)", "oem"),
    ("ZIL/SUG./001  (40FCV201)", "oem"),
    ("ZIL/SUG./001  (40XV202)", "oem"),
    ("ZIL/SUG./001  (40XV203)", "oem"),
    ("ZIL/SUG./001  (40XV205)", "oem"),
    ("ZIL/SUG./001  (40XV206)", "oem"),
    ("ZIL/SUG./001  (40XV207)", "oem"),
    ("ZIL/SUG./001  (40XV208)", "oem"),
    ("ZIL/SUG./001  (40FCV003)", "oem"),
    ("ZIL/SUG./001  (52 XV 016)", "oem"),
    ("ZIL/SUG./001  (52 XV005)", "oem"),
    ("ZIL/SUG./001  (52 XV006)", "oem"),
    ("ZIL/SUG./001  (52 XV007)", "oem"),
    ("ZIL/SUG./001  (52 XV 002)", "oem"),
    ("ZIL/SUG./001  (52 XV 003)", "oem"),
    ("ZIL/SUG./001  (52 TCV 004)", "oem"),
    ("ZIL/SUG./001  (52 FCV 009)", "oem"),
    ("ZIL/SUG./001  (52 XV 026)", "oem"),
    ("ZIL/SUG./001  (52 FCV 011)", "oem"),
    ("ZIL/SUG./001  (52 XV 012)", "oem"),
    ("ZIL/SUG./001  (15 XV 017)", "oem"),
    ("ZIL/SUG./001  (15 TCV 014)", "oem"),
    ("ZIL/SUG./001  (52 FCV 013)", "oem"),
    ("ZIL/SUG./001  (52 XV 036)", "oem"),
    ("ZIL/SUG./001  (52 XV 032)", "oem"),
    ("ZIL/SUG./001  (52 XV 031)", "oem"),
    ("ZIL/SUG./001  (25 TCV 029 )", "oem"),
    ("ZIL/SUG./001  (52 XV 037)", "oem"),
    ("ZIL/SUG./001  (FCV-101)", "oem"),
    ("ZIL/SUG./001  (52 XV 025)", "oem"),
    ("ZIL/SUG./001/BCV_TCV_801", "oem"),
    ("ZIL/SUG./001/BCV_PCV_802", "oem"),
    ("ZIL/SUG./001  (21TCV040B01)", "oem"),
    ("ZIL/SUG./001  (21LCV070B01)", "oem"),
]


def letters(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(s or "").lower())


def device_key(tag: str) -> str:
    t = str(tag or "").strip()
    m = re.search(r"\((.*)\)\s*$", t)
    if m:
        return letters(m.group(1))
    if "/" in t:
        return letters(t.rsplit("/", 1)[-1])
    return letters(t)


def source_tag_of(fields: dict) -> str:
    return (
        fields.get("EQUIPMENT TAG NAME/APPLICATION")
        or fields.get("EQUIPMENT NO")
        or ""
    ).strip()


def parse_specs(rows: list[list[str]]) -> list[dict]:
    out = []
    for row in rows:
        if len(row) < 6:
            continue
        lbl = str(row[4] or "").strip()
        if not lbl:
            continue
        out.append(
            {
                "section": str(row[2] or "").strip().lower() or "instrument",
                "sub_section": str(row[3] or "").strip(),
                "lbl": lbl,
                "val": "" if row[5] is None else str(row[5]),
            }
        )
    return out


def parse_schedule(rows: list[list[str]]) -> list[dict]:
    out = []
    for row in rows:
        if len(row) < 5:
            continue
        intervals = list(row[5:14])
        while len(intervals) < 9:
            intervals.append("")
        out.append(
            {
                "sr": row[2],
                "comp": row[3],
                "act": row[4],
                "Daily": intervals[0],
                "Weekly": intervals[1],
                "Monthly": intervals[2],
                "Quarterly": intervals[3],
                "Half - Yearly": intervals[4],
                "Yearly": intervals[5],
                "2 - Years": intervals[6],
                "3 - Years": intervals[7],
                "4 - Years": intervals[8],
            }
        )
    return out


def parse_history(rows: list[list[str]]) -> list[dict]:
    out = []
    for row in rows:
        if len(row) < 8:
            continue
        out.append(
            {
                "season": row[2],
                "year": row[3],
                "date_start": row[4],
                "date_finish": row[5],
                "obs": row[6],
                "act": row[7],
                "cost": row[8] if len(row) > 8 else "",
                "svc": row[9] if len(row) > 9 else "",
                "resp": row[10] if len(row) > 10 else "",
                "rem": row[11] if len(row) > 11 else "",
            }
        )
    return out


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"Source workbook not found: {SOURCE}")

    wb = openpyxl.load_workbook(SOURCE, data_only=True)
    by_device: dict[str, list[dict]] = {}

    for sheet in SHEETS:
        if sheet not in wb.sheetnames:
            print(f"WARN missing sheet: {sheet}")
            continue
        ws = wb[sheet]
        for block in find_equipment_subcards(ws):
            fields = extract_life_fields(ws, block)
            tag = source_tag_of(fields)
            if not tag:
                continue
            specs = parse_specs(extract_specification_rows(ws, block, "tmp", sheet))
            schedule = parse_schedule(extract_maintenance_schedule(ws, block, "tmp", sheet))
            history = parse_history(extract_maintenance_history(ws, block, "tmp", sheet))
            rec = {
                "source_tag": tag,
                "name": (fields.get("NAME OF EQUIPMENT") or "").strip(),
                "location": (fields.get("LOCATION") or "").strip(),
                "commissioned": (fields.get("DATE OF COMMISSIONING") or "").strip(),
                "sheet": sheet,
                "specs": specs,
                "schedule": schedule,
                "history": history,
            }
            by_device.setdefault(device_key(tag), []).append(rec)

    results = []
    missing = []
    for user_tag, mode in TAGS:
        key = device_key(user_tag)
        candidates = list(by_device.get(key, []))
        if key == "fcv101":
            preferred = [
                c
                for c in candidates
                if "fcv-101" in c["source_tag"].lower()
                or "ground floor" in c["sheet"].lower()
            ]
            if preferred:
                candidates = preferred
        if not candidates:
            missing.append(user_tag)
            continue
        candidates.sort(key=lambda c: len(c["schedule"]), reverse=True)
        best = candidates[0]
        entry = {
            "user_tag": user_tag,
            "mode": mode,
            "source_tag": best["source_tag"],
            "name": best["name"],
            "location": best["location"],
            "commissioned": best["commissioned"],
            "sheet": best["sheet"],
            "specs": best["specs"] if mode == "full" else [],
            "schedule": best["schedule"],
            "history": best["history"] if mode == "full" else [],
            "specs_count": len(best["specs"]) if mode == "full" else 0,
            "schedule_count": len(best["schedule"]),
            "history_count": len(best["history"]) if mode == "full" else 0,
        }
        results.append(entry)
        print(
            f"OK\t{user_tag}\tmode={mode}\tsheet={best['sheet']}\t"
            f"specs={entry['specs_count']}\tsched={entry['schedule_count']}\thist={entry['history_count']}"
        )

    OUT.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nwrote {OUT}")
    print(f"extracted={len(results)} missing={len(missing)}")
    if missing:
        for t in missing:
            print(f"MISSING\t{t}")
        raise SystemExit(1)
    if any(r["schedule_count"] <= 0 for r in results):
        empty = [r["user_tag"] for r in results if r["schedule_count"] <= 0]
        print("EMPTY_SCHEDULE", empty)
        raise SystemExit(2)


if __name__ == "__main__":
    main()
