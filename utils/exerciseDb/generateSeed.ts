// ============================================================
// TMLSN — Run this to generate seed SQL from the exercise DB
// Usage: npx ts-node generateSeed.ts > seed.sql
// ============================================================

import { EXERCISE_DATABASE } from './exerciseDatabase';

function escapeSQL(str: string): string {
  return str.replace(/'/g, "''");
}

console.log('-- AUTO-GENERATED SEED DATA');
console.log(`-- ${EXERCISE_DATABASE.length} exercises\n`);

// Insert exercises
for (const ex of EXERCISE_DATABASE) {
  const equip = `ARRAY[${ex.equipment.map((e) => `'${e}'`).join(', ')}]`;
  const desc = ex.description ? `'${escapeSQL(ex.description)}'` : 'NULL';
  const tips = ex.tips ? `'${escapeSQL(ex.tips)}'` : 'NULL';

  console.log(
    `INSERT INTO exercises (id, name, category, equipment, movement_type, force_type, description, tips) VALUES ` +
    `('${ex.id}', '${escapeSQL(ex.name)}', '${ex.category}', ${equip}, '${ex.movementType}', '${ex.forceType}', ${desc}, ${tips});`
  );
}

console.log('\n-- Exercise muscle targets\n');

// Insert muscle targets
for (const ex of EXERCISE_DATABASE) {
  for (const muscle of ex.muscles) {
    console.log(
      `INSERT INTO exercise_muscles (exercise_id, muscle_id, activation_percent) VALUES ` +
      `('${ex.id}', '${muscle.muscleId}', ${muscle.activationPercent});`
    );
  }
}

// Summary stats
const categories = new Set(EXERCISE_DATABASE.map((e) => e.category));
const totalMuscleEntries = EXERCISE_DATABASE.reduce(
  (sum, e) => sum + e.muscles.length, 0
);

console.log(`\n-- Summary: ${EXERCISE_DATABASE.length} exercises across ${categories.size} categories`);
console.log(`-- Total muscle targeting entries: ${totalMuscleEntries}`);
