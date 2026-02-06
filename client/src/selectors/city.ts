import { City, STRUCTURE_DEFINITIONS, StructureType } from '@shared/types/city';
import { coerceFactionId } from '@shared/types/factionId';
import { GameState, PlayerState } from '@shared/types/game';
import { UNIT_DEFINITIONS } from '@shared/data/units';

export interface CityValidation {
  canAffordStructure: (structureId: string) => boolean;
  canAffordUnit: (unitId: string) => boolean;
  hasStructurePrerequisites: (structureId: string) => boolean;
  hasUnitPrerequisites: (unitId: string) => boolean;
  getAvailableStructures: () => string[];
  getAvailableUnits: () => string[];
  getStructureCost: (structureId: string) => number;
}

export function getCityValidation(city: City, player: PlayerState, gameState: GameState): CityValidation {
  
  const getStructureCost = (structureId: string): number => {
    const structureDef = STRUCTURE_DEFINITIONS[structureId as StructureType];
    return structureDef?.cost ?? 10;
  };

  const canAffordStructure = (structureId: string): boolean => {
    const cost = getStructureCost(structureId);
    return player.stars >= cost;
  };

  const canAffordUnit = (unitId: string): boolean => {
    const unitDef = UNIT_DEFINITIONS[unitId as keyof typeof UNIT_DEFINITIONS];
    if (!unitDef) return false;
    
    if (player.stars < unitDef.cost) return false;
    
    const requirements = unitDef.requirements;
    if (requirements) {
      if (requirements.faith && player.stats.faith < requirements.faith) return false;
      if (requirements.pride && player.stats.pride < requirements.pride) return false;
    }
    
    return true;
  };

  const hasStructurePrerequisites = (structureId: string): boolean => {
    const structureDef = STRUCTURE_DEFINITIONS[structureId as StructureType];
    if (!structureDef) return false;
    
    if (structureDef.requiredTech && !player.researchedTechs.includes(structureDef.requiredTech)) {
      return false;
    }
    
    const existingStructures = gameState.structures?.filter(s => s.cityId === city.id) || [];
    const alreadyBuilt = existingStructures.some(s => s.type === structureId);
    if (alreadyBuilt) return false;
    
    return true;
  };

  const hasUnitPrerequisites = (unitId: string): boolean => {
    const unitDef = UNIT_DEFINITIONS[unitId as keyof typeof UNIT_DEFINITIONS];
    if (!unitDef) return false;
    
    if (unitDef.requiredTechnology && !player.researchedTechs.includes(unitDef.requiredTechnology)) {
      return false;
    }
    
    if (unitDef.factionSpecific && unitDef.factionSpecific.length > 0) {
      const factionId = coerceFactionId(player.factionId);
      if (!factionId || !unitDef.factionSpecific.includes(factionId)) {
        return false;
      }
    }
    
    return true;
  };

  const getAvailableStructures = (): string[] => {
    return Object.keys(STRUCTURE_DEFINITIONS).filter(structureId => 
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
    getAvailableUnits,
    getStructureCost
  };
}
