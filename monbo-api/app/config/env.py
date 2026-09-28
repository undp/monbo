import os
import re

from dotenv import load_dotenv

# Optional: load .env manually (mainly useful for local dev outside Docker)
load_dotenv()

GCP_MAPS_PLATFORM_API_KEY = os.getenv("GCP_MAPS_PLATFORM_API_KEY")

GCP_MAPS_PLATFORM_SIGNATURE_SECRET = os.getenv("GCP_MAPS_PLATFORM_SIGNATURE_SECRET")

# Root directory holding the layers index, metadata and rasters. Relative paths are
# resolved from the working directory, as before (the default is the Git-tracked
# copy). In Azure this points at the mounted Azure Files share (/mnt/maps).
MAPS_ROOT = os.getenv("MAPS_ROOT") or "app/maps"

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


# Layers admin. It is enabled only when both the passkey hash and the session secret
# are set; generate them with `uv run python -m app.modules.admin.passkey`.
# SHA-256 of the admin passkey, as 64 lowercase hex characters (never the passkey).
ADMIN_PASSKEY_HASH = os.getenv("ADMIN_PASSKEY_HASH") or None
if ADMIN_PASSKEY_HASH is not None and not re.fullmatch(
    r"[0-9a-f]{64}", ADMIN_PASSKEY_HASH
):
    raise ValueError("ADMIN_PASSKEY_HASH must be a SHA-256 hash in lowercase hex")

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
