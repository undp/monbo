from fastapi import APIRouter
from pydantic import BaseModel

from app.modules.layers.store import get_layers_root

router = APIRouter()


class CountryData(BaseModel):
    code: str


@router.get("", response_model=list[CountryData])
def get_countries():
    """
    The countries a visitor can analyze: enabled in the country registry and with
    at least one enabled layer, sorted by ISO 3166-1 alpha-2 code. With the legacy
    flat layout, the countries listed by the enabled layers.
    """
    return [CountryData(code=code) for code in get_layers_root().public_countries()]
