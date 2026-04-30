/**
 * Legacy compatibility exports for the world-elements technology grouping.
 *
 * Canonical technology definitions live in ./technologies. This module must not
 * override costs, prerequisites, or unlocks with a second tech tree.
 */

import { TECHNOLOGIES, type Technology } from './technologies';

const WORLD_ELEMENT_TECH_IDS = [
  'woodcraft',
  'husbandry',
  'agriculture',
  'irrigation',
  'seafaring',
  'trade',
  'navigation',
] as const;

export const NEW_TECHNOLOGIES = WORLD_ELEMENT_TECH_IDS.reduce<Record<string, Technology>>(
  (acc, techId) => {
    acc[techId] = TECHNOLOGIES[techId];
    return acc;
  },
  {}
);

export function getAllTechnologies(): Record<string, Technology> {
  return TECHNOLOGIES;
}
