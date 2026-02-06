import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Button } from "./button";
import { Badge } from "./badge";
import { Separator } from "./separator";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { useGameState } from "../../lib/stores/useGameState";
import { Star, Building, Sword, Hammer, Users, Sparkles, Pencil, Check, X, Info } from "lucide-react";
import { IMPROVEMENT_DEFINITIONS, STRUCTURE_DEFINITIONS, type ImprovementType, type StructureType } from "@shared/types/city";
import { getUnitDefinition, UNIT_DEFINITIONS } from "@shared/data/units";
import { getFaction } from "@shared/data/factions";
import { coerceFactionId } from "@shared/types/factionId";
import type { UnitType } from "@shared/types/unit";
import {
  getStructureEffectSummary,
  getUnitEffectSummary,
  type EffectDescriptor,
} from "@shared/data/buildingEffects";
import {
  getStructureBuildRequirements,
  getUnitBuildRequirements,
  type BuildRequirement,
} from "@shared/logic/buildingRequirements";
import { BuildingMenu } from "./BuildingMenu";
import { ActionTooltip } from "./TooltipSystem";
import { Input } from "./input";
import { getValidSpawnTiles } from "@shared/logic/gameReducer";
import { HexCoordinate } from "@shared/types/coordinates";
import { Progress } from "./progress";
import { TutorialHelpIcon } from "./TutorialHelpIcon";
import { useMobileUI } from "../../hooks/useMobileUI";

interface CityPanelProps {
  open: boolean;
  onClose: () => void;
  cityId: string;
}

