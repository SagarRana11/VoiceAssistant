import { vectorStore } from './vectorStore';
import { KnowledgeDoc } from './knowledgeSources/exerciseKnowledge';
import { MEDITATION_KNOWLEDGE_DOCS } from './knowledgeSources/meditationKnowledge';
import { DIET_KNOWLEDGE_DOCS } from './knowledgeSources/dietKnowledge';
import { DomainVectorStore } from './domainVectorStore';

function formatDoc(doc: KnowledgeDoc): string {
  return `### ${doc.title}\n${doc.content}`;
}

// Domain-specific singletons
const meditationStore = new DomainVectorStore('meditation', MEDITATION_KNOWLEDGE_DOCS);
const dietStore       = new DomainVectorStore('diet',       DIET_KNOWLEDGE_DOCS);

/**
 * Retrieve the top-K most relevant exercise knowledge docs for a given query.
 * Returns formatted strings ready for LLM context injection.
 */
export async function retrieveExerciseDocs(query: string, topK = 3): Promise<string[]> {
  const docs = await vectorStore.similaritySearch(query, topK);
  return docs.map(formatDoc);
}

/**
 * Retrieve docs by fitness goal and activity level tags.
 */
export async function retrieveDocsByProfile(
  fitnessGoal?: string,
  activityLevel?: string,
  hasInjuries?: boolean,
  topK = 4
): Promise<string[]> {
  const tags: string[] = [];
  if (fitnessGoal)   tags.push(fitnessGoal);
  if (activityLevel) {
    if (['sedentary', 'light'].includes(activityLevel)) tags.push('beginner');
    else if (activityLevel === 'moderate')tags.push('intermediate');
    else tags.push('strength');
  }
  if (hasInjuries) tags.push('injury', 'safety', 'modification');

  const query = [fitnessGoal, activityLevel].filter(Boolean).join(' ') + ' workout plan';
  const docs = await vectorStore.searchByTags(tags, topK);

  // Always include warmup + safety docs for completeness
  const extraQuery = 'warmup cooldown safety';
  const extraDocs = await vectorStore.similaritySearch(extraQuery, 2);

  const all = [...docs];
  const seen = new Set(docs.map(d => d));
  for (const d of extraDocs) {
    if (!seen.has(d)) { all.push(d); seen.add(d); }
  }

  return all.slice(0, topK + 2).map(formatDoc);
}

// ─── Meditation retrieval ──────────────────────────────────────────────────────

/**
 * Retrieve meditation knowledge docs based on user profile data.
 */
export async function retrieveMeditationDocs(
  stressLevel?: number,
  sleepHours?: number,
  activityLevel?: string,
  hasExperience?: boolean,
  topK = 5
): Promise<string[]> {
  const tags: string[] = [];

  // Stress severity → tags
  if (stressLevel && stressLevel >= 4) tags.push('stress', 'stress_reduction', 'mbsr');
  else if (stressLevel && stressLevel >= 2) tags.push('mindfulness', 'stress');

  // Sleep quality → tags
  if (sleepHours && sleepHours < 6) tags.push('sleep', 'insomnia', 'relaxation');

  // Experience level → tags
  if (!hasExperience) tags.push('beginner', 'foundation', 'first_steps');
  else tags.push('intermediate', 'advanced', 'deep_practice');

  // Always pull breathing and environment docs
  const coreTags = [...new Set([...tags, 'breathing', 'environment'])];

  const docs = await meditationStore.searchByTags(coreTags, topK);

  // Supplement with semantic search for any gaps
  const query = [
    stressLevel && stressLevel >= 4 ? 'stress reduction anxiety' : 'mindfulness meditation',
    sleepHours && sleepHours < 6 ? 'sleep meditation' : '',
    !hasExperience ? 'beginner meditation guide' : 'advanced meditation',
  ].filter(Boolean).join(' ');

  const extras = await meditationStore.similaritySearch(query, 2);
  const seen   = new Set(docs.map(d => d.id));
  for (const d of extras) {
    if (!seen.has(d.id)) { docs.push(d); seen.add(d.id); }
  }

  return docs.slice(0, topK + 2).map(formatDoc);
}

// ─── Diet retrieval ───────────────────────────────────────────────────────────

/**
 * Retrieve diet knowledge docs based on user profile and goals.
 */
export async function retrieveDietDocs(
  fitnessGoal?: string,
  dietPreference?: string,
  diseases?: string[],
  allergies?: string[],
  topK = 5
): Promise<string[]> {
  const tags: string[] = ['calorie', 'macros', 'hydration'];

  // Goal-based tags
  if (fitnessGoal === 'weight_loss')   tags.push('fat_loss', 'calorie_deficit', 'satiety');
  if (fitnessGoal === 'muscle_gain')   tags.push('muscle_gain', 'bulking', 'protein_timing');
  if (fitnessGoal === 'endurance')     tags.push('carbs', 'meal_timing');

  // Diet preference tags
  if (dietPreference === 'vegan')      tags.push('vegan', 'plant_based');
  if (dietPreference === 'vegetarian') tags.push('vegetarian', 'eggs', 'dairy');

  // Medical condition tags
  const diseaseList = (diseases ?? []).map(d => d.toLowerCase());
  if (diseaseList.some(d => d.includes('diabet'))) tags.push('diabetes', 'disease');
  if (diseaseList.some(d => d.includes('thyroid'))) tags.push('thyroid', 'disease');
  if (diseaseList.some(d => d.includes('cholesterol') || d.includes('cardiac'))) tags.push('cholesterol', 'disease');

  // Allergy tags
  if ((allergies ?? []).some(a => /gluten|wheat|celiac/i.test(a))) tags.push('gluten_free');
  if ((allergies ?? []).some(a => /dairy|milk|lactose/i.test(a)))  tags.push('dairy_free');

  const docs = await dietStore.searchByTags([...new Set(tags)], topK);

  const query = [
    fitnessGoal?.replace('_', ' ') ?? 'healthy diet',
    dietPreference ?? '',
    diseaseList.join(' '),
  ].filter(Boolean).join(' ');

  const extras = await dietStore.similaritySearch(query, 2);
  const seen   = new Set(docs.map(d => d.id));
  for (const d of extras) {
    if (!seen.has(d.id)) { docs.push(d); seen.add(d.id); }
  }

  return docs.slice(0, topK + 2).map(formatDoc);
}
