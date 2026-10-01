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
    # The layer version (raster) the results were computed against. Clients send it
    # back to /generate-image so a report never mixes results from different rasters.
    version: int
    farmResults: list[FarmDeforestation]
