
"use client";

import { useEffect, useState } from "react";
import Filters from "../components/Filters";
import Buttons from "../components/Buttons";
import LengthSlider from "../components/LengthSlider";
import MapLoader from "../components/MapLoader";

interface Coords {
  lat: number;
  lng: number;
}

interface SearchRequestSettings {
  tags: string[];
  match_mode: "all" | "any";
}

// Difficulty options in the Filters component mapped to backend tag ids.
const DIFFICULTY_TAGS: Record<string, SearchRequestSettings> = {
  Low: { tags: ["easy"], match_mode: "all" },
  Mid: { tags: ["moderate"], match_mode: "all" },
  High: { tags: ["hard"], match_mode: "all" },
  All: { tags: ["easy", "moderate", "hard"], match_mode: "any" },
};

type RequestStatus = "idle" | "loading" | "error";

export default function Journey() {
  const [difficulty, setDifficulty] = useState("Low");
  const [radius, setRadius] = useState<number[]>([25]);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [backendUrl, setBackendUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<RequestStatus>("idle");
  const [result, setResult] = useState<unknown>(null);

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
          limit: 50,
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
            <MapLoader onMarkerPlaced={setCoords} />
          </div>


        <aside className="rounded-xl border border-[#E2E2D8] bg-white p-5 flex-1">
          <h2 className="mb-4 font-serif text-2xl text-forest">
            Results
          </h2>

          {status === "loading" && <p className="text-[#536457]">Searching trails…</p>}
          {status === "error" && (
            <p className="text-red-600">
              Search failed — make sure the backend is running (see console).
            </p>
          )}
          {status === "idle" && result !== null && (
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap font-mono text-xs text-[#35483B]">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </aside>
        </section>
      </div>
    </main>
  );
}
