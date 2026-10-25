
"use client";

const difficulties = ["Low", "Mid", "High", "All"];

interface FiltersProps {
  selected: string;
  onChange: (difficulty: string) => void;
}

export default function Filters({
  selected,
  onChange,
}: FiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-sm font-medium uppercase tracking-widest text-cream/60">
        Difficulty
      </span>

      {difficulties.map((difficulty) => (
        <button
          key={difficulty}
          type="button"
          aria-pressed={selected === difficulty}
          onClick={() => onChange(difficulty)}
          className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors duration-200 ${
            selected === difficulty
              ? "border-[#557D62] bg-[#2F5D43] text-white shadow-[0_0_12px_rgba(85,125,98,0.35)]"
              : "border-dusk-border bg-transparent text-cream/70 hover:bg-white/5 hover:text-cream"
          }`}
        >
          {difficulty}
        </button>
      ))}
    </div>
  );
}
