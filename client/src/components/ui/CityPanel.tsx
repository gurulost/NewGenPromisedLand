import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Button } from "./button";
import { Badge } from "./badge";
import { Separator } from "./separator";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { Star, Building, Sword, Hammer, Users } from "lucide-react";
import { IMPROVEMENT_DEFINITIONS, STRUCTURE_DEFINITIONS, type ImprovementType, type StructureType } from "@shared/types/city";
import { getUnitDefinition, UNIT_DEFINITIONS } from "@shared/data/units";
import type { UnitType } from "@shared/types/unit";

interface CityPanelProps {
  open: boolean;
  onClose: () => void;
  cityId: string;
}

export default function CityPanel({ open, onClose, cityId }: CityPanelProps) {
  const { gameState, dispatch } = useLocalGame();
  const [selectedTab, setSelectedTab] = useState<'overview' | 'structures' | 'units' | 'improvements'>('overview');
  
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

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <Card className="w-[90%] h-[90%] max-w-4xl bg-white border-2" onClick={(e) => e.stopPropagation()}>
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
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
          
          {/* Tab Navigation */}
          <div className="flex gap-2 mt-4">
            {(['overview', 'structures', 'units'] as const).map(tab => (
              <Button
                key={tab}
                variant={selectedTab === tab ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedTab(tab)}
                className="flex items-center gap-2"
              >
                {tab === 'overview' && <Building className="w-4 h-4" />}
                {tab === 'structures' && <Hammer className="w-4 h-4" />}
                {tab === 'units' && <Users className="w-4 h-4" />}
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Button>
            ))}
          </div>
        </CardHeader>
        
        <CardContent className="overflow-y-auto max-h-[calc(90vh-200px)]">
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
                        {hasStructure ? "Built" : 
                         canAfford ? "Build" : 
                         `Need ${structure.cost - currentPlayer.stars} more stars`}
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
                        {canAfford ? "Recruit" : 
                         cityUnits.length >= 4 ? "City Full" :
                         `Need ${unit.cost - currentPlayer.stars} more stars`}
                      </Button>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}