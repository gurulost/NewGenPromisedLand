import { GameState, PlayerState } from '@shared/types/game';
import { TECHNOLOGIES } from '@shared/data/technologies';
import { getLegalPlayerActions, getTechnologyRuleSummary } from '@shared/logic/ruleQueries';

export interface TechValidation {
  canResearch: (techId: string) => boolean;
  hasPrerequisites: (techId: string) => boolean;
  canAfford: (techId: string) => boolean;
  getAvailableTechs: () => string[];
  getResearchProgress: () => { researched: number; total: number };
}

export function getTechValidation(player: PlayerState, gameState: GameState): TechValidation {
  
  const canAfford = (techId: string): boolean => {
    return getTechnologyRuleSummary(gameState, player.id, techId).canAfford;
  };

  const hasPrerequisites = (techId: string): boolean => {
    return getTechnologyRuleSummary(gameState, player.id, techId).prerequisitesMet;
  };

  const canResearch = (techId: string): boolean => {
    return getTechnologyRuleSummary(gameState, player.id, techId).check.legal;
  };

  const getAvailableTechs = (): string[] => {
    const ids: string[] = [];
    for (const option of getLegalPlayerActions(gameState, player.id)) {
      if (option.action.type === 'RESEARCH_TECH') {
        ids.push(option.action.payload.techId);
      }
    }
    return ids;
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
