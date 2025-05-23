import os

from dotenv import load_dotenv

# Optional: load .env manually (mainly useful for local dev outside Docker)
load_dotenv()

GCP_MAPS_PLATFORM_API_KEY = os.getenv("GCP_MAPS_PLATFORM_API_KEY")

GCP_MAPS_PLATFORM_SIGNATURE_SECRET = os.getenv("GCP_MAPS_PLATFORM_SIGNATURE_SECRET")

# Overlap threshold %, between 0 and 100. Ensure the same value at frontend.
raw_overlap_threshold_percentage = os.getenv("OVERLAP_THRESHOLD_PERCENTAGE")
if raw_overlap_threshold_percentage is not None:
    try:
        threshold = float(raw_overlap_threshold_percentage)
        if not 0 <= threshold <= 100:
            raise ValueError(
                f"OVERLAP_THRESHOLD_PERCENTAGE must be between 0 and 100, "
                f"got {threshold}"
            )
        OVERLAP_THRESHOLD_PERCENTAGE = threshold
    except ValueError as e:
        if "must be between" not in str(e):
            raise ValueError(
                f"OVERLAP_THRESHOLD_PERCENTAGE must be a valid number, "
                f"got '{raw_overlap_threshold_percentage}'"
            )
        raise
else:
    OVERLAP_THRESHOLD_PERCENTAGE = 0
