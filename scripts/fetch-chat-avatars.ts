// Fetch portrait photos from Pexels for the chat-mockup characters in
// PainResonance.tsx. Pexels lets us pick varied, real-looking faces
// without the consent + recognisability problems of recycling Unsplash
// stock that other landing pages use heavily.
//
// Run: PEXELS_API_KEY=... pnpm tsx scripts/fetch-chat-avatars.ts
// (the key is read from process.env, falling back to .env.local)
//
// Output: src/lib/marketing/chatAvatars.json — a stable, committed
// fixture that PainResonance imports. Re-run to refresh the cast.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type CharacterQuery = {
  initials: string;
  name: string;
  // Loose query passed to Pexels search. Tweak to bias the cast in any
  // direction — keep these neutral and let Pexels' algorithm pick.
  query: string;
  // Skip the first N hits to land on a less-stock-feeling photo. Each
  // character uses a different offset so adjacent rows in the chat don't
  // look like a series shoot.
  offset: number;
};

const CHARACTERS: CharacterQuery[] = [
  { initials: "NA", name: "Nia",   query: "black woman portrait smile",    offset: 2 },
  { initials: "SM", name: "Sam",   query: "casual man portrait",           offset: 3 },
  { initials: "MO", name: "Mo",    query: "young woman portrait casual",   offset: 5 },
  { initials: "TM", name: "Tom",   query: "professional man portrait",     offset: 4 },
  { initials: "AS", name: "Ash",   query: "candid woman portrait",         offset: 6 },
  { initials: "PR", name: "Priya", query: "south asian woman portrait",    offset: 1 },
];

type PexelsPhoto = {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographer_url: string;
  src: {
    medium: string;
    small: string;
    tiny: string;
    portrait: string;
  };
};

type PexelsResponse = {
  photos: PexelsPhoto[];
  total_results: number;
};

function readEnvLocal(): Record<string, string> {
  try {
    const raw = readFileSync(join(process.cwd(), ".env.local"), "utf8");
    const env: Record<string, string> = {};
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
    return env;
  } catch {
    return {};
  }
}

async function fetchPexelsPhoto(
  apiKey: string,
  character: CharacterQuery,
): Promise<PexelsPhoto | null> {
  const params = new URLSearchParams({
    query: character.query,
    per_page: "20",
    orientation: "square",
  });

  const response = await fetch(
    `https://api.pexels.com/v1/search?${params.toString()}`,
    { headers: { Authorization: apiKey } },
  );

  if (!response.ok) {
    console.error(
      `[${character.name}] Pexels error: ${response.status} ${response.statusText}`,
    );
    return null;
  }

  const data = (await response.json()) as PexelsResponse;
  if (data.photos.length === 0) {
    console.error(`[${character.name}] No photos found for "${character.query}"`);
    return null;
  }

  const offset = Math.min(character.offset, data.photos.length - 1);
  return data.photos[offset]!;
}

async function main() {
  const fileEnv = readEnvLocal();
  const apiKey = process.env.PEXELS_API_KEY ?? fileEnv.PEXELS_API_KEY;
  if (!apiKey) {
    console.error(
      "PEXELS_API_KEY not set. Add it to .env.local or pass via env.",
    );
    process.exit(1);
  }

  const results: Record<
    string,
    {
      photoUrl: string;
      photographer: string;
      photographerUrl: string;
      pexelsUrl: string;
    } | null
  > = {};

  for (const character of CHARACTERS) {
    const photo = await fetchPexelsPhoto(apiKey, character);
    if (!photo) {
      results[character.initials] = null;
      continue;
    }
    results[character.initials] = {
      photoUrl: photo.src.medium,
      photographer: photo.photographer,
      photographerUrl: photo.photographer_url,
      pexelsUrl: photo.url,
    };
    console.log(`[${character.name}] -> ${photo.photographer} · ${photo.url}`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const outPath = join(
    process.cwd(),
    "src",
    "lib",
    "marketing",
    "chatAvatars.json",
  );
  writeFileSync(outPath, JSON.stringify(results, null, 2) + "\n", "utf8");
  console.log(`\nWrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
