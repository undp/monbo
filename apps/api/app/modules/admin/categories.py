"""Category administration: list, create, edit and enable/disable a country's layer
categories.

Every route acts on the country of the admin session: another country's category
answers 404, like an unknown one. Categories are never deleted and ids are never
reused, because layers and saved results refer to them by id.

No action may change the meaning of a published layer in place: a category with
published layers can't be disabled nor change its polarity, and one with any layer
can't change `temporal` (its layers' years would stop matching). The admin hides the
layers first. Writes go through `LayerStore.put_category`, which keeps every other
entry of the file as stored, so a rejected entry can be repaired with `PUT` and is
never silently dropped.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path

from app.models.categories import LocalizedText, ResultLabels
from app.modules.layers.categories import CATEGORY_ID_PATTERN, DEFAULT_CATEGORY_ID
from app.modules.layers.store import CategoriesUnreadable, LayerStore

from .auth import Session, logger, require_admin
from .helpers import (
    CountryCategories,
    country_store,
    describe_ids,
    index_or_500,
    layers_in,
    published_ids,
    read_country_categories,
)
from .models import (
    AdminCategories,
    AdminCategory,
    CategoryCreate,
    CategoryInput,
    EnabledInput,
)

router = APIRouter()

CategoryId = Annotated[str, Path(pattern=CATEGORY_ID_PATTERN)]


def _to_admin_category(category: dict, index: list[dict]) -> AdminCategory:
    layers = layers_in(index, category["id"])
    labels = category["result_labels"]
    return AdminCategory(
        id=category["id"],
        name=LocalizedText(**category["name"]),
        description=LocalizedText(**category["description"]),
        icon=category["icon"],
        color=category["color"],
        polarity=category["polarity"],
        thresholdPercentage=category["threshold_percentage"],
        resultLabels=ResultLabels(
            ok=LocalizedText(**labels["ok"]),
            flagged=LocalizedText(**labels["flagged"]),
        ),
        temporal=category["temporal"],
        enabled=category["enabled"],
        layerCount=len(layers),
        publishedLayerCount=len(published_ids(layers)),
    )


def _to_stored(category_id: str, body: CategoryInput, enabled: bool) -> dict:
    """The category as `categories.json` keeps it (snake_case)."""
    return {
        "id": category_id,
        "name": body.name.model_dump(),
        "description": body.description.model_dump(),
        "icon": body.icon,
        "color": body.color,
        "polarity": body.polarity,
        "threshold_percentage": body.thresholdPercentage,
        "result_labels": body.resultLabels.model_dump(),
        "temporal": body.temporal,
        "enabled": enabled,
    }


def _readable_categories(store: LayerStore) -> CountryCategories:
    categories = read_country_categories(store)
    if not categories.file.readable:
        raise HTTPException(
            status_code=409,
            detail=(
                "The country's categories file can't be read ("
                + "; ".join(categories.file.errors)
                + "): it must be fixed on the share before categories can be edited"
            ),
        )
    return categories


def _put(store: LayerStore, category: dict, *, first: bool) -> None:
    try:
        store.put_category(category, first=first)
    except CategoriesUnreadable as error:
        # Changed on the share between the read and the write.
        raise HTTPException(
            status_code=409,
            detail=f"{error}: it must be fixed on the share before categories can "
            "be edited",
        ) from error


def _not_found() -> HTTPException:
    return HTTPException(status_code=404, detail="Category not found")


@router.get("", response_model=AdminCategories)
def list_categories(session: Session = Depends(require_admin)):
    """
    Every category of the session's country, enabled or not, with its own threshold
    (null: the global one) and how many layers use it. `readable` and `errors`
    report the problems of the country's categories file: a rejected entry is not
    listed, and its layers show `category_issue` in `GET /admin/layers`.
    """
    store = country_store(session)
    with store.locked():
        index = index_or_500(store)
        categories = read_country_categories(store)
    return AdminCategories(
        categories=[
            _to_admin_category(category, index) for category in categories.effective
        ],
        readable=categories.file.readable,
        errors=categories.file.errors,
    )


@router.post("", response_model=AdminCategory, status_code=201)
def create_category(body: CategoryCreate, session: Session = Depends(require_admin)):
    """
    Create a category in the session's country, enabled and at the end of the
    list. Its `id` is permanent: an id the country already uses (or used, in a
    rejected entry), and `deforestation`, answer 409.
    """
    store = country_store(session)
    with store.locked():
        index = index_or_500(store)
        categories = _readable_categories(store)
        taken = (
            {category["id"] for category in categories.file.categories}
            | categories.file.invalid_ids
            | {DEFAULT_CATEGORY_ID}
        )
        if body.id in taken:
            raise HTTPException(
                status_code=409,
                detail=f"The category id '{body.id}' is already used in "
                f"{session.country}: ids are never reused",
            )
        category = _to_stored(body.id, body, enabled=True)
        _put(store, category, first=False)
    logger.info("Admin created category %s in %s", body.id, session.country)
    return _to_admin_category(category, index)


@router.put("/{category_id}", response_model=AdminCategory)
def update_category(
    category_id: CategoryId,
    body: CategoryInput,
    session: Session = Depends(require_admin),
):
    """
    Replace a category's editable fields. The id and `enabled` don't change here.
    The polarity can't change while the category has published layers, and
    `temporal` can't change while it has any layer (400). Editing the built-in
    "deforestation" stores it, first in the list. Editing a rejected entry repairs
    it, once its layers are hidden.
    """
    store = country_store(session)
    with store.locked():
        index = index_or_500(store)
        categories = _readable_categories(store)
        current = categories.by_id().get(category_id)
        layers = layers_in(index, category_id)
        published = published_ids(layers)
        if current is None:
            if category_id not in categories.file.invalid_ids:
                raise _not_found()
            # A rejected entry: its polarity and years were never readable, so its
            # layers can only come back once they are hidden.
            if published:
                raise HTTPException(
                    status_code=400,
                    detail=f"Category '{category_id}' has published layers "
                    f"({describe_ids(published)}): hide them before repairing it",
                )
        else:
            if body.polarity != current["polarity"] and published:
                raise HTTPException(
                    status_code=400,
                    detail=f"Category '{category_id}' has published layers "
                    f"({describe_ids(published)}): hide them before changing its "
                    "polarity",
                )
            if body.temporal != current["temporal"] and layers:
                raise HTTPException(
                    status_code=400,
                    detail=f"Category '{category_id}' has layers "
                    f"({describe_ids([entry['id'] for entry in layers])}): "
                    "whether it is temporal can't change",
                )
        enabled = current["enabled"] if current is not None else True
        category = _to_stored(category_id, body, enabled=enabled)
        _put(store, category, first=categories.is_synthesized(category_id))
    logger.info("Admin updated category %s in %s", category_id, session.country)
    return _to_admin_category(category, index)


@router.patch("/{category_id}", response_model=AdminCategory)
def set_category_enabled(
    category_id: CategoryId,
    body: EnabledInput,
    session: Session = Depends(require_admin),
):
    """
    Enable or disable a category. A disabled category is left out of
    `GET /categories`, and its layers out of `GET /maps`. A category with published
    layers can't be disabled (400): hide the layers first.
    """
    store = country_store(session)
    with store.locked():
        index = index_or_500(store)
        categories = _readable_categories(store)
        if category_id in categories.file.invalid_ids:
            raise HTTPException(
                status_code=400,
                detail=f"Category '{category_id}' is invalid in the categories "
                "file: repair it with PUT first",
            )
        current = categories.by_id().get(category_id)
        if current is None:
            raise _not_found()
        published = published_ids(layers_in(index, category_id))
        if not body.enabled and current["enabled"] and published:
            raise HTTPException(
                status_code=400,
                detail=f"Category '{category_id}' has published layers "
                f"({describe_ids(published)}): hide them before disabling it",
            )
        category = {**current, "enabled": body.enabled}
        if current["enabled"] != body.enabled:
            _put(store, category, first=categories.is_synthesized(category_id))
            logger.info(
                "Admin %s category %s in %s",
                "enabled" if body.enabled else "disabled",
                category_id,
                session.country,
            )
    return _to_admin_category(category, index)
