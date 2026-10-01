"""Manage the country registry: which countries exist and their admin passkeys.

    uv run python -m app.modules.admin.countries list [--root PATH]
    uv run python -m app.modules.admin.countries add PE [--root PATH]
    uv run python -m app.modules.admin.countries rotate PE [--root PATH]
    uv run python -m app.modules.admin.countries disable PE [--root PATH]
    uv run python -m app.modules.admin.countries enable PE [--root PATH]

`--root` defaults to MAPS_ROOT. The root must use the per-country layout (an empty
directory becomes one with the first `add`). `add` and `rotate` print the new
passkey once: give it to that country's admin through a password manager. Only its
SHA-256 is written, to `countries.json`. A running API picks up every registry
change on its next request, except the first `add` on an empty root: the admin
routes are only registered at startup, so restart the API then. Nothing here
deletes a country's folder or its layers.
"""

import argparse
import secrets
import sys
from pathlib import Path

import pycountry

from app.config import env
from app.modules.layers.store import (
    SUPPORTED_LANGUAGES,
    LayersRoot,
    is_country_folder_name,
)

from .auth import hash_passkey

PASSKEY_BYTES = 48  # 64 URL-safe characters


class CountryError(Exception):
    pass


def generate_passkey() -> str:
    return secrets.token_urlsafe(PASSKEY_BYTES)


def country_name(code: str) -> str:
    country = pycountry.countries.get(alpha_2=code)
    return country.name if country else code


def _normalize(code: str) -> str:
    code = code.strip().upper()
    if (
        not is_country_folder_name(code)
        or pycountry.countries.get(alpha_2=code) is None
    ):
        raise CountryError(f"'{code}' is not an ISO 3166-1 alpha-2 country code")
    return code


def _registry(root: LayersRoot) -> list[dict]:
    """The registry to edit: empty for a fresh root, an error for a flat one."""
    if not root.is_per_country():
        if root.flat.index_path.exists():
            raise CountryError(
                f"{root.root} has the flat layout (index.json); migrate it first "
                "with app.modules.layers.migrate_countries"
            )
        return []
    registry = root.read_registry()
    if registry is None:
        raise CountryError(f"Cannot read a valid {root.registry_path}")
    return registry


def _find(registry: list[dict], code: str) -> dict:
    country = next((c for c in registry if c["code"] == code), None)
    if country is None:
        raise CountryError(f"{code} is not registered")
    return country


def add_country(root: LayersRoot, code: str) -> str:
    """Register a country with an empty folder. Returns its new passkey."""
    code = _normalize(code)
    with root.locked():
        registry = _registry(root)
        if any(c["code"] == code for c in registry):
            raise CountryError(f"{code} is already registered")
        store = root.country_store(code)
        if store.index_path.exists():
            raise CountryError(
                f"{store.root} already has an index.json but {code} is not "
                "registered; check the folder before adding it"
            )
        for kind in ("attributes", "considerations"):
            for language in SUPPORTED_LANGUAGES:
                (store.root / "metadata" / kind / language).mkdir(
                    parents=True, exist_ok=True
                )
        store.rasters_dir.mkdir(parents=True, exist_ok=True)
        store.write_index([])
        passkey = generate_passkey()
        root.write_registry(
            [
                *registry,
                {"code": code, "passkey_hash": hash_passkey(passkey), "enabled": True},
            ]
        )
    return passkey


def rotate_passkey(root: LayersRoot, code: str) -> str:
    """Give a country a new passkey; sessions from the old one stop working."""
    code = _normalize(code)
    with root.locked():
        registry = _registry(root)
        passkey = generate_passkey()
        _find(registry, code)["passkey_hash"] = hash_passkey(passkey)
        root.write_registry(registry)
    return passkey


def set_enabled(root: LayersRoot, code: str, enabled: bool) -> None:
    code = _normalize(code)
    with root.locked():
        registry = _registry(root)
        _find(registry, code)["enabled"] = enabled
        root.write_registry(registry)


def list_countries(root: LayersRoot) -> list[dict]:
    rows = []
    for country in _registry(root):
        index = root.country_store(country["code"]).read_index() or []
        rows.append(
            {
                "code": country["code"],
                "name": country_name(country["code"]),
                "enabled": country["enabled"],
                "layers": len(index),
                "enabled_layers": sum(1 for entry in index if entry["enabled"]),
            }
        )
    return rows


def _print_passkey(code: str, passkey: str) -> None:
    print(f"# Give this to the admin of {code} (password manager). It is not stored:")
    print(f"ADMIN_PASSKEY={passkey}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "command", choices=["list", "add", "rotate", "disable", "enable"]
    )
    parser.add_argument("code", nargs="?", help="ISO 3166-1 alpha-2 country code")
    parser.add_argument("--root", type=Path, default=Path(env.MAPS_ROOT))
    args = parser.parse_args(argv)
    if args.command != "list" and not args.code:
        parser.error(f"'{args.command}' needs a country code")

    root = LayersRoot(args.root)
    try:
        if args.command == "list":
            for row in list_countries(root):
                state = "enabled" if row["enabled"] else "disabled"
                print(
                    f"{row['code']}  {row['name']:<28} {state:<9} "
                    f"{row['layers']} layers ({row['enabled_layers']} enabled)"
                )
        elif args.command == "add":
            passkey = add_country(root, args.code)
            print(f"Added {args.code.upper()} in {root.root}")
            _print_passkey(args.code.upper(), passkey)
        elif args.command == "rotate":
            passkey = rotate_passkey(root, args.code)
            print(f"New passkey for {args.code.upper()}; the old one no longer works")
            _print_passkey(args.code.upper(), passkey)
        else:
            set_enabled(root, args.code, args.command == "enable")
            print(f"{args.code.upper()} {args.command}d")
    except CountryError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
