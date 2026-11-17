"""Layer categories as stored in a country's `categories.json`, and how a layer's
`category_id` resolves against them.

The file is a JSON list. Each category is validated on its own, so one bad entry
doesn't take the others down; an id that appears more than once is rejected in every
copy, because which one is meant (and so which polarity applies) can't be told. A
file that is not JSON or not a list resolves nothing.

Every country has a `deforestation` category: when the file is missing, or readable
without an entry with that id, the built-in one below is used. When the stored one is
rejected, or the file is unreadable, the built-in one is not used either: the
country's own threshold must never be silently replaced by the global one.

A layer whose category doesn't resolve gets a `category_issue` code. It is left out
of the public listings, and the admin shows the code so the country can fix it.
"""

from collections import Counter
from dataclasses import dataclass, field
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.models.categories import CategoryIcon, CategoryPolarity

CATEGORIES_FILENAME = "categories.json"
DEFAULT_CATEGORY_ID = "deforestation"
CATEGORY_ID_PATTERN = r"^[a-z][a-z0-9_]{0,49}$"
# Limits of a stored category, shared with the admin's input models.
COLOR_PATTERN = r"^#[0-9a-fA-F]{6}$"
NAME_MAX_LENGTH = 100
DESCRIPTION_MAX_LENGTH = 1000
LABEL_MAX_LENGTH = 60
THRESHOLD_MIN = 0
THRESHOLD_MAX = 100

# Why a layer's category doesn't resolve. Stable codes: the admin translates them.
CategoryIssue = Literal["unknown_category", "invalid_category", "unreadable_categories"]
# Why a layer whose category resolves still can't be public. Stable codes too.
LayerIssue = Literal["years_mismatch", "missing_raster"]


class _Stored(BaseModel):
    # Strict: "5" is not a threshold and 1 is not `true`. Unknown fields are ignored,
    # so a file written by a later release still loads.
    model_config = ConfigDict(strict=True, extra="ignore")


class _Name(_Stored):
    es: str = Field(min_length=1, max_length=NAME_MAX_LENGTH)
    en: str = Field(min_length=1, max_length=NAME_MAX_LENGTH)


class _Description(_Stored):
    es: str = Field(max_length=DESCRIPTION_MAX_LENGTH)
    en: str = Field(max_length=DESCRIPTION_MAX_LENGTH)


class _Label(_Stored):
    es: str = Field(min_length=1, max_length=LABEL_MAX_LENGTH)
    en: str = Field(min_length=1, max_length=LABEL_MAX_LENGTH)


class _ResultLabels(_Stored):
    ok: _Label
    flagged: _Label


class StoredCategory(_Stored):
    id: str = Field(pattern=CATEGORY_ID_PATTERN)
    name: _Name
    description: _Description
    icon: CategoryIcon
    color: str = Field(pattern=COLOR_PATTERN)
    polarity: CategoryPolarity
    # None: the global DEFORESTATION_THRESHOLD_PERCENTAGE.
    threshold_percentage: float | None = Field(
        default=None, ge=THRESHOLD_MIN, le=THRESHOLD_MAX
    )
    result_labels: _ResultLabels
    temporal: bool
    enabled: bool = True


@dataclass(frozen=True)
class CategoriesFile:
    """A country's `categories.json`, as read. A missing file is readable and empty."""

    readable: bool = True
    # The valid categories, in file order (StoredCategory dumps, snake_case).
    categories: list[dict] = field(default_factory=list)
    # Ids of rejected entries: invalid, or repeated.
    invalid_ids: frozenset[str] = frozenset()
    # One message per problem, for the logs and the admin.
    errors: list[str] = field(default_factory=list)


