import { Prompt } from '../types';

// Sample Prompts for the Prompt Vault (MVP)
export const SAMPLE_PROMPTS: Prompt[] = [
  {
    id: 'prompt-001',
    title: 'Personalized Meal Plan Generator',
    summary: 'Create a customized meal plan based on your macros and preferences',
    fullText: `You are a nutrition expert. Create a personalized 7-day meal plan for me with the following constraints:

- Daily Calories: [YOUR_CALORIE_TARGET]
- Daily Protein: [YOUR_PROTEIN_TARGET]g
- Daily Carbs: [YOUR_CARB_TARGET]g
- Daily Fat: [YOUR_FAT_TARGET]g
- Dietary Restrictions: [LIST_ANY_RESTRICTIONS]
- Meals per day: [NUMBER_OF_MEALS]
- Foods I dislike: [LIST_DISLIKES]

For each day, provide:
1. Breakfast, lunch, dinner, and any snacks
2. Exact macro breakdown for each meal
3. Simple preparation instructions
4. Grocery list for the week

Make the meals realistic, affordable, and achievable for a busy schedule.`,
    source: 'Newsletter 001',
    sourceUrl: 'https://tmlsn.com/newsletter/001',
    dateAdded: '2025-02-01',
    category: 'Nutrition',
  },
  {
    id: 'prompt-002',
    title: 'Progressive Overload Workout Planner',
    summary: 'Design a structured progression plan for your lifts',
    fullText: `You are a strength training coach. Help me create a 12-week progressive overload plan with these details:

Current Stats:
- Bench Press: [CURRENT_WEIGHT] for [REPS] reps
- Squat: [CURRENT_WEIGHT] for [REPS] reps  
- Deadlift: [CURRENT_WEIGHT] for [REPS] reps
- Training Days per Week: [NUMBER]
- Training Experience: [BEGINNER/INTERMEDIATE/ADVANCED]

Goals:
- Target Bench: [GOAL_WEIGHT]
- Target Squat: [GOAL_WEIGHT]
- Target Deadlift: [GOAL_WEIGHT]

Provide:
1. Weekly progression scheme (weight increases, rep ranges, deload weeks)
2. Accessory exercises to support main lifts
3. Recovery protocols
4. When to adjust if progress stalls

Make the plan sustainable and account for real-life recovery constraints.`,
    source: 'Newsletter 003',
    sourceUrl: 'https://tmlsn.com/newsletter/003',
    dateAdded: '2025-02-05',
    category: 'Training',
  },
  {
    id: 'prompt-003',
    title: 'Body Composition Analysis',
    summary: 'Get personalized feedback on cutting vs bulking strategy',
    fullText: `You are a body composition expert. Analyze my current state and recommend a strategy:

Current Stats:
- Weight: [WEIGHT] lbs/kg
- Height: [HEIGHT]
- Estimated Body Fat: [BF_PERCENTAGE]%
- Primary Goal: [LOSE_FAT/BUILD_MUSCLE/RECOMP]
- Training Experience: [YEARS]
- Current Calorie Intake: [CALORIES]

Provide:
1. Recommended approach (cut/bulk/recomp) with reasoning
2. Optimal calorie and macro targets
3. Expected timeline to reach goal physique
4. Training adjustments needed
5. Potential pitfalls to avoid

Be realistic about timeframes and set proper expectations.`,
    source: 'Newsletter 005',
    sourceUrl: 'https://tmlsn.com/newsletter/005',
    dateAdded: '2025-02-08',
    category: 'Nutrition',
  },
  {
    id: 'prompt-004',
    title: 'Weak Point Destroyer',
    summary: 'Target lagging muscle groups with specialized protocols',
    fullText: `You are a hypertrophy specialist. My [MUSCLE_GROUP] is lagging behind. Help me bring it up:

Current Situation:
- Lagging Muscle: [CHEST/BACK/SHOULDERS/ARMS/LEGS]
- Current Training Volume: [SETS_PER_WEEK]
- Current Training Frequency: [DAYS_PER_WEEK]
- Main Compound Lifts: [LIST_EXERCISES]
- Time per Session Available: [MINUTES]

Provide:
1. Specialized exercise selection for this muscle
2. Optimal weekly volume and frequency
3. Technique cues to maximize stimulus
4. Intensity techniques (drop sets, rest-pause, etc.)
5. 8-week protocol to bring up the weak point
6. How to integrate with my current program

Focus on maximum efficiency without overtraining.`,
    source: 'Newsletter 007',
    sourceUrl: 'https://tmlsn.com/newsletter/007',
    dateAdded: '2025-02-10',
    category: 'Training',
  },
  {
    id: 'prompt-005',
    title: 'Supplement Stack Optimizer',
    summary: 'Build an evidence-based supplement protocol',
    fullText: `You are a sports nutrition scientist. Design an optimal supplement stack:

My Details:
- Primary Goals: [STRENGTH/MUSCLE/FAT_LOSS/PERFORMANCE]
- Budget: $[AMOUNT]/month
- Current Supplements: [LIST_CURRENT]
- Dietary Gaps: [KNOWN_DEFICIENCIES]
- Training Intensity: [LOW/MODERATE/HIGH]

Provide:
1. Essential supplements ranked by priority
2. Optimal dosing and timing
3. Expected benefits (be realistic)
4. Cost-effectiveness analysis
5. What to buy first with limited budget
6. Common marketing traps to avoid

Only recommend supplements with strong scientific backing.`,
    source: 'YouTube - Supplement Science',
    sourceUrl: 'https://youtube.com/tmlsn/supplements',
    dateAdded: '2025-02-12',
    category: 'Nutrition',
  },
];
