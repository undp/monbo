"""Seed a layers root (e.g. the Azure Files share) from the Git-tracked layers.

    uv run python -m app.modules.layers.seed --target /tmp/maps-seed [--source app/maps]

Every raster goes through the same checks as an admin upload: it must be binary,
it is converted to a Cloud Optimized GeoTIFF, and the conversion is verified pixel
by pixel. The target gets `<stem>-v1.tif` rasters, a copy of the metadata and an
index with every layer enabled at version 1. Nothing is written to the target
index until every layer has passed.

Seed into a local directory and upload it to the share afterwards (see the
deployment docs); converting straight onto the share works but is much slower.
"""

import argparse
import re
import shutil
import sys
import time
from pathlib import Path

from app.modules.layers.processing import (
    IngestionError,
    check_pixel_size,
    convert_to_cog,
    validate_raster,
    verify_same_pixels,
)
from app.modules.layers.store import LayerStore


class SeedError(Exception):
    pass


def _is_lfs_pointer(path: Path) -> bool:
    with open(path, "rb") as file:
        return file.read(40).startswith(b"version https://git-lfs")


def _stem(raster_filename: str) -> str:
    return re.sub(r"-v\d+$", "", Path(raster_filename).stem)


def _copy_metadata(source: Path, target: Path) -> int:
    """Copy metadata/** file by file, skipping hidden files like macOS's .DS_Store.
    copyfile, not copytree: copying permissions (copystat) fails on the Azure Files
    mount."""
    copied = 0
    for path in sorted((source / "metadata").rglob("*")):
        if path.is_file() and not path.name.startswith("."):
            destination = target / path.relative_to(source)
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, destination)
            copied += 1
    return copied


def _seed_layer(
    entry: dict, raster: Path, target_store: LayerStore, written: list[Path], log
) -> dict:
    started = time.monotonic()
    filename = f"{_stem(entry['raster_filename'])}-v1.tif"
    destination = target_store.rasters_dir / filename
    if destination.exists():
        raise SeedError(f"{destination} already exists; seed an empty directory")
    written.append(destination)
    try:
        validation = validate_raster(raster, None)
        check_pixel_size(entry["pixel_size"], validation.pixel_size_range_m)
        convert_to_cog(raster, destination)
        verify_same_pixels(raster, destination)
    except IngestionError as e:
        raise SeedError(f"Layer {entry['id']} ({raster.name}): {e}") from e
    report = validation.report
    log(
        f"  layer {entry['id']}: {raster.name} "
        f"({raster.stat().st_size / 1e6:.1f} MB) -> {filename} "
        f"({destination.stat().st_size / 1e6:.1f} MB), values {report['values']}, "
        f"nodata {report['nodata']}, {time.monotonic() - started:.0f}s"
    )
    for warning in validation.warnings:
        log(f"    warning: {warning['message']}")
    return {**entry, "raster_filename": filename, "enabled": True, "version": 1}


def seed(source: Path, target: Path, log=print) -> list[dict]:
    """Seed `target` from `source`. Returns the new index."""
    source_store = LayerStore(source)
    index = source_store.read_index()
    if index is None:
        raise SeedError(f"Cannot read the layers index in {source}")
    target_store = LayerStore(target)
    if target_store.index_path.exists():
        raise SeedError(f"{target} already has an index.json; seed an empty directory")

    rasters = [source_store.raster_path(entry["raster_filename"]) for entry in index]
    for path in rasters:
        if not path.is_file():
            raise SeedError(f"Missing raster {path}")
        if _is_lfs_pointer(path):
            raise SeedError(f"{path} is a Git LFS pointer. Run 'git lfs pull' first.")

    target_store.rasters_dir.mkdir(parents=True, exist_ok=True)
    seeded: list[dict] = []
    written: list[Path] = []
    try:
        for entry, raster in zip(index, rasters):
            seeded.append(_seed_layer(entry, raster, target_store, written, log))
    except SeedError:
        # Leave the target as it was: remove what this run wrote.
        for path in written:
            path.unlink(missing_ok=True)
        raise

    copied = _copy_metadata(source, target)
    # Last, so a failure above never leaves a target that looks seeded.
    target_store.write_index(seeded)
    total = sum(p.stat().st_size for p in target_store.rasters_dir.iterdir()) / 1e6
    log(f"Seeded {len(seeded)} layers ({total:.1f} MB) and {copied} metadata files")
    return seeded


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--source", type=Path, default=Path("app/maps"))
    parser.add_argument("--target", type=Path, required=True)
    args = parser.parse_args(argv)
    print(f"Seeding {args.target} from {args.source}")
    try:
        seed(args.source, args.target)
    except SeedError as e:
        print(f"Seed failed: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
