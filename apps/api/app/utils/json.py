import json


def read_json_file(file_path: str) -> dict | list[dict] | None:
    """Reads a JSON file and returns its content. Returns None if an error occurs."""
    try:
        with open(file_path, "r", encoding="utf-8") as file:
            return json.load(file)
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return None
