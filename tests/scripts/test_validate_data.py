from scripts import validate_data


def test_read_rows_parses_quoted_fields():
    rows = validate_data.read_rows('a,b\n"x, y",z\n')
    assert rows == [["a", "b"], ["x, y", "z"]]


def test_validate_flags_missing_files(tmp_path, monkeypatch):
    monkeypatch.setattr(validate_data, "RAW_DIR", tmp_path)
    problems = validate_data.validate()
    assert any("events.csv: file is missing" in p for p in problems)
