"""Tag matching helpers for sugar-house equipment extraction."""

from __future__ import annotations

import re

from equipment_history_extract_lib import cell_text


def norm_tag(value) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip()).upper()


def compact_tag(value) -> str:
    return re.sub(r"\s+", "", norm_tag(value))


def canonical_tag(value) -> str:
    """Canonicalize sugar-house equipment tags so:
    1. '(01)', '( 01)', '(01 )' and whitespace variations inside/around parentheses are identical.
    2. '022' vs '22' and '(01)' vs '(1)' zero-padding variations are identical.
    3. 'CV-1' vs 'CV1' hyphen variations in codes are identical.
    4. 'ZIL/SUG./001/DECANTER-2/CV-1' vs 'ZIL/SUG./DECANTER-2/CV-1' optional /001 section prefix are identical.
    """
    s = str(value or "").strip().upper()
    s = re.sub(r"\s+", "", s)
    s = re.sub(r"SUG\.", "SUG", s)
    s = re.sub(r"SUG/0*1/", "SUG/", s)
    s = re.sub(r"(/SUG/)+0*(\d+)", r"\1\2", s)
    s = re.sub(r"\(0*(\d+)\)", r"(\1)", s)
    s = re.sub(r"-", "", s)
    return s


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
    if canonical_tag(allowed_tag) == canonical_tag(equipment_tag):
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
