"""Tag matching helpers for sugar-house equipment extraction."""

from __future__ import annotations

import re

from equipment_history_extract_lib import cell_text


def norm_tag(value) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip()).upper()


def compact_tag(value) -> str:
    return re.sub(r"\s+", "", norm_tag(value))


def tags_match(allowed_tag: str, equipment_tag: str) -> bool:
    """Return True when equipment_tag corresponds to allowed_tag."""
    p = norm_tag(allowed_tag)
    t = norm_tag(equipment_tag)
    if not p or not t:
        return False
    if p == t:
        return True
    if t.startswith(f"{p} ") or t.startswith(f"{p}("):
        return True
    if compact_tag(allowed_tag) == compact_tag(equipment_tag):
        return True
    if p.startswith(f"{t} ") or p.startswith(f"{t}("):
        return True
    return False


def matches_any_filter(equipment_tag: str, filter_tags: set[str]) -> bool:
    return any(tags_match(allowed, equipment_tag) for allowed in filter_tags)


def load_tag_filter(path) -> set[str]:
    lines = path.read_text(encoding="utf-8").splitlines()
    tags = {line.strip() for line in lines if line.strip() and not line.strip().startswith("#")}
    if not tags:
        raise ValueError(f"No tags found in {path}")
    return tags
