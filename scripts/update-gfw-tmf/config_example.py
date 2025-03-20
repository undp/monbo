# Configuration settings for the GEE downloader
CONFIG = {
    # Required
    "PROJECT_ID": "your-project-id",  # Your Earth Engine project ID

    # List of countries to download data for.
    # IMPORTANT: Country names must match exactly with the 'country_na' field 
    # in the USDOS/LSIB_SIMPLE/2017 dataset.
    # Examples: "Ecuador", "Costa Rica", "United States", "Congo (Kinshasa)"
    # You can view the full list of country names at:
    # https://developers.google.com/earth-engine/datasets/catalog/USDOS_LSIB_SIMPLE_2017
    "COUNTRIES": ["Ecuador", "Colombia", "Costa Rica"],
    "EXECUTE_FOR": "GFW",  # 'GFW' or 'TMF'

    # Override default asset IDs if needed
    "GFW_ASSET_ID": "UMD/hansen/global_forest_change_2023_v1_11",  # Example for 2023 version
    "TMF_ASSET_ID": "projects/JRC/TMF/v1_2023/DeforestationYear"  # Example for 2023 version
}
