from pydantic import BaseModel

from app.models.farms import FarmPolygonDetailData, InputFarmData


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
