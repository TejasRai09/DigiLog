"""Parse CREATE TABLE definitions from MySQL dump SQL for documentation."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SQL = ROOT / "backend" / "backup_before_reconcile.sql"

# Tables to skip in application docs (Prisma internal)
SKIP_TABLES = {"_prisma_migrations"}

TABLE_DOMAIN = {
    "users": "System",
    "apps": "System",
    "forms": "System",
    "mappings": "System",
    "mapping_forms": "System",
    "portal_settings": "System",
    "user_homepage_cards": "System",
    "user_data_upload_access": "System",
    "data_upload_files": "System",
    "mill_logbook1": "Mill Logbook",
    "mill_logbook2": "Mill Logbook",
    "mill_logbook3": "Mill Logbook",
    "mill_stoppages": "Mill Logbook",
    "ds_logbook": "Lab Logbook",
    "rs_logbook": "Lab Logbook",
    "ops_logbook": "Lab Logbook",
    "sa_logbook": "Lab Logbook",
    "syrp_logbook": "Lab Logbook",
    "stoppage_logbook": "Lab Logbook",
    "ph_power": "Power Logbook",
    "ph_steam": "Power Logbook",
    "ph_stoppage": "Power Logbook",
    "pp_equipment": "Power Equipment (Legacy)",
    "pp_specs": "Power Equipment (Legacy)",
    "pp_oem_schedule": "Power Equipment (Legacy)",
    "pp_history": "Power Equipment (Legacy)",
    "ppn_equipment": "Power Equipment (New)",
    "ppn_specs": "Power Equipment (New)",
    "ppn_oem_schedule": "Power Equipment (New)",
    "ppn_history": "Power Equipment (New)",
    "ppn_hierarchy_node": "Power Equipment (New)",
    "mh_equipment": "Mill House Equipment",
    "mh_specs": "Mill House Equipment",
    "mh_oem_schedule": "Mill House Equipment",
    "mh_history": "Mill House Equipment",
    "distillery_operations": "Distillery",
    "ehs_near_miss": "EHS",
    "ehs_accident": "EHS",
    "ehs_water_gwa": "EHS",
    "ehs_water_etp": "EHS",
    "ehs_water_cpu": "EHS",
    "prod_shift_chemist": "Production",
    "prod_centrifugal": "Production",
    "prod_pan_logbook": "Production",
    "prod_decanter": "Production",
    "prod_clarification": "Production",
    "data_mill_mapping": "BI Reference",
    "data_shredder_mapping": "BI Reference",
    "data_lube_mapping": "BI Reference",
}


@dataclass
class ColumnDef:
    name: str
    data_type: str
    nullable: str
    default: str
    extra: str


@dataclass
class TableSchema:
    name: str
    domain: str
    columns: list[ColumnDef] = field(default_factory=list)
    primary_key: list[str] = field(default_factory=list)
    unique_keys: list[str] = field(default_factory=list)
    indexes: list[str] = field(default_factory=list)
    foreign_keys: list[str] = field(default_factory=list)
    constraints: list[str] = field(default_factory=list)
    engine: str = ""
    charset: str = ""


def _split_create_body(body: str) -> list[str]:
    """Split CREATE TABLE body on commas at paren depth 0."""
    parts: list[str] = []
    depth = 0
    start = 0
    for i, ch in enumerate(body):
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        elif ch == "," and depth == 0:
            parts.append(body[start:i].strip())
            start = i + 1
    parts.append(body[start:].strip())
    return parts


def _parse_column(line: str) -> ColumnDef | None:
    m = re.match(r"`([^`]+)`\s+(.+)", line, re.DOTALL)
    if not m:
        return None
    name = m.group(1)
    rest = m.group(2).strip()

    nullable = "YES"
    if " NOT NULL" in rest.upper():
        nullable = "NO"

    default = ""
    dm = re.search(r"\bDEFAULT\s+((?:CURRENT_TIMESTAMP(?:\(\d?\))?|NULL|'[^']*'|\d+(?:\.\d+)?))", rest, re.I)
    if dm:
        default = dm.group(1)

    extra_parts = []
    upper = rest.upper()
    if "AUTO_INCREMENT" in upper:
        extra_parts.append("AUTO_INCREMENT")
    if "ON UPDATE CURRENT_TIMESTAMP" in upper:
        extra_parts.append("ON UPDATE CURRENT_TIMESTAMP")
    if "GENERATED" in upper:
        gm = re.search(r"(GENERATED\s+ALWAYS\s+AS\s+\(.+?\)\s+STORED)", rest, re.I | re.DOTALL)
        if gm:
            extra_parts.append(gm.group(1).replace("\n", " "))

    # Strip trailing constraint fragments from data_type display
    data_type = rest
    for token in (" NOT NULL", " NULL", " DEFAULT ", " AUTO_INCREMENT", " ON UPDATE "):
        idx = data_type.upper().find(token.strip().upper())
        if idx > 0 and token.strip().upper() == "DEFAULT":
            data_type = data_type[:idx].strip()
            break
        if idx > 0 and token != " DEFAULT ":
            data_type = data_type[:idx].strip()
    if "GENERATED" in data_type.upper():
        data_type = re.sub(r"\s*GENERATED\s+ALWAYS.*", "", data_type, flags=re.I).strip()

    return ColumnDef(
        name=name,
        data_type=data_type,
        nullable=nullable,
        default=default,
        extra=", ".join(extra_parts),
    )


def parse_sql_file(sql_path: Path = DEFAULT_SQL) -> list[TableSchema]:
    text = sql_path.read_text(encoding="utf-8", errors="replace")
    pattern = re.compile(
        r"CREATE TABLE `([^`]+)`\s*\((.*?)\)\s*ENGINE=(\w+)[^;]*?(?:DEFAULT CHARSET=(\w+))?",
        re.DOTALL | re.IGNORECASE,
    )
    tables: list[TableSchema] = []
    for match in pattern.finditer(text):
        name = match.group(1)
        if name in SKIP_TABLES:
            continue
        body = match.group(2)
        engine = match.group(3) or ""
        charset = match.group(4) or ""

        schema = TableSchema(
            name=name,
            domain=TABLE_DOMAIN.get(name, "Other"),
            engine=engine,
            charset=charset,
        )

        for part in _split_create_body(body):
            stripped = part.strip()
            if not stripped:
                continue
            upper = stripped.upper()
            if upper.startswith("PRIMARY KEY"):
                cols = re.findall(r"`([^`]+)`", stripped)
                schema.primary_key = cols
            elif upper.startswith("UNIQUE KEY") or upper.startswith("UNIQUE INDEX"):
                schema.unique_keys.append(re.sub(r"\s+", " ", stripped))
            elif upper.startswith("KEY ") or upper.startswith("INDEX "):
                schema.indexes.append(re.sub(r"\s+", " ", stripped))
            elif upper.startswith("CONSTRAINT") or upper.startswith("FOREIGN KEY"):
                schema.foreign_keys.append(re.sub(r"\s+", " ", stripped))
            elif upper.startswith("CHECK "):
                schema.constraints.append(re.sub(r"\s+", " ", stripped))
            else:
                col = _parse_column(stripped)
                if col:
                    schema.columns.append(col)

        tables.append(schema)

    # Stable sort: domain then name
    domain_order = list(dict.fromkeys(TABLE_DOMAIN.values()))
    tables.sort(key=lambda t: (domain_order.index(t.domain) if t.domain in domain_order else 99, t.name))
    return tables


def column_rows(schema: TableSchema) -> list[list[str]]:
    rows = []
    for c in schema.columns:
        rows.append([c.name, c.data_type, c.nullable, c.default or "-", c.extra or "-"])
    return rows


if __name__ == "__main__":
    schemas = parse_sql_file()
    print(f"Parsed {len(schemas)} tables from {DEFAULT_SQL.name}")
    for s in schemas[:3]:
        print(f"  {s.name}: {len(s.columns)} columns, PK={s.primary_key}")
