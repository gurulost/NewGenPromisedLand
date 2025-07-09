import { useLocalGame } from "../../lib/stores/useLocalGame";
import { hexToPixel } from "@shared/utils/hex";
import { Box, Cylinder, Sphere, Cone, Torus, useGLTF } from "@react-three/drei";
import { useGameState } from "../../lib/stores/useGameState";
import { useMemo } from "react";
import { getVisibleTilesInRange } from "@shared/utils/lineOfSight";
import { getUnitDefinition } from "@shared/data/units";
import { IMPROVEMENT_DEFINITIONS, STRUCTURE_DEFINITIONS } from "@shared/types/city";
import Construction from "./Construction";
import { CityModel } from "./CityModel";
import { getVillageModelPath, getResourceModelPath } from "../../utils/modelManager";
import { GroundedModel } from "./GroundedModel";

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
        scale={0.6}
        tileY={0}
      />
      {/* Village ownership indicator - small flag */}
      <group position={[0, 1.2, 0]}>
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

// Stone Model Component
function StoneModel({ position }: { position: { x: number; y: number } }) {
  const modelPath = getResourceModelPath('stone');
  
  if (!modelPath) {
    // Fallback to procedural boxes if model not available
    return (
      <Box position={[position.x, 0.15, position.y]} args={[0.12, 0.15, 0.12]}>
        <meshStandardMaterial color="#696969" />
      </Box>
    );
  }
  
  return (
    <GroundedModel
      src={modelPath}
      position={position}
      scale={0.5}
      tileY={0}
    />
  );
}

