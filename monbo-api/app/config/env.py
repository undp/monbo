import os

from dotenv import load_dotenv

# Optional: load .env manually (mainly useful for local dev outside Docker)
load_dotenv()

GOOGLE_SERVICE_API_KEY = os.getenv("GOOGLE_SERVICE_API_KEY")

raw_overlap_threshold_percentage = os.getenv("OVERLAP_THRESHOLD_PERCENTAGE")
OVERLAP_THRESHOLD_PERCENTAGE = (
    float(raw_overlap_threshold_percentage) if raw_overlap_threshold_percentage else 0
)
