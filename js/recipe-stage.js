// Where a recipe stands for you: to try, tried, favourite, archived (hidden but kept).
// Stored on the recipe as `stage`. Recipes from before v33 get one once (see initialStage); after that a
// recipe without a stage (made by an older app copy or importer) counts as "to try".

export const STAGES = ['fav', 'tried', 'try', 'archived'];

export function isBookRecipe(r) {
  return (r?.source?.type === 'book') || Boolean(r?.bookId);
}

/** The one-time choice for recipes that existed before stages (decision D1, 31 Oct 2026). */
export function initialStage(r) {
  if (isBookRecipe(r)) return 'try';
  if ((r?.cookedCount || 0) > 0) return 'fav';
  return 'tried';
}

/** The recipe's stage. migrated = the one-time assignment has run (shared pref stagesV1). */
export function stageOf(r, migrated = true) {
  if (STAGES.includes(r?.stage)) return r.stage;
  return migrated ? 'try' : initialStage(r);
}

/** Recipes needing a stored stage in the one-time assignment, with the stage each gets. */
export function stagePlan(recipes) {
  return recipes.filter((r) => !STAGES.includes(r?.stage)).map((r) => ({ id: r.id, stage: initialStage(r) }));
}

/** How many recipes in each stage. */
export function stageCounts(recipes, migrated = true) {
  const out = { fav: 0, tried: 0, try: 0, archived: 0 };
  for (const r of recipes) out[stageOf(r, migrated)]++;
  return out;
}
