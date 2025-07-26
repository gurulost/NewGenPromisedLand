import { City } from '../../../shared/types/city';
import { GameState, Player } from '../../../shared/types/game';
import { UNIT_DEFINITIONS } from '../../../shared/data/units';

export interface CityValidation {
  canAffordStructure: (structureId: string) => boolean;
  canAffordUnit: (unitId: string) => boolean;
  hasStructurePrerequisites: (structureId: string) => boolean;
  hasUnitPrerequisites: (unitId: string) => boolean;
  getAvailableStructures: () => string[];
  getAvailableUnits: () => string[];
}

export function getCityValidation(city: City, player: Player, gameState: GameState): CityValidation {
  
  const canAffordStructure = (structureId: string): boolean => {
    // Simplified - actual structure definitions would be imported from proper location
    const baseCosts: Record<string, number> = {
      'temple': 15,
      'market': 10,
      'barracks': 12
    };
    const cost = baseCosts[structureId] || 10;
    return player.stars >= cost;
  };

  const canAffordUnit = (unitId: string): boolean => {
    const unitDef = UNIT_DEFINITIONS[unitId as keyof typeof UNIT_DEFINITIONS];
    if (!unitDef) return false;
    return player.stars >= unitDef.cost;
  };

  const hasStructurePrerequisites = (structureId: string): boolean => {
    // Simplified - actual prerequisite checking would use proper structure definitions
    return true; // For now, assume all structures are available
  };

  const hasUnitPrerequisites = (unitId: string): boolean => {
    const unitDef = UNIT_DEFINITIONS[unitId as keyof typeof UNIT_DEFINITIONS];
    if (!unitDef) return false;
    
    // Check tech prerequisites
    if (unitDef.requiredTechnology && !player.researchedTechs.includes(unitDef.requiredTechnology)) {
      return false;
    }
    
    return true;
  };

  const getAvailableStructures = (): string[] => {
    return ['temple', 'market', 'barracks'].filter(structureId => 
      hasStructurePrerequisites(structureId)
    );
  };

  const getAvailableUnits = (): string[] => {
    return Object.keys(UNIT_DEFINITIONS).filter(unitId => 
      hasUnitPrerequisites(unitId)
    );
  };

  return {
    canAffordStructure,
    canAffordUnit,
    hasStructurePrerequisites,
    hasUnitPrerequisites,
    getAvailableStructures,
    getAvailableUnits
  };
}