/**
 * Run: npx tsx scripts/test-food-search.ts
 * Verifies food search returns results for "pear"
 */
import { searchFoods } from '../utils/foodApi';

async function main() {
  console.log('Searching for "pear"...');
  const results = await searchFoods('pear', 15);
  console.log('Results:', results.length);
  if (results.length > 0) {
    console.log('First 3:', results.slice(0, 3).map((r) => ({ name: r.name, cal: r.calories })));
    console.log('OK: search returns results');
  } else {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
