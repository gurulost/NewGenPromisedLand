import { useLocalGame } from "../../lib/stores/useLocalGame";
import { hexToPixel, hexDistance } from "@shared/utils/hex";
import { Box, Cylinder, Sphere, Cone, Torus, useGLTF, Html } from "@react-three/drei";
import { useGameState } from "../../lib/stores/useGameState";
import { useMemo } from "react";
import { getVisibleTilesInRange } from "@shared/utils/lineOfSight";
import { getUnitDefinition } from "@shared/data/units";
import { getFaction } from "@shared/data/factions";
import { IMPROVEMENT_DEFINITIONS, STRUCTURE_DEFINITIONS } from "@shared/types/city";
import type { HexCoordinate } from "@shared/types/coordinates";
import Construction from "./Construction";
import { CityModel } from "./CityModel";
import { getVillageModelPath, getResourceModelPath, getImprovementModelPath, getStructureModelPath } from "../../utils/modelManager";
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
      {/* Enhanced info button positioned above the resource using Html from drei */}
      <Html position={[position.x + 0.35, 0.6, position.y + 0.35]} style={{ pointerEvents: 'auto' }}>
        <div className="relative transform transition-all duration-300 hover:scale-110">
          <InfoTooltip 
            content={getTooltipContent(resourceType)} 
            placement="top"
            className="animate-bounce-subtle z-[40]"
          />
        </div>
      </Html>
    </group>
  );
}

// Model preloading is now handled by the centralized modelManager.ts

