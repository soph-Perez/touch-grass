/**
 * Shape of one matching trail as returned by the backend's POST /search
 * response. (Full model in backend/app.py: SearchResponse → ResultModel.)
 */
export interface TrailResult {
  id: number | string;
  name: string;
  geometry: { type: "LineString"; coordinates: [number, number][] };
  properties: { length_m?: number; difficulty?: string };
  distance_m: number | null;
}

/** Full POST /search response (only the members the frontend uses). */
export interface SearchResponse {
  search_by: "tags";
  tags: { id: string; label: string }[];
  count: number;
  truncated: boolean;
  message: string | null;
  results: TrailResult[];
}

/** Card-click zoom request: which trail to focus, `n` makes re-clicks re-fire. */
export interface TrailFocus {
  id: string;
  n: number;
}

/** Backend search config: which difficulty tags the filter chips map onto. */
export const DIFFICULTY_TAGS: Record<
  string,
  { tags: string[]; match_mode: "all" | "any" }
> = {
  Low: { tags: ["easy"], match_mode: "all" },
  Mid: { tags: ["moderate"], match_mode: "all" },
  High: { tags: ["hard"], match_mode: "all" },
  All: { tags: ["easy", "moderate", "hard"], match_mode: "any" },
};
