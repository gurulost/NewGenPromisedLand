import { useLocalGame } from "../../lib/stores/useLocalGame";
import { hexToPixel } from "@shared/utils/hex";
import { Box, Cylinder, Sphere, Cone, Torus, useGLTF, Html } from "@react-three/drei";
import { useGameState } from "../../lib/stores/useGameState";
import { useMemo } from "react";
import { getVisibleTilesInRange } from "@shared/utils/lineOfSight";
import { getUnitDefinition } from "@shared/data/units";
import { IMPROVEMENT_DEFINITIONS, STRUCTURE_DEFINITIONS } from "@shared/types/city";
import Construction from "./Construction";
import { CityModel } from "./CityModel";
import { getVillageModelPath, getResourceModelPath } from "../../utils/modelManager";
import { GroundedModel } from "./GroundedModel";
import { 
  InfoTooltip, 
  StoneResourceTooltip, 
  FruitResourceTooltip, 
  GameResourceTooltip, 
  MetalResourceTooltip,
  TimberGroveTooltip,
  WildGoatsTooltip,
  GrainPatchTooltip,
  FishingShoalTooltip,
  JarediteRuinsTooltip,
  OreVeinTooltip 
} from '../ui/TooltipSystem';

// Village Model Component
function VillageModel({ position, owner }: { position: { x: number; y: number }; owner?: string }) {
  // Get color based on ownership
  const getOwnershipColor = (owner?: string) => {
    if (!owner || owner === 'neutral') return '#888888'; // Gray for neutral
    // For now, use green for owned - in future could map to player colors
    return '#4ade80'; // Green for owned
  };
  
  return (
    <group position={[position.x, 0, position.y]}>
      <GroundedModel
        src={getVillageModelPath()}
        position={{ x: 0, y: 0 }}
        scale={0.95}
        tileY={0}
      />
      {/* Village ownership indicator - small flag */}
      <group position={[0, 1.6, 0]}>
        <Cylinder args={[0.15, 0.15, 0.1]} position={[0, 0, 0]}>
          <meshStandardMaterial color={getOwnershipColor(owner)} />
        </Cylinder>
        {/* Flag pole */}
        <Cylinder args={[0.02, 0.02, 0.4]} position={[0, 0.25, 0]}>
          <meshStandardMaterial color="#8B4513" />
        </Cylinder>
      </group>
    </group>
  );
}

// Fruit Model Component
function FruitModel({ position }: { position: { x: number; y: number } }) {
  const modelPath = getResourceModelPath('fruit');
  
  if (!modelPath) {
    // Fallback to procedural sphere if model not available
    return (
      <Sphere position={[position.x, 0.06, position.y]} args={[0.06]}>
        <meshStandardMaterial color="#90EE90" />
      </Sphere>
    );
  }
  
  return (
    <GroundedModel
      src={modelPath}
      position={position}
      scale={0.6}
      tileY={0}
    />
  );
}

// Legacy model components removed - now using unified WorldElementModel

// Fish Shoal Model Component for Water Resources
function FishShoalModel({ position }: { position: { x: number; y: number } }) {
  const modelPath = getResourceModelPath('fishing_shoal');
  
  if (!modelPath) {
    // Fallback to procedural fish if model not available
    return (
      <group>
        <Sphere position={[position.x, 0.05, position.y]} args={[0.08]}>
          <meshStandardMaterial color="#4169E1" />
        </Sphere>
        <Sphere position={[position.x + 0.1, 0.03, position.y + 0.05]} args={[0.05]}>
          <meshStandardMaterial color="#4682B4" />
        </Sphere>
        <Sphere position={[position.x - 0.08, 0.04, position.y - 0.03]} args={[0.06]}>
          <meshStandardMaterial color="#5F9EA0" />
        </Sphere>
      </group>
    );
  }
  
  return (
    <GroundedModel
      src={modelPath}
      position={position}
      scale={0.42}
      tileY={0}
    />
  );
}

