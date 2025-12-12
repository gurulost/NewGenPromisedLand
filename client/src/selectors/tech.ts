import { GameState, PlayerState } from '@shared/types/game';
import { TECHNOLOGIES } from '@shared/data/technologies';

export interface TechValidation {
  canResearch: (techId: string) => boolean;
  hasPrerequisites: (techId: string) => boolean;
  canAfford: (techId: string) => boolean;
  getAvailableTechs: () => string[];
  getResearchProgress: () => { researched: number; total: number };
}

export function getTechValidation(player: PlayerState, gameState: GameState): TechValidation {
  
  const canAfford = (techId: string): boolean => {
    const tech = TECHNOLOGIES[techId as keyof typeof TECHNOLOGIES];
    if (!tech) return false;
    return player.stars >= tech.cost;
  };

  const hasPrerequisites = (techId: string): boolean => {
    const tech = TECHNOLOGIES[techId as keyof typeof TECHNOLOGIES];
    if (!tech) return false;
    
    // Check if all prerequisites are researched
    if (tech.prerequisites) {
      return tech.prerequisites.every(prereq => player.researchedTechs.includes(prereq));
    }
    
    return true;
  };

  const canResearch = (techId: string): boolean => {
    // Can't research if already researched
    if (player.researchedTechs.includes(techId)) {
      return false;
    }
    
    return hasPrerequisites(techId) && canAfford(techId);
  };

  const getAvailableTechs = (): string[] => {
    return Object.keys(TECHNOLOGIES).filter(techId => 
      hasPrerequisites(techId) && !player.researchedTechs.includes(techId)
    );
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
