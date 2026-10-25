
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
import type { TrailResult, TrailFocus } from "../types";
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
  /** Card-click zoom request from the results panel. */
  focus?: TrailFocus | null;
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

/** Zoom to a single trail when its result card is clicked. */
function TrailFocusZoom({
  focus,
  results,
}: {
  focus: TrailFocus | null;
  results: TrailResult[];
}) {
  const map = useMap();

  useEffect(() => {
    if (!focus) return;

    const trail = results.find((entry) => String(entry.id) === focus.id);
    if (!trail) return;

    const coords = latLngBounds(
      trail.geometry.coordinates.map(([lng, lat]) => [lat, lng])
    );
    if (coords.isValid()) {
      map.flyToBounds(coords, { padding: [40, 40], maxZoom: 17, duration: 0.8 });
    }
  }, [focus, results, map]);

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
  focus = null,
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
      {/* Compact coordinates + radius readout */}
      <div className="absolute bottom-3 left-3 z-1000 rounded-lg border border-white/15 bg-[#0D1F17]/85 px-3 py-2 text-cream shadow-md backdrop-blur-sm">
        {activeMarker ? (
          <div className="font-mono text-[11px] leading-4">
            <div>
              {activeMarker.lat.toFixed(5)}, {activeMarker.lng.toFixed(5)}
            </div>
            <div className="text-cream/60">
              {(radiusMeters / 1000).toFixed(1)} km radius
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-cream/70">
            Click the map to place your marker
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="absolute bottom-9 right-3 z-1000 rounded-lg border border-white/15 bg-[#0D1F17]/85 px-3 py-2 shadow-md backdrop-blur-sm">
        <div className="flex items-center gap-2 text-[11px] text-cream/85">
          <span
            className="inline-block h-[3px] w-5 rounded"
            style={{ background: "#d946ef" }}
          />
          Matching trails
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-cream/85">
          <span
            className="inline-block h-3 w-5 rounded border-2 border-dashed"
            style={{ borderColor: "rgba(217, 70, 239, 0.55)" }}
          />
          Search reach
        </div>
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

          <BaseLayer name="Dark Map">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
          </BaseLayer>
        </LayersControl>

        <MapClickHandler onAddMarker={addMarker} />

        <FitResults results={results} />
        <TrailFocusZoom focus={focus} results={results} />

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
