from app.utils.json import read_json_file


def read_attributes(filename: str, language: str) -> dict | None:
    filepath = f"app/maps/metadata/attributes/{language}/{filename}"
    content = read_json_file(filepath)
    if content is None:
        print(f"Cannot read Attributes file at '{filepath}'")
        return None
    return content


def read_considerations(filename: str, language: str) -> str | None:
    filepath = f"app/maps/metadata/considerations/{language}/{filename}"
    try:
        with open(filepath, "r") as f:
            return f.read().strip()
    except Exception as e:
        print(f"Cannot read Considerations file at '{filepath}': {e}")
        return None
