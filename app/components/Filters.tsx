
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
      <span className="mr-2 text-2xl font-medium text-[#35483B]">
        Difficulty:
      </span>

      {difficulties.map((difficulty) => (
        <button
          key={difficulty}
          type="button"
          onClick={() => onChange(difficulty)}
          className={`rounded-full border px-5 py-2 text-lg font-medium transition-colors duration-200 ${
            selected === difficulty
              ? "border-[#557D62] bg-[#557D62] text-white"
              : "border-[#C8CEC3] bg-transparent text-[#35483B] hover:bg-[#E9EEE5]"
          }`}
        >
          {difficulty}
        </button>
      ))}
    </div>
  );
}