def parse_categories(content: Any) -> CategoriesFile:
    """Validate the parsed content of a `categories.json` (None when it isn't JSON)."""
    if not isinstance(content, list):
        return CategoriesFile(
            readable=False, errors=[f"{CATEGORIES_FILENAME} is not a JSON list"]
        )
    ids = Counter(
        entry["id"]
        for entry in content
        if isinstance(entry, dict) and isinstance(entry.get("id"), str)
    )
    categories: list[dict] = []
    invalid_ids: set[str] = set()
    errors: list[str] = []
    for position, entry in enumerate(content):
        raw_id = entry.get("id") if isinstance(entry, dict) else None
        where = f"entry {position}" + (
            f" ('{raw_id}')" if isinstance(raw_id, str) else ""
        )
        try:
            category = StoredCategory.model_validate(entry)
        except ValidationError as error:
            errors.append(f"{where}: {_describe(error)}")
            if isinstance(raw_id, str):
                invalid_ids.add(raw_id)
            continue
        if ids[category.id] > 1:
            errors.append(f"{where}: the id is repeated")
            invalid_ids.add(category.id)
            continue
        categories.append(category.model_dump())
    return CategoriesFile(
        categories=categories, invalid_ids=frozenset(invalid_ids), errors=errors
    )


def _describe(error: ValidationError) -> str:
    return "; ".join(
        f"{'.'.join(str(part) for part in issue['loc']) or 'entry'}: {issue['msg']}"
        for issue in error.errors()
    )


DEFAULT_CATEGORY: dict = StoredCategory(
    id=DEFAULT_CATEGORY_ID,
    name=_Name(es="Deforestación", en="Deforestation"),
    description=_Description(
        es="Pérdida de bosque posterior al año de línea base de la capa.",
        en="Forest loss after the layer's baseline year.",
    ),
    icon="forest",
    color="#c62828",
    polarity="avoid",
    threshold_percentage=None,
    result_labels=_ResultLabels(
        ok=_Label(es="Libre de deforestación", en="Deforestation-free"),
        flagged=_Label(es="Con deforestación", en="With deforestation"),
    ),
    temporal=True,
    enabled=True,
).model_dump()


def effective_categories(file: CategoriesFile) -> list[dict]:
    """A country's categories, enabled or not: the valid stored ones, plus the
    built-in `deforestation` first when the file doesn't define it (see the module
    docstring for when it is not added)."""
    if not file.readable:
        return []
    defined = {category["id"] for category in file.categories} | file.invalid_ids
    if DEFAULT_CATEGORY_ID in defined:
        return [dict(category) for category in file.categories]
    return [dict(DEFAULT_CATEGORY), *(dict(c) for c in file.categories)]


def resolve_category(
    category_id: Any, file: CategoriesFile, categories: dict[str, dict]
) -> tuple[dict | None, CategoryIssue | None]:
    """The category a layer's `category_id` points at, or why there is none.
    `categories` is `effective_categories(file)` by id."""
    if not file.readable:
        return None, "unreadable_categories"
    if isinstance(category_id, str) and category_id in categories:
        return categories[category_id], None
    if isinstance(category_id, str) and category_id in file.invalid_ids:
        return None, "invalid_category"
    return None, "unknown_category"


def is_temporal(category_id: Any, file: CategoriesFile) -> bool:
    """Whether a layer's category resolves and is `temporal` (its layers have a
    baseline). A category that doesn't resolve is not: whether the layer has a
    baseline can't be told."""
    by_id = {category["id"]: category for category in effective_categories(file)}
    category, _ = resolve_category(category_id, file, by_id)
    return bool(category and category["temporal"])


def _year_state(value: Any) -> bool | None:
    """True for a year, False for none (missing, null or ""), None when the index
    holds something that isn't a year (a hand edit)."""
    if value in (None, ""):
        return False
    try:
        int(value)
    except (TypeError, ValueError):
        return None
    return True


def years_fit(entry: dict, temporal: bool) -> bool:
    """Whether an index entry's years fit a category that is (or isn't) temporal:
    temporal categories need both years, the others none. A year that can't be
    read never fits."""
    years = [_year_state(entry.get(key)) for key in ("baseline", "compared_against")]
    if None in years:
        return False
    return all(years) if temporal else not any(years)
