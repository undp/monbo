import os

from dotenv import load_dotenv

# Optional: load .env manually (mainly useful for local dev outside Docker)
load_dotenv()

GCP_MAPS_PLATFORM_API_KEY = os.getenv("GCP_MAPS_PLATFORM_API_KEY")

GCP_MAPS_PLATFORM_SIGNATURE_SECRET = os.getenv("GCP_MAPS_PLATFORM_SIGNATURE_SECRET")

# Root directory holding the layers: per-country folders and their registry, or the
# legacy flat index. Relative paths are resolved from the working directory, as
# before (the default is the Git-tracked copy, in the flat layout). In Azure this
# points at the per-country layout on the mounted Azure Files share (/mnt/maps).
MAPS_ROOT = os.getenv("MAPS_ROOT") or "app/maps"


def _percentage(name: str) -> float:
    """A percentage setting between 0 and 100; unset or empty means 0."""
    raw = os.getenv(name)
    if raw is None or raw == "":
        return 0
    try:
        value = float(raw)
    except ValueError:
        raise ValueError(f"{name} must be a valid number, got '{raw}'")
    if not 0 <= value <= 100:
        raise ValueError(f"{name} must be between 0 and 100, got {value}")
    return value


# Product thresholds. The API owns them and publishes both at GET /config, which the
# frontend reads at startup; the frontend has no copy of its own.
# Overlaps above this percentage are reported by polygon validation.
OVERLAP_THRESHOLD_PERCENTAGE = _percentage("OVERLAP_THRESHOLD_PERCENTAGE")
# Deforestation above this percentage is flagged by the frontend (labels, colours,
# exports, the report).
DEFORESTATION_THRESHOLD_PERCENTAGE = _percentage("DEFORESTATION_THRESHOLD_PERCENTAGE")


def _positive_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or raw == "":
        return default
    try:
        value = int(raw)
    except ValueError:
        raise ValueError(f"{name} must be a whole number, got '{raw}'")
    if value <= 0:
        raise ValueError(f"{name} must be greater than 0, got {value}")
    return value


# Layers admin. It is enabled when the session secret is set and MAPS_ROOT uses the
# per-country layout; each country's passkey hash lives in its country registry
# (`uv run python -m app.modules.admin.countries`).
# The single passkey hash of earlier releases is no longer used; only its presence is
# read, to warn that it is ignored.
LEGACY_ADMIN_PASSKEY_HASH_SET = bool(os.getenv("ADMIN_PASSKEY_HASH"))

# Key that signs admin session tokens. Changing it signs every admin out.
ADMIN_SESSION_SECRET = os.getenv("ADMIN_SESSION_SECRET") or None
if ADMIN_SESSION_SECRET is not None and len(ADMIN_SESSION_SECRET.encode()) < 32:
    raise ValueError("ADMIN_SESSION_SECRET must be at least 32 bytes long")

ADMIN_SESSION_TTL_MINUTES = _positive_int("ADMIN_SESSION_TTL_MINUTES", 60)

# Frontend origin allowed to call the admin routes (e.g. https://monbo.example.org).
# Unset means no Origin check.
ADMIN_ALLOWED_ORIGIN = (os.getenv("ADMIN_ALLOWED_ORIGIN") or "").rstrip("/") or None

ADMIN_MAX_UPLOAD_MB = _positive_int("ADMIN_MAX_UPLOAD_MB", 500)

# Local (container) directory where raster uploads are staged and processed.
ADMIN_STAGING_DIR = os.getenv("ADMIN_STAGING_DIR") or "/tmp/monbo-staging"
