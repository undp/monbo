from app.utils.farms import parse_base_information
from app.models.farms import PreProcessedFarmData, FarmData


def generate_farms(preprocessed_farms: list[PreProcessedFarmData]) -> list[FarmData]:
    return [parse_base_information(farm) for farm in preprocessed_farms]
