
"use client";

import { useEffect, useState } from "react";
import Filters from "../components/Filters";
import Buttons from "../components/Buttons";
import LengthSlider from "../components/LengthSlider";
import MapLoader from "../components/MapLoader";
import { DIFFICULTY_TAGS, type TrailResult } from "../types";
import { poeticName } from "../names";

/** Trails shorter than this are never shown. */
const MIN_TRAIL_LENGTH_M = 300;

const DIFFICULTY_CHIP: Record<string, string> = {
  easy: "bg-[#557D62] text-white",
  moderate: "bg-[#E8B44A] text-[#35483B]",
  hard: "bg-[#C4553B] text-white",
};

function Chip({ difficulty }: { difficulty?: string }) {
  const key = difficulty?.toLowerCase() ?? "";
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
        DIFFICULTY_CHIP[key] ?? "bg-[#E2E2D8] text-[#536457]"
      }`}
    >
      {key || "unrated"}
    </span>
  );
}

function formatLength(meters?: number): string {
  if (meters === undefined) return "—";
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

function TrailCard({ trail }: { trail: TrailResult }) {
  return (
    <article className="rounded-lg border border-[#E2E2D8] bg-[#FAF9F4] p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-serif text-lg leading-snug text-[#35483B]">
          {poeticName(String(trail.id))}
        </h3>
        <Chip difficulty={trail.properties.difficulty} />
      </div>

      <p className="mt-2 text-sm text-[#536457]">
        {formatLength(trail.properties?.length_m)} long
        {trail.distance_m !== null && ` · ${trail.distance_m} m from your marker`}
      </p>

      <p className="mt-1 font-mono text-[10px] text-[#7A8578]">
        trail #{trail.id}
      </p>
    </article>
  );
}

interface Coords {
  lat: number;
  lng: number;
}

interface SearchResponse {
  count: number;
  truncated: boolean;
  message: string | null;
  results: TrailResult[];
}

type RequestStatus = "idle" | "loading" | "error";

export default function Journey() {
  const [difficulty, setDifficulty] = useState("Low");
  const [radius, setRadius] = useState<number[]>([2.5]);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [backendUrl, setBackendUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<RequestStatus>("idle");
  const [result, setResult] = useState<SearchResponse | null>(null);

  // Ask the Next server where the backend lives (see app/api/config).
  useEffect(() => {
    fetch("/api/config")
      .then((res) =>
        res.ok
          ? res.json()
          : Promise.reject(new Error(`Config request failed (${res.status})`))
      )
      .then((data) => setBackendUrl(data.backendUrl))
      .catch((err) => {
        console.error(err);
        setStatus("error");
      });
  }, []);

  async function search() {
    if (!coords || !backendUrl) return;

    const { tags, match_mode } = DIFFICULTY_TAGS[difficulty] ?? DIFFICULTY_TAGS.Low;

    setStatus("loading");
    try {
      const res = await fetch(`${backendUrl}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          search_by: "tags",
          tags,
          area: {
            type: "Feature",
            geometry: {
              type: "Point",
              // GeoJSON order is [longitude, latitude]
              coordinates: [coords.lng, coords.lat],
            },
            properties: { radius_m: radius[0] * 1000 },
          },
          limit: 500,
          match_mode,
        }),
      });

      if (!res.ok) throw new Error(`Search failed (${res.status})`);
      setResult(await res.json());
      setStatus("idle");
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  }

  const searchDisabled = !coords || !backendUrl || status === "loading";
  const trails = result?.results.filter(
    (trail) => (trail.properties.length_m ?? 0) >= MIN_TRAIL_LENGTH_M
  ) ?? [];

  return (
    <main className="min-h-screen bg-cream p-6">
      <h1 className="mb-6 font-serif text-4xl text-forest md:text-5xl">
        Create an Adventure!
      </h1>

      <div className="flex">

      </div>
      <div className="grid grid-cols-1 gap-5">
        <section className="overflow-hidden">
          <div className="gap-5 border-b border-[#E2E2D8] p-5">
            <Filters
              selected={difficulty}
              onChange={setDifficulty}
            />

            <div className="w-full sm:w-200">
              <LengthSlider
                value={radius}
                onChange={setRadius}
              />
            </div>

            <div className="mt-5 flex items-center gap-4">
              <Buttons onClick={search} disabled={searchDisabled}>
                Search
              </Buttons>
              {!coords && (
                <span className="text-sm text-[#7A8578]">
                  Click the map to add a marker first
                </span>
              )}
            </div>
          </div>
        </section>
        <section className="flex gap-6">
          <div className="h-125 w-full flex-3">
            <MapLoader
              onMarkerPlaced={setCoords}
              results={trails}
              radiusMeters={radius[0] * 1000}
            />
          </div>


        <aside className="flex flex-1 flex-col rounded-xl border border-[#E2E2D8] bg-white p-5">
          <h2 className="mb-4 shrink-0 font-serif text-2xl text-forest">
            Results
          </h2>

          {status === "loading" && <p className="text-[#536457]">Searching trails…</p>}
          {status === "error" && (
            <p className="text-red-600">
              Search failed — make sure the backend is running (see console).
            </p>
          )}
          {status === "idle" && result !== null && trails.length === 0 && (
            <p className="text-[#536457]">
              No trails over 300 m were found here. Try a larger radius or a
              different difficulty.
            </p>
          )}
          {status === "idle" && result !== null && trails.length > 0 && (
            <div className="flex flex-col gap-3 overflow-y-auto">
              {trails.map((trail) => (
                <TrailCard key={String(trail.id)} trail={trail} />
              ))}
            </div>
          )}
        </aside>
        </section>
      </div>
    </main>
  );
}
