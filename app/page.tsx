"use client"

import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <div 
      className="flex flex-col min-h-screen justify-center items-center gap-6 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "radial-gradient(ellipse 55% 45% at center, rgba(255, 255, 255, 0.75) 0%, rgba(255, 255, 255, 0.25) 50%, rgba(255, 255, 255, 0) 100%), url('/assets/home-bg.png')" }}>
      <h1 className="title-rise title-gilded font-serif font-display text-6xl font-bold leading-none sm:text-8xl md:text-9xl">
        TOUCH GRASS
      </h1>
      <p className="title-rise mb-6 font-display text-base tracking-[0.5em] text-forest sm:text-lg font-semibold">
        Revitalize by going outside
      </p>
      <button 
      onClick={() => router.push("/home")}
      className="title-rise px-8 py-4 bg-reggreen font-serif tracking-[0.2em] text-lg text-white font-medium rounded-lg shadow-sm hover:bg-forest focus:outline-none">
        Begin Your Journey
      </button>
    </div>
  );
}
