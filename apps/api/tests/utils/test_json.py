from app.utils.json import read_json_file


def test_read_json_file(tmp_path):
    valid_json = tmp_path / "valid.json"
    invalid_json = tmp_path / "invalid.json"
    non_existent_json = tmp_path / "missing.json"

    # Create a valid JSON file
    valid_json.write_text('{"key": "value"}', encoding="utf-8")
    assert read_json_file(str(valid_json)) == {"key": "value"}

    # Create an invalid JSON file
    invalid_json.write_text("{key: value}", encoding="utf-8")
    assert read_json_file(str(invalid_json)) is None

    # Try to read a non-existent file
    assert read_json_file(str(non_existent_json)) is None
