"""Trail search API.

Implements POST /search (tag search only) from the team spec on top of the
existing helpers in data_sorter.py (nearest-point distance, area/tag filtering
and tag discovery). Serves output.json by default; override with TRAILS_DATA.

Run with:
    .venv/bin/uvicorn app:app --reload --port 8000

Interactive docs: http://127.0.0.1:8000/docs
"""

from __future__ import annotations

import json
import os
import re
import sys
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, field_validator

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

# Reuse the project's existing GeoJSON helpers.
from data_sorter import (  # noqa: E402
    calculate_distance_to_geometry,
    filter_features,
    get_all_tag_types,
)

DATA_PATH = Path(os.environ.get("TRAILS_DATA", BASE_DIR / "output.json"))

# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

with DATA_PATH.open("r", encoding="utf-8") as fh:
    _raw = json.load(fh)

if isinstance(_raw, dict) and _raw.get("type") == "FeatureCollection":
    FEATURES: list[dict[str, Any]] = list(_raw.get("features", []))
elif isinstance(_raw, dict) and _raw.get("type") == "Feature":
    FEATURES = [_raw]
elif isinstance(_raw, list):
    FEATURES = _raw
else:
    raise RuntimeError(f"{DATA_PATH} is not a GeoJSON FeatureCollection")


def _feature_id(feature: dict[str, Any], index: int) -> Any:
    """Prefer human-readable property ids, then the GeoJSON top-level id."""
    props = feature.get("properties") or {}
    for key in ("site_code", "trail_id"):
        value = props.get(key)
        if value not in (None, ""):
            return value
    value = feature.get("id")
    if value not in (None, ""):
        return value
    value = props.get("id")
    if value not in (None, ""):
        return value
    return f"feature-{index}"


FEATURE_IDS: list[Any] = []
_seen_ids: Counter[Any] = Counter()
for _i, _feature in enumerate(FEATURES):
    _base_id = _feature_id(_feature, _i)
    _n = _seen_ids[_base_id]
    _seen_ids[_base_id] += 1
    FEATURE_IDS.append(_base_id if _n == 0 else f"{_base_id}-{_n}")


FEATURE_INDEX_BY_OBJECT = {id(feature): i for i, feature in enumerate(FEATURES)}

# ---------------------------------------------------------------------------
# Tag catalog
# ---------------------------------------------------------------------------

ID_LIKE_KEY_RE = re.compile(r"(^|_)(id|code|ref|uuid)$")
ID_LIKE_VALUE_RE = re.compile(r"^[A-Z]{2,}[A-Z0-9-]*\d+[A-Z0-9-]*$")
EXCLUDED_TAG_PROPS = {
    "id",
    "name",
    "objectid",
    "trail_id",
    "trail_name",
    "trail_names",
}
SENTINEL_TAG_VALUES = {"", "unknown", "unrated", "none", "null", "n/a", "na"}


def _slug(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "-", str(value).lower()).strip("-") or "value"


def _label(prop: str, value: Any) -> str:
    pretty = str(value).replace("_", " ").strip()
    pretty = pretty[:1].upper() + pretty[1:]
    if prop in {"main_surface", "surface_class", "surface"}:
        return f"{pretty} surface"
    if "difficulty" in prop:
        return f"{pretty} difficulty"
    return f"{pretty} ({prop.replace('_', ' ')})"


@dataclass(frozen=True)
class TagDef:
    id: str
    label: str
    property: str
    value: Any


