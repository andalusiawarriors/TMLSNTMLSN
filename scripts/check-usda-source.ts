/**
 * Check which USDA dataType returns a given food.
 * Run: npx tsx scripts/check-usda-source.ts
 * Uses EXPO_PUBLIC_USDA_API_KEY from .env.local (or .env) or DEMO_KEY.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
config(); // .env fallback

const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1';
const API_KEY = process.env.EXPO_PUBLIC_USDA_API_KEY ?? 'DEMO_KEY';

async function main() {
  const query = 'roast beef sub on white bread with lettuce';
  console.log('USDA search:', query);
  console.log('');

  const url = `${USDA_BASE}/foods/search?api_key=${API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: query.trim(),
      pageSize: 25,
      pageNumber: 1,
    }),
  });

  if (!res.ok) {
    console.error('USDA API error:', res.status, await res.text());
    process.exit(1);
  }

  const data = await res.json();
  const foods = data.foods ?? [];

  console.log('Total hits:', data.totalHits ?? '?');
  console.log('Foods in this page:', foods.length);
  console.log('');

  for (let i = 0; i < foods.length; i++) {
    const f = foods[i];
    const desc = f.description ?? '';
    const dataType = f.dataType ?? '(none)';
    const brand = [f.brandOwner, f.brandName].filter(Boolean).join(' / ') || '(no brand)';
    console.log(`${i + 1}. dataType: ${dataType}`);
    console.log(`   description: ${desc}`);
    console.log(`   brand: ${brand}`);
    console.log('');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
