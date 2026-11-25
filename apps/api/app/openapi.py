"""Export the API's OpenAPI document, the source of the frontend's types.

    uv run python -m app.openapi           # writes apps/api/openapi.json
    uv run python -m app.openapi --check   # fails if it is out of date

The admin routes are included whether or not the admin is enabled here, and the
output is deterministic (sorted keys, 2-space indent, trailing newline), so the same
models always produce the same file. After changing a model, run `pnpm contracts` at
the repository root: it exports this file and regenerates the frontend's types.
"""

import argparse
import json
import sys
from pathlib import Path

OPENAPI_PATH = Path(__file__).resolve().parent.parent / "openapi.json"


def render() -> str:
    from app.main import create_app

    document = create_app(include_admin=True).openapi()
    return json.dumps(document, indent=2, sort_keys=True, ensure_ascii=False) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument(
        "--check",
        action="store_true",
        help="exit 1 if openapi.json doesn't match the current models",
    )
    args = parser.parse_args(argv)

    rendered = render()
    if args.check:
        current = (
            OPENAPI_PATH.read_text(encoding="utf-8") if OPENAPI_PATH.exists() else ""
        )
        if current != rendered:
            print(
                f"{OPENAPI_PATH.name} is out of date: run `pnpm contracts` at the "
                "repository root and commit the result",
                file=sys.stderr,
            )
            return 1
        print(f"{OPENAPI_PATH.name} is up to date")
        return 0

    OPENAPI_PATH.write_text(rendered, encoding="utf-8")
    print(f"Wrote {OPENAPI_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