// Game/Animal Model Component
function GameModel({ position }: { position: { x: number; y: number } }) {
  const modelPath = getResourceModelPath('game');
  
  if (!modelPath) {
    // Fallback to procedural animal if model not available
    return (
      <Box position={[position.x, 0.08, position.y]} args={[0.1, 0.06, 0.15]}>
        <meshStandardMaterial color="#8B4513" />
      </Box>
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

// Metal/Ore Model Component
function MetalModel({ position }: { position: { x: number; y: number } }) {
  const modelPath = getResourceModelPath('metal');
  
  if (!modelPath) {
    // Fallback to procedural metal if model not available
    return (
      <Box position={[position.x, 0.12, position.y]} args={[0.08, 0.12, 0.08]} rotation={[0, Math.PI/4, 0]}>
        <meshStandardMaterial color="#C0C0C0" metalness={0.9} roughness={0.1} />
      </Box>
    );
  }
  
  return (
    <GroundedModel
      src={modelPath}
      position={position}
      scale={0.5}
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
        return { model: 'fruit', scale: 0.8 }; // Tree-like elements
      case 'wild_goats':
        return { model: 'game', scale: 0.7 }; // Animal elements
      case 'grain_patch':
        return { model: 'fruit', scale: 0.6 }; // Agricultural elements
      case 'fishing_shoal':
        return { model: 'fruit', scale: 0.5 }; // Marine elements
      case 'sea_beast':
        return { model: 'game', scale: 1.2 }; // Large creature elements
      case 'jaredite_ruins':
        return { model: 'stone', scale: 1.0 }; // Archaeological elements
      default:
        return { model: 'fruit', scale: 0.6 };
    }
  };

  const config = getModelForElement(elementId);
  const modelPath = getResourceModelPath(config.model as 'fruit' | 'stone' | 'game' | 'metal');
  
  if (!modelPath) {
    // Fallback to procedural geometry
    return (
      <Box position={[position.x, 0.08, position.y]} args={[0.08, 0.08, 0.08]} scale={config.scale}>
        <meshStandardMaterial color="#90EE90" />
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
    
    // Filter cities that are visible or explored
    const cities = gameState.cities?.filter(city => {
      const cityKey = `${city.coordinate.q},${city.coordinate.r}`;
      return explored.has(cityKey) || visible.has(cityKey);
    }) || [];
    
    // Filter improvements that are visible or explored
    const improvements = gameState.improvements?.filter(improvement => {
      const impKey = `${improvement.coordinate.q},${improvement.coordinate.r}`;
      return explored.has(impKey) || visible.has(impKey);
    }) || [];
    
    // Filter structures in visible cities
    const structures = gameState.structures?.filter(structure => {
      const city = cities.find(c => c.id === structure.cityId);
      return city !== undefined;
    }) || [];
    
    // Filter villages that are visible or explored
    const villages = gameState.map.tiles.filter(tile => {
      const tileKey = `${tile.coordinate.q},${tile.coordinate.r}`;
      const isVisible = explored.has(tileKey) || visible.has(tileKey);
      return isVisible && tile.feature === 'village';
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
  
  // Get visible tiles with resources and improvements
  const visibleTilesWithFeatures = useMemo(() => {
    if (!gameState) return [];
    
    return gameState.map.tiles.filter(tile => {
      const tileKey = `${tile.coordinate.q},${tile.coordinate.r}`;
      const isVisible = visibleTiles.has(tileKey) || exploredTiles.has(tileKey);
      const hasFeatures = tile.resources.length > 0; // Add improvements check when available
      
      return isVisible && hasFeatures;
    });
  }, [gameState, visibleTiles, exploredTiles]);
  
  if (!gameState) return null;
  
  // Function to render resource models with enhanced visuals
  const renderResource = (resource: string, position: { x: number; y: number }, key: string) => {
    const y = 0.2; // Proper elevation above hex tiles
    
    switch (resource) {
      case 'fruit':
      case 'food':
        return <FruitModel key={`fruit-${key}`} position={position} />;
      case 'stone':
        return <StoneModel key={`stone-${key}`} position={position} />;
      case 'animal':
      case 'game':
        return <GameModel key={`game-${key}`} position={position} />;
      case 'metal':
        return <MetalModel key={`metal-${key}`} position={position} />;
      case 'gold':
        return <MetalModel key={`gold-${key}`} position={position} />;
      
      // World Elements - Book of Mormon themed resources
      case 'timber_grove':
        return <GameModel key={`timber-${key}`} position={position} />; // Use tree model
      case 'wild_goats':
        return <GameModel key={`goats-${key}`} position={position} />; // Use animal model
      case 'grain_patch':
        return <FruitModel key={`grain-${key}`} position={position} />; // Use fruit model for crops
      case 'fishing_shoal':
        return <FruitModel key={`fish-${key}`} position={position} />; // Temporary fish representation
      case 'sea_beast':
        return <GameModel key={`whale-${key}`} position={position} />; // Use large creature model
      case 'jaredite_ruins':
        return <StoneModel key={`ruins-${key}`} position={position} />; // Use stone model for ruins
      
      default:
        return null;
    }
  };

  // Function to render forest trees (Polytopia-style: ALL forests have trees)
  const renderForestTrees = (position: { x: number; y: number }, key: string) => {
    return <GameModel key={`forest-${key}`} position={position} />;
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
      
      {/* Render Forest Trees on ALL Forest Tiles (Polytopia-style) */}
      {gameState.map.tiles.filter(tile => {
        const tileKey = `${tile.coordinate.q},${tile.coordinate.r}`;
        const isVisible = visibleTiles.has(tileKey) || exploredTiles.has(tileKey);
        return isVisible && tile.terrain === 'forest';
      }).map(tile => {
        const position = hexToPixel(tile.coordinate, 1);
        const tileKey = `${tile.coordinate.q},${tile.coordinate.r}`;
        
        // Check if this tile has an improvement (don't render trees on improved tiles)
        const hasImprovement = visibleImprovements.some(imp => 
          imp.coordinate.q === tile.coordinate.q && imp.coordinate.r === tile.coordinate.r
        );
        
        if (hasImprovement) return null; // Don't render trees on improved tiles
        
        return renderForestTrees(position, tileKey);
      })}

      {/* Render Resources on Non-Forest Tiles */}
      {visibleTilesWithFeatures.map(tile => {
        if (tile.terrain === 'forest') return null; // Forest trees handled separately
        
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