// World Element Model Components
function WorldElementModel({ elementId, position }: { elementId: string; position: { x: number; y: number } }) {
  // Use existing resource models for world elements with appropriate fallbacks
  const getModelForElement = (elementId: string) => {
    switch (elementId) {
      case 'timber_grove':
        return { model: 'timber_grove', scale: 0.18 }; // Made trees a bit bigger
      case 'wild_goats':
        return { model: 'game', scale: 0.35 }; // Made tapir (goats) about half the size
      case 'grain_patch':
        return { model: 'fruit', scale: 0.6 }; // Agricultural elements
      case 'ore_vein':
        return { model: 'ore_vein', scale: 0.6 }; // New ore vein model for unified ore system
      case 'fishing_shoal':
        return { model: 'fishing_shoal', scale: 0.525 }; // Increased fish shoal size by 25%
      case 'sea_beast':
        return { model: 'game', scale: 1.2 }; // Large creature elements
      case 'jaredite_ruins':
        return { model: 'jaredite_ruins', scale: 0.8 }; // New archaeological elements model
      default:
        return { model: 'fruit', scale: 0.6 };
    }
  };

  const config = getModelForElement(elementId);
  const modelPath = getResourceModelPath(config.model);
  
  if (!modelPath) {
    // Fallback to procedural geometry with element-specific colors
    const colors = {
      timber_grove: "#228B22", // Forest green
      wild_goats: "#D2691E",   // Saddle brown
      grain_patch: "#FFD700",  // Gold
      ore_vein: "#696969",     // Dim gray
      fishing_shoal: "#00CED1", // Dark turquoise
      sea_beast: "#4682B4",    // Steel blue
      jaredite_ruins: "#8B4513" // Saddle brown
    };
    
    return (
      <Box position={[position.x, 0.08, position.y]} args={[0.12, 0.12, 0.12]} scale={config.scale}>
        <meshStandardMaterial color={colors[elementId as keyof typeof colors] || "#90EE90"} />
      </Box>
    );
  }
  
  return (
    <GroundedModel
      src={modelPath}
      position={position}
      scale={config.scale}
      tileY={0}
    />
  );
}

// Resource with Info Tooltip Component
function ResourceWithTooltip({ 
  children, 
  resourceType, 
  position 
}: { 
  children: React.ReactNode; 
  resourceType: string; 
  position: { x: number; y: number; }; 
}) {
  const getTooltipContent = (type: string) => {
    switch (type) {
      // Unified World Elements System - All resources now provide moral choices
      case 'timber_grove':
        return <TimberGroveTooltip />;
      case 'wild_goats':
        return <WildGoatsTooltip />;
      case 'grain_patch':
        return <GrainPatchTooltip />;
      case 'ore_vein':
        return <OreVeinTooltip />; // Use ore vein tooltip for unified ore system
      case 'fishing_shoal':
        return <FishingShoalTooltip />;
      case 'sea_beast':
        return <GameResourceTooltip />; // Use animal tooltip for sea beasts
      case 'jaredite_ruins':
        return <JarediteRuinsTooltip />;
      default:
        return <div>Resource information not available</div>;
    }
  };

  return (
    <group>
      {children}
      {/* Info button positioned above the resource using Html from drei */}
      <Html position={[position.x + 0.3, 0.5, position.y + 0.3]} style={{ pointerEvents: 'auto' }}>
        <div className="relative">
          <InfoTooltip content={getTooltipContent(resourceType)} />
        </div>
      </Html>
    </group>
  );
}

// Model preloading is now handled by the centralized modelManager.ts

