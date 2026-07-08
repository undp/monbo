import logging
import os

from app.utils.json import read_json_file

logger = logging.getLogger(__name__)

LFS_POINTER_SIGNATURE = b"version https://git-lfs.github.com/spec/v1"
LFS_POINTER_MAX_SIZE = 200  # LFS pointer files are always small text files


def is_git_lfs_pointer(filepath: str) -> bool:
    """Check if a file is a Git LFS pointer instead of actual content."""
    try:
        size = os.path.getsize(filepath)
        if size > LFS_POINTER_MAX_SIZE:
            return False
        with open(filepath, "rb") as f:
            return f.read(len(LFS_POINTER_SIGNATURE)) == LFS_POINTER_SIGNATURE
    except OSError:
        return False


def validate_raster_files(raster_dir: str = "app/maps/layers/rasters") -> None:
    """Validate that raster files are actual data and not Git LFS pointers.

    Raises RuntimeError with instructions if LFS pointers are detected.
    """
    if not os.path.isdir(raster_dir):
        return

    lfs_pointers = [
        f
        for f in os.listdir(raster_dir)
        if f.endswith(".tif") and is_git_lfs_pointer(os.path.join(raster_dir, f))
    ]

    if lfs_pointers:
        files_list = ", ".join(lfs_pointers)
        raise RuntimeError(
            f"Git LFS pointer files detected instead of actual raster data: {files_list}. "
            f"Run 'git lfs install && git lfs pull' to download the actual files. "
            f"If Git LFS is not installed, install it first (e.g. 'brew install git-lfs' or 'apt-get install git-lfs')."
        )


def read_attributes(filename: str, language: str) -> dict | None:
    filepath = f"app/maps/metadata/attributes/{language}/{filename}"
    content = read_json_file(filepath)
    if content is None:
        print(f"Cannot read Attributes file at '{filepath}'")
        return None
    return content


def read_considerations(filename: str, language: str) -> str | None:
    filepath = f"app/maps/metadata/considerations/{language}/{filename}"
    try:
        with open(filepath, "r") as f:
            return f.read().strip()
    except Exception as e:
        print(f"Cannot read Considerations file at '{filepath}': {e}")
        return None


def get_map_raster_path(raster_filename: str) -> str:
    filepath = f"app/maps/layers/rasters/{raster_filename}"
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Raster file not found at '{filepath}'")
    return filepath
