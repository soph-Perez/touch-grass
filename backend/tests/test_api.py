"""Smoke tests for the trail tag-search API."""

import json
from pathlib import Path

from fastapi.testclient import TestClient

from app import app

client = TestClient(app)

DATA = json.loads((Path(__file__).resolve().parents[1] / "output.json").read_text())

# A point on the last vertex of feature id 1, about 74 m from its start point.
FEATURE_1_LAST_VERTEX = [-114.07236068960189, 51.106715387375885]
AREA = {
    "type": "Feature",
    "geometry": {"type": "Point", "coordinates": FEATURE_1_LAST_VERTEX},
    "properties": {"radius_m": 50},
}


def post(payload):
    return client.post("/search", json=payload)


def test_health_and_tags():
    assert client.get("/health").json()["status"] == "ok"
    tags = client.get("/tags").json()
    ids = {tag["id"] for tag in tags["tags"]}
    assert ids == {
        "boardwalk",
        "easy",
        "gravel",
        "hard",
        "moderate",
        "natural",
        "paved",
    }
    # Sentinel values should not become tags.
    assert "unknown" not in ids
    assert "unrated" not in ids


def test_tag_search_in_area():
    response = post({"tags": ["natural", "moderate"], "area": AREA})
    assert response.status_code == 200
    body = response.json()
    assert body["search_by"] == "tags"
    assert body["area"] == AREA
    assert body["count"] == 1
    assert body["truncated"] is False
    result = body["results"][0]
    assert result["id"] == 1
    assert result["matched_tags"] == ["moderate", "natural"]
    assert result["score"] == 1.0
    assert result["distance_m"] == 0.0
    assert {tag["id"] for tag in body["tags"]} == {"natural", "moderate"}


def test_result_is_full_geojson_feature():
    body = post({"tags": ["moderate"], "area": AREA}).json()
    result = body["results"][0]
    source = next(feature for feature in DATA["features"] if feature["id"] == 1)
    assert result["type"] == "Feature"
    assert result["id"] == 1
    assert result["geometry"] == source["geometry"]
    assert result["properties"] == source["properties"]


def test_area_uses_nearest_point_not_start_point():
    # A 30 m radius still matches feature 1 because its nearest part is 0 m
    # away, even though its start point is ~74 m from the query point.
    area = {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": FEATURE_1_LAST_VERTEX},
        "properties": {"radius_m": 30},
    }
    body = post({"tags": ["natural"], "area": area}).json()
    results = {result["id"]: result for result in body["results"]}
    assert 1 in results
    assert results[1]["distance_m"] == 0.0


def test_tag_search_without_area():
    body = post({"tags": ["boardwalk"]}).json()
    assert body["count"] == 2
    assert [result["id"] for result in body["results"]] == [5036, 7338]
    assert all(result["distance_m"] is None for result in body["results"])


def test_tags_search_impossible_combination():
    body = post({"tags": ["boardwalk", "natural"]}).json()
    assert body["count"] == 0
    assert body["truncated"] is False
    assert body["results"] == []


def test_tags_search_any_mode():
    body = post(
        {"tags": ["boardwalk", "paved"], "match_mode": "any", "limit": 500}
    ).json()
    assert body["count"] == 84
    assert body["truncated"] is False
    assert all(result["score"] == 0.5 for result in body["results"])


def test_unknown_tag_is_reported():
    body = post({"tags": ["cafe"]}).json()
    assert body["count"] == 0
    assert body["message"] == "Unknown tags ignored: cafe."
    assert body["tags"] == []


def test_unknown_tag_is_ignored_when_known_tag_present():
    body = post({"tags": ["boardwalk", "cafe"]}).json()
    assert body["count"] == 2
    assert "Unknown tags ignored: cafe." in body["message"]


def test_limit_and_truncated():
    body = post({"tags": ["natural"], "limit": 1}).json()
    assert body["count"] == 1
    assert body["truncated"] is True
    assert "Showing 1 of 5584" in body["message"]


def test_validation():
    assert post({}).status_code == 422
    assert post({"tags": []}).status_code == 422
    assert post({"tags": ["natural"], "limit": 0}).status_code == 422
    assert post({"tags": ["natural"], "search_by": "prompt"}).status_code == 422
    assert post({"tags": ["natural"], "prompt": "quiet"}).status_code == 422
