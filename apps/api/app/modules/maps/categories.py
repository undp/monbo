from typing import Annotated

from fastapi import APIRouter, HTTPException, Query

from app.models.categories import LayerCategory
from app.models.maps import COUNTRY_CODE_PATTERN
from app.modules.layers.store import get_layers_root
from app.modules.maps.helpers import to_public_category

router = APIRouter()


@router.get("", response_model=list[LayerCategory])
def get_categories(
    country: Annotated[str, Query(pattern=COUNTRY_CODE_PATTERN)],
):
    """
    A country's enabled layer categories: the built-in "deforestation" first (unless
    the country stores its own), then the country's in the order it keeps them.
    Texts come in every language. `thresholdPercentage` is already resolved (the
    category's own, or the global threshold). An unknown or disabled country gets an
    empty list. Categories that fail validation are left out, and so are their
    layers in `GET /maps`.
    """
    categories = get_layers_root().country_categories(country)
    if categories is None:
        raise HTTPException(status_code=500, detail="Failed to read map data")
    return [to_public_category(category) for category in categories]
