// Google Gemini 2.0 Flash — AI food photo recognition & nutrition label reader
// Free API key: https://aistudio.google.com/apikey

import { ParsedNutrition } from './foodApi';

const GEMINI_BASE =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

async function callGemini(imageBase64: string, mimeType: string, prompt: string): Promise<string | null> {
  if (!API_KEY) {
    console.warn('Gemini API key not set. Add EXPO_PUBLIC_GEMINI_API_KEY to .env.local');
    return null;
  }
  try {
    const res = await fetch(`${GEMINI_BASE}?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: imageBase64 } }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
      }),
    });
    if (!res.ok) { console.warn('Gemini API error:', res.status); return null; }
    const data: GeminiResponse = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  } catch (err) {
    console.warn('Gemini API call failed:', err);
    return null;
  }
}

function extractJSON(text: string): ParsedNutrition | null {
  try {
    const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    const jsonStr = fenced ? fenced[1].trim() : text.trim();
    const parsed = JSON.parse(jsonStr);
    return {
      name: String(parsed.name ?? 'Unknown Food'),
      brand: String(parsed.brand ?? ''),
      calories: Math.round(Number(parsed.calories) || 0),
      protein: Math.round(Number(parsed.protein) || 0),
      carbs: Math.round(Number(parsed.carbs) || 0),
      fat: Math.round(Number(parsed.fat) || 0),
      servingSize: String(parsed.servingSize ?? parsed.serving_size ?? ''),
      unit: (parsed.unit === 'ml' ? 'ml' : 'g') as 'g' | 'ml',
      source: 'usda',
    };
  } catch {
    console.warn('Failed to parse Gemini JSON:', text);
    return null;
  }
}

const FOOD_PROMPT = `You are a nutrition expert. Analyze this photo of food and estimate the nutritional content.
If the user provided a description, use it to improve your estimate. Be practical — estimate a realistic single-serving portion.
Respond with ONLY a JSON object (no markdown, no explanation):
{"name":"Short food name","brand":"","calories":0,"protein":0,"carbs":0,"fat":0,"servingSize":"estimated portion"}
All macro values in grams (integers). Calories in kcal.`;

const LABEL_PROMPT = `You are reading a nutrition facts label from a food product photo.
Extract the EXACT values printed on the label for one serving. Read carefully — do not estimate.
Respond with ONLY a JSON object (no markdown, no explanation):
{"name":"Product name (if visible)","brand":"Brand name (if visible)","calories":0,"protein":0,"carbs":0,"fat":0,"servingSize":"serving size as printed"}
All macro values in grams (integers). Calories in kcal. If not legible, use 0.`;

export async function analyzeFood(imageBase64: string, mimeType = 'image/jpeg', description?: string): Promise<ParsedNutrition | null> {
  const prompt = description ? `${FOOD_PROMPT}\n\nUser description: "${description}"` : FOOD_PROMPT;
  const text = await callGemini(imageBase64, mimeType, prompt);
  return text ? extractJSON(text) : null;
}

export async function readNutritionLabel(imageBase64: string, mimeType = 'image/jpeg'): Promise<ParsedNutrition | null> {
  const text = await callGemini(imageBase64, mimeType, LABEL_PROMPT);
  return text ? extractJSON(text) : null;
}

export function isGeminiConfigured(): boolean { return !!API_KEY; }
