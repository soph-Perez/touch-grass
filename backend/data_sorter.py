import json
import math

def calculate_haversine_distance(coord1, coord2):
    """Calculates Great Circle distance between two (lon, lat) points in meters."""
    lon1, lat1 = coord1
    lon2, lat2 = coord2
    R = 6371000.0  # Earth radius in meters
    
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) *
         math.sin(delta_lambda / 2.0) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c


def get_first_point(geometry):
    """Extracts the first [longitude, latitude] coordinate from a GeoJSON geometry."""
    g_type = geometry.get("type")
    coords = geometry.get("coordinates", [])
    
    if not coords:
        return None
    if g_type == "Point":
        return coords
    elif g_type in ("LineString", "MultiPoint"):
        return coords[0]
    elif g_type in ("Polygon", "MultiLineString"):
        return coords[0][0]
    elif g_type == "MultiPolygon":
        return coords[0][0][0]
    return None


def _iter_geometry_lines(geometry):
    """Yields each line/ring of a GeoJSON geometry as a list of positions."""
    g_type = geometry.get("type")
    coords = geometry.get("coordinates") or []
    if not coords:
        return

    if g_type == "Point":
        yield coords
    elif g_type in ("MultiPoint", "LineString"):
        yield coords
    elif g_type in ("MultiLineString", "Polygon"):
        for part in coords:
            yield part
    elif g_type == "MultiPolygon":
        for polygon in coords:
            for ring in polygon:
                yield ring


def _project_to_local_meters(coord, origin):
    """Projects a (lon, lat) coordinate to meters on a plane centered on origin."""
    lon, lat = coord[0], coord[1]
    lon0, lat0 = origin[0], origin[1]
    x = math.radians(lon - lon0) * math.cos(math.radians(lat0)) * 6371000.0
    y = math.radians(lat - lat0) * 6371000.0
    return x, y


def _point_to_segment_distance(px, py, ax, ay, bx, by):
    """Shortest distance from (px, py) to segment (ax, ay)-(bx, by)."""
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)

    t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def calculate_distance_to_geometry(point, geometry):
    """
    Calculates the shortest distance in meters from a (lon, lat) point to any
    part of a GeoJSON geometry (vertex or segment).

    Returns None when the geometry has no usable coordinates.
    """
    lines = list(_iter_geometry_lines(geometry))
    if not lines:
        return None

    best = math.inf
    # The query point is the origin of the local projection.
    for line in lines:
        projected = [
            _project_to_local_meters(coord, point)
            for coord in line
            if len(coord) >= 2
        ]
        if not projected:
            continue
        if len(projected) == 1:
            best = min(best, math.hypot(*projected[0]))
        for a, b in zip(projected, projected[1:]):
            best = min(best, _point_to_segment_distance(0.0, 0.0, *a, *b))

    return None if best == math.inf else best


def get_all_tag_types(geojson_data):
    """
    Scans a GeoJSON object and returns a dictionary of all unique property 
    keys and their distinct values present in the data.
    """
    if isinstance(geojson_data, dict):
        if geojson_data.get("type") == "FeatureCollection":
            features = geojson_data.get("features", [])
        elif geojson_data.get("type") == "Feature":
            features = [geojson_data]
        else:
            features = []
    elif isinstance(geojson_data, list):
        features = geojson_data
    else:
        features = []

    tags_summary = {}
    for feature in features:
        properties = feature.get("properties", {})
        for key, val in properties.items():
            if key not in tags_summary:
                tags_summary[key] = set()
            tags_summary[key].add(val)
            
    return {
        k: sorted(list(v), key=lambda x: (x is None, str(x))) 
        for k, v in tags_summary.items()
    }


def filter_features(geojson_data, target_point, max_distance_meters, required_tags=None, nearest_point=False):
    """
    Filters features in a GeoJSON object within max_distance_meters of
    target_point and matching required_tags.

    By default distance is measured to the first coordinate of each feature
    (legacy behaviour). Pass nearest_point=True to measure the shortest
    distance to any vertex or segment of the feature instead.

    Returns a list of the matching Feature dictionaries.
    """
    if isinstance(geojson_data, dict):
        if geojson_data.get("type") == "FeatureCollection":
            features = geojson_data.get("features", [])
        elif geojson_data.get("type") == "Feature":
            features = [geojson_data]
        else:
            features = []
    elif isinstance(geojson_data, list):
        features = geojson_data
    else:
        features = []

    matching_features = []

    for feature in features:
        # 1. Check property tags match (cheap check first)
        if required_tags:
            props = feature.get("properties", {})
            if not all(props.get(k) == v for k, v in required_tags.items()):
                continue

        # 2. Measure distance to the feature (nearest point or first point)
        geometry = feature.get("geometry", {})
        if nearest_point:
            distance = calculate_distance_to_geometry(target_point, geometry)
            if distance is None:
                continue
        else:
            first_point = get_first_point(geometry)
            if not first_point:
                continue
            distance = calculate_haversine_distance(first_point, target_point)

        # 3. Check distance
        if distance > max_distance_meters:
            continue

        matching_features.append(feature)

    return matching_features


def filter_geojson(geojson_data, target_point, max_distance_meters, required_tags=None, indent=2, nearest_point=False):
    """
    Filters features in a GeoJSON object within max_distance_meters of
    target_point and matching required_tags.

    By default distance is measured to the first coordinate of each feature
    (legacy behaviour). Pass nearest_point=True to measure the shortest
    distance to any vertex or segment of the feature instead.

    Returns a GeoJSON FeatureCollection string.
    """
    output_collection = {
        "type": "FeatureCollection",
        "features": filter_features(
            geojson_data,
            target_point,
            max_distance_meters,
            required_tags=required_tags,
            nearest_point=nearest_point,
        ),
    }

    return json.dumps(output_collection, indent=indent)


def main():
    file_path = "data.geojson"

    # Load file data
    with open(file_path, "r", encoding="utf-8") as f:
        geojson_data = json.load(f)

    # 1. Retrieve and display available tag types
    all_tags = get_all_tag_types(geojson_data)
    print("=== Available Property Tags & Values ===")
    print(json.dumps(all_tags, indent=2))

    print("\n" + "=" * 50 + "\n")

    # 2. Set search params & filter
    target_point = (-114.0715, 51.1071)  # (longitude, latitude)
    max_distance_meters = 500
    search_tags = {
        "main_surface": "natural",
        "difficulty_placeholder": "moderate"
    }

    matching_json_str = filter_geojson(
        geojson_data=geojson_data,
        target_point=target_point,
        max_distance_meters=max_distance_meters,
        required_tags=search_tags
    )

    # Print matching JSON output
    print("=== Matching Features (GeoJSON Output) ===")
    print(matching_json_str)


if __name__ == "__main__":
    main()
