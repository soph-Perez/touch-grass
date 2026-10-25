
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
      <label className="shrink-0 text-2xl font-medium text-[#35483B]">
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
        min={1}
        max={50}
        step={1}
        className="flex-1 cursor-pointer"
      />

      <span className="w-16 shrink-0 text-right text-sm text-[#536457]">
        {value[0]} km
      </span>
    </div>
  );
}
