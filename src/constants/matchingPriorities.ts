import type { MatchingPriorityCategory } from '../types';

export const MATCHING_PRIORITY_CATEGORIES: MatchingPriorityCategory[] = [
  'datingIntentionFit',
  'queerRoleFit',
  'presentationFit',
  'appearanceFit',
  'ageFit',
  'distanceFit',
  'personalityVibeFit',
  'lifestyleFit',
  'heightFit',
];

export const DEFAULT_MATCHING_PRIORITY_ORDER: MatchingPriorityCategory[] = [
  'datingIntentionFit',
  'queerRoleFit',
  'presentationFit',
  'appearanceFit',
  'ageFit',
  'distanceFit',
  'personalityVibeFit',
  'lifestyleFit',
  'heightFit',
];

/** User-facing labels — never expose raw appearance scores. */
export const MATCHING_PRIORITY_LABELS: Record<MatchingPriorityCategory, string> = {
  datingIntentionFit: 'Dating intentions',
  queerRoleFit: 'Queer roles',
  presentationFit: 'Presentation',
  appearanceFit: 'Private chemistry fit',
  ageFit: 'Age range',
  distanceFit: 'Distance',
  personalityVibeFit: 'Personality vibe',
  lifestyleFit: 'Lifestyle & values',
  heightFit: 'Height',
};

export const MATCHING_PRIORITY_HINTS: Record<MatchingPriorityCategory, string> = {
  datingIntentionFit: 'Relationship goals and what you are looking for',
  queerRoleFit: 'Role compatibility preferences',
  presentationFit: 'Masc/fem/presentation overlap',
  appearanceFit: 'Uses private feedback only — never shown on anyone’s profile',
  ageFit: 'How closely age matches your range',
  distanceFit: 'Geographic proximity',
  personalityVibeFit: 'Shared personality tags',
  lifestyleFit: 'Lifestyle tags and dealbreakers',
  heightFit: 'Height relative to your preferred range',
};

export function normalizeMatchingPriorityOrder(
  order: string[] | null | undefined,
): MatchingPriorityCategory[] {
  const seen = new Set<MatchingPriorityCategory>();
  const normalized: MatchingPriorityCategory[] = [];

  for (const key of order ?? []) {
    if (!MATCHING_PRIORITY_CATEGORIES.includes(key as MatchingPriorityCategory)) {
      continue;
    }
    const category = key as MatchingPriorityCategory;
    if (seen.has(category)) {
      continue;
    }
    seen.add(category);
    normalized.push(category);
  }

  for (const category of DEFAULT_MATCHING_PRIORITY_ORDER) {
    if (!seen.has(category)) {
      normalized.push(category);
    }
  }

  return normalized;
}

/**
 * Rank position 0 (most important) receives the highest weight.
 * Weights are normalized to sum to 1.
 */
export function priorityWeights(
  order: MatchingPriorityCategory[],
): Record<MatchingPriorityCategory, number> {
  const n = order.length;
  const weights = {} as Record<MatchingPriorityCategory, number>;
  let sum = 0;

  order.forEach((category, index) => {
    const weight = n - index;
    weights[category] = weight;
    sum += weight;
  });

  for (const category of MATCHING_PRIORITY_CATEGORIES) {
    weights[category] = (weights[category] ?? 1) / sum;
  }

  return weights;
}

export function movePriorityItem(
  order: MatchingPriorityCategory[],
  index: number,
  direction: 'up' | 'down',
): MatchingPriorityCategory[] {
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= order.length) {
    return order;
  }

  const next = [...order];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
