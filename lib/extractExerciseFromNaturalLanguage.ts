// ============================================================
// TMLSN — Extract structured exercise from natural language
// Uses Groq (same as Jarvis) for constrained AI extraction.
// Returns CreateExerciseInput + confidence; never raw AI text.
// ============================================================

import type {
  CreateExerciseInput,
  ExerciseCategory,
  EquipmentType,
  Laterality,
  LoadEntryMode,
} from '../utils/exerciseDb/types';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';
const MAX_TOKENS = 400;
const TEMPERATURE = 0.2;

const VALID_CATEGORIES: ExerciseCategory[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps',
  'forearms', 'quads', 'hamstrings', 'glutes', 'calves', 'abs', 'full_body', 'olympic',
];

const VALID_EQUIPMENT: EquipmentType[] = [
  'barbell', 'dumbbell', 'cable', 'machine', 'bodyweight',
  'kettlebell', 'ez_bar', 'smith_machine', 'resistance_band', 'trx', 'plate', 'trap_bar',
];

const EQUIPMENT_ALIASES: Record<string, EquipmentType> = {
  bar: 'barbell', barbell: 'barbell', bb: 'barbell',
  db: 'dumbbell', dumbbell: 'dumbbell', dumbell: 'dumbbell',
  cable: 'cable', cables: 'cable',
  machine: 'machine', machines: 'machine',
  bodyweight: 'bodyweight', bw: 'bodyweight', 'body weight': 'bodyweight',
  kettlebell: 'kettlebell', kb: 'kettlebell', kettlebells: 'kettlebell',
  'ez bar': 'ez_bar', ezbar: 'ez_bar', ez: 'ez_bar',
  smith: 'smith_machine', 'smith machine': 'smith_machine', smith_machine: 'smith_machine',
  band: 'resistance_band', bands: 'resistance_band', 'resistance band': 'resistance_band',
  trx: 'trx',
  plate: 'plate', plates: 'plate',
  'trap bar': 'trap_bar', trapbar: 'trap_bar', 'hex bar': 'trap_bar',
};

const CATEGORY_ALIASES: Record<string, ExerciseCategory> = {
  chest: 'chest', pecs: 'chest', pectorals: 'chest',
  back: 'back', lats: 'back', 'upper back': 'back', 'lower back': 'back',
  shoulders: 'shoulders', delts: 'shoulders', deltoids: 'shoulders',
  biceps: 'biceps', bicep: 'biceps', bis: 'biceps',
  triceps: 'triceps', tricep: 'triceps', tris: 'triceps',
  forearms: 'forearms', forearm: 'forearms',
  quads: 'quads', quadriceps: 'quads', quad: 'quads',
  hamstrings: 'hamstrings', hams: 'hamstrings', hamstring: 'hamstrings',
  glutes: 'glutes', glute: 'glutes', butt: 'glutes',
  calves: 'calves', calf: 'calves',
  abs: 'abs', core: 'abs', abdominal: 'abs',
  'full body': 'full_body', fullbody: 'full_body',
  olympic: 'olympic', oly: 'olympic',
};

function normalizeEquipment(raw: string): EquipmentType | null {
  const key = raw.toLowerCase().trim().replace(/\s+/g, ' ');
  return EQUIPMENT_ALIASES[key] ?? (VALID_EQUIPMENT.includes(key as EquipmentType) ? (key as EquipmentType) : null);
}

function normalizeCategory(raw: string): ExerciseCategory | null {
  const key = raw.toLowerCase().trim().replace(/\s+/g, ' ');
  return CATEGORY_ALIASES[key] ?? (VALID_CATEGORIES.includes(key as ExerciseCategory) ? (key as ExerciseCategory) : null);
}

function inferLaterality(name: string, equipment: EquipmentType[]): Laterality {
  const lower = name.toLowerCase();
  if (
    /\b(single|one[- ]?arm|one[- ]?leg|unilateral|one[- ]?sided)\b/.test(lower) ||
    /\b(alternating|alt)\b/.test(lower)
  ) {
    return 'unilateral';
  }
  return 'bilateral';
}

function inferLoadEntryMode(equipment: EquipmentType[], laterality: Laterality): LoadEntryMode {
  const hasDumbbell = equipment.includes('dumbbell');
  if (laterality === 'unilateral') return 'per_side';
  if (hasDumbbell) return 'per_hand';
  return 'total';
}

export type ExtractExerciseResult =
  | { ok: true; draft: CreateExerciseInput; confidence: 'high' | 'low'; followUp?: string }
  | { ok: false; error: string };

