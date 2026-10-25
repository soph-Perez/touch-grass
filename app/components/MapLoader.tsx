
"use client";

import dynamic from "next/dynamic";

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
}: {
  onMarkerPlaced?: (coords: { lat: number; lng: number } | null) => void;
}) {
  return <LeafletMap onMarkerPlaced={onMarkerPlaced} />;
}
