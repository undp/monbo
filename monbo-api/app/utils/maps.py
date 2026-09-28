from app.modules.layers.store import get_layer_store


def read_attributes(filename: str, language: str) -> dict | None:
    return get_layer_store().read_attributes(filename, language)


def read_considerations(filename: str, language: str) -> str | None:
    return get_layer_store().read_considerations(filename, language)


def get_map_raster_path(raster_filename: str) -> str:
    filepath = get_layer_store().raster_path(raster_filename)
    if not filepath.exists():
        raise FileNotFoundError(f"Raster file not found at '{filepath}'")
    return str(filepath)
