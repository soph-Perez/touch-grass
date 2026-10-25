
"use client";

import { useState } from "react";
import Filters from "../components/Filters";
import Buttons from "../components/Buttons";
import LengthSlider from "../components/LengthSlider";
import MapLoader from "../components/MapLoader";

export default function Journey() {
  const [difficulty, setDifficulty] = useState("Low");
  const [length, setLength] = useState<number[]>([25]);

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
                value={length}
                onChange={setLength}
              />
            </div>
          </div>
        </section>
        <section className="flex gap-6">
          <div className="h-125 w-full flex-3">
            <MapLoader />
          </div>
        

        <aside className="rounded-xl border border-[#E2E2D8] bg-white p-5 flex-1">
          <h2 className="mb-4 font-serif text-2xl text-forest">
            Results
          </h2>
        </aside>
        </section>
      </div>
    </main>
  );
}
