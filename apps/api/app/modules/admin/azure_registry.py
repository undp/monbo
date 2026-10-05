"""Read and publish the country registry on an Azure Files share.

The deploy script prepares changes in a local directory. Publishing holds a lease on
countries.json while it checks the original ETag, creates a new country's folder
(if requested), and uploads the registry. Another operator cannot publish a stale
copy between the check and the upload. This module is a CLI-only tool; its Azure SDK
dependency lives in the ``azure`` dependency group, outside the API image.
"""

import argparse
import json
import os
import sys
from pathlib import Path

from app.modules.layers.store import SUPPORTED_LANGUAGES, is_country_folder_name


class RegistryChanged(Exception):
    """The registry changed since the operator downloaded it."""


class CountryFolderConflict(Exception):
    """An unregistered country folder contains an existing layer index."""


class RegistryLeased(Exception):
    """countries.json still holds a lease, most likely from an interrupted run."""


def _is_lease_conflict(error: Exception) -> bool:
    # Duck-typed: the Azure SDK is only imported in main() (an optional group).
    return getattr(error, "status_code", None) == 409 or (
        getattr(error, "error_code", None) == "LeaseAlreadyPresent"
    )


def snapshot(share, destination: Path) -> str:
    """Download the registry and return the ETag used for optimistic concurrency."""
    registry = share.get_file_client("countries.json")
    etag = registry.get_file_properties().etag
    destination.write_bytes(registry.download_file().readall())
    return etag


def _ensure_country_folder(share, code: str, index_source: Path) -> None:
    """Create the same empty folder structure as the local country CLI."""
    paths = (
        code,
        f"{code}/metadata",
        *(f"{code}/metadata/{kind}" for kind in ("attributes", "considerations")),
        *(
            f"{code}/metadata/{kind}/{language}"
            for kind in ("attributes", "considerations")
            for language in SUPPORTED_LANGUAGES
        ),
        f"{code}/layers",
        f"{code}/layers/rasters",
    )
    for path in paths:
        directory = share.get_directory_client(path)
        if not directory.exists():
            directory.create_directory()

    index = share.get_file_client(f"{code}/index.json")
    if index.exists():
        if json.loads(index.download_file().readall()) != []:
            raise CountryFolderConflict(
                f"{code}/index.json already has layers but {code} is not registered"
            )
    else:
        index.upload_file(index_source.read_bytes())


def publish(
    share,
    expected_etag: str,
    source: Path,
    country: str | None = None,
    country_index: Path | None = None,
) -> None:
    """Publish only if the registry still has the downloaded ETag."""
    registry = share.get_file_client("countries.json")
    try:
        lease = registry.acquire_lease()
    except Exception as error:
        if _is_lease_conflict(error):
            raise RegistryLeased(
                "countries.json is still leased, probably by an earlier command "
                "that was interrupted. If no other `countries` command is running, "
                "run tools/layers-ops/layers-ops.sh <env> countries unlock and try again"
            ) from error
        raise
    try:
        if registry.get_file_properties().etag != expected_etag:
            raise RegistryChanged(
                "countries.json changed on the share; run the command again"
            )
        if country is not None:
            if country_index is None:
                raise ValueError("A new country needs its local index")
            if not is_country_folder_name(country):
                raise ValueError(f"Invalid country code '{country}'")
            _ensure_country_folder(share, country, country_index)
        registry.upload_file(source.read_bytes(), lease=lease)
    finally:
        lease.release()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("command", choices=("snapshot", "publish", "break-stale-lease"))
    parser.add_argument("--account", required=True)
    parser.add_argument("--share", required=True)
    parser.add_argument("--dest", type=Path)
    parser.add_argument("--source", type=Path)
    parser.add_argument("--expected-etag")
    parser.add_argument("--country")
    parser.add_argument("--country-index", type=Path)
    args = parser.parse_args(argv)
    if args.command == "snapshot" and args.dest is None:
        parser.error("snapshot needs --dest")
    if args.command == "publish" and (args.source is None or not args.expected_etag):
        parser.error("publish needs --source and --expected-etag")
    if args.country and not args.country_index:
        parser.error("--country needs --country-index")

    from azure.core.exceptions import AzureError
    from azure.storage.fileshare import ShareLeaseClient, ShareServiceClient

    key = os.environ.get("AZURE_STORAGE_KEY")
    if not key:
        parser.error("AZURE_STORAGE_KEY is required")
    service = ShareServiceClient(
        account_url=f"https://{args.account}.file.core.windows.net", credential=key
    )
    try:
        share = service.get_share_client(args.share)
        if args.command == "snapshot":
            print(snapshot(share, args.dest))
        elif args.command == "publish":
            publish(
                share,
                args.expected_etag,
                args.source,
                args.country,
                args.country_index,
            )
        else:
            ShareLeaseClient(share.get_file_client("countries.json")).break_lease()
    except (
        AzureError,
        RegistryChanged,
        RegistryLeased,
        CountryFolderConflict,
        ValueError,
    ) as error:
        print(f"Country registry update failed: {error}", file=sys.stderr)
        return 1
    finally:
        service.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
