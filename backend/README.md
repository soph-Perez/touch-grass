# Trail Search API

A FastAPI service for the cleaned trail data in `output.json` (7,976 LineString
features). It implements the team's `POST /search` contract for **tag search**
and reuses the helpers in `data_sorter.py` (`filter_features`,
`get_all_tag_types`, `calculate_distance_to_geometry`).

## Run

```bash
python -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app:app --reload --port 8000
```

- API docs (Swagger UI): http://127.0.0.1:8000/docs
- Tag catalog: `GET /tags`
- Health: `GET /health`
- Use a different GeoJSON file with `TRAILS_DATA=/path/to/file.geojson`
  (for example `TRAILS_DATA=data.geojson`).

Run the tests:

```bash
.venv/bin/python -m pytest -q
```

## POST /search

```bash
curl -s http://127.0.0.1:8000/search \
  -H 'Content-Type: application/json' \
  -d '{
    "search_by": "tags",
    "tags": ["natural", "moderate"],
    "area": {
      "type": "Feature",
      "geometry": {"type": "Point", "coordinates": [-114.07236068960189, 51.106715387375885]},
      "properties": {"radius_m": 1500}
    },
    "limit": 50
  }'
```

Request fields:

| Field        | Notes                                                       |
| ------------ | ----------------------------------------------------------- |
| `search_by`  | Optional, must be `"tags"` if sent (default `"tags"`)       |
| `tags`       | Required, non-empty list of tag ids                         |
| `area`       | Optional GeoJSON Feature with a `Point` and `radius_m`      |
| `limit`      | Optional, default `50`, max `500`                           |
| `match_mode` | Optional extension: `"all"` (default) or `"any"`            |

Response:

```json
{
  "search_by": "tags",
  "tags": [{ "id": "moderate", "label": "Moderate difficulty" }],
  "area": { "...": "echoed request area" },
  "count": 1,
  "truncated": false,
  "message": null,
  "results": [
    {
      "type": "Feature",
      "id": 1,
      "name": "1",
      "geometry": { "type": "LineString", "coordinates": [] },
      "properties": {
        "OBJECTID": 1,
        "surface_class": "natural",
        "length_m": 76.5,
        "Max_Slope": 8,
        "Avg_Slope": 5,
        "difficulty": "moderate"
      },
      "tags": [
        { "id": "moderate", "label": "Moderate difficulty" },
        { "id": "natural", "label": "Natural surface" }
      ],
      "matched_tags": ["moderate", "natural"],
      "score": 1.0,
      "distance_m": 0.0
    }
  ]
}
```

- `tags` echoes the requested tags that exist in the catalog.
- `count` is the number of results returned; `truncated` is true when more
  trails matched than `limit`.
- `message` carries optional info: unknown tags or truncation.
- `results[]` are complete GeoJSON Features: `type`, `id`, `geometry`,
  `properties` and any other original members (for example `bbox`) are returned
  unchanged, with the search metadata (`name`, `tags`, `matched_tags`, `score`,
  `distance_m`) added alongside them. The original numeric `id` is preserved,
  so each result can be passed straight to a GeoJSON map layer.
- `results[].tags` lists every tag on that trail; `matched_tags` lists the ones
  that matched the query.
- `distance_m` is the shortest distance from the area point to any vertex or
  segment of the trail geometry.
- `score` is `1.0` in `"all"` mode, or the fraction of requested tags matched in
  `"any"` mode.

## Tag catalog

Tags are derived automatically from categorical string properties. Identifier
and name properties (`OBJECTID`, `id`, `name`, `trail_id`, ...), numeric
properties, and sentinel values (`unknown`, `unrated`, ...) are skipped. For
`output.json`:

| id         | label               | property        |
| ---------- | ------------------- | --------------- |
| `boardwalk`| Boardwalk surface   | `surface_class` |
| `easy`     | Easy difficulty     | `difficulty`    |
| `gravel`   | Gravel surface      | `surface_class` |
| `hard`     | Hard difficulty     | `difficulty`    |
| `moderate` | Moderate difficulty | `difficulty`    |
| `natural`  | Natural surface     | `surface_class` |
| `paved`    | Paved surface       | `surface_class` |

Tag search with `"match_mode": "all"` requires every tag to be present on the
trail. `"any"` returns trails with at least one and ranks by how many matched.
Unknown tag ids are ignored and reported in `message`.

## Area behaviour

The area filter uses `data_sorter.filter_features(..., nearest_point=True)`, so
a trail is inside the area when the **nearest point on the trail geometry** is
within `radius_m` metres of the area point. Distance is measured to the closest
vertex or line segment, not to the trail's start coordinate. The same
nearest-point distance is returned as `distance_m`.

Omit `area` to search the whole dataset. `radius_m` defaults to `1000` if not
supplied. `filter_geojson` keeps `nearest_point=False` as its default for
backwards compatibility with the original script.
