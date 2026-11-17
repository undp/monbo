"""What the layer and category admin routes share: the session's country folder and
how its layers relate to its categories."""

from dataclasses import dataclass

from fastapi import HTTPException

from app.modules.layers.categories import (
    CategoriesFile,
    CategoryIssue,
    effective_categories,
    resolve_category,
)
from app.modules.layers.store import LayerStore, get_layers_root

from .auth import Session


def country_store(session: Session) -> LayerStore:
    return get_layers_root().country_store(session.country)


def index_or_500(store: LayerStore) -> list[dict]:
    index = store.read_index()
    if index is None:
        raise HTTPException(status_code=500, detail="Failed to read map data")
    return index


@dataclass(frozen=True)
class CountryCategories:
    """A country's categories as read once for a request."""

    file: CategoriesFile

    @property
    def effective(self) -> list[dict]:
        """Enabled or not, in the order `GET /categories` uses."""
        return effective_categories(self.file)

    def by_id(self) -> dict[str, dict]:
        return {category["id"]: category for category in self.effective}

    def resolve(self, category_id: object) -> tuple[dict | None, CategoryIssue | None]:
        return resolve_category(category_id, self.file, self.by_id())

    def is_synthesized(self, category_id: str) -> bool:
        """Whether `category_id` is the built-in category, not stored in the file."""
        stored = {c["id"] for c in self.file.categories} | self.file.invalid_ids
        return category_id not in stored and category_id in self.by_id()


def read_country_categories(store: LayerStore) -> CountryCategories:
    return CountryCategories(store.read_categories())


def layers_in(index: list[dict], category_id: str) -> list[dict]:
    return [entry for entry in index if entry["category_id"] == category_id]


def published_ids(layers: list[dict]) -> list[int]:
    return [entry["id"] for entry in layers if entry["enabled"]]


def describe_ids(ids: list[int]) -> str:
    return ", ".join(str(layer_id) for layer_id in ids)
