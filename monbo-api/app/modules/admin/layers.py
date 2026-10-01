"""Layer administration: list, create, edit and enable/disable layers.

Every route acts on the country of the admin session: another country's layer
answers 404, like an unknown one. Ids are numbered within each country. Layers are
never deleted and ids are never reused, because saved analyses and reports refer to
layers by id. Rasters are uploaded separately (raster ingestion).
"""

from fastapi import APIRouter, Depends, HTTPException
from rasterio import open as rasterio_open
from rasterio.errors import RasterioIOError

from app.modules.layers.processing import (
    IngestionError,
    check_pixel_size,
    raster_pixel_size_m,
)
from app.modules.layers.store import SUPPORTED_LANGUAGES, LayerStore, get_layers_root

from .auth import Session, logger, require_admin
from .models import AdminLayer, EnabledInput, LayerInput, StoredAttributes

router = APIRouter()


def _index_or_500(store: LayerStore) -> list[dict]:
    index = store.read_index()
    if index is None:
        raise HTTPException(status_code=500, detail="Failed to read map data")
    return index


def _position(index: list[dict], layer_id: int) -> int:
    for position, entry in enumerate(index):
        if entry["id"] == layer_id:
            return position
    raise HTTPException(status_code=404, detail="Layer not found")


def _year(value) -> int | None:
    return int(value) if value not in (None, "") else None


def _to_admin_layer(store: LayerStore, entry: dict) -> AdminLayer:
    attributes = {}
    considerations = {}
    for language in SUPPORTED_LANGUAGES:
        stored = store.read_attributes(entry["attributes_filename"], language)
        attributes[language] = (
            StoredAttributes.model_validate(stored) if stored else None
        )
        considerations[language] = store.read_considerations(
            entry["considerations_filename"], language
        )
    return AdminLayer(
        id=entry["id"],
        pixel_size=entry["pixel_size"],
        baseline=_year(entry.get("baseline")),
        compared_against=_year(entry.get("compared_against")),
        references=entry.get("references", []),
        enabled=entry["enabled"],
        version=entry["version"],
        raster_filename=entry.get("raster_filename"),
        has_raster=store.has_raster(entry.get("raster_filename")),
        attributes=attributes,
        considerations=considerations,
    )


def _apply_input(store: LayerStore, entry: dict, body: LayerInput) -> None:
    """Write the metadata files, then update the editable index fields in `entry`."""
    for language in SUPPORTED_LANGUAGES:
        attributes = getattr(body.attributes, language)
        store.write_attributes(
            entry["attributes_filename"],
            language,
            attributes.model_dump(exclude_none=True),
        )
        store.write_considerations(
            entry["considerations_filename"],
            language,
            getattr(body.considerations, language),
        )
    pixel_size = body.pixel_size
    entry.update(
        {
            "pixel_size": int(pixel_size) if pixel_size.is_integer() else pixel_size,
            # Years are stored as strings, like the rest of the index.
            "baseline": str(body.baseline),
            "compared_against": str(body.compared_against),
            "references": body.references,
        }
    )


def _country_store(session: Session) -> LayerStore:
    return get_layers_root().country_store(session.country)


def _check_existing_raster_pixel_size(
    store: LayerStore, entry: dict, pixel_size: float
) -> None:
    filename = entry.get("raster_filename")
    if not filename or not store.has_raster(filename):
        return
    try:
        with rasterio_open(store.raster_path(filename)) as raster:
            check_pixel_size(pixel_size, raster_pixel_size_m(raster))
    except IngestionError as error:
        raise HTTPException(status_code=409, detail=error.as_issue()) from error
    except RasterioIOError as error:
        raise HTTPException(
            status_code=409, detail="Layer raster is unreadable"
        ) from error


@router.get("", response_model=list[AdminLayer])
def list_layers(session: Session = Depends(require_admin)):
    """Every layer of the session's country, enabled or not, with its metadata in
    every language."""
    store = _country_store(session)
    return [_to_admin_layer(store, entry) for entry in _index_or_500(store)]


@router.post("", response_model=AdminLayer, status_code=201)
def create_layer(body: LayerInput, session: Session = Depends(require_admin)):
    """
    Create a layer in the session's country. It starts disabled and without a
    raster; upload one and then enable the layer to publish it. Its id is one more
    than the highest id in the country (disabled layers included), so ids are never
    reused.
    """
    store = _country_store(session)
    with store.locked():
        index = _index_or_500(store)
        layer_id = max((entry["id"] for entry in index), default=-1) + 1
        entry = {
            "id": layer_id,
            "raster_filename": None,
            "attributes_filename": f"layer-{layer_id}.json",
            "considerations_filename": f"layer-{layer_id}.md",
            "enabled": False,
            # No raster yet: the first upload makes it version 1 (`layer-<id>-v1.tif`).
            "version": 0,
        }
        # Metadata first: the index never points at files that don't exist yet.
        _apply_input(store, entry, body)
        store.write_index([*index, entry])
    logger.info("Admin created layer %s in %s", layer_id, session.country)
    return _to_admin_layer(store, entry)


@router.put("/{layer_id}", response_model=AdminLayer)
def update_layer(
    layer_id: int, body: LayerInput, session: Session = Depends(require_admin)
):
    """
    Replace a layer's editable fields and its metadata in every language. The id,
    raster, version, enabled state and country are not changed here.
    """
    store = _country_store(session)
    with store.locked():
        index = _index_or_500(store)
        position = _position(index, layer_id)
        if body.pixel_size != index[position]["pixel_size"]:
            _check_existing_raster_pixel_size(store, index[position], body.pixel_size)
        _apply_input(store, index[position], body)
        store.write_index(index)
        entry = index[position]
    logger.info("Admin updated layer %s in %s", layer_id, session.country)
    return _to_admin_layer(store, entry)


@router.patch("/{layer_id}", response_model=AdminLayer)
def set_layer_enabled(
    layer_id: int, body: EnabledInput, session: Session = Depends(require_admin)
):
    """
    Publish (enable) or hide (disable) a layer. A hidden layer disappears from the
    public listing but still resolves by id for analyses and tiles. A layer can
    only be enabled once it has a raster.
    """
    store = _country_store(session)
    with store.locked():
        index = _index_or_500(store)
        position = _position(index, layer_id)
        entry = index[position]
        if body.enabled and not store.has_raster(entry.get("raster_filename")):
            raise HTTPException(
                status_code=409, detail="Upload a raster before enabling the layer"
            )
        if entry["enabled"] != body.enabled:
            entry["enabled"] = body.enabled
            store.write_index(index)
            logger.info(
                "Admin %s layer %s in %s",
                "enabled" if body.enabled else "disabled",
                layer_id,
                session.country,
            )
    return _to_admin_layer(store, entry)
