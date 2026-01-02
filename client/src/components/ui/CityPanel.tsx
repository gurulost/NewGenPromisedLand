import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Button } from "./button";
import { Badge } from "./badge";
import { Separator } from "./separator";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { useGameState } from "../../lib/stores/useGameState";
import { Star, Building, Sword, Hammer, Users, Sparkles, Pencil, Check, X } from "lucide-react";
import { IMPROVEMENT_DEFINITIONS, STRUCTURE_DEFINITIONS, type ImprovementType, type StructureType } from "@shared/types/city";
import { getUnitDefinition, UNIT_DEFINITIONS } from "@shared/data/units";
import type { UnitType } from "@shared/types/unit";
import { BuildingMenu } from "./BuildingMenu";
import { ActionTooltip } from "./TooltipSystem";
import { Input } from "./input";
import { getValidSpawnTiles } from "@shared/logic/gameReducer";
import { HexCoordinate } from "@shared/types/coordinates";
import { Progress } from "./progress";

interface CityPanelProps {
  open: boolean;
  onClose: () => void;
  cityId: string;
}

export default function CityPanel({ open, onClose, cityId }: CityPanelProps) {
  const { gameState, dispatch } = useLocalGame();
  const { startConstruction, startSpawnSelection } = useGameState();
  const [selectedTab, setSelectedTab] = useState<'overview' | 'structures' | 'units' | 'improvements'>('overview');
  const [showAdvancedBuildingMenu, setShowAdvancedBuildingMenu] = useState(false);

  // Renaming state
  const [isRenaming, setIsRenaming] = useState(false);
  const [tempName, setTempName] = useState('');

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
    // Get valid spawn tiles for this unit type
    const validTiles = getValidSpawnTiles(gameState, city.coordinate, unitType, currentPlayer.id);
    
    if (validTiles.length === 0) {
      console.log('No valid spawn tiles available for', unitType);
      // Show user feedback
      alert(`Cannot recruit ${unitType}: No valid spawn locations available. All nearby tiles are blocked or at capacity.`);
      return;
    }
    
    // If only one valid tile, spawn directly there
    if (validTiles.length === 1) {
      dispatch({
        type: 'RECRUIT_UNIT',
        payload: {
          playerId: currentPlayer.id,
          cityId,
          unitType,
          spawnCoordinate: validTiles[0]
        }
      });
      return;
    }
    
    // Multiple valid tiles - enter spawn selection mode
    onClose(); // Close the city panel
    startSpawnSelection({
      unitType,
      cityId,
      cityCoordinate: city.coordinate,
      playerId: currentPlayer.id,
      validSpawnTiles: validTiles,
      onSelectTile: (coordinate: HexCoordinate) => {
        dispatch({
          type: 'RECRUIT_UNIT',
          payload: {
            playerId: currentPlayer.id,
            cityId,
            unitType,
            spawnCoordinate: coordinate
          }
        });
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
    const hasRequiredTech = !unitDef.requiredTechnology || currentPlayer.researchedTechs.includes(unitDef.requiredTechnology);
    const meetsRequirements = !unitDef.requirements ||
      ((!unitDef.requirements.faith || currentPlayer.stats.faith >= unitDef.requirements.faith) &&
        (!unitDef.requirements.pride || currentPlayer.stats.pride >= unitDef.requirements.pride) &&
        (!unitDef.requirements.dissent || currentPlayer.stats.internalDissent >= unitDef.requirements.dissent));
    const factionMatch = unitDef.factionSpecific.length === 0 ||
      unitDef.factionSpecific.includes(currentPlayer.factionId);

    return currentPlayer.stars >= unitDef.cost && hasSpace && hasRequiredTech && meetsRequirements && factionMatch;
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

    if (unitDef.requiredTechnology && !currentPlayer.researchedTechs.includes(unitDef.requiredTechnology)) {
      const techName = unitDef.requiredTechnology.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
      return `Requires ${techName}`;
    }

    if (unitDef.requirements) {
      if (unitDef.requirements.faith && currentPlayer.stats.faith < unitDef.requirements.faith) {
        return `Need ${unitDef.requirements.faith} Faith`;
      }
      if (unitDef.requirements.pride && currentPlayer.stats.pride < unitDef.requirements.pride) {
        return `Need ${unitDef.requirements.pride} Pride`;
      }
      if (unitDef.requirements.dissent && currentPlayer.stats.internalDissent < unitDef.requirements.dissent) {
        return `Need ${unitDef.requirements.dissent} Dissent`;
      }
    }

    if (!hasEnoughStars) {
      return `Need ${unitDef.cost - currentPlayer.stars} more stars`;
    }

    return "Recruit";
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      style={{ pointerEvents: 'auto' }}
      onClick={(e) => {
        console.log('🏛️ CityPanel backdrop clicked:', e.target === e.currentTarget);
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <Card
        className="w-full h-full max-w-4xl max-h-[90vh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-amber-500/30 shadow-2xl shadow-amber-500/10 overflow-y-auto"
        onClick={(e) => {
          console.log('🏛️ CityPanel card clicked');
          e.stopPropagation();
        }}
      >
        <CardHeader className="bg-gradient-to-r from-amber-900/20 to-amber-800/20 border-b border-amber-500/20">
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-3 font-cinzel text-xl font-semibold tracking-wide text-amber-100 flex-1">
              <div className="p-2 bg-gradient-to-br from-amber-600 to-amber-700 rounded-lg shadow-lg shadow-amber-500/25">
                <Building className="w-5 h-5 text-amber-100" />
              </div>

              {isRenaming ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    className="h-8 w-48 bg-slate-900/50 border-amber-500/30 text-amber-100"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        dispatch({
                          type: 'RENAME_CITY',
                          payload: { playerId: currentPlayer.id, cityId, newName: tempName }
                        });
                        setIsRenaming(false);
                      } else if (e.key === 'Escape') {
                        setIsRenaming(false);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-green-400 hover:text-green-300 hover:bg-green-900/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch({
                        type: 'RENAME_CITY',
                        payload: { playerId: currentPlayer.id, cityId, newName: tempName }
                      });
                      setIsRenaming(false);
                    }}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsRenaming(false);
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <span>{city.name}</span>
                  {isOwned && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-amber-400 hover:text-amber-300 hover:bg-amber-900/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTempName(city.name);
                        setIsRenaming(true);
                      }}
                      title="Rename City"
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                  )}
                  <div className="text-sm text-amber-300/70 font-normal ml-2">— City of the Promised Land —</div>
                </div>
              )}
            </CardTitle>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-amber-900/30 border border-amber-500/30 px-3 py-2 rounded-lg">
                <Star className="w-4 h-4 text-amber-400" />
                <span className="font-semibold text-amber-100">{currentPlayer.stars}</span>
                <span className="text-amber-300/70 text-sm">Stars</span>
              </div>
              <Button
                variant="outline"
                onClick={(e) => {
                  console.log('🏛️ CityPanel Close button clicked');
                  e.stopPropagation();
                  onClose();
                }}
                className="min-h-[44px] bg-amber-900/30 border-amber-600/50 text-amber-300 md:hover:bg-amber-800/30 active:bg-amber-900/50 touch-manipulation"
              >
                Close
              </Button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 mt-4 justify-between">
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedTab === 'overview' ? "default" : "outline"}
                size="sm"
                className="flex items-center gap-2"
                onClick={() => setSelectedTab('overview')}
              >
                <Building className="w-4 h-4" />
                Overview
              </Button>
              <Button
                variant={selectedTab === 'structures' ? "default" : "outline"}
                size="sm"
                className="flex items-center gap-2"
                onClick={() => setSelectedTab('structures')}
              >
                <Hammer className="w-4 h-4" />
                Structures
              </Button>
              <Button
                variant={selectedTab === 'units' ? "default" : "outline"}
                size="sm"
                className="flex items-center gap-2"
                onClick={() => setSelectedTab('units')}
              >
                <Sword className="w-4 h-4" />
                Units
              </Button>
            </div>

            {/* Construction Hall Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                console.log('Construction Hall button clicked');
                setShowAdvancedBuildingMenu(true);
              }}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-600/10 to-blue-600/10 border-purple-500/30 hover:from-purple-600/20 hover:to-blue-600/20"
              title="Open the comprehensive building interface with detailed information and visual design (B)"
            >
              <Hammer className="w-4 h-4" />
              Construction Hall
            </Button>
          </div>
        </CardHeader>

        <CardContent className="overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold mb-2">City Information</h3>
                <div className="space-y-1 text-sm">
                  <p>Level: {city.level}</p>
                  <p>Population: {city.population}/{city.maxPopulation}</p>
                  <p>Star Production: +{city.starProduction}/turn</p>
                  <p>Owner: {currentPlayer.name}</p>
                  {city.population >= city.maxPopulation && (
                    <p className="text-yellow-400 font-bold">Ready to level up!</p>
                  )}
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
                      <p className="text-sm text-gray-600">HP: {unit.hp}/{unit.maxHp}</p>
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
                {Object.values(UNIT_DEFINITIONS)
                  .filter(unit => unit.factionSpecific.length === 0 || unit.factionSpecific.includes(currentPlayer.factionId))
                  .filter(unit => {
                    if (!unit.requiredTechnology) return true;
                    return currentPlayer.researchedTechs.includes(unit.requiredTechnology);
                  })
                  .map(unit => {
                    const canAfford = canAffordUnit(unit.type);
                    const hasRequiredTech = !unit.requiredTechnology || currentPlayer.researchedTechs.includes(unit.requiredTechnology);

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
                              {unit.requirements.pride && (
                                <p>Pride: {unit.requirements.pride}+ (have: {currentPlayer.stats.pride})</p>
                              )}
                              {unit.requirements.dissent && (
                                <p>Dissent: {unit.requirements.dissent}+ (have: {currentPlayer.stats.internalDissent})</p>
                              )}
                            </div>
                          </div>
                        )}

                        {unit.passiveEffects && (
                          <div className="mb-3">
                            <p className="text-xs font-medium text-gray-500 mb-1">Per Turn:</p>
                            <div className="text-xs space-y-1">
                              {unit.passiveEffects.perTurn?.stars && (
                                <p>{unit.passiveEffects.perTurn.stars > 0 ? '+' : ''}{unit.passiveEffects.perTurn.stars}★</p>
                              )}
                              {unit.passiveEffects.perTurn?.faith && (
                                <p>{unit.passiveEffects.perTurn.faith > 0 ? '+' : ''}{unit.passiveEffects.perTurn.faith} Faith</p>
                              )}
                              {unit.passiveEffects.perTurn?.pride && (
                                <p>{unit.passiveEffects.perTurn.pride > 0 ? '+' : ''}{unit.passiveEffects.perTurn.pride} Pride</p>
                              )}
                              {unit.passiveEffects.perTurn?.dissent && (
                                <p>{unit.passiveEffects.perTurn.dissent > 0 ? '+' : ''}{unit.passiveEffects.perTurn.dissent} Dissent</p>
                              )}
                              {(unit.passiveEffects.perTurnWhen || []).map((cond, idx) => {
                                const statLabel = cond.stat === 'internalDissent' ? 'Dissent' : (cond.stat.charAt(0).toUpperCase() + cond.stat.slice(1));
                                const condition = typeof cond.gte === 'number'
                                  ? `${statLabel} ≥ ${cond.gte}`
                                  : typeof cond.lte === 'number'
                                    ? `${statLabel} ≤ ${cond.lte}`
                                    : statLabel;
                                const parts: string[] = [];
                                if (cond.perTurn.stars) parts.push(`${cond.perTurn.stars > 0 ? '+' : ''}${cond.perTurn.stars}★`);
                                if (cond.perTurn.faith) parts.push(`${cond.perTurn.faith > 0 ? '+' : ''}${cond.perTurn.faith} Faith`);
                                if (cond.perTurn.pride) parts.push(`${cond.perTurn.pride > 0 ? '+' : ''}${cond.perTurn.pride} Pride`);
                                if (cond.perTurn.dissent) parts.push(`${cond.perTurn.dissent > 0 ? '+' : ''}${cond.perTurn.dissent} Dissent`);
                                if (parts.length === 0) return null;
                                return <p key={idx}>When {condition}: {parts.join(', ')}</p>;
                              })}
                              {unit.passiveEffects.diplomacyCooldownDelta?.perTurn.requestTrade && (
                                <p>Request Trade cooldown: {unit.passiveEffects.diplomacyCooldownDelta.perTurn.requestTrade}/turn</p>
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
            // Determine building category
            let category: 'improvements' | 'structures' | 'units';

            if (Object.values(STRUCTURE_DEFINITIONS).some(s => s.id === optionId)) {
              category = 'structures';
            } else if (Object.values(UNIT_DEFINITIONS).some(u => u.type === optionId)) {
              category = 'units';
            } else {
              category = 'improvements';
            }

            // For units, use spawn selection mode
            if (category === 'units') {
              handleRecruitUnit(optionId as UnitType);
              setShowAdvancedBuildingMenu(false);
              return;
            }

            // For structures and improvements, use construction mode
            console.log(`Starting tile selection for ${optionId}`);
            startConstruction(optionId, category, city.id, currentPlayer.id);
            setShowAdvancedBuildingMenu(false);
            // Close the main city panel to show the map clearly
            onClose();
          }}
          onClose={() => setShowAdvancedBuildingMenu(false)}
        />
      )}
    </div>
  );
}
