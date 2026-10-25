
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Filters from "../components/Filters";
import Buttons from "../components/Buttons";
import LengthSlider from "../components/LengthSlider";
import MapLoader from "../components/MapLoader";
import { DIFFICULTY_TAGS, type SearchResponse, type TrailFocus, type TrailResult } from "../types";
import { poeticName } from "../names";

/** Trails shorter than this are never shown. */
const MIN_TRAIL_LENGTH_M = 300;

const DIFFICULTY_CHIP: Record<string, string> = {
  easy: "bg-[#1E3C2C] text-[#9FD8AC]",
  moderate: "bg-[#3D2F10] text-[#EBD08A]",
  hard: "bg-[#3D1A12] text-[#F2B09B]",
};

function Chip({ difficulty }: { difficulty?: string }) {
  const key = difficulty?.toLowerCase() ?? "";
  return (
    <span
      className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold capitalize ${
        DIFFICULTY_CHIP[key] ?? "bg-white/10 text-cream/70"
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

/** Soft color tint for the steepness line, keyed off the worst bit (max slope %). */
function slopeColor(maxSlope?: number | null): string {
  if (maxSlope === null || maxSlope === undefined) return "text-cream/70";
  if (maxSlope < 5) return "text-[#9FD8AC]";
  if (maxSlope < 10) return "text-[#EBD08A]";
  if (maxSlope < 20) return "text-[#F2B09B]";
  return "text-[#F28585]";
}

function TrailCard({
  trail,
  onClick,
}: {
  trail: TrailResult;
  onClick: () => void;
}) {
  const { Avg_Slope: avgSlope, Max_Slope: maxSlope, surface_class: surface } =
    trail.properties;
  const surfaceValid = surface && surface.trim().length > 0;

  return (
    <article
      onClick={onClick}
      className="group cursor-pointer rounded-lg border border-dusk-border border-l-[3px] border-l-magenta bg-white/[0.03] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/[0.07] hover:shadow-lg hover:shadow-black/30"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-serif text-lg leading-snug text-cream">
          {poeticName(String(trail.id))}
        </h3>
        <Chip difficulty={trail.properties.difficulty} />
      </div>

      <p className="mt-2 text-sm text-cream/70">
        {formatLength(trail.properties?.length_m)} long
        {trail.distance_m !== null && ` · ${trail.distance_m} m from your marker`}
      </p>

      <p className={`mt-1 text-sm ${slopeColor(maxSlope ?? null)}`}>
        Avg climb {avgSlope ?? "—"}% · Max {maxSlope ?? "—"}%
      </p>

      <div className="mt-2 flex items-center justify-between gap-2">
        {surfaceValid ? (
          <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] capitalize text-cream/70">
            {surface}
          </span>
        ) : (
          <span />
        )}
        <span className="font-mono text-[10px] text-cream/40 group-hover:text-cream/60">
          trail #{trail.id} · click to zoom
        </span>
      </div>
    </article>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-lg border border-dusk-border bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="h-5 w-3/4 rounded bg-white/10" />
        <div className="h-6 w-16 rounded-full bg-white/10" />
      </div>
      <div className="mt-3 h-4 w-1/2 rounded bg-white/10" />
      <div className="mt-2 h-3 w-1/4 rounded bg-white/5" />
    </div>
  );
}

export default function Journey() {
  const [difficulty, setDifficulty] = useState("Low");
  const [radius, setRadius] = useState<number[]>([2.5]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [backendUrl, setBackendUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [focus, setFocus] = useState<TrailFocus | null>(null);

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

    const buildBody = (tags: string[], match_mode: "all" | "any") => ({
      search_by: "tags" as const,
      tags,
      area: {
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          // GeoJSON order is [longitude, latitude]
          coordinates: [coords.lng, coords.lat],
        },
        properties: { radius_m: radius[0] * 1000 },
      },
      limit: 500,
      match_mode,
    });

    setStatus("loading");
    try {
      let response: SearchResponse;

      if (difficulty === "All") {
        // Query each difficulty separately and merge, so the backend's
        // 500-result cap can't drop easy trails just because moderate/hard
        // ones are closer (a shared cutoff would sample the union instead).
        const settled = await Promise.allSettled(
          DIFFICULTY_TAGS.All.tags.map((tag) =>
            fetch(`${backendUrl}/search`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(buildBody([tag], "all")),
            }).then(async (res) => {
              if (!res.ok) throw new Error(`Search failed (${res.status})`);
              return (await res.json()) as SearchResponse;
            })
          )
        );

        const landed = settled.filter(
          (s): s is PromiseFulfilledResult<SearchResponse> =>
            s.status === "fulfilled"
        );
        if (landed.length === 0) throw new Error("All search legs failed");

        const seen = new Map<string, TrailResult>();
        for (const leg of landed) {
          for (const trail of leg.value.results) {
            const key = String(trail.id);
            if (!seen.has(key)) seen.set(key, trail);
          }
        }
        const merged = [...seen.values()].sort(
          (a, b) =>
            (a.distance_m ?? Infinity) - (b.distance_m ?? Infinity) ||
            String(a.id).localeCompare(String(b.id))
        );

        response = {
          search_by: "tags",
          tags: landed.flatMap((leg) => leg.value.tags),
          count: merged.length,
          truncated: false,
          message:
            landed.length < settled.length
              ? "Some difficulty lookups failed; results may be partial."
              : null,
          results: merged,
        };
      } else {
        const { tags, match_mode } =
          DIFFICULTY_TAGS[difficulty] ?? DIFFICULTY_TAGS.Low;
        const res = await fetch(`${backendUrl}/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildBody(tags, match_mode)),
        });
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
        response = await res.json();
      }

      setResult(response);
      setStatus("idle");
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  }

  const searchDisabled = !coords || !backendUrl || status === "loading";
  const trails = useMemo(
    () =>
      result?.results.filter(
        (trail) => (trail.properties.length_m ?? 0) >= MIN_TRAIL_LENGTH_M
      ) ?? [],
    [result]
  );

  return (
    <main className="flex min-h-[100dvh] flex-col bg-dusk text-cream md:h-[100dvh] md:min-h-0 md:overflow-hidden">
      <header className="shrink-0 border-b border-dusk-border bg-gradient-to-r from-forest via-[#0F2419] to-dusk">
        <div className="flex items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="font-serif text-2xl font-bold tracking-wide text-gold transition-opacity hover:opacity-80"
          >
            TOUCH GRASS
          </Link>
          <Link
            href="/"
            className="rounded-full border border-dusk-border px-4 py-2 text-sm text-cream/80 transition-colors hover:bg-white/5 hover:text-cream"
          >
            ← Back
          </Link>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 flex-col px-6 py-6 md:overflow-y-auto">
        <h1 className="mb-6 shrink-0 font-serif text-4xl text-cream md:text-5xl">
          Create an Adventure!
        </h1>

        <section className="mb-5 shrink-0 rounded-xl border border-dusk-border bg-dusk-panel p-5">
          <div className="flex flex-col gap-5">
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

            <div className="flex items-center gap-4">
              <Buttons onClick={search} disabled={searchDisabled}>
                Search
              </Buttons>
              {!coords && (
                <span className="text-sm text-cream/60">
                  Click the map to place your marker
                </span>
              )}
            </div>
          </div>
        </section>

        <section className="flex min-h-0 flex-1 flex-col gap-6 md:flex-row lg:gap-8">
          <div className="h-80 w-full shrink-0 overflow-hidden rounded-xl border border-dusk-border md:h-auto md:min-h-0 md:flex-[3]">
            <MapLoader
              onMarkerPlaced={setCoords}
              results={trails}
              radiusMeters={radius[0] * 1000}
              focus={focus}
            />
          </div>

          <aside className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-dusk-border bg-dusk-panel p-5">
            <h2 className="mb-2 shrink-0 font-serif text-2xl text-gold">
              Results
            </h2>

            {result !== null && status === "idle" && trails.length > 0 && (
              <p className="mb-4 shrink-0 text-sm text-cream/60">
                {trails.length} trail{trails.length === 1 ? "" : "s"} within {radius[0]} km
                {result.count > trails.length
                  ? ` · ${result.count - trails.length} filtered as too short`
                  : ""}
              </p>
            )}

            <div className="flex-1 overflow-y-auto pr-1">
              {status === "loading" && (
                <div className="flex flex-col gap-3">
                  {Array.from({ length: 4 }, (_, i) => (
                    <SkeletonCard key={i} />
                  ))}
                </div>
              )}
              {status === "error" && (
                <div className="text-cream/80">
                  <p className="text-[#F2B09B]">
                    Search failed — make sure the backend is running.
                  </p>
                  {coords && (
                    <div className="mt-3">
                      <Buttons onClick={search} disabled={!backendUrl}>
                        Retry
                      </Buttons>
                    </div>
                  )}
                </div>
              )}
              {status === "idle" && result !== null && trails.length === 0 && (
                <p className="text-cream/60">
                  🌱 No trails over 300 m were found here. Try a larger radius
                  or a different difficulty.
                </p>
              )}
              {status === "idle" && result !== null && trails.length > 0 && (
                <div className="flex flex-col gap-3">
                  {trails.map((trail) => (
                    <TrailCard
                      key={String(trail.id)}
                      trail={trail}
                      onClick={() =>
                        setFocus((f) => ({ id: String(trail.id), n: (f?.n ?? 0) + 1 }))
                      }
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Scroll fade hint at the bottom of the list */}
            <div className="pointer-events-none sticky bottom-0 -mb-5 h-10 bg-gradient-to-t from-dusk-panel to-transparent" />
          </aside>
        </section>
      </div>
    </main>
  );
}
