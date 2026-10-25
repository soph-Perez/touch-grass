"use client";

import dynamic from "next/dynamic";
import type { TrailResult, TrailFocus } from "../types";

const LeafletMap = dynamic(
  () => import("../components/Leaflet"),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center">
        Loading map...
      </div>
    ),
  }
);

export default function MapLoader({
  onMarkerPlaced,
  results,
  radiusMeters,
  focus,
}: {
  onMarkerPlaced?: (coords: { lat: number; lng: number } | null) => void;
  results?: TrailResult[];
  radiusMeters?: number;
  focus?: TrailFocus | null;
}) {
  return (
    <LeafletMap
      onMarkerPlaced={onMarkerPlaced}
      results={results}
      radiusMeters={radiusMeters}
      focus={focus}
    />
  );
}
