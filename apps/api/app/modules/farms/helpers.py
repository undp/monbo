from app.models.farms import FarmData, PreProcessedFarmData
from app.utils.farms import parse_base_information


def generate_farms(preprocessed_farms: list[PreProcessedFarmData]) -> list[FarmData]:
    return [parse_base_information(farm) for farm in preprocessed_farms]
