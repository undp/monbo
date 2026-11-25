"""Layer administration: list, create, edit and enable/disable layers.

Every route acts on the country of the admin session: another country's layer
answers 404, like an unknown one. Ids are numbered within each country. Layers are
never deleted and ids are never reused, because saved analyses and reports refer to
layers by id. Rasters are uploaded separately (raster ingestion).

Each layer belongs to a category of its country, which decides whether it has years.
A layer is only created in, moved to or published in an enabled category that
resolves, and a published layer never changes category: its results would change
meaning in place (see `categories.py`).
"""

from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from rasterio import open as rasterio_open
from rasterio.errors import RasterioIOError

from app.modules.layers.categories import (
    LayerIssue,
    index_fields_problem,
    stored_year,
    years_fit,
)
from app.modules.layers.processing import (
    IngestionError,
    check_pixel_size,
    raster_pixel_size_range_m,
)
from app.modules.layers.store import SUPPORTED_LANGUAGES, LayerStore, is_enabled

from .auth import Session, logger, require_admin
from .helpers import (
    CountryCategories,
    country_store,
    index_or_500,
    read_country_categories,
)
from .models import AdminLayer, EnabledInput, LayerInput, StoredAttributes

router = APIRouter()


def _position(index: list[dict], layer_id: int) -> int:
    for position, entry in enumerate(index):
        if entry["id"] == layer_id:
            return position
    raise HTTPException(status_code=404, detail="Layer not found")


def _to_admin_layer(
    store: LayerStore, entry: dict, categories: CountryCategories
) -> AdminLayer:
    fields_problem = index_fields_problem(entry)
    attributes_filename = entry.get("attributes_filename")
    considerations_filename = entry.get("considerations_filename")
    attributes = {}
    considerations = {}
    for language in SUPPORTED_LANGUAGES:
        stored = (
            store.read_attributes(attributes_filename, language)
            if isinstance(attributes_filename, str)
            else None
        )
        attributes[language] = (
            StoredAttributes.model_validate(stored) if stored else None
        )
        considerations[language] = (
            store.read_considerations(considerations_filename, language)
            if isinstance(considerations_filename, str)
            else None
        )
    category, issue = categories.resolve(entry["category_id"])
    raster_filename = entry.get("raster_filename")
    if not isinstance(raster_filename, str):
        raster_filename = None
    has_raster = store.has_raster(raster_filename)
    layer_issue: LayerIssue | None = None
    if fields_problem is not None:
        layer_issue = "invalid_fields"
    elif category is not None and not years_fit(entry, category["temporal"]):
        layer_issue = "years_mismatch"
    elif not has_raster:
        layer_issue = "missing_raster"
    return AdminLayer(
        id=entry["id"],
        category_id=str(entry["category_id"]),
        category_issue=issue,
        category_enabled=bool(category and category["enabled"]),
        layer_issue=layer_issue,
        pixel_size=_shown_field(entry, "pixel_size"),
        baseline=_shown_year(entry.get("baseline")),
        compared_against=_shown_year(entry.get("compared_against")),
        references=_shown_field(entry, "references") or [],
        enabled=is_enabled(entry),
        version=_shown_field(entry, "version"),
        raster_filename=raster_filename,
        has_raster=has_raster,
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
            "category_id": body.category_id,
            "pixel_size": int(pixel_size) if pixel_size.is_integer() else pixel_size,
            # Years are stored as strings, like the rest of the index. Both keys are
            # always written, null for a layer without years: releases before
            # categories read them unconditionally.
            "baseline": _year(body.baseline),
            "compared_against": _year(body.compared_against),
            "references": body.references,
        }
    )


def _shown_year(value: object) -> int | None:
    """A stored year for the admin; null when the index holds something that isn't
    a valid year (a hand edit), which `layer_issue` then reports as
    `years_mismatch` instead of failing the whole listing."""
    try:
        return stored_year(value)
    except ValueError:
        return None


def _shown_field(entry: dict, field: str) -> Any:
    """An index field for the admin; null when its value has the wrong type (a hand
    edit), which `layer_issue` then reports as `invalid_fields`. The other fields of
    the probe are valid stand-ins, so only `field` can make it fail."""
    probe = {
        "id": 0,
        "version": 1,
        "pixel_size": 1,
        "attributes_filename": "",
        "considerations_filename": "",
        field: entry.get(field),
    }
    return entry.get(field) if index_fields_problem(probe) is None else None


