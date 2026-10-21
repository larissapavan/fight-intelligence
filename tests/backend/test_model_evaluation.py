import json

from backend.app.services import model_evaluation as evaluation

SAMPLE = {
    "fights": 1752, "start": "2023-06-03", "end": "2026-10-17", "accuracy": 0.6216, "roc_auc": 0.669, "log_loss": 0.7084,
    "confident_threshold": 0.9, "confident_fights": 229, "confident_hit_rate": 0.7118,
}


def test_the_note_says_what_was_measured_where_and_that_the_reported_figure_failed_to_reproduce():
    note = evaluation.metrics_note(SAMPLE, 0.7466)
    assert note.startswith("Measured on 1,752 recent fights (June 2023 to October 2026)")
    assert "reports 74.7% accuracy" in note and "could not be reproduced" in note
    assert "rated 90% or more were right 71% of the time" in note and note.endswith("Read its probabilities as rough.")


def test_without_a_check_the_note_claims_nothing_it_has_not_measured():
    note = evaluation.metrics_note(None, 0.7466)
    assert "could not be checked" in note and "recent fights" not in note and "62%" not in note
    assert evaluation.evaluation_limitations(None, 0.7466) == []


def test_the_limitations_follow_from_the_measured_numbers():
    first, second = evaluation.evaluation_limitations(SAMPLE, 0.7466)
    assert first == "The test accuracy it reports (74.7%) could not be reproduced: on 1,752 recent fights it got 62% right."
    assert second == "Its probabilities are overconfident: picks it rated 90% or more were right about 71% of the time."
    only_first = evaluation.evaluation_limitations({**SAMPLE, "confident_hit_rate": None}, 0.7466)
    assert len(only_first) == 1  # no overconfidence claim when there were no confident picks to judge


def test_a_missing_or_broken_file_means_no_evaluation(tmp_path, monkeypatch):
    monkeypatch.setattr(evaluation, "EVALUATION_PATH", tmp_path / "eval.json")
    assert evaluation.load_recent_evaluation() is None
    (tmp_path / "eval.json").write_text("{not json", encoding="utf-8")
    assert evaluation.load_recent_evaluation() is None
    (tmp_path / "eval.json").write_text(json.dumps({"fights": 10}), encoding="utf-8")
    assert evaluation.load_recent_evaluation() is None  # missing the numbers the site needs
    (tmp_path / "eval.json").write_text(json.dumps(SAMPLE), encoding="utf-8")
    assert evaluation.load_recent_evaluation() == SAMPLE


def test_the_saved_evaluation_in_the_repository_is_usable():
    saved = evaluation.load_recent_evaluation()
    assert saved is not None and saved["fights"] > 1000 and saved["start"] < saved["end"]
