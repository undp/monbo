"""Compare two deployed APIs on the regression farms.

    uv run python -m tests.regression.parity https://current.example https://new.example

Sends the farms of `regression_farms.xlsx` to both APIs (`/farms/parse`,
`/deforestation_analysis/analize` on every published layer and
`/polygons_validation/validate`) and exits 0 only if every parsed area,
deforestation ratio and validation result is identical. Use it before and after a
storage migration, e.g. the image's layers against the seeded Azure Files share.
"""

import argparse
import sys

import httpx

from tests.regression.pipeline import differences, read_farm_rows, run_pipeline


def published_map_ids(client) -> list[int]:
    response = client.get("/maps")
    response.raise_for_status()
    return sorted(layer["id"] for layer in response.json())


def compare_clients(current, candidate) -> list[str]:
    """Differences of `candidate` against `current` (empty when identical)."""
    current_ids, candidate_ids = published_map_ids(current), published_map_ids(
        candidate
    )
    if current_ids != candidate_ids:
        return [f"Published layers differ: {current_ids} vs {candidate_ids}"]
    rows = read_farm_rows()
    expected = run_pipeline(rows, client=current, map_ids=current_ids)
    actual = run_pipeline(rows, client=candidate, map_ids=candidate_ids)
    return differences(actual, expected)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("current", help="Base URL of the reference API")
    parser.add_argument("candidate", help="Base URL of the API to check")
    parser.add_argument("--timeout", type=float, default=300)
    args = parser.parse_args(argv)

    with (
        httpx.Client(base_url=args.current, timeout=args.timeout) as current,
        httpx.Client(base_url=args.candidate, timeout=args.timeout) as candidate,
    ):
        diffs = compare_clients(current, candidate)
    if diffs:
        print(f"{len(diffs)} differences:")
        for diff in diffs:
            print(f"  {diff}")
        return 1
    print("Identical results on every regression farm and layer")
    return 0


if __name__ == "__main__":
    sys.exit(main())
