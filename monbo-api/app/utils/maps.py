from app.modules.layers.store import get_layers_root

# `layer` is an entry from `app.modules.maps.helpers.get_all_maps`: its `country`
# says which folder holds its files.


def read_attributes(layer: dict, language: str) -> dict | None:
    store = get_layers_root().store_for(layer)
    return store.read_attributes(layer["attributes_filename"], language)


def read_considerations(layer: dict, language: str) -> str | None:
    store = get_layers_root().store_for(layer)
    return store.read_considerations(layer["considerations_filename"], language)


def get_map_raster_path(layer: dict) -> str:
    raster_filename = layer.get("raster_filename")
    if not raster_filename:
        raise FileNotFoundError(f"Layer {layer['id']} has no raster")
    filepath = get_layers_root().store_for(layer).raster_path(raster_filename)
    if not filepath.exists():
        raise FileNotFoundError(f"Raster file not found at '{filepath}'")
    return str(filepath)