export default function MapFeatures() {
  const { gameState } = useLocalGame();
  const { selectedUnit } = useGameState();
  
  // Get current player for visibility calculations
  const currentPlayer = gameState?.players[gameState.currentPlayerIndex];
  
  // Memoize visible features to avoid recalculating on every render
  const { visibleCities, visibleTiles, exploredTiles, visibleImprovements, visibleStructures, visibleVillages } = useMemo(() => {
    if (!gameState || !currentPlayer) return { 
      visibleCities: [], 
      visibleTiles: new Set(), 
      exploredTiles: new Set(),
      visibleImprovements: [],
      visibleStructures: [],
      visibleVillages: []
    };
    
    // Calculate which tiles are explored or visible by current player
    const explored = new Set<string>();
    const visible = new Set<string>();
    
    // Add explored tiles
    gameState.map.tiles.forEach(tile => {
      const tileKey = `${tile.coordinate.q},${tile.coordinate.r}`;
      if (tile.exploredBy.includes(currentPlayer.id)) {
        explored.add(tileKey);
      }
    });
    
    // Add currently visible tiles from units using proper line-of-sight
    gameState.units
      .filter(unit => unit.playerId === currentPlayer.id)
      .forEach(unit => {
        // Use unit's actual vision radius from definition
        const unitDef = getUnitDefinition(unit.type);
        const visionRadius = unitDef.baseStats.visionRadius;
        
        // Get visible tiles with line-of-sight calculations
        const unitVisibleTiles = getVisibleTilesInRange(
          unit.coordinate,
          visionRadius,
          gameState.map,
          true // Enable shadow casting for performance
        );
        
        // Add all visible tiles to the set
        unitVisibleTiles.forEach((tileKey: string) => visible.add(tileKey));
      });
    
    // Filter cities that are currently visible only (not just explored)
    const cities = gameState.cities?.filter(city => {
      const cityKey = `${city.coordinate.q},${city.coordinate.r}`;
      return visible.has(cityKey); // Only currently visible, not explored
    }) || [];
    
    // Filter improvements that are currently visible only (not just explored)
    const improvements = gameState.improvements?.filter(improvement => {
      const impKey = `${improvement.coordinate.q},${improvement.coordinate.r}`;
      return visible.has(impKey); // Only currently visible, not explored
    }) || [];
    
    // Filter structures in visible cities
    const structures = gameState.structures?.filter(structure => {
      const city = cities.find(c => c.id === structure.cityId);
      return city !== undefined;
    }) || [];
    
    // Filter villages that are currently visible only (not just explored)
    const villages = gameState.map.tiles.filter(tile => {
      const tileKey = `${tile.coordinate.q},${tile.coordinate.r}`;
      const isCurrentlyVisible = visible.has(tileKey); // Only currently visible, not explored
      const isVillage = tile.feature === 'village';
      
      // Debug logging for villages
      if (isVillage) {
        console.log(`🏘️ Village tile ${tileKey}:`, {
          coordinate: tile.coordinate,
          isCurrentlyVisible,
          willRender: isCurrentlyVisible && isVillage
        });
      }
      
      return isCurrentlyVisible && isVillage;
    });
    
    return { 
      visibleCities: cities, 
      visibleTiles: visible, 
      exploredTiles: explored,
      visibleImprovements: improvements,
      visibleStructures: structures,
      visibleVillages: villages
    };
  }, [gameState, currentPlayer]);
  
  // Get currently visible tiles with resources (not just explored)
  const visibleTilesWithFeatures = useMemo(() => {
    if (!gameState) return [];
    
    const filteredTiles = gameState.map.tiles.filter(tile => {
      const tileKey = `${tile.coordinate.q},${tile.coordinate.r}`;
      const isCurrentlyVisible = visibleTiles.has(tileKey); // Only currently visible, not explored
      const hasFeatures = tile.resources.length > 0; // Add improvements check when available
      
      // Debug logging for visibility
      if (hasFeatures) {
        console.log(`🔍 Resource tile ${tileKey}:`, {
          coordinate: tile.coordinate,
          resources: tile.resources,
          isCurrentlyVisible,
          willRender: isCurrentlyVisible && hasFeatures
        });
      }
      
      return isCurrentlyVisible && hasFeatures;
    });
    
    console.log(`🎯 MapFeatures rendering ${filteredTiles.length} resource tiles out of ${gameState.map.tiles.filter(t => t.resources.length > 0).length} total resource tiles`);
    
    return filteredTiles;
  }, [gameState, visibleTiles]);
  
  if (!gameState) return null;
  
  // Function to render resource models with enhanced visuals and tooltips
  const renderResource = (resource: string, position: { x: number; y: number }, key: string) => {
    const y = 0.2; // Proper elevation above hex tiles
    
    const getResourceModel = (resource: string) => {
      switch (resource) {
        // Unified World Elements System - All resources now provide moral choices
        case 'timber_grove':
          return <WorldElementModel elementId="timber_grove" position={position} />; 
        case 'wild_goats':
          return <WorldElementModel elementId="wild_goats" position={position} />; 
        case 'grain_patch':
          return <WorldElementModel elementId="grain_patch" position={position} />; 
        case 'ore_vein':
          return <WorldElementModel elementId="ore_vein" position={position} />; 
        case 'fishing_shoal':
          return <WorldElementModel elementId="fishing_shoal" position={position} />; 
        case 'sea_beast':
          return <WorldElementModel elementId="sea_beast" position={position} />; 
        case 'jaredite_ruins':
          return <WorldElementModel elementId="jaredite_ruins" position={position} />; 
        
        default:
          return null;
      }
    };

    const model = getResourceModel(resource);
    if (!model) return null;

    return (
      <ResourceWithTooltip 
        key={`resource-${key}`} 
        resourceType={resource} 
        position={position}
      >
        {model}
      </ResourceWithTooltip>
    );
  };

  // Function to render forest trees (Polytopia-style: ALL forests have trees)
  const renderForestTrees = (position: { x: number; y: number }, key: string) => {
    return <WorldElementModel key={`forest-${key}`} elementId="timber_grove" position={position} />;
  };

  // Function to render improvement models
  const renderImprovement = (improvement: any, position: { x: number; y: number }, key: string) => {
    const y = 0.3; // Properly elevated above hex tiles
    
    switch (improvement.type) {
      case 'farm':
        return (
          <group key={`farm-${key}`}>
            {/* Farmland with crop rows */}
            <Box position={[position.x, y - 0.05, position.y]} args={[0.8, 0.02, 0.8]}>
              <meshStandardMaterial color="#8B4513" /> {/* Brown soil */}
            </Box>
            {/* Crop rows */}
            {Array.from({ length: 3 }, (_, i) => (
              <Box key={i} position={[position.x - 0.3 + i * 0.3, y, position.y]} args={[0.05, 0.1, 0.6]}>
                <meshStandardMaterial color="#90EE90" />
              </Box>
            ))}
          </group>
        );
      case 'mine':
        return (
          <group key={`mine-${key}`}>
            {/* Mine entrance */}
            <Box position={[position.x, y + 0.1, position.y]} args={[0.4, 0.3, 0.2]}>
              <meshStandardMaterial color="#654321" />
            </Box>
            {/* Mine cart */}
            <Box position={[position.x - 0.2, y, position.y + 0.2]} args={[0.15, 0.08, 0.1]}>
              <meshStandardMaterial color="#8B4513" />
            </Box>
            {/* Support beams */}
            <Cylinder position={[position.x - 0.15, y + 0.15, position.y]} args={[0.03, 0.03, 0.3]}>
              <meshStandardMaterial color="#8B4513" />
            </Cylinder>
          </group>
        );
      case 'forest_camp':
        return (
          <group key={`forest_camp-${key}`}>
            {/* Logging camp */}
            <Box position={[position.x, y + 0.05, position.y]} args={[0.3, 0.15, 0.2]}>
              <meshStandardMaterial color="#8B4513" />
            </Box>
            {/* Chopped logs */}
            <Cylinder position={[position.x + 0.2, y, position.y]} args={[0.05, 0.05, 0.4]} rotation={[Math.PI/2, 0, 0]}>
              <meshStandardMaterial color="#A0522D" />
            </Cylinder>
            <Cylinder position={[position.x + 0.2, y + 0.1, position.y]} args={[0.05, 0.05, 0.35]} rotation={[Math.PI/2, 0, 0]}>
              <meshStandardMaterial color="#A0522D" />
            </Cylinder>
          </group>
        );
      case 'port':
        return (
          <group key={`port-${key}`}>
            {/* Dock structure */}
            <Box position={[position.x, y, position.y]} args={[0.6, 0.1, 0.3]}>
              <meshStandardMaterial color="#8B4513" />
            </Box>
            {/* Dock posts */}
            <Cylinder position={[position.x - 0.25, y + 0.15, position.y]} args={[0.03, 0.03, 0.3]}>
              <meshStandardMaterial color="#654321" />
            </Cylinder>
            <Cylinder position={[position.x + 0.25, y + 0.15, position.y]} args={[0.03, 0.03, 0.3]}>
              <meshStandardMaterial color="#654321" />
            </Cylinder>
          </group>
        );
      case 'workshop':
        return (
          <group key={`workshop-${key}`}>
            {/* Workshop building */}
            <Box position={[position.x, y + 0.1, position.y]} args={[0.5, 0.25, 0.4]}>
              <meshStandardMaterial color="#696969" />
            </Box>
            {/* Chimney */}
            <Cylinder position={[position.x + 0.15, y + 0.3, position.y - 0.1]} args={[0.05, 0.05, 0.2]}>
              <meshStandardMaterial color="#2F4F4F" />
            </Cylinder>
            {/* Anvil */}
            <Box position={[position.x - 0.2, y + 0.02, position.y + 0.1]} args={[0.1, 0.05, 0.08]}>
              <meshStandardMaterial color="#4A4A4A" />
            </Box>
          </group>
        );
      case 'road':
        return (
          <group key={`road-${key}`}>
            {/* Road surface - stone cobblestone appearance */}
            <Box position={[position.x, y - 0.05, position.y]} args={[0.9, 0.02, 0.9]}>
              <meshStandardMaterial color="#555555" />
            </Box>
            {/* Road markings - center line */}
            <Box position={[position.x, y - 0.04, position.y]} args={[0.8, 0.01, 0.05]}>
              <meshStandardMaterial color="#DDDDDD" />
            </Box>
            <Box position={[position.x, y - 0.04, position.y]} args={[0.05, 0.01, 0.8]}>
              <meshStandardMaterial color="#DDDDDD" />
            </Box>
            {/* Road edges - small stones */}
            {Array.from({ length: 6 }, (_, i) => (
              <Box key={i} position={[
                position.x - 0.4 + (i * 0.16), 
                y - 0.02, 
                position.y + 0.42
              ]} args={[0.08, 0.04, 0.08]}>
                <meshStandardMaterial color="#666666" />
              </Box>
            ))}
            {Array.from({ length: 6 }, (_, i) => (
              <Box key={i + 6} position={[
                position.x - 0.4 + (i * 0.16), 
                y - 0.02, 
                position.y - 0.42
              ]} args={[0.08, 0.04, 0.08]}>
                <meshStandardMaterial color="#666666" />
              </Box>
            ))}
          </group>
        );
      default:
        return (
          <Box key={`improvement-${key}`} position={[position.x, y, position.y]} args={[0.3, 0.15, 0.3]}>
            <meshStandardMaterial color="#8B4513" />
          </Box>
        );
    }
  };

  // Function to render structure models (in cities)
  const renderStructure = (structure: any, cityPosition: { x: number; y: number }, index: number, key: string) => {
    const offsetAngle = (index * Math.PI * 2) / 6; // Distribute around city
    const offsetDistance = 0.4;
    const x = cityPosition.x + Math.cos(offsetAngle) * offsetDistance;
    const z = cityPosition.y + Math.sin(offsetAngle) * offsetDistance;
    const y = 0.4;
    
    switch (structure.type) {
      case 'temple':
        return (
          <group key={`temple-${key}`}>
            {/* Temple base */}
            <Cylinder position={[x, y, z]} args={[0.15, 0.2, 0.3, 8]}>
              <meshStandardMaterial color="#DDD" />
            </Cylinder>
            {/* Temple spire */}
            <Cone position={[x, y + 0.25, z]} args={[0.08, 0.2, 8]}>
              <meshStandardMaterial color="#FFD700" />
            </Cone>
          </group>
        );
      case 'granary':
        return (
          <group key={`granary-${key}`}>
            {/* Storage building */}
            <Cylinder position={[x, y, z]} args={[0.12, 0.15, 0.25, 6]}>
              <meshStandardMaterial color="#8B4513" />
            </Cylinder>
            {/* Roof */}
            <Cone position={[x, y + 0.2, z]} args={[0.18, 0.1, 6]}>
              <meshStandardMaterial color="#654321" />
            </Cone>
          </group>
        );
      case 'lighthouse':
        return (
          <group key={`lighthouse-${key}`}>
            {/* Tower */}
            <Cylinder position={[x, y + 0.1, z]} args={[0.08, 0.1, 0.4, 8]}>
              <meshStandardMaterial color="#E6E6FA" />
            </Cylinder>
            {/* Light beacon */}
            <Sphere position={[x, y + 0.35, z]} args={[0.06]}>
              <meshStandardMaterial color="#FFFF00" emissive="#FFFF00" emissiveIntensity={0.5} />
            </Sphere>
          </group>
        );
      case 'fortress':
        return (
          <group key={`fortress-${key}`}>
            {/* Fortress walls */}
            <Box position={[x, y + 0.1, z]} args={[0.25, 0.3, 0.25]}>
              <meshStandardMaterial color="#696969" />
            </Box>
            {/* Battlements */}
            <Box position={[x, y + 0.28, z]} args={[0.3, 0.05, 0.3]}>
              <meshStandardMaterial color="#2F4F4F" />
            </Box>
          </group>
        );
      default:
        return (
          <Cylinder key={`structure-${key}`} position={[x, y, z]} args={[0.1, 0.12, 0.2, 6]}>
            <meshStandardMaterial color="#8B4513" />
          </Cylinder>
        );
    }
  };
  
  return (
    <group>
      {/* Render Cities */}
      {visibleCities.map((city, cityIndex) => {
        const position = hexToPixel(city.coordinate, 1);
        const isPlayerCity = city.ownerId === currentPlayer?.id;
        
        // Get structures for this city
        const cityStructures = visibleStructures.filter(structure => structure.cityId === city.id);
        
        return (
          <group key={city.id}>
            {/* Use the new 3D city model */}
            <CityModel 
              city={city} 
              position={position} 
              isPlayerCity={isPlayerCity} 
            />
            
            {/* Render Structures around the city */}
            {cityStructures.map((structure, structureIndex) => 
              renderStructure(structure, position, structureIndex, `${city.id}-${structure.id}`)
            )}
          </group>
        );
      })}
      
      {/* Render Improvements on Tiles */}
      {visibleImprovements.map(improvement => {
        const position = hexToPixel(improvement.coordinate, 1);
        const impKey = `${improvement.coordinate.q},${improvement.coordinate.r}`;
        
        return renderImprovement(improvement, position, `${improvement.id}-${impKey}`);
      })}
      
      {/* Render Forest Trees on Forest Tiles WITHOUT Timber Groves (Polytopia-style) */}
      {gameState.map.tiles.filter(tile => {
        const tileKey = `${tile.coordinate.q},${tile.coordinate.r}`;
        const isCurrentlyVisible = visibleTiles.has(tileKey); // Only currently visible, not explored
        const isForest = tile.terrain === 'forest';
        
        // Debug logging for forest tiles
        if (isForest) {
          console.log(`🌲 Forest tile ${tileKey}:`, {
            coordinate: tile.coordinate,
            isCurrentlyVisible,
            willRender: isCurrentlyVisible && isForest
          });
        }
        
        return isCurrentlyVisible && isForest;
      }).map(tile => {
        const position = hexToPixel(tile.coordinate, 1);
        const tileKey = `${tile.coordinate.q},${tile.coordinate.r}`;
        
        // Check if this tile has an improvement (don't render trees on improved tiles)
        const hasImprovement = visibleImprovements.some(imp => 
          imp.coordinate.q === tile.coordinate.q && imp.coordinate.r === tile.coordinate.r
        );
        
        // Check if this tile has timber grove resource (don't render generic trees on timber groves)
        const hasTimberGrove = tile.resources.includes('timber_grove');
        
        if (hasImprovement || hasTimberGrove) return null; // Don't render generic trees on improved tiles or timber groves
        
        return renderForestTrees(position, tileKey);
      })}

      {/* Render Resources on All Tiles (including Forest Resources like Timber Groves) */}
      {visibleTilesWithFeatures.map(tile => {
        const position = hexToPixel(tile.coordinate, 1);
        const tileKey = `${tile.coordinate.q},${tile.coordinate.r}`;
        
        // Check if this tile has an improvement (resources should not render on improved tiles)
        const hasImprovement = visibleImprovements.some(imp => 
          imp.coordinate.q === tile.coordinate.q && imp.coordinate.r === tile.coordinate.r
        );
        
        if (hasImprovement) return null; // Don't render raw resources on improved tiles
        
        return (
          <group key={`tile-features-${tileKey}`}>
            {tile.resources.map((resource, index) => 
              renderResource(resource, position, `${tileKey}-${index}`)
            )}
          </group>
        );
      })}
      
      {/* Render Villages */}
      {visibleVillages.map(village => {
        const position = hexToPixel(village.coordinate, 1);
        const villageKey = `${village.coordinate.q},${village.coordinate.r}`;
        
        return (
          <group key={`village-${villageKey}`}>
            <VillageModel position={position} owner={village.cityOwner || 'neutral'} />
          </group>
        );
      })}
      
      {/* Render ongoing construction */}
      {currentPlayer && gameState.players.map(player => 
        player.constructionQueue?.map(construction => (
          <Construction
            key={construction.id}
            construction={construction}
          />
        ))
      )}
    </group>
  );
}