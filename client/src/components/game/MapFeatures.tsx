import { useLocalGame } from "../../lib/stores/useLocalGame";
import { hexToPixel } from "@shared/utils/hex";
import { Box, Cylinder, Sphere, Cone, Torus } from "@react-three/drei";
import { useGameState } from "../../lib/stores/useGameState";
import { useMemo } from "react";
import { getVisibleTilesInRange } from "@shared/utils/lineOfSight";
import { getUnitDefinition } from "@shared/data/units";
import { IMPROVEMENT_DEFINITIONS, STRUCTURE_DEFINITIONS } from "@shared/types/city";
import Construction from "./Construction";
import { CityModel } from "./CityModel";

export default function MapFeatures() {
  const { gameState } = useLocalGame();
  const { selectedUnit } = useGameState();
  
  // Get current player for visibility calculations
  const currentPlayer = gameState?.players[gameState.currentPlayerIndex];
  
  // Memoize visible features to avoid recalculating on every render
  const { visibleCities, visibleTiles, exploredTiles, visibleImprovements, visibleStructures } = useMemo(() => {
    if (!gameState || !currentPlayer) return { 
      visibleCities: [], 
      visibleTiles: new Set(), 
      exploredTiles: new Set(),
      visibleImprovements: [],
      visibleStructures: []
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
    
    return { 
      visibleCities: cities, 
      visibleTiles: visible, 
      exploredTiles: explored,
      visibleImprovements: improvements,
      visibleStructures: structures
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
    const y = 0.05; // Slight elevation above ground
    
    switch (resource) {
      case 'food':
        return (
          <group key={`food-${key}`}>
            {/* Multiple small food items clustered together */}
            <Sphere position={[position.x - 0.2, y, position.y + 0.1]} args={[0.06]}>
              <meshStandardMaterial color="#90EE90" /> {/* Light green */}
            </Sphere>
            <Sphere position={[position.x - 0.3, y, position.y - 0.1]} args={[0.05]}>
              <meshStandardMaterial color="#32CD32" /> {/* Lime green */}
            </Sphere>
            <Sphere position={[position.x - 0.1, y, position.y]} args={[0.04]}>
              <meshStandardMaterial color="#228B22" /> {/* Forest green */}
            </Sphere>
          </group>
        );
      case 'wood':
        return (
          <group key={`wood-${key}`}>
            {/* Tree representation */}
            <Cylinder position={[position.x + 0.3, y + 0.1, position.y]} args={[0.04, 0.06, 0.2]} rotation={[0, 0, 0]}>
              <meshStandardMaterial color="#8B4513" /> {/* Brown trunk */}
            </Cylinder>
            <Sphere position={[position.x + 0.3, y + 0.25, position.y]} args={[0.15]}>
              <meshStandardMaterial color="#228B22" /> {/* Green foliage */}
            </Sphere>
            {/* Additional logs */}
            <Cylinder position={[position.x + 0.2, y, position.y + 0.15]} args={[0.03, 0.03, 0.12]} rotation={[0, 0, Math.PI/6]}>
              <meshStandardMaterial color="#A0522D" />
            </Cylinder>
          </group>
        );
      case 'stone':
        return (
          <group key={`stone-${key}`}>
            {/* Rock formation */}
            <Box position={[position.x, y + 0.05, position.y - 0.3]} args={[0.12, 0.15, 0.12]}>
              <meshStandardMaterial color="#696969" /> {/* Gray */}
            </Box>
            <Box position={[position.x + 0.1, y + 0.02, position.y - 0.2]} args={[0.08, 0.1, 0.08]}>
              <meshStandardMaterial color="#778899" /> {/* Light slate gray */}
            </Box>
            <Box position={[position.x - 0.1, y + 0.03, position.y - 0.35]} args={[0.06, 0.08, 0.06]}>
              <meshStandardMaterial color="#2F4F4F" /> {/* Dark slate gray */}
            </Box>
          </group>
        );
      case 'gold':
        return (
          <group key={`gold-${key}`}>
            {/* Gold deposits with sparkle effect */}
            <Sphere position={[position.x, y + 0.03, position.y + 0.3]} args={[0.06]}>
              <meshStandardMaterial color="#FFD700" metalness={0.8} roughness={0.2} /> {/* Shiny gold */}
            </Sphere>
            <Sphere position={[position.x + 0.08, y + 0.02, position.y + 0.25]} args={[0.04]}>
              <meshStandardMaterial color="#FFA500" metalness={0.7} roughness={0.3} />
            </Sphere>
            <Sphere position={[position.x - 0.06, y + 0.01, position.y + 0.35]} args={[0.03]}>
              <meshStandardMaterial color="#FFB347" metalness={0.6} roughness={0.4} />
            </Sphere>
          </group>
        );
      default:
        return null;
    }
  };

  // Function to render improvement models
  const renderImprovement = (improvement: any, position: { x: number; y: number }, key: string) => {
    const y = 0.1; // Elevated above ground
    
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
    const y = 0.2;
    
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
      
      {/* Render Resources on Tiles */}
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