def _year(year: int | None) -> str | None:
    return None if year is None else str(year)


_CATEGORY_ISSUES = {
    "unknown_category": "doesn't exist in {country}",
    "invalid_category": "is invalid in {country}'s categories file",
    "unreadable_categories": "can't be read: {country}'s categories file is broken",
}


def _check_category(
    categories: CountryCategories,
    body: LayerInput,
    country: str,
    current: dict | None = None,
) -> None:
    """400 unless `body` may put the layer (`current`, None when new) in its category:
    one that resolves and is enabled (a layer may keep its current, disabled one), not
    a move of a published layer, and with years exactly when the category is
    temporal. Checked before anything is written."""
    category_id = body.category_id
    moved = current is None or current["category_id"] != category_id
    if current is not None and moved and is_enabled(current):
        raise HTTPException(
            status_code=400,
            detail=f"Layer {current['id']} is published: hide it before moving it "
            "to another category",
        )
    category, issue = categories.resolve(category_id)
    if category is None:
        reason = _CATEGORY_ISSUES[issue or "unknown_category"]
        raise HTTPException(
            status_code=400,
            detail=f"Category '{category_id}' {reason.format(country=country)}",
        )
    if moved and not category["enabled"]:
        raise HTTPException(
            status_code=400, detail=f"Category '{category_id}' is disabled"
        )
    if category["temporal"] and body.baseline is None:
        raise HTTPException(
            status_code=400,
            detail=f"Category '{category_id}' is temporal: baseline and "
            "compared_against are required",
        )
    if not category["temporal"] and body.baseline is not None:
        raise HTTPException(
            status_code=400,
            detail=f"Category '{category_id}' is not temporal: baseline and "
            "compared_against must be null",
        )


def _check_existing_raster_pixel_size(
    store: LayerStore, entry: dict, pixel_size: float
) -> None:
    filename = entry.get("raster_filename")
    if not filename or not store.has_raster(filename):
        return
    try:
        with rasterio_open(store.raster_path(filename), driver="GTiff") as raster:
            check_pixel_size(pixel_size, raster_pixel_size_range_m(raster))
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
    store = country_store(session)
    index = index_or_500(store)
    categories = read_country_categories(store)
    addressable = [entry for entry in index if index_fields_problem(entry) != "id"]
    if len(addressable) < len(index):
        logger.error(
            "%s layer(s) of %s are left out of the admin listing: their index "
            "field 'id' is invalid",
            len(index) - len(addressable),
            session.country,
        )
    return [_to_admin_layer(store, entry, categories) for entry in addressable]


def _free_metadata_stem(store: LayerStore, index: list[dict], layer_id: int) -> str:
    """`layer-<id>`, or `layer-<id>-<n>` when another layer already uses that name
    (e.g. a layer the per-country migration renumbered keeps its old `layer-<old
    id>` files) or a file with it is left on disk: never overwrite another layer's
    metadata."""
    used = {
        Path(entry[key]).stem
        for entry in index
        for key in ("attributes_filename", "considerations_filename")
        if entry.get(key)
    }

    def taken(stem: str) -> bool:
        if stem in used:
            return True
        for language in SUPPORTED_LANGUAGES:
            for path in (
                store.attributes_path(f"{stem}.json", language),
                store.considerations_path(f"{stem}.md", language),
            ):
                if path is not None and path.exists():
                    return True
        return False

    stem, suffix = f"layer-{layer_id}", 2
    while taken(stem):
        stem, suffix = f"layer-{layer_id}-{suffix}", suffix + 1
    return stem


