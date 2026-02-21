const GOOGLE_TRANSLATE_KEY = process.env.EXPO_PUBLIC_GOOGLE_TRANSLATE_KEY ?? '';
const TRANSLATE_URL = 'https://translation.googleapis.com/language/translate/v2';

export async function translateFoodName(name: string, targetLang: string): Promise<string> {
  if (!GOOGLE_TRANSLATE_KEY || targetLang === 'en') return name;
  try {
    const res = await fetch(`${TRANSLATE_URL}?key=${GOOGLE_TRANSLATE_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: name, target: targetLang, format: 'text' }),
    });
    if (!res.ok) return name;
    const data = await res.json();
    return data?.data?.translations?.[0]?.translatedText?.toLowerCase() ?? name;
  } catch {
    return name;
  }
}

/**
 * Detect if a query is already English by checking if most characters are basic ASCII.
 * This avoids wasting a translate call on English queries.
 */
function likelyEnglish(text: string): boolean {
  const words = text.toLowerCase().split(/\s+/);
  const commonEnglish = new Set([
    'chicken', 'rice', 'bread', 'milk', 'egg', 'eggs', 'cheese', 'butter',
    'beef', 'pork', 'fish', 'raw', 'boiled', 'fried', 'baked', 'grilled',
    'cooked', 'fresh', 'frozen', 'canned', 'dried', 'roasted', 'steamed',
    'protein', 'bar', 'oats', 'yogurt', 'banana', 'apple', 'potato',
    'salad', 'soup', 'pasta', 'sauce', 'oil', 'sugar', 'salt', 'flour',
    'cream', 'steak', 'salmon', 'tuna', 'shrimp', 'turkey', 'ham',
    'whole', 'low', 'fat', 'light', 'organic', 'breast', 'thigh', 'ground',
  ]);
  // If more than half the words are known English food words, skip translation
  const englishCount = words.filter(w => commonEnglish.has(w)).length;
  if (englishCount / words.length > 0.5) return true;
  return false;
}

/**
 * Translate a food query to English using Google Translate.
 * Returns null if already English or translation fails.
 */
export async function translateToEnglish(query: string): Promise<string | null> {
  const q = query.trim();
  if (!q || !GOOGLE_TRANSLATE_KEY) return null;
  if (likelyEnglish(q)) return null;

  try {
    const res = await fetch(`${TRANSLATE_URL}?key=${GOOGLE_TRANSLATE_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: q,
        target: 'en',
        format: 'text',
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const translated = data?.data?.translations?.[0]?.translatedText?.toLowerCase()?.trim();
    // If translation is identical to input, it was already English
    if (!translated || translated === q.toLowerCase()) return null;
    return translated;
  } catch {
    return null;
  }
}
