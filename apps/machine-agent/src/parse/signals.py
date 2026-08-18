from __future__ import annotations

from difflib import SequenceMatcher


def compute_diff_pct(old_text: str, new_text: str) -> float:
    """Compute the percentage difference between two text strings.

    Uses SequenceMatcher similarity ratio.
    Returns 0.0 when both inputs are empty.
    Formula: diff_pct = (1.0 - similarity_ratio) * 100
    """
    if not old_text and not new_text:
        return 0.0
    ratio = SequenceMatcher(None, old_text, new_text).ratio()
    return (1.0 - ratio) * 100


def compute_stable_counter(old_counter: int, diff_pct: float, threshold: float = 1.0) -> int:
    """Compute the stable counter based on diff percentage.

    If diff_pct <= threshold, increment the counter.
    Otherwise, reset to 0.
    """
    if diff_pct <= threshold:
        return old_counter + 1
    return 0
