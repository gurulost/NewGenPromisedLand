import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Button } from "./button";
import { Badge } from "./badge";
import { Separator } from "./separator";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { useGameState } from "../../lib/stores/useGameState";
import { Star, Building, Sword, Hammer, Users, Sparkles } from "lucide-react";
import { IMPROVEMENT_DEFINITIONS, STRUCTURE_DEFINITIONS, type ImprovementType, type StructureType } from "@shared/types/city";
import { getUnitDefinition, UNIT_DEFINITIONS } from "@shared/data/units";
import type { UnitType } from "@shared/types/unit";
import { BuildingMenu } from "./BuildingMenu";
import { Tooltip, ActionTooltip } from "./TooltipSystem";

interface CityPanelProps {
  open: boolean;
  onClose: () => void;
  cityId: string;
}

export default function CityPanel({ open, onClose, cityId }: CityPanelProps) {
  const { gameState, dispatch } = useLocalGame();
  const { startConstruction } = useGameState();
  const [selectedTab, setSelectedTab] = useState<'overview' | 'structures' | 'units' | 'improvements'>('overview');
  const [showAdvancedBuildingMenu, setShowAdvancedBuildingMenu] = useState(false);
  
  if (!open || !gameState) return null;
  
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const city = gameState.cities?.find(c => c.id === cityId);
  
  if (!city) return null;
  
  // Check if player owns this city
  const isOwned = currentPlayer.citiesOwned.includes(cityId);
  if (!isOwned) return null;
  
  const cityStructures = gameState.structures?.filter(s => s.cityId === cityId) || [];
  const cityUnits = gameState.units.filter(u => 
    u.coordinate.q === city.coordinate.q && 
    u.coordinate.r === city.coordinate.r
  );
  
  const handleBuildStructure = (structureType: StructureType) => {
    dispatch({
      type: 'BUILD_STRUCTURE',
      payload: {
        playerId: currentPlayer.id,
        cityId,
        structureType
      }
    });
  };
  
  const handleRecruitUnit = (unitType: UnitType) => {
    dispatch({
      type: 'RECRUIT_UNIT',
      payload: {
        playerId: currentPlayer.id,
        cityId,
        unitType
      }
    });
  };
  
  const canAffordStructure = (structureType: StructureType) => {
    const structureDef = STRUCTURE_DEFINITIONS[structureType];
    return currentPlayer.stars >= structureDef.cost &&
           currentPlayer.researchedTechs.includes(structureDef.requiredTech) &&
           !cityStructures.find(s => s.type === structureType);
  };

  const getStructureBuildMessage = (structureType: StructureType) => {
    const structureDef = STRUCTURE_DEFINITIONS[structureType];
    const hasStructure = cityStructures.find(s => s.type === structureType);
    
    if (hasStructure) {
      return "Built";
    }
    
    const hasRequiredTech = currentPlayer.researchedTechs.includes(structureDef.requiredTech);
    const hasEnoughStars = currentPlayer.stars >= structureDef.cost;
    
    if (!hasRequiredTech) {
      // Find the tech name for better UX
      const techName = structureDef.requiredTech.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
      return `Requires ${techName}`;
    }
    
    if (!hasEnoughStars) {
      return `Need ${structureDef.cost - currentPlayer.stars} more stars`;
    }
    
    return "Build";
  };
  
  const canAffordUnit = (unitType: UnitType) => {
    const unitDef = getUnitDefinition(unitType);
    const hasSpace = cityUnits.length < 4; // Max 4 units per city
    const meetsRequirements = !unitDef.requirements || 
      ((!unitDef.requirements.faith || currentPlayer.stats.faith >= unitDef.requirements.faith) &&
       (!unitDef.requirements.pride || currentPlayer.stats.pride >= unitDef.requirements.pride));
    const factionMatch = unitDef.factionSpecific.length === 0 || 
      unitDef.factionSpecific.includes(currentPlayer.factionId);
    
    return currentPlayer.stars >= unitDef.cost && hasSpace && meetsRequirements && factionMatch;
  };

  const getUnitRecruitMessage = (unitType: UnitType) => {
    const unitDef = getUnitDefinition(unitType);
    const hasSpace = cityUnits.length < 4;
    const hasEnoughStars = currentPlayer.stars >= unitDef.cost;
    
    if (!hasSpace) {
      return "City Full (4/4)";
    }
    
    const factionMatch = unitDef.factionSpecific.length === 0 || 
      unitDef.factionSpecific.includes(currentPlayer.factionId);
    
    if (!factionMatch) {
      return "Wrong Faction";
    }
    
    if (unitDef.requirements) {
      if (unitDef.requirements.faith && currentPlayer.stats.faith < unitDef.requirements.faith) {
        return `Need ${unitDef.requirements.faith} Faith`;
      }
      if (unitDef.requirements.pride && currentPlayer.stats.pride < unitDef.requirements.pride) {
        return `Need ${unitDef.requirements.pride} Pride`;
      }
    }
    
    if (!hasEnoughStars) {
      return `Need ${unitDef.cost - currentPlayer.stars} more stars`;
    }
    
    return "Recruit";
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      style={{ pointerEvents: 'auto' }}
      onClick={(e) => {
        console.log('🏛️ CityPanel backdrop clicked:', e.target === e.currentTarget);
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <Card 
        className="w-[90%] h-[90%] max-w-4xl bg-white border-2" 
        onClick={(e) => {
          console.log('🏛️ CityPanel card clicked');
          e.stopPropagation();
        }}
      >
        <CardHeader className="border-b">
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2 font-cinzel text-xl font-semibold tracking-wide">
              <Building className="w-5 h-5" />
              {city.name} - City Management
            </CardTitle>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-500" />
                <span className="font-semibold">{currentPlayer.stars} Stars</span>
              </div>
              <Button 
                variant="outline" 
                onClick={(e) => {
                  console.log('🏛️ CityPanel Close button clicked');
                  e.stopPropagation();
                  onClose();
                }}
              >
                Close
              </Button>
            </div>
          </div>
          
          {/* Tab Navigation */}
          <div className="flex gap-2 mt-4 justify-between">
            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                className="flex items-center gap-2"
              >
                <Building className="w-4 h-4" />
                Overview
              </Button>
            </div>
            
            {/* Construction Hall Button */}
            <Tooltip content={
              <ActionTooltip
                title="Construction Hall"
                description="Open the comprehensive building interface with detailed information and visual design"
                hotkey="B"
              />
            }>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAdvancedBuildingMenu(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-purple-600/10 to-blue-600/10 border-purple-500/30 hover:from-purple-600/20 hover:to-blue-600/20"
              >
                <Hammer className="w-4 h-4" />
                Construction Hall
              </Button>
            </Tooltip>
          </div>
        </CardHeader>
        
        <CardContent className="overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold mb-2">City Information</h3>
                <div className="space-y-1 text-sm">
                  <p>Population: {city.population}</p>
                  <p>Owner: {currentPlayer.name}</p>
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Resources</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-yellow-500" />
                    <span>{currentPlayer.stars} Stars</span>
                  </div>
                </div>
              </div>
            </div>
            
            <Separator />
            
            <div>
              <h3 className="font-semibold mb-2">Current Structures</h3>
              {cityStructures.length > 0 ? (
                <div className="grid grid-cols-1 gap-2">
                  {cityStructures.map(structure => (
                    <div key={structure.id} className="p-2 border rounded">
                      <p className="font-medium">{structure.type}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No structures built yet</p>
              )}
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">Units in City</h3>
              {cityUnits.length > 0 ? (
                <div className="grid grid-cols-1 gap-2">
                  {cityUnits.map(unit => (
                    <div key={unit.id} className="p-2 border rounded">
                      <p className="font-medium">{unit.type}</p>
                      <p className="text-sm text-gray-600">HP: {unit.currentHp}/{unit.maxHp}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No units in city</p>
              )}
            </div>
          </div>
          {selectedTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h3 className="font-semibold">City Information</h3>
                  <p>Population: {city.population}</p>
                  <p>Level: {city.level}</p>
                  <p>Production: {city.starProduction} per turn</p>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold">Units in City</h3>
                  <p>{cityUnits.length}/4 units stationed</p>
                  {cityUnits.map(unit => (
                    <Badge key={unit.id} variant="outline">
                      {unit.type}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <h3 className="font-semibold">City Structures</h3>
                {cityStructures.length === 0 ? (
                  <p className="text-gray-500">No structures built</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {cityStructures.map(structure => (
                      <Badge key={structure.id} variant="default">
                        {STRUCTURE_DEFINITIONS[structure.type as StructureType]?.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {selectedTab === 'structures' && (
            <div className="space-y-4">
              <h3 className="font-semibold mb-4">Available Structures</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.values(STRUCTURE_DEFINITIONS).map(structure => {
                  const canAfford = canAffordStructure(structure.id);
                  const hasStructure: boolean = cityStructures.some(s => s.type === structure.id);
                  
                  return (
                    <Card key={structure.id} className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium">{structure.name}</h4>
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-yellow-500" />
                          <span className="font-semibold">{structure.cost}</span>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-3">{structure.description}</p>
                      
                      <div className="mb-3">
                        <p className="text-xs font-medium text-gray-500 mb-1">Requirements:</p>
                        <div className="text-xs space-y-1">
                          <p>Technology: {structure.requiredTech.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} 
                            {currentPlayer.researchedTechs.includes(structure.requiredTech) ? 
                              <span className="text-green-600 ml-1">✓</span> : 
                              <span className="text-red-500 ml-1">✗</span>
                            }
                          </p>
                        </div>
                      </div>
                      
                      <div className="mb-3">
                        <p className="text-xs font-medium text-gray-500 mb-1">Effects:</p>
                        <div className="text-xs space-y-1">
                          {structure.effects.starProduction > 0 && (
                            <p>+{structure.effects.starProduction} stars/turn</p>
                          )}
                          {structure.effects.unitProduction > 0 && (
                            <p>+{structure.effects.unitProduction} unit production</p>
                          )}
                          {structure.effects.defenseBonus > 0 && (
                            <p>+{structure.effects.defenseBonus} defense</p>
                          )}
                        </div>
                      </div>
                      
                      <Button
                        onClick={() => handleBuildStructure(structure.id)}
                        disabled={!canAfford || hasStructure}
                        className="w-full"
                        variant={canAfford && !hasStructure ? "default" : "outline"}
                        size="sm"
                      >
                        {getStructureBuildMessage(structure.id as StructureType)}
                      </Button>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
          
          {selectedTab === 'units' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Recruit Units</h3>
                <p className="text-sm text-gray-600">{cityUnits.length}/4 units in city</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.values(UNIT_DEFINITIONS).map(unit => {
                  const canAfford = canAffordUnit(unit.type);
                  
                  return (
                    <Card key={unit.type} className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium">{unit.name}</h4>
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-yellow-500" />
                          <span className="font-semibold">{unit.cost}</span>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-3">{unit.description}</p>
                      
                      <div className="mb-3">
                        <p className="text-xs font-medium text-gray-500 mb-1">Stats:</p>
                        <div className="grid grid-cols-2 gap-1 text-xs">
                          <span>HP: {unit.baseStats.hp}</span>
                          <span>Attack: {unit.baseStats.attack}</span>
                          <span>Defense: {unit.baseStats.defense}</span>
                          <span>Movement: {unit.baseStats.movement}</span>
                        </div>
                      </div>
                      
                      {unit.requirements && (
                        <div className="mb-3">
                          <p className="text-xs font-medium text-gray-500 mb-1">Requirements:</p>
                          <div className="text-xs space-y-1">
                            {unit.requirements.faith && (
                              <p>Faith: {unit.requirements.faith}+ (have: {currentPlayer.stats.faith})</p>
                            )}
                          </div>
                        </div>
                      )}
                      
                      <Button
                        onClick={() => handleRecruitUnit(unit.type)}
                        disabled={!canAfford}
                        className="w-full"
                        variant={canAfford ? "default" : "outline"}
                        size="sm"
                      >
                        {getUnitRecruitMessage(unit.type)}
                      </Button>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Construction Hall */}
      {showAdvancedBuildingMenu && (
        <BuildingMenu
          city={city}
          player={currentPlayer}
          gameState={gameState}
          onBuild={(optionId) => {
            console.log('Starting construction:', optionId);
            // Determine building category and start construction mode
            let category: 'improvements' | 'structures' | 'units';
            
            if (Object.values(STRUCTURE_DEFINITIONS).some(s => s.id === optionId)) {
              category = 'structures';
            } else if (Object.values(UNIT_DEFINITIONS).some(u => u.type === optionId)) {
              category = 'units';
            } else {
              category = 'improvements';
            }
            
            // Start construction mode for tile selection
            startConstruction(optionId, category, city.id, currentPlayer.id);
            setShowAdvancedBuildingMenu(false);
            
            // Show instruction message
            console.log(`Select a tile to build ${optionId}`);
          }}
          onClose={() => setShowAdvancedBuildingMenu(false)}
        />
      )}
    </div>
  );
}