
"use client";

import { useEffect, useState } from "react";
import {
  MapContainer,
  Circle,
  Polyline,
  TileLayer,
  LayersControl,
  Marker,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { divIcon, latLngBounds, type LatLng } from "leaflet";
import type { LatLngExpression } from "leaflet";
import type { TrailResult } from "../types";
import { poeticName } from "../names";

const { BaseLayer } = LayersControl;

interface MapMarker {
  id: number;
  position: LatLngExpression;
  lat: number;
  lng: number;
}

function MapClickHandler({
  onAddMarker,
}: {
  onAddMarker: (position: LatLng) => void;
}) {
  useMapEvents({
    click(event) {
      onAddMarker(event.latlng);
    },
  });

  return null;
}

function createDotIcon() {
  return divIcon({
    className: "!bg-transparent !border-0",
    html: `
      <div class="marker-dot-wrapper">
        <div class="marker-dot"></div>
        <button
          type="button"
          class="marker-delete"
          aria-label="Delete marker"
          title="Delete marker"
        >×</button>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

interface LeafletMapProps {
  /** Fires when a marker is placed (with its coords) or deleted (with null). */
  onMarkerPlaced?: (coords: { lat: number; lng: number } | null) => void;
  /** Matching trails from the search response, drawn on the map. */
  results?: TrailResult[];
  /** How far from the marker the search reaches (meters). */
  radiusMeters?: number;
}

/** Pan/zoom the map to show every matching trail after a search completes. */
function FitResults({ results }: { results: TrailResult[] }) {
  const map = useMap();

  useEffect(() => {
    if (results.length === 0) return;

    const bounds = latLngBounds([]);
    for (const trail of results) {
      for (const [lng, lat] of trail.geometry.coordinates) {
        bounds.extend([lat, lng]);
      }
    }
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [24, 24] });
    }
  }, [results, map]);

  return null;
}

/** Convert GeoJSON [lng, lat] pairs to Leaflet's [lat, lng] format. */
function toLeafletCoords(
  coordinates: [number, number][]
): LatLngExpression[] {
  return coordinates.map(([lng, lat]) => [lat, lng]);
}

export default function LeafletMap({
  onMarkerPlaced,
  results = [],
  radiusMeters = 0,
}: LeafletMapProps) {
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [activeMarkerId, setActiveMarkerId] = useState<number | null>(null);

  const activeMarker =
    markers.find((marker) => marker.id === activeMarkerId) ?? null;

  function addMarker(position: LatLng) {
  const id = markers[0]?.id ?? Date.now() + Math.random();

  setMarkers([
    {
      id,
      position: [position.lat, position.lng],
      lat: position.lat,
      lng: position.lng,
    },
  ]);

  setActiveMarkerId(id);

  onMarkerPlaced?.({ lat: position.lat, lng: position.lng });
}

  function deleteMarker(id: number) {
    setMarkers((current) => current.filter((marker) => marker.id !== id));

    setActiveMarkerId((current) => (current === id ? null : current));

    onMarkerPlaced?.(null);
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl">
      {/* Marker count and coordinates */}
      <div className="absolute right-3 top-3 z-1000 max-w-[calc(100%-5rem)] rounded-xl border border-[#E2E2D8] bg-[#FAF9F4] px-4 py-3 shadow-md">
        <div className="text-sm font-semibold text-[#35483B]">
          {markers.length} {markers.length === 1 ? "marker" : "markers"}
        </div>

        {activeMarker ? (
          <div className="mt-2 space-y-1">
            <div className="text-xs font-medium text-[#536457]">
              Selected coordinates
            </div>

            <div className="font-mono text-xs text-[#35483B]">
              Lat: {activeMarker.lat.toFixed(6)}
            </div>

            <div className="font-mono text-xs text-[#35483B]">
              Lng: {activeMarker.lng.toFixed(6)}
            </div>

            <button
              type="button"
              onClick={() =>
                navigator.clipboard.writeText(
                  `${activeMarker.lat}, ${activeMarker.lng}`
                )
              }
              className="mt-1 rounded-full border border-[#C8CEC3] px-3 py-1 text-xs font-medium text-[#365D46] transition hover:bg-[#E9EEE5]"
            >
              Copy coordinates
            </button>
          </div>
        ) : (
          <div className="mt-1 text-xs text-[#7A8578]">
            Click the map to add a marker
          </div>
        )}
      </div>

      <MapContainer
        center={[51.0447, -114.0719]}
        zoom={12}
        style={{ height: "100%", width: "100%" }}
      >
        <LayersControl position="topright">
          <BaseLayer checked name="City Map">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </BaseLayer>

          <BaseLayer name="Satellite">
            <TileLayer
              attribution="Imagery &copy; Esri, Maxar, Earthstar Geographics"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </BaseLayer>
        </LayersControl>

        <MapClickHandler onAddMarker={addMarker} />

        <FitResults results={results} />

        {results.map((trail) => (
          <Polyline
            key={String(trail.id)}
            positions={toLeafletCoords(trail.geometry.coordinates)}
            pathOptions={{ color: "#d946ef", weight: 4, opacity: 0.9 }}
          >
            <Tooltip direction="top" sticky>
              {poeticName(String(trail.id))}
              {trail.distance_m !== null && ` · ${trail.distance_m} m away`}
            </Tooltip>
          </Polyline>
        ))}

        {activeMarker && radiusMeters > 0 && (
          <Circle
            center={[activeMarker.lat, activeMarker.lng]}
            radius={radiusMeters}
            pathOptions={{
              color: "#d946ef",
              weight: 2,
              dashArray: "6 8",
              fillColor: "#d946ef",
              fillOpacity: 0.08,
            }}
          />
        )}

        {markers.map((marker) => (
          <Marker
            key={marker.id}
            position={marker.position}
            icon={createDotIcon()}
            eventHandlers={{
              click: (event) => {
                if (
                  (event.originalEvent.target as HTMLElement).closest(
                    ".marker-delete"
                  )
                ) {
                  return;
                }

                setActiveMarkerId(marker.id);
              },
              add(event) {
                const markerElement = event.target.getElement();
                const deleteButton =
                  markerElement?.querySelector(".marker-delete");

                deleteButton?.addEventListener("click", (e: Event) => {
                  e.preventDefault();
                  e.stopPropagation();
                  deleteMarker(marker.id);
                });
              },
            }}
          >
            <Tooltip direction="top" offset={[0, -12]}>
              Hover and click × to delete
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>

      <style jsx global>{`
        .marker-dot-wrapper {
          position: relative;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .marker-dot {
          width: 13px;
          height: 13px;
          border-radius: 50%;
          background: #365d46;
          border: 2px solid white;
          box-shadow: 0 1px 5px rgba(0, 0, 0, 0.35);
          transition: transform 150ms ease;
        }

        .marker-delete {
          position: absolute;
          top: -8px;
          right: -8px;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid white;
          border-radius: 50%;
          background: #365d46;
          color: white;
          font-size: 22px;
          font-weight: 500;
          line-height: 1;
          cursor: pointer;
          opacity: 0;
          pointer-events: none;
          transition:
            opacity 150ms ease,
            transform 150ms ease,
            background 150ms ease;
        }

        .marker-dot-wrapper:hover .marker-delete,
        .marker-dot-wrapper:focus-within .marker-delete {
          opacity: 1;
          pointer-events: auto;
        }

        .marker-dot-wrapper:hover .marker-dot {
          transform: scale(1.2);
        }

        .marker-delete:hover {
          background: #294a37;
          transform: scale(1.1);
        }
      `}</style>
    </div>
  );
}
