/** One matching trail as returned by the backend's POST /search response. */
export interface TrailResult {
  id: number | string;
  name: string;
  geometry: { type: "LineString"; coordinates: [number, number][] };
  properties: { length_m?: number; difficulty?: string };
  distance_m: number | null;
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
