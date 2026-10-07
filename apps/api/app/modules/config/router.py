from fastapi import APIRouter
from pydantic import BaseModel

from app.config import env

router = APIRouter()


class ConfigData(BaseModel):
    overlapThresholdPercentage: float
    deforestationThresholdPercentage: float


@router.get("", response_model=ConfigData)
def get_config():
    """
    Product settings the frontend needs, owned by the API's environment so there is a
    single place to set them. The frontend loads them once at startup.
    """
    return ConfigData(
        overlapThresholdPercentage=env.OVERLAP_THRESHOLD_PERCENTAGE,
        deforestationThresholdPercentage=env.DEFORESTATION_THRESHOLD_PERCENTAGE,
    )