def _build_catalog(
    features: list[dict[str, Any]],
) -> tuple[dict[str, TagDef], dict[tuple[str, Any], TagDef]]:
    """Turn categorical GeoJSON properties into searchable tags."""
    catalog: dict[str, TagDef] = {}
    lookup: dict[tuple[str, Any], TagDef] = {}

    for prop, raw_values in sorted(get_all_tag_types(features).items()):
        if prop.lower() in EXCLUDED_TAG_PROPS or ID_LIKE_KEY_RE.search(prop):
            continue

        values = [
            value
            for value in raw_values
            if value is not None and not isinstance(value, bool)
        ]
        if not values or all(isinstance(v, (int, float)) for v in values):
            continue
        if len(values) > 40:  # too high-cardinality to be a useful tag
            continue

        for value in values:
            if not isinstance(value, str) or not value.strip():
                continue
            if value.strip().lower() in SENTINEL_TAG_VALUES:
                continue
            if ID_LIKE_VALUE_RE.match(value.strip()):
                continue

            key = (prop, value)
            if key in lookup:
                continue

            tag_id = _slug(value)
            if tag_id in catalog:
                tag_id = f"{_slug(prop)}-{tag_id}"
            base_id, n = tag_id, 2
            while tag_id in catalog:
                tag_id = f"{base_id}-{n}"
                n += 1

            tag = TagDef(tag_id, _label(prop, value), prop, value)
            catalog[tag_id] = tag
            lookup[key] = tag

    return catalog, lookup


CATALOG, TAG_LOOKUP = _build_catalog(FEATURES)


def _feature_tag_ids(feature: dict[str, Any]) -> list[str]:
    props = feature.get("properties") or {}
    tag_ids: list[str] = []
    for prop in sorted(props):
        try:
            tag = TAG_LOOKUP.get((prop, props[prop]))
        except TypeError:  # unhashable property value
            continue
        if tag is not None:
            tag_ids.append(tag.id)
    return tag_ids


# ---------------------------------------------------------------------------
# API models
# ---------------------------------------------------------------------------


class PointGeometry(BaseModel):
    model_config = ConfigDict(extra="allow")

    type: Literal["Point"]
    coordinates: list[float] = Field(min_length=2)

    @field_validator("coordinates")
    @classmethod
    def _check_coordinates(cls, value: list[float]) -> list[float]:
        lon, lat = value[0], value[1]
        if not -180 <= lon <= 180:
            raise ValueError("longitude must be between -180 and 180")
        if not -90 <= lat <= 90:
            raise ValueError("latitude must be between -90 and 90")
        return value


class AreaProperties(BaseModel):
    model_config = ConfigDict(extra="allow")

    radius_m: float = Field(default=1000, gt=0, le=100_000)


class Area(BaseModel):
    model_config = ConfigDict(extra="allow")

    type: Literal["Feature"]
    geometry: PointGeometry
    properties: AreaProperties = Field(default_factory=AreaProperties)


class TagModel(BaseModel):
    id: str
    label: str


class ResultModel(BaseModel):
    """A full GeoJSON Feature plus search metadata."""

    model_config = ConfigDict(extra="allow")

    type: Literal["Feature"] = "Feature"
    id: int | str
    name: str
    geometry: dict[str, Any] = Field(default_factory=dict)
    properties: dict[str, Any] = Field(default_factory=dict)
    tags: list[TagModel]
    matched_tags: list[str]
    score: float
    distance_m: float | None


class SearchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    search_by: Literal["tags"] = "tags"
    tags: list[str]
    area: Area | None = None
    limit: int = Field(default=50, ge=1, le=500)
    # Extension: "all" requires every tag, "any" ranks by how many matched.
    match_mode: Literal["all", "any"] = "all"

    @field_validator("tags")
    @classmethod
    def _clean_tags(cls, value: list[str]) -> list[str]:
        cleaned: list[str] = []
        for tag in value:
            tag = tag.strip().lower()
            if tag and tag not in cleaned:
                cleaned.append(tag)
        if not cleaned:
            raise ValueError("tags must contain at least one tag id")
        return cleaned


class SearchResponse(BaseModel):
    search_by: Literal["tags"]
    tags: list[TagModel]
    area: Area | None
    count: int
    truncated: bool
    message: str | None
    results: list[ResultModel]


# ---------------------------------------------------------------------------
# Search logic
# ---------------------------------------------------------------------------