export default function MapFeatures() {
  const { gameState, onlineSession } = useLocalGame();
  const isDev = import.meta.env.DEV;
  const { showSpawnDebug } = useGameState();
  
  const activePlayer = gameState?.players[gameState.currentPlayerIndex];
  const viewPlayer = useMemo(() => {
    if (!gameState) return null;
    if (onlineSession?.myPlayerIds?.length) {
      return gameState.players.find(player => onlineSession.myPlayerIds.includes(player.id))
        ?? activePlayer
        ?? gameState.players[0];
    }
    const humanPlayers = gameState.players.filter(player => !player.isAI);
    if (humanPlayers.length === 1) {
      return humanPlayers[0];
    }
    return activePlayer ?? gameState.players[0];
  }, [gameState, onlineSession, activePlayer]);
  
  // Memoize visible features to avoid recalculating on every render
  const { visibleCities, visibleTiles, exploredTiles, visibleImprovements, visibleStructures, visibleVillages } = useMemo(() => {
    if (!gameState || !viewPlayer) return { 
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
      if (tile.exploredBy.includes(viewPlayer.id)) {
        explored.add(tileKey);
      }
    });
    
    // Add currently visible tiles from units using proper line-of-sight
    gameState.units
      .filter(unit => unit.playerId === viewPlayer.id)
      .forEach(unit => {
        // Use unit's actual vision radius from definition
        const unitDef = getUnitDefinition(unit.type);
        const visionRadius = unit.visionRadius ?? unitDef.baseStats.visionRadius;
        
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

    // Add visibility around owned cities
    const CITY_VISION_RADIUS = 2;
    const ownedCities = gameState.cities?.filter(city => city.ownerId === viewPlayer.id) || [];
    ownedCities.forEach(city => {
      gameState.map.tiles.forEach(tile => {
        const distance = hexDistance(city.coordinate, tile.coordinate);
        if (distance <= CITY_VISION_RADIUS) {
          const tileKey = `${tile.coordinate.q},${tile.coordinate.r}`;
          visible.add(tileKey);
          explored.add(tileKey);
        }
      });
    });
    
    // Filter cities that are currently visible only (not just explored)
    const cities = gameState.cities?.filter(city => {
      const cityKey = `${city.coordinate.q},${city.coordinate.r}`;
      // Show cities if currently visible OR explored OR owned by the current player
      return (
        visible.has(cityKey) ||
        explored.has(cityKey) ||
        viewPlayer.citiesOwned.includes(city.id)
      );
    }) || [];
    
    // Filter improvements that are currently visible only (not just explored)
    const improvements = gameState.improvements?.filter(improvement => {
      const impKey = `${improvement.coordinate.q},${improvement.coordinate.r}`;
      return visible.has(impKey); // Only currently visible, not explored
    }) || [];
    
    // Filter structures based on visibility or city ownership
    const structures = gameState.structures?.filter(structure => {
      if (structure.coordinate) {
        const key = `${structure.coordinate.q},${structure.coordinate.r}`;
        const isVisible = visible.has(key);
        const isExplored = explored.has(key);
        const isOwned = structure.ownerId === viewPlayer.id;
        return isVisible || (isExplored && isOwned);
      }

      const city = cities.find(c => c.id === structure.cityId);
      return city !== undefined;
    }) || [];
    
    // Filter villages that are currently visible only (not just explored)
    const villages = gameState.map.tiles.filter(tile => {
      const tileKey = `${tile.coordinate.q},${tile.coordinate.r}`;
      const isCurrentlyVisible = visible.has(tileKey); // Currently visible
      const isExplored = explored.has(tileKey);
      const isOwnedByPlayer = tile.cityOwner === viewPlayer.id;
      const isVillage = tile.feature === 'village';

      return isVillage && (isCurrentlyVisible || isExplored || isOwnedByPlayer);
    });
    
    return { 
      visibleCities: cities, 
      visibleTiles: visible, 
      exploredTiles: explored,
      visibleImprovements: improvements,
      visibleStructures: structures,
      visibleVillages: villages
    };
  }, [gameState, viewPlayer]);

  const spawnDebugMarkers = useMemo(() => {
    if (!isDev || !showSpawnDebug || !gameState) return null;

    const villageTiles = gameState.map.tiles.filter(tile => tile.feature === "village");
    const capitals = gameState.players.map(player => {
      const capitalCity = gameState.cities.find(city => city.id === `city-${player.id}`)
        ?? gameState.cities.find(city => city.ownerId === player.id);

      if (!capitalCity) return null;

      const faction = getFaction(player.factionId as any);
      const position = hexToPixel(capitalCity.coordinate, 1);
      let nearestVillage: { coordinate: { q: number; r: number; s: number }; distance: number } | null = null;

      for (const village of villageTiles) {
        const distance = hexDistance(capitalCity.coordinate, village.coordinate);
        if (!nearestVillage || distance < nearestVillage.distance) {
          nearestVillage = { coordinate: village.coordinate, distance };
        }
      }

      return {
        id: player.id,
        name: player.name,
        position,
        color: faction?.color ?? "#38bdf8",
        nearestVillage,
      };
    }).filter((capital): capital is NonNullable<typeof capital> => !!capital);

    const villageMarkers = new Map<string, { position: { x: number; y: number }; color: string }>();
    capitals.forEach(capital => {
      if (!capital.nearestVillage) return;
      const key = `${capital.nearestVillage.coordinate.q},${capital.nearestVillage.coordinate.r}`;
      if (!villageMarkers.has(key)) {
        villageMarkers.set(key, {
          position: hexToPixel(capital.nearestVillage.coordinate, 1),
          color: capital.color,
        });
      }
    });

    return {
      capitals,
      villageMarkers: Array.from(villageMarkers.values()),
    };
  }, [gameState, isDev, showSpawnDebug]);
  
  // Get currently visible tiles with resources (not just explored)
  const visibleTilesWithFeatures = useMemo(() => {
    if (!gameState) return [];
    
    const filteredTiles = gameState.map.tiles.filter(tile => {
      const tileKey = `${tile.coordinate.q},${tile.coordinate.r}`;
      const isCurrentlyVisible = visibleTiles.has(tileKey); // Only currently visible, not explored
      const hasFeatures = tile.resources.length > 0; // Add improvements check when available
      

      
      return isCurrentlyVisible && hasFeatures;
    });
    

    
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

  // Function to render improvement models using 3D GLB models
  const renderImprovement = (improvement: any, position: { x: number; y: number }, key: string) => {
    const modelPath = getImprovementModelPath(improvement.type);
    
    // Scale configurations for different improvement types
    const scaleConfig: Record<string, number> = {
      farm: 0.35,
      mine: 0.4,
      forest_camp: 0.35,
      lumber_hut: 0.35,
      sawmill: 0.4,
      plantation: 0.4,
      irrigation: 0.35,
      workshop: 0.4,
      port: 0.4,
      aqueduct: 0.45,
      road: 0.3,
      shrine: 0.4,
    };
    
    const scale = scaleConfig[improvement.type] || 0.35;
    
    if (modelPath) {
      return (
        <GroundedModel
          key={`improvement-${key}`}
          src={modelPath}
          position={position}
          scale={scale}
          tileY={0}
        />
      );
    }
    
    // Fallback to simple box if model not available
    return (
      <Box key={`improvement-${key}`} position={[position.x, 0.3, position.y]} args={[0.3, 0.15, 0.3]}>
        <meshStandardMaterial color="#8B4513" />
      </Box>
    );
  };

  // Function to render structure models (in cities) using 3D GLB models
  const renderStructure = (structure: any, cityPosition: { x: number; y: number }, index: number, key: string) => {
    const hasCoordinate = Boolean(structure.coordinate);
    const tilePosition = hasCoordinate ? hexToPixel(structure.coordinate, 1) : cityPosition;
    const offsetAngle = (index * Math.PI * 2) / 6; // Distribute around city when no tile coordinate
    const offsetDistance = 0.5;
    const x = hasCoordinate ? tilePosition.x : tilePosition.x + Math.cos(offsetAngle) * offsetDistance;
    const z = hasCoordinate ? tilePosition.y : tilePosition.y + Math.sin(offsetAngle) * offsetDistance;
    
    const modelPath = getStructureModelPath(structure.type);
    
    // Scale configurations for different structure types
    const scaleConfig: Record<string, number> = {
      temple: 0.35,
      granary: 0.35,
      lighthouse: 0.4,
      cathedral: 0.4,
      academy: 0.35,
      library: 0.35,
      fortress: 0.4,
    };
    
    const scale = scaleConfig[structure.type] || 0.35;
    
    if (modelPath) {
      return (
        <GroundedModel
          key={`structure-${key}`}
          src={modelPath}
          position={{ x, y: z }}
          scale={scale}
          tileY={0}
        />
      );
    }
    
    // Fallback to simple cylinder if model not available
    const y = hasCoordinate ? 0.3 : 0.4;
    return (
      <Cylinder key={`structure-${key}`} position={[x, y, z]} args={[0.1, 0.12, 0.2, 6]}>
        <meshStandardMaterial color="#8B4513" />
      </Cylinder>
    );
  };
  
  return (
    <group>
      {/* Render Cities */}
      {visibleCities.map((city, cityIndex) => {
        const position = hexToPixel(city.coordinate, 1);
        const isPlayerCity = city.ownerId === viewPlayer?.id;
        
        // Get structures for this city
        const cityStructures = visibleStructures.filter(structure =>
          structure.cityId === city.id && !structure.coordinate
        );
        
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

      {/* Render structures with explicit tile coordinates */}
      {visibleStructures
        .filter(structure => structure.coordinate)
        .map(structure => {
          const coordinate = structure.coordinate;
          if (!coordinate) return null;
          const tilePosition = hexToPixel(coordinate, 1);
          return renderStructure(structure, tilePosition, 0, `tile-${structure.id}`);
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
      {viewPlayer && gameState.players.map(player =>
        player.constructionQueue?.map(construction => {
          const city = gameState.cities?.find(c => c.id === construction.cityId);
          const coordinate = construction.coordinate ?? city?.coordinate;
          if (!coordinate) return null;

          const key = `${coordinate.q},${coordinate.r}`;
          const isVisible = visibleTiles.has(key);
          const isExplored = exploredTiles.has(key);
          const isOwned = player.id === viewPlayer.id;
          if (!isVisible && !isExplored && !isOwned) return null;

          return (
            <Construction
              key={construction.id}
              construction={{ ...construction, coordinate }}
            />
          );
        })
      )}

      {spawnDebugMarkers && (
        <group>
          {spawnDebugMarkers.capitals.map(capital => (
            <group key={`spawn-capital-${capital.id}`}>
              <Torus position={[capital.position.x, 0.06, capital.position.y]} args={[0.65, 0.05, 8, 24]} rotation={[Math.PI / 2, 0, 0]}>
                <meshStandardMaterial color={capital.color} emissive={capital.color} emissiveIntensity={0.5} transparent opacity={0.9} />
              </Torus>
              <Cone position={[capital.position.x, 0.45, capital.position.y]} args={[0.16, 0.4, 6]}>
                <meshStandardMaterial color={capital.color} emissive={capital.color} emissiveIntensity={0.35} />
              </Cone>
              <Html position={[capital.position.x, 0.85, capital.position.y]} style={{ pointerEvents: "none" }}>
                <div className="rounded bg-black/70 px-2 py-1 text-[10px] text-white/80 shadow">
                  {capital.name}
                </div>
              </Html>
            </group>
          ))}
          {spawnDebugMarkers.villageMarkers.map((marker, index) => (
            <Sphere key={`spawn-village-${index}`} position={[marker.position.x, 0.18, marker.position.y]} args={[0.08]}>
              <meshStandardMaterial color={marker.color} emissive={marker.color} emissiveIntensity={0.6} transparent opacity={0.85} />
            </Sphere>
          ))}
        </group>
      )}
    </group>
  );
}