const EXTRACT_PROMPT = `You extract structured exercise data from natural language. The user will type something like "create single arm cable lateral raise" or "add smith incline press".

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "name": "Proper Exercise Name (Title Case)",
  "category": "one of: chest, back, shoulders, biceps, triceps, forearms, quads, hamstrings, glutes, calves, abs, full_body, olympic",
  "equipment": ["array of: barbell, dumbbell, cable, machine, bodyweight, kettlebell, ez_bar, smith_machine, resistance_band, trx, plate, trap_bar"],
  "laterality": "bilateral or unilateral",
  "loadEntryMode": "total, per_hand, or per_side",
  "confidence": "high or low",
  "followUp": "only if confidence is low: one short question to clarify (e.g. 'Which muscle group: chest or shoulders?')"
}

Rules:
- name: Clean title-case exercise name. Infer from the user's words (e.g. "single arm cable lateral raise" → "Single-Arm Cable Lateral Raise").
- category: Primary muscle group. Infer from movement (lateral raise→shoulders, incline press→chest, curl→biceps, row→back, etc.).
- equipment: At least one. Infer from words: cable, dumbbell, barbell, smith, machine, bodyweight, etc.
- laterality: unilateral if "single", "one arm", "one leg", "alternating" etc.; else bilateral.
- loadEntryMode: per_side for unilateral; per_hand for bilateral dumbbell; total for barbell/machine/cable.
- confidence: high if name+category+equipment are clear; low if ambiguous (e.g. "press" could be chest or shoulder).
- followUp: Only when confidence is low. One short question. Omit when high.`;

export async function extractExerciseFromNaturalLanguage(
  text: string
): Promise<ExtractExerciseResult> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: 'Please describe the exercise.' };

  const apiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'AI not configured. Create exercise manually.' };
  }

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: EXTRACT_PROMPT },
          { role: 'user', content: trimmed },
        ],
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
      }),
    });

    if (!res.ok) {
      return { ok: false, error: 'AI unavailable. Try creating manually.' };
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return { ok: false, error: 'No response from AI.' };

    // Parse JSON (allow markdown code block)
    let jsonStr = content;
    const fenced = content.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (fenced) jsonStr = fenced[1].trim();

    const parsed = JSON.parse(jsonStr) as {
      name?: string;
      category?: string;
      equipment?: string | string[];
      laterality?: string;
      loadEntryMode?: string;
      confidence?: string;
      followUp?: string;
    };

    const rawName = String(parsed.name ?? trimmed).trim();
    if (!rawName) return { ok: false, error: 'Could not parse exercise name.' };

    // Normalize category
    const rawCat = String(parsed.category ?? '').trim();
    const category = normalizeCategory(rawCat) ?? 'full_body';

    // Normalize equipment
    const rawEquip = parsed.equipment;
    const equipArr = Array.isArray(rawEquip)
      ? rawEquip.map((e) => String(e).trim())
      : rawEquip
        ? [String(rawEquip).trim()]
        : [];
    const equipment: EquipmentType[] = [];
    for (const e of equipArr) {
      const norm = normalizeEquipment(e);
      if (norm && !equipment.includes(norm)) equipment.push(norm);
    }
    if (equipment.length === 0) {
      // Infer from name
      const lower = rawName.toLowerCase();
      if (/\bcable\b/.test(lower)) equipment.push('cable');
      else if (/\bdumbbell|db\b/.test(lower)) equipment.push('dumbbell');
      else if (/\bbarbell|bb\b/.test(lower)) equipment.push('barbell');
      else if (/\bsmith\b/.test(lower)) equipment.push('smith_machine');
      else if (/\bmachine\b/.test(lower)) equipment.push('machine');
      else equipment.push('dumbbell'); // safe default
    }

    const laterality =
      parsed.laterality === 'unilateral' ? 'unilateral' : inferLaterality(rawName, equipment);
    const loadEntryMode =
      (parsed.loadEntryMode === 'total' || parsed.loadEntryMode === 'per_hand' || parsed.loadEntryMode === 'per_side')
        ? (parsed.loadEntryMode as LoadEntryMode)
        : inferLoadEntryMode(equipment, laterality);

    const confidence = parsed.confidence === 'low' ? 'low' : 'high';
    const followUp = confidence === 'low' && parsed.followUp ? String(parsed.followUp).trim() : undefined;

    const draft: CreateExerciseInput = {
      name: rawName,
      category,
      equipment,
      laterality,
      loadEntryMode,
    };

    return { ok: true, draft, confidence, followUp };
  } catch (e) {
    console.warn('[extractExercise]', e);
    return { ok: false, error: 'Could not parse. Try creating manually.' };
  }
}
