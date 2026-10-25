/**
 * Deterministic poetic trail names.
 *
 * A cheap hash of the trail id is used to pick fragments from curated pools,
 * so the same trail always gets the same name in every search.
 */

const ADJECTIVES = [
  "Whispering", "Restless", "Gilded", "Patient", "Forgotten", "Humble",
  "Quiet", "Wandering", "Lingering", "Amber", "Sunken", "Ancestral",
  "Austere", "Roving", "Slow", "Solitary", "Threadbare", "Emberlit",
  "Untamed", "Silent", "Fading", "Honest", "Drifting", "Windward",
];

const NOUNS = [
  "Ascent", "Reverie", "Vigil", "Murmur", "Threshold", "Prologue",
  "Pilgrimage", "Cartography", "Meander", "Aurora", "Solitude", "Beacon",
  "Benediction", "Crossing", "Lullaby", "Sanctuary", "Tether", "Vernacular",
  "Hymn", "Driftwood", "Ember", "Orbit", "Fable", "Compass",
];

const PATTERNS = [
  "The {a} {n}",
  "{n} of the {a} Valley",
  "Where the {a} {n} Begins",
  "Notes on a {a} {n}",
  "In Praise of the {a} Trail",
  "A {n} for the {a} Hour",
  "The {a} {n} Revisited",
  "Second {n} of the {a} Hills",
  "Song of the {a} {n}",
  "The {n} the {a} Light Forgot",
  "Letter from a {a} {n}",
  "Ending of a {a} {n}",
];

/** Cheap, stable 32-bit hash. */
function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (h * 31 + text.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function poeticName(id: string): string {
  const h = hash(id);
  const template = PATTERNS[h % PATTERNS.length];
  const adjective = ADJECTIVES[(h >> 3) % ADJECTIVES.length];
  const noun = NOUNS[(h >> 7) % NOUNS.length];
  return template.replaceAll("{a}", adjective).replaceAll("{n}", noun);
}