export default function CityPanel({ open, onClose, cityId }: CityPanelProps) {
  const { gameState, dispatch } = useLocalGame();
  const { startConstruction, startSpawnSelection } = useGameState();
  const { isMobileUI } = useMobileUI();
  const [selectedTab, setSelectedTab] = useState<'overview' | 'structures' | 'units' | 'improvements'>('overview');
  const [showAdvancedBuildingMenu, setShowAdvancedBuildingMenu] = useState(false);
  const [showGrowthGuide, setShowGrowthGuide] = useState(false);

  // Renaming state
  const [isRenaming, setIsRenaming] = useState(false);
  const [tempName, setTempName] = useState('');

  if (!open || !gameState) return null;

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const currentFactionId = coerceFactionId(currentPlayer.factionId);
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
  const popToNextLevel = Math.max(0, city.maxPopulation - city.population);
  const levelProgress = city.maxPopulation > 0
    ? Math.min(100, Math.round((city.population / city.maxPopulation) * 100))
    : 0;

  const handleBuildStructure = (structureType: StructureType) => {
    startConstruction(structureType, 'structures', city.id, currentPlayer.id);
    onClose();
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
          type: 'START_CONSTRUCTION',
          payload: {
            playerId: currentPlayer.id,
            buildingType: unitType,
            category: 'units',
            coordinate,
            cityId
          }
        });
      }
    });
  };

  const getStructureBuildMessage = (
    hasStructure: boolean,
    structureCost: number,
    requirements: BuildRequirement[]
  ) => {
    if (hasStructure) {
      return "Built";
    }

    const unmet = requirements.find(req => req.status === "unmet");
    if (!unmet) return "Build";

    if (unmet.id === "technology") {
      return unmet.value ? `Requires ${unmet.value}` : "Requires technology";
    }
    if (unmet.id === "stars_cost") {
      return `Need ${structureCost - currentPlayer.stars} more stars`;
    }
    if (unmet.id === "valid_tiles") {
      return "No valid build tiles";
    }
    if (unmet.id === "owns_city") {
      return "Not your city";
    }

    return unmet.label;
  };

  const canAffordUnit = (unitType: UnitType) => {
    const unitDef = getUnitDefinition(unitType);
    const validTiles = getValidSpawnTiles(gameState, city.coordinate, unitType, currentPlayer.id);
    const hasSpace = validTiles.length > 0;
    const hasRequiredTech = !unitDef.requiredTechnology || currentPlayer.researchedTechs.includes(unitDef.requiredTechnology);
    const meetsRequirements = !unitDef.requirements ||
      ((!unitDef.requirements.faith || currentPlayer.stats.faith >= unitDef.requirements.faith) &&
        (!unitDef.requirements.pride || currentPlayer.stats.pride >= unitDef.requirements.pride) &&
        (!unitDef.requirements.dissent || currentPlayer.stats.internalDissent >= unitDef.requirements.dissent));
    const factionMatch = unitDef.factionSpecific.length === 0 ||
      (!!currentFactionId && unitDef.factionSpecific.includes(currentFactionId));

    return currentPlayer.stars >= unitDef.cost && hasSpace && hasRequiredTech && meetsRequirements && factionMatch;
  };

  const getUnitRecruitMessage = (unitType: UnitType) => {
    const unitDef = getUnitDefinition(unitType);
    const validTiles = getValidSpawnTiles(gameState, city.coordinate, unitType, currentPlayer.id);
    const hasSpace = validTiles.length > 0;
    const hasEnoughStars = currentPlayer.stars >= unitDef.cost;

    if (!hasSpace) {
      return "No open spawn tiles";
    }

    const factionMatch = unitDef.factionSpecific.length === 0 ||
      (!!currentFactionId && unitDef.factionSpecific.includes(currentFactionId));

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

  const formatEffectLine = (effect: EffectDescriptor) =>
    effect.value ? `${effect.label}: ${effect.value}` : effect.label;

  const formatRequirementLine = (req: BuildRequirement) => {
    const status = req.status === "info" ? "•" : req.status === "met" ? "✓" : "✗";
    return `${status} ${req.value ? `${req.label}: ${req.value}` : req.label}`;
  };

  return (
    <div
      className={`fixed inset-0 bg-black/80 flex items-center justify-center z-50 ${isMobileUI ? 'p-0' : 'p-4'}`}
      style={{ pointerEvents: 'auto' }}
      onClick={(e) => {
        console.log('🏛️ CityPanel backdrop clicked:', e.target === e.currentTarget);
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <Card
        className={`w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-amber-500/30 shadow-2xl shadow-amber-500/10 overflow-y-auto ${isMobileUI ? 'max-w-full max-h-full rounded-none mobile-safe-top mobile-safe-bottom' : 'max-w-4xl max-h-[90vh]'}`}
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
              <TutorialHelpIcon cardId="city" label="Open city tutorial" />
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

        <CardContent className={`overflow-y-auto touch-scroll ${isMobileUI ? 'max-h-[calc(100vh-200px)]' : 'max-h-[calc(90vh-200px)]'}`}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold mb-2 text-amber-100">City Information</h3>
                <div className="space-y-1 text-sm text-slate-200">
                  <p>Level: {city.level}</p>
                  <p>Population: {city.population}/{city.maxPopulation}</p>
                  <p>Star Production: +{city.starProduction}/turn</p>
                  <p>Owner: {currentPlayer.name}</p>
                  <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-900/10 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-amber-200">Level Progress</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs text-amber-200 hover:text-amber-100 hover:bg-amber-500/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowGrowthGuide(true);
                        }}
                      >
                        <Info className="mr-1 h-3 w-3" />
                        Growth Guide
                      </Button>
                    </div>
                    <p className="mt-1 text-xs text-amber-200/70">
                      {popToNextLevel === 0
                        ? "Leveling on the next population gain"
                        : `Next level in ${popToNextLevel} population`}
                    </p>
                    <Progress value={levelProgress} className="mt-2 h-2 bg-slate-800" />
                    <p className="mt-2 text-[11px] text-amber-200/70">
                      Next Level Rewards: +1★/turn, +2 population cap, larger city model
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2 text-amber-100">Resources</h3>
                <div className="space-y-1 text-sm text-slate-200">
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-yellow-500" />
                    <span>{currentPlayer.stars} Stars</span>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-2 text-amber-100">Current Structures</h3>
              {cityStructures.length > 0 ? (
                <div className="grid grid-cols-1 gap-2">
                  {cityStructures.map(structure => (
                    <div key={structure.id} className="p-2 border border-slate-600 rounded">
                      <p className="font-medium text-slate-200">{structure.type}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-sm">No structures built yet</p>
              )}
            </div>

            <div>
              <h3 className="font-semibold mb-2 text-amber-100">Units in City</h3>
              {cityUnits.length > 0 ? (
                <div className="grid grid-cols-1 gap-2">
                  {cityUnits.map(unit => (
                    <div key={unit.id} className="p-2 border border-slate-600 rounded">
                      <p className="font-medium text-slate-200">{unit.type}</p>
                      <p className="text-sm text-slate-400">HP: {unit.hp}/{unit.maxHp}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-sm">No units in city</p>
              )}
            </div>
          </div>
          {selectedTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 text-slate-200">
                  <h3 className="font-semibold text-amber-100">City Information</h3>
                  <p>Population: {city.population}</p>
                  <p>Level: {city.level}</p>
                  <p>Production: {city.starProduction} per turn</p>
                  <p className="text-xs text-amber-200/70">
                    {popToNextLevel === 0
                      ? "Leveling on the next population gain"
                      : `Next level in ${popToNextLevel} population`}
                  </p>
                  <Progress value={levelProgress} className="h-2 bg-slate-800" />
                </div>
                <div className="space-y-2 text-slate-200">
                  <h3 className="font-semibold text-amber-100">Units in City</h3>
                  <p>{cityUnits.length}/4 units stationed</p>
                  {cityUnits.map(unit => (
                    <Badge key={unit.id} variant="outline">
                      {getUnitDefinition(unit.type)?.name ?? unit.type}
                    </Badge>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <h3 className="font-semibold text-amber-100">City Structures</h3>
                {cityStructures.length === 0 ? (
                  <p className="text-slate-400">No structures built</p>
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
              <h3 className="font-semibold mb-4 text-amber-100">Available Structures</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.values(STRUCTURE_DEFINITIONS).map(structure => {
                  const hasStructure: boolean = cityStructures.some(s => s.type === structure.id);
                  const structureEffects = getStructureEffectSummary(structure);
                  const structureRequirements = getStructureBuildRequirements(gameState, currentPlayer, city.id, structure);
                  const canBuild = !structureRequirements.some(req => req.status === "unmet");

                  return (
                    <Card key={structure.id} className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium">{structure.name}</h4>
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-yellow-500" />
                          <span className="font-semibold">{structure.cost}</span>
                        </div>
                      </div>

                      <p className="text-sm text-slate-300 mb-3">{structure.description}</p>

                      <div className="mb-3">
                        <p className="text-xs font-medium text-slate-400 mb-1">Requirements:</p>
                        <div className="text-xs space-y-1 text-slate-300">
                          {structureRequirements.map(req => (
                            <p key={req.id}>{formatRequirementLine(req)}</p>
                          ))}
                        </div>
                      </div>

                      <div className="mb-3">
                        <p className="text-xs font-medium text-slate-400 mb-1">Effects:</p>
                        {structureEffects.length > 0 ? (
                          <div className="text-xs space-y-1 text-slate-300">
                            {structureEffects.map(effect => (
                              <p key={effect.id}>{formatEffectLine(effect)}</p>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400">No effects listed</p>
                        )}
                      </div>

                      <Button
                        onClick={() => handleBuildStructure(structure.id)}
                        disabled={!canBuild}
                        className="w-full"
                        variant={canBuild ? "default" : "outline"}
                        size="sm"
                      >
                        {getStructureBuildMessage(hasStructure, structure.cost, structureRequirements)}
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
                <h3 className="font-semibold text-amber-100">Recruit Units</h3>
                <p className="text-sm text-slate-300">{cityUnits.length}/4 units in city</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.values(UNIT_DEFINITIONS)
                  .filter(unit => unit.factionSpecific.length === 0 || (!!currentFactionId && unit.factionSpecific.includes(currentFactionId)))
                  .filter(unit => {
                    if (!unit.requiredTechnology) return true;
                    return currentPlayer.researchedTechs.includes(unit.requiredTechnology);
                  })
                  .map(unit => {
                    const canAfford = canAffordUnit(unit.type);
                    const unitEffects = getUnitEffectSummary(unit);
                    const unitRequirements = getUnitBuildRequirements(gameState, currentPlayer, city.id, unit);
                    const factionTag = unit.factionSpecific.length > 0
                      ? (() => {
                          const names = unit.factionSpecific.map((id) => {
                            const faction = getFaction(id);
                            return faction ? faction.name : String(id);
                          });
                          return names.length === 1 ? `${names[0]} only` : `Only: ${names.join(', ')}`;
                        })()
                      : null;

                    return (
                      <Card key={unit.type} className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-medium">{unit.name}</h4>
                            {factionTag && (
                              <p className="mt-1 text-[10px] font-semibold text-amber-200/70">
                                {factionTag}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-yellow-500" />
                            <span className="font-semibold">{unit.cost}</span>
                          </div>
                        </div>

                        <p className="text-sm text-slate-300 mb-3">{unit.description}</p>

                        <div className="mb-3">
                          <p className="text-xs font-medium text-slate-400 mb-1">Effects:</p>
                          <div className="text-xs space-y-1 text-slate-300">
                            {unitEffects.map(effect => (
                              <p key={effect.id}>{formatEffectLine(effect)}</p>
                            ))}
                          </div>
                        </div>

                        <div className="mb-3">
                          <p className="text-xs font-medium text-slate-400 mb-1">Requirements:</p>
                          <div className="text-xs space-y-1 text-slate-300">
                            {unitRequirements.map(req => (
                              <p key={req.id}>{formatRequirementLine(req)}</p>
                            ))}
                          </div>
                        </div>

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

      {showGrowthGuide && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowGrowthGuide(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-amber-500/40 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 text-amber-100 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-cinzel text-lg text-amber-200">City Growth Guide</h3>
                <p className="text-xs text-amber-200/70">How population and leveling work</p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-amber-200 hover:text-amber-100 hover:bg-amber-500/10"
                onClick={() => setShowGrowthGuide(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-4 space-y-4 text-sm text-amber-100/90">
              <div>
                <p className="text-xs uppercase tracking-wider text-amber-300">How population grows</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Harvest world elements (timber, ore, grain, goats, fishing, ruins).</li>
                  <li>Convert or conquer villages (population goes to your nearest city).</li>
                  <li>Some world-element builds grant population immediately.</li>
                </ul>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider text-amber-300">Level-up rules</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>When population hits the cap, the city levels up automatically.</li>
                  <li>Population resets to 1, and the cap increases by 2.</li>
                  <li>Each level grants +1★/turn and a larger city model.</li>
                </ul>
              </div>

              <div className="rounded-lg border border-amber-500/20 bg-amber-900/10 p-3 text-xs text-amber-200/80">
                Tip: Population rewards are always applied to your nearest owned city.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
