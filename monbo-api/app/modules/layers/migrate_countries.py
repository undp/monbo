"""Turn a flat layers root into the per-country layout.

    uv run python -m app.modules.layers.migrate_countries \
        --source /tmp/maps-flat --target /tmp/maps-v2 [--mapping-out ids.json]

Each layer goes to every country in its `available_countries_codes`, so GFW and TMF
get one copy per country. Each country numbers its layers from 0, in the order of
their original ids. Rasters are copied whole, never clipped (a farm can cross a
border), with `shutil.copyfile` so no permission bits are copied (the Azure Files
mount refuses them). Every country found is registered with a new passkey, printed
once. `--mapping-out` writes each country's `{old id: new id}`, which
`tests.regression.parity --mapping` uses to compare the two layouts.

The source is left untouched, and the target must be empty.
"""

import argparse
import json
import shutil
import sys
from pathlib import Path

from app.modules.admin.countries import CountryError, add_country
from app.modules.layers.store import SUPPORTED_LANGUAGES, LayersRoot, LayerStore


class MigrationError(Exception):
    pass


def _copy(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)


def _copy_layer_files(source: LayerStore, target: LayerStore, entry: dict) -> None:
    raster = entry.get("raster_filename")
    if raster:
        _copy(source.raster_path(raster), target.raster_path(raster))
    for language in SUPPORTED_LANGUAGES:
        for source_path, target_path in (
            (
                source.attributes_path(entry["attributes_filename"], language),
                target.attributes_path(entry["attributes_filename"], language),
            ),
            (
                source.considerations_path(entry["considerations_filename"], language),
                target.considerations_path(entry["considerations_filename"], language),
            ),
        ):
            if source_path and target_path and source_path.is_file():
                _copy(source_path, target_path)


def plan(index: list[dict]) -> list[tuple[str, int, dict]]:
    """(country, new id, source entry) for every layer copy: in the order of the
    original ids, each country numbering its layers from 0."""
    next_ids: dict[str, int] = {}
    copies = []
    for entry in sorted(index, key=lambda e: e["id"]):
        countries = entry.get("available_countries_codes") or []
        if not countries:
            raise MigrationError(f"Layer {entry['id']} lists no country")
        for country in countries:
            country = country.upper()
            layer_id = next_ids.get(country, 0)
            next_ids[country] = layer_id + 1
            copies.append((country, layer_id, entry))
    return copies


def id_mapping(copies: list[tuple[str, int, dict]]) -> dict[str, dict[str, int]]:
    """Each country's `{old id: new id}` (old ids as strings, as in JSON)."""
    mapping: dict[str, dict[str, int]] = {}
    for country, layer_id, entry in copies:
        mapping.setdefault(country, {})[str(entry["id"])] = layer_id
    return mapping


def migrate(
    source: Path, target: Path, log=print, mapping_out: Path | None = None
) -> dict[str, str]:
    """Migrate `source` into `target`. Returns each country's new passkey."""
    source_root = LayersRoot(source)
    if source_root.is_per_country() or not source_root.flat.index_path.is_file():
        raise MigrationError(f"{source} is not a flat layers root (no index.json)")
    index = source_root.flat.read_index()
    if index is None:
        raise MigrationError(f"Cannot read {source_root.flat.index_path}")
    if target.exists() and any(target.iterdir()):
        raise MigrationError(f"{target} is not empty; migrate into an empty directory")

    copies = plan(index)
    target.mkdir(parents=True, exist_ok=True)
    target_root = LayersRoot(target)
    passkeys: dict[str, str] = {}
    try:
        for country in dict.fromkeys(country for country, _, _ in copies):
            passkeys[country] = add_country(target_root, country)
    except CountryError as e:
        raise MigrationError(str(e)) from e

    by_country: dict[str, list[dict]] = {country: [] for country in passkeys}
    for country, layer_id, entry in copies:
        _copy_layer_files(source_root.flat, target_root.country_store(country), entry)
        migrated = {
            key: value
            for key, value in entry.items()
            if key != "available_countries_codes"
        }
        migrated["id"] = layer_id
        by_country[country].append(migrated)
        log(
            f"  {country} {layer_id}: {entry.get('raster_filename')} (was {entry['id']})"
        )
    # Indexes last: a country folder only lists layers whose files are in place.
    for country, entries in by_country.items():
        target_root.country_store(country).write_index(entries)
    if mapping_out is not None:
        mapping_out.write_text(json.dumps(id_mapping(copies), indent=2) + "\n")
    log(
        f"Migrated {len(index)} layers into {len(copies)} layers "
        f"in {len(passkeys)} countries"
    )
    return passkeys


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--target", type=Path, required=True)
    parser.add_argument(
        "--mapping-out",
        type=Path,
        help="Write each country's {old id: new id} here (for the parity check)",
    )
    args = parser.parse_args(argv)
    print(f"Migrating {args.source} to the per-country layout in {args.target}")
    try:
        passkeys = migrate(args.source, args.target, mapping_out=args.mapping_out)
    except MigrationError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    print()
    print("# Give each passkey to that country's admin (password manager).")
    print("# They are not stored anywhere:")
    for country, passkey in passkeys.items():
        print(f"{country}: {passkey}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
