/**
 * Food search result filters: sanitize and filter out profanity, emojis, junk text.
 * All results from USDA and Open Food Facts pass through here before display.
 *
 * Future: Language heuristic — prefer results with high ASCII letter ratio;
 * add `showFoodsInOtherLanguages` setting later.
 */

import emojiRegex from 'emoji-regex';
import type { ParsedNutrition } from './foodApi';

/* ------------------------------------------------------------------ */
/*  Profanity blocklist (whole-word, case-insensitive)                 */
/* ------------------------------------------------------------------ */

const PROFANITY_BLOCKLIST = new Set([
  'shit', 'shitty', 'bullshit', 'ass', 'asshole', 'damn', 'damned',
  'fuck', 'fucking', 'fucker', 'fucked', 'crap', 'crappy',
  'bitch', 'bastard', 'dick', 'cock', 'pussy', 'slut',
  'retard', 'retarded', 'nigger', 'nigga', 'fag', 'faggot',
]);

/* ------------------------------------------------------------------ */
/*  Junk pattern regex: URLs, slang, repeated chars                    */
/* ------------------------------------------------------------------ */

// URLs, slang; (.)\1{3,} removed — was matching valid names like "pear, raw"
const JUNK_PATTERN = /\bwww\.|https?:\/\/|\.(com|org|net|io)\b|\b(ey\s*bro|lol|omg|yolo|wtf|bro\s*bruh)\b/i;

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function buildProfanityRegex(): RegExp {
  const terms = [...PROFANITY_BLOCKLIST].map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`\\b(${terms.join('|')})\\b`, 'gi');
}

const PROFANITY_REGEX = buildProfanityRegex();

/**
 * Strip emojis, trim, collapse internal whitespace.
 */
export function sanitizeFoodName(text: string): string {
  if (!text || typeof text !== 'string') return '';
  const noEmoji = text.replace(emojiRegex(), '');
  return noEmoji.trim().replace(/\s+/g, ' ');
}

/**
 * Returns false if the food name/brand should be hidden (profanity, junk, too short, etc).
 * Whitelist approach: allow unless clearly bad.
 */
export function isAcceptableFood(name: string, brand?: string): boolean {
  const sanitizedName = sanitizeFoodName(name);
  const sanitizedBrand = brand ? sanitizeFoodName(brand) : '';

  // Empty or too short
  if (sanitizedName.length < 2) return false;

  // "Unknown" or placeholder
  if (sanitizedName.toLowerCase() === 'unknown') return false;

  // Profanity in name or brand (whole-word)
  PROFANITY_REGEX.lastIndex = 0;
  if (PROFANITY_REGEX.test(sanitizedName)) return false;
  PROFANITY_REGEX.lastIndex = 0;
  if (sanitizedBrand && PROFANITY_REGEX.test(sanitizedBrand)) return false;

  // Junk patterns (URLs, slang)
  if (JUNK_PATTERN.test(sanitizedName) || (sanitizedBrand && JUNK_PATTERN.test(sanitizedBrand))) {
    return false;
  }

  // Mostly non-alpha (< 20% letters) — allows "McDonald's", "Coca-Cola", and more international names
  const letters = sanitizedName.replace(/[^a-zA-Z]/g, '').length;
  if (letters / Math.max(1, sanitizedName.length) < 0.2) return false;

  return true;
}

/**
 * Sanitize and filter a list of food results. Drops unacceptable items.
 */
export function filterResults(items: ParsedNutrition[]): ParsedNutrition[] {
  const result: ParsedNutrition[] = [];
  for (const item of items) {
    const sanitizedName = sanitizeFoodName(item.name);
    const sanitizedBrand = sanitizeFoodName(item.brand || '');
    if (!isAcceptableFood(sanitizedName, sanitizedBrand)) continue;
    result.push({
      ...item,
      name: sanitizedName.toLowerCase(),
      brand: sanitizedBrand.toLowerCase(),
    });
  }
  return result;
}

/**
 * For barcode lookup: sanitize and validate single result. Returns null if unacceptable.
 */
export function filterSingleFood(food: ParsedNutrition | null): ParsedNutrition | null {
  if (!food) return null;
  const sanitizedName = sanitizeFoodName(food.name);
  const sanitizedBrand = sanitizeFoodName(food.brand || '');
  if (!isAcceptableFood(sanitizedName, sanitizedBrand)) return null;
  return {
    ...food,
    name: sanitizedName.toLowerCase(),
    brand: sanitizedBrand.toLowerCase(),
  };
}
