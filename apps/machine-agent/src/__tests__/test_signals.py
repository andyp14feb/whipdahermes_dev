from parse.signals import compute_diff_pct, compute_stable_counter


def test_compute_diff_pct_identical_text():
    assert compute_diff_pct("hello world", "hello world") == 0.0


def test_compute_diff_pct_fully_different_text():
    assert compute_diff_pct("abc", "xyz") == 100.0


def test_compute_diff_pct_empty_strings():
    assert compute_diff_pct("", "") == 0.0


def test_compute_stable_counter_increments_when_diff_below_threshold():
    assert compute_stable_counter(5, 0.0) == 6
    assert compute_stable_counter(2, 1.0) == 3


def test_compute_stable_counter_resets_when_diff_above_threshold():
    assert compute_stable_counter(5, 1.1) == 0