def _area_indices(area: Area | None) -> list[int]:
    """Feature indices whose nearest point lies inside the requested area."""
    if area is None:
        return list(range(len(FEATURES)))

    point = tuple(area.geometry.coordinates[:2])
    features = filter_features(
        FEATURES,
        target_point=point,
        max_distance_meters=area.properties.radius_m,
        nearest_point=True,
    )
    return [
        FEATURE_INDEX_BY_OBJECT[id(feature)]
        for feature in features
        if id(feature) in FEATURE_INDEX_BY_OBJECT
    ]


def _tag_model(tag: TagDef) -> TagModel:
    return TagModel(id=tag.id, label=tag.label)


def _make_result(
    index: int, score: float, matched: set[str], area: Area | None
) -> ResultModel:
    feature = FEATURES[index]
    props = feature.get("properties") or {}
    geometry = feature.get("geometry") or {}

    distance = None
    if area is not None:
        nearest = calculate_distance_to_geometry(
            tuple(area.geometry.coordinates[:2]), geometry
        )
        if nearest is not None:
            distance = round(nearest, 1)

    name = (
        props.get("trail_names")
        or props.get("trail_name")
        or props.get("name")
        or FEATURE_IDS[index]
    )
    # Keep every member of the original GeoJSON Feature (type, bbox, foreign
    # members, ...) and add the search metadata alongside it.
    payload = {
        key: value
        for key, value in feature.items()
        if key
        not in {"id", "name", "tags", "matched_tags", "score", "distance_m"}
    }
    return ResultModel(
        **payload,
        id=FEATURE_IDS[index],
        name=str(name),
        tags=[_tag_model(CATALOG[tag_id]) for tag_id in _feature_tag_ids(feature)],
        matched_tags=sorted(matched),
        score=round(score, 3),
        distance_m=distance,
    )


def _search(request: SearchRequest) -> SearchResponse:
    area = request.area
    messages: list[str] = []

    known: list[TagDef] = []
    unknown: list[str] = []
    for tag_id in request.tags:
        tag = CATALOG.get(tag_id)
        if tag is None:
            unknown.append(tag_id)
        else:
            known.append(tag)
    if unknown:
        messages.append(f"Unknown tags ignored: {', '.join(unknown)}.")

    if not known:
        results: list[ResultModel] = []
    else:
        area_indices = _area_indices(area)
        tag_indices: list[set[int]] = []
        for tag in known:
            tag_indices.append(
                {
                    index
                    for index in area_indices
                    if (FEATURES[index].get("properties") or {}).get(tag.property)
                    == tag.value
                }
            )
        if request.match_mode == "all":
            final_indices = set.intersection(*tag_indices)
        else:
            final_indices = set.union(*tag_indices)

        requested_ids = {tag.id for tag in known}
        results = []
        for index in final_indices:
            matched = set(_feature_tag_ids(FEATURES[index])) & requested_ids
            if request.match_mode == "all":
                score = 1.0
            else:
                score = len(matched) / len(known)
            results.append(_make_result(index, score, matched, area))

        results.sort(
            key=lambda result: (
                -result.score,
                result.distance_m if result.distance_m is not None else float("inf"),
                str(result.id),
            )
        )

    total = len(results)
    truncated = total > request.limit
    if truncated:
        messages.append(f"Showing {request.limit} of {total} matching trails.")

    return SearchResponse(
        search_by=request.search_by,
        tags=[_tag_model(tag) for tag in known],
        area=area,
        count=min(total, request.limit),
        truncated=truncated,
        message=" ".join(messages) or None,
        results=results[: request.limit],
    )


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Trail Search API",
    version="1.0.0",
    description="Search trails by tags, optionally within an area.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "features": len(FEATURES), "tags": len(CATALOG)}


@app.get("/tags")
def list_tags() -> dict[str, Any]:
    """Full tag catalog (useful for building the tags UI)."""
    return {
        "count": len(CATALOG),
        "tags": [
            {
                "id": tag.id,
                "label": tag.label,
                "property": tag.property,
                "value": tag.value,
            }
            for tag in sorted(CATALOG.values(), key=lambda item: item.id)
        ],
    }


@app.post("/search", response_model=SearchResponse)
def search(request: SearchRequest) -> SearchResponse:
    return _search(request)
