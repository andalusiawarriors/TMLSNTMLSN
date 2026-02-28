/**
 * List 50 SR Legacy (Standard Reference Legacy) foods for inspection.
 * Run: npx tsx scripts/list-sr-legacy-sample.ts
 * Uses EXPO_PUBLIC_USDA_API_KEY from .env.local (or .env) or DEMO_KEY.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
config();

const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1';
const API_KEY = process.env.EXPO_PUBLIC_USDA_API_KEY ?? 'DEMO_KEY';

const SEARCH_TERMS = [
  'beef', 'chicken', 'milk', 'bread', 'apple', 'fish', 'egg', 'cheese',
  'rice', 'potato', 'broccoli', 'pasta', 'salmon', 'turkey', 'yogurt',
  'oatmeal', 'beans', 'lettuce', 'tomato', 'carrot',
];

async function fetchSrLegacyPage(query: string, pageNumber: number): Promise<{ description: string; fdcId: number }[]> {
  const url = `${USDA_BASE}/foods/search?api_key=${API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: query.trim(),
      pageSize: 25,
      pageNumber,
      dataType: ['SR Legacy'],
    }),
  });
  if (!res.ok) throw new Error(`USDA API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const foods = (data.foods ?? []) as { description?: string; fdcId?: number }[];
  return foods.map((f) => ({ description: f.description ?? '(no description)', fdcId: f.fdcId ?? 0 }));
}

async function main() {
  const seen = new Set<number>();
  const list: { description: string; fdcId: number }[] = [];

  for (const term of SEARCH_TERMS) {
    if (list.length >= 50) break;
    try {
      const page = await fetchSrLegacyPage(term, 1);
      for (const item of page) {
        if (list.length >= 50) break;
        if (item.fdcId && !seen.has(item.fdcId)) {
          seen.add(item.fdcId);
          list.push(item);
        }
      }
    } catch (e) {
      console.error(`Search "${term}" failed:`, e);
    }
  }

  console.log('SR Legacy sample (50 entries)\n');
  list.forEach((item, i) => {
    console.log(`${(i + 1).toString().padStart(2)}. ${item.description}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