@router.post("", response_model=AdminLayer, status_code=201)
def create_layer(body: LayerInput, session: Session = Depends(require_admin)):
    """
    Create a layer in the session's country. It starts disabled and without a
    raster; upload one and then enable the layer to publish it. Its id is one more
    than the highest id in the country (disabled layers included), so ids are never
    reused.
    """
    store = country_store(session)
    with store.locked():
        index = index_or_500(store)
        categories = read_country_categories(store)
        _check_category(categories, body, session.country)
        layer_id = max((entry["id"] for entry in index), default=-1) + 1
        stem = _free_metadata_stem(store, index, layer_id)
        entry = {
            "id": layer_id,
            "raster_filename": None,
            "attributes_filename": f"{stem}.json",
            "considerations_filename": f"{stem}.md",
            "enabled": False,
            # No raster yet: the first upload makes it version 1 (`layer-<id>-v1.tif`).
            "version": 0,
        }
        # Metadata first: the index never points at files that don't exist yet.
        _apply_input(store, entry, body)
        store.write_index([*index, entry])
    logger.info("Admin created layer %s in %s", layer_id, session.country)
    return _to_admin_layer(store, entry, categories)


@router.put("/{layer_id}", response_model=AdminLayer)
def update_layer(
    layer_id: int, body: LayerInput, session: Session = Depends(require_admin)
):
    """
    Replace a layer's editable fields and its metadata in every language. The id,
    raster, version, enabled state and country are not changed here.
    """
    store = country_store(session)
    # Checked before taking the store lock: it may open the raster over the share,
    # and every tile and image request waits on that lock.
    current = index_or_500(store)
    checked = current[_position(current, layer_id)]
    if body.pixel_size != checked["pixel_size"]:
        _check_existing_raster_pixel_size(store, checked, body.pixel_size)
    with store.locked():
        index = index_or_500(store)
        position = _position(index, layer_id)
        categories = read_country_categories(store)
        _check_category(categories, body, session.country, index[position])
        # A new raster was activated meanwhile: check against that one instead.
        if body.pixel_size != index[position]["pixel_size"] and index[position].get(
            "raster_filename"
        ) != checked.get("raster_filename"):
            _check_existing_raster_pixel_size(store, index[position], body.pixel_size)
        _apply_input(store, index[position], body)
        store.write_index(index)
        entry = index[position]
    logger.info("Admin updated layer %s in %s", layer_id, session.country)
    return _to_admin_layer(store, entry, categories)


@router.patch("/{layer_id}", response_model=AdminLayer)
def set_layer_enabled(
    layer_id: int, body: EnabledInput, session: Session = Depends(require_admin)
):
    """
    Publish (enable) or hide (disable) a layer. A hidden layer disappears from the
    public listing but still resolves by id for analyses and tiles. A layer can
    only be enabled once it has a raster (409), and while its category resolves, is
    enabled and fits its years (400).
    """
    store = country_store(session)
    with store.locked():
        index = index_or_500(store)
        position = _position(index, layer_id)
        entry = index[position]
        categories = read_country_categories(store)
        fields_problem = index_fields_problem(entry)
        if body.enabled and fields_problem is not None:
            raise HTTPException(
                status_code=400,
                detail=f"Layer {layer_id} can't be published: its index field "
                f"'{fields_problem}' is invalid",
            )
        if body.enabled and not store.has_raster(entry.get("raster_filename")):
            raise HTTPException(
                status_code=409, detail="Upload a raster before enabling the layer"
            )
        if body.enabled and not is_enabled(entry):
            category, issue = categories.resolve(entry["category_id"])
            if category is None or not category["enabled"]:
                reason = (
                    "is disabled"
                    if category is not None
                    else _CATEGORY_ISSUES[issue or "unknown_category"].format(
                        country=session.country
                    )
                )
                raise HTTPException(
                    status_code=400,
                    detail=f"Layer {layer_id} can't be published: its category "
                    f"'{entry['category_id']}' {reason}",
                )
            # Also covers layers whose category was repaired or edited by hand.
            if not years_fit(entry, category["temporal"]):
                raise HTTPException(
                    status_code=400,
                    detail=f"Layer {layer_id} can't be published: its years don't "
                    f"fit category '{entry['category_id']}' (edit the layer first)",
                )
        # A hand-edited non-boolean (`"false"`) is rewritten as a boolean.
        if entry["enabled"] is not body.enabled:
            entry["enabled"] = body.enabled
            store.write_index(index)
            logger.info(
                "Admin %s layer %s in %s",
                "enabled" if body.enabled else "disabled",
                layer_id,
                session.country,
            )
    return _to_admin_layer(store, entry, categories)
