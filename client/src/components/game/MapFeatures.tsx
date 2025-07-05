import { useLocalGame } from "../../lib/stores/useLocalGame";
import { hexToPixel } from "@shared/utils/hex";
import { Box, Cylinder, Sphere, Cone } from "@react-three/drei";
import { useGameState } from "../../lib/stores/useGameState";
import { useMemo } from "react";
import { getVisibleTilesInRange } from "@shared/utils/lineOfSight";
import { getUnitDefinition } from "@shared/data/units";

export default function MapFeatures() {
  const { gameState } = useLocalGame();
  const { selectedUnit } = useGameState();
  
  // Get current player for visibility calculations
  const currentPlayer = gameState?.players[gameState.currentPlayerIndex];
  
  // Memoize visible features to avoid recalculating on every render
  const { visibleCities, visibleTiles, exploredTiles } = useMemo(() => {
    if (!gameState || !currentPlayer) return { visibleCities: [], visibleTiles: new Set(), exploredTiles: new Set() };
    
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
    
    return { visibleCities: cities, visibleTiles: visible, exploredTiles: explored };
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
  
  // Function to render resource models
  const renderResource = (resource: string, position: { x: number; y: number }, key: string) => {
    const y = 0.1; // Slight elevation above ground
    
    switch (resource) {
      case 'food':
        return (
          <Sphere key={`food-${key}`} position={[position.x - 0.3, y, position.y]} args={[0.1]}>
            <meshStandardMaterial color="#90EE90" /> {/* Light green */}
          </Sphere>
        );
      case 'wood':
        return (
          <Cylinder key={`wood-${key}`} position={[position.x + 0.3, y + 0.1, position.y]} args={[0.05, 0.05, 0.2]} rotation={[0, 0, 0]}>
            <meshStandardMaterial color="#8B4513" /> {/* Brown */}
          </Cylinder>
        );
      case 'stone':
        return (
          <Box key={`stone-${key}`} position={[position.x, y, position.y - 0.3]} args={[0.15, 0.15, 0.15]}>
            <meshStandardMaterial color="#696969" /> {/* Gray */}
          </Box>
        );
      case 'gold':
        return (
          <Sphere key={`gold-${key}`} position={[position.x, y, position.y + 0.3]} args={[0.08]}>
            <meshStandardMaterial color="#FFD700" /> {/* Gold */}
          </Sphere>
        );
      default:
        return null;
    }
  };
  
  return (
    <group>
      {/* Render Cities */}
      {visibleCities.map(city => {
        const position = hexToPixel(city.coordinate, 1);
        const isPlayerCity = city.ownerId === currentPlayer?.id;
        
        return (
          <group key={city.id}>
            {/* City base - a cylinder for the city foundation */}
            <Cylinder
              position={[position.x, 0.15, position.y]}
              args={[0.6, 0.8, 0.3, 8]} // radiusTop, radiusBottom, height, segments
            >
              <meshStandardMaterial 
                color={isPlayerCity ? "#FFD700" : "#8B4513"} // Gold for player cities, brown for others
              />
            </Cylinder>
            
            {/* City tower/building */}
            <Box
              position={[position.x, 0.5, position.y]}
              args={[0.5, 0.7, 0.5]} // width, height, depth
            >
              <meshStandardMaterial 
                color={isPlayerCity ? "#FFA500" : "#A0522D"} // Orange for player cities, darker brown for others
              />
            </Box>
            
            {/* City flag/marker on top */}
            <Box
              position={[position.x, 0.9, position.y]}
              args={[0.15, 0.3, 0.05]} // small flag
            >
              <meshStandardMaterial 
                color={isPlayerCity ? "#FF6347" : "#696969"} // Tomato red for player, gray for others
              />
            </Box>
          </group>
        );
      })}
      
      {/* Render Resources on Tiles */}
      {visibleTilesWithFeatures.map(tile => {
        const position = hexToPixel(tile.coordinate, 1);
        const tileKey = `${tile.coordinate.q},${tile.coordinate.r}`;
        
        return (
          <group key={`tile-features-${tileKey}`}>
            {tile.resources.map((resource, index) => 
              renderResource(resource, position, `${tileKey}-${index}`)
            )}
          </group>
        );
      })}
    </group>
  );
}