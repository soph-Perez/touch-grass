"use client";

import dynamic from "next/dynamic";
import type { TrailResult } from "../types";

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
}: {
  onMarkerPlaced?: (coords: { lat: number; lng: number } | null) => void;
  results?: TrailResult[];
  radiusMeters?: number;
}) {
  return (
    <LeafletMap
      onMarkerPlaced={onMarkerPlaced}
      results={results}
      radiusMeters={radiusMeters}
    />
  );
}
