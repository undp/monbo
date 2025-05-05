from app.models.farms import FarmPolygonDetailData, InputFarmData
from pydantic import BaseModel


class DeforestationUnprocessedFarmData(InputFarmData):
    pass


class AnalizeBody(BaseModel):
    maps: list[int]
    farms: list[FarmPolygonDetailData]


class FarmDeforestation(BaseModel):
    farmId: str
    value: float | None


class MapData(BaseModel):
    mapId: int
    farmResults: list[FarmDeforestation]
