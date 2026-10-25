
"use client";

import { Slider } from "@/components/ui/slider";

interface LengthSliderProps {
  value: number[];
  onChange: (value: number[]) => void;
}

export default function LengthSlider({
  value,
  onChange,
}: LengthSliderProps) {
  return (
    <div className="flex w-full items-center gap-4">
      <label className="shrink-0 text-sm font-medium uppercase tracking-widest text-cream/60">
        Radius (km):
      </label>

      <Slider
        value={value}
        onValueChange={(newValue) =>
          onChange(
            typeof newValue === "number"
              ? [newValue]
              : [...newValue]
          )
        }
        min={0.1}
        max={5}
        step={0.1}
        className="flex-1 cursor-pointer"
      />

      <span className="w-16 shrink-0 text-right text-sm text-cream/80">
        {value[0]} km
      </span>
    </div>
  );
}
