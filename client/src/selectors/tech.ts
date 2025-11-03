import { GameState, PlayerState } from '@shared/types/game';
import { TECHNOLOGIES } from '@shared/data/technologies';
import { getTechnology, canPlayerResearchTechnology, getEffectiveTechCostForPlayer, playerHasTechPrerequisites } from '@shared/logic/technologyHelpers';

export interface TechValidation {
  canResearch: (techId: string) => boolean;
  hasPrerequisites: (techId: string) => boolean;
  canAfford: (techId: string) => boolean;
  getAvailableTechs: () => string[];
  getResearchProgress: () => { researched: number; total: number };
}

export function getTechValidation(player: PlayerState, gameState: GameState): TechValidation {
  
  const findTech = (techId: string) => getTechnology(techId);

  const canAfford = (techId: string): boolean => {
    const tech = findTech(techId);
    if (!tech) return false;
    const cost = getEffectiveTechCostForPlayer(tech, player);
    return player.stars >= cost;
  };

  const hasPrerequisites = (techId: string): boolean => {
    const tech = findTech(techId);
    if (!tech) return false;
    return playerHasTechPrerequisites(player, tech);
  };

  const canResearch = (techId: string): boolean => {
    const tech = findTech(techId);
    if (!tech) return false;
    return canPlayerResearchTechnology(player, tech);
  };

  const getAvailableTechs = (): string[] => {
    return Object.keys(TECHNOLOGIES).filter(techId => {
      const tech = findTech(techId);
      if (!tech) return false;
      return playerHasTechPrerequisites(player, tech) && !player.researchedTechs.includes(techId);
    });
  };

  const getResearchProgress = () => {
    const total = Object.keys(TECHNOLOGIES).length;
    const researched = player.researchedTechs.length;
    return { researched, total };
  };

  return {
    canResearch,
    hasPrerequisites,
    canAfford,
    getAvailableTechs,
    getResearchProgress
  };
}
