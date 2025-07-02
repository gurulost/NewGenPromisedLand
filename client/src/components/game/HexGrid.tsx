import { useMemo, useRef } from "react";
import { useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { GameMap, Tile } from "@shared/types/game";
import { hexToPixel } from "@shared/utils/hex";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { useGameState } from "../../lib/stores/useGameState";
import * as THREE from "three";

interface HexGridProps {
  map: GameMap;
}

const HEX_SIZE = 1;

export default function HexGrid({ map }: HexGridProps) {
  const { gameState } = useLocalGame();
  const { setHoveredTile, selectedUnit, reachableTiles } = useGameState();
  const groupRef = useRef<THREE.Group>(null);
  
  // Load textures for different terrain types
  const grassTexture = useTexture("/textures/grass.png");
  const sandTexture = useTexture("/textures/sand.jpg");
  const woodTexture = useTexture("/textures/wood.jpg");
  
  // Configure texture repeat for better visual
  grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping;
  grassTexture.repeat.set(1, 1);
  sandTexture.wrapS = sandTexture.wrapT = THREE.RepeatWrapping;
  sandTexture.repeat.set(1, 1);
  woodTexture.wrapS = woodTexture.wrapT = THREE.RepeatWrapping;
  woodTexture.repeat.set(1, 1);

  // Create hex geometry
  const hexGeometry = useMemo(() => {
    const geometry = new THREE.CylinderGeometry(HEX_SIZE, HEX_SIZE, 0.1, 6);
    geometry.rotateY(Math.PI / 6); // Rotate to align flat-top hexagons
    return geometry;
  }, []);

  // Get current player's visibility
  const currentPlayer = gameState?.players[gameState.currentPlayerIndex];
  const visibilityMask = currentPlayer?.visibilityMask || [];

  const getTerrainTexture = (terrain: string) => {
    switch (terrain) {
      case 'forest':
        return woodTexture;
      case 'desert':
        return sandTexture;
      case 'plains':
      default:
        return grassTexture;
    }
  };

  const getTerrainColor = (terrain: string) => {
    switch (terrain) {
      case 'water':
        return '#2563eb';
      case 'mountain':
        return '#6b7280';
      case 'forest':
        return '#16a34a';
      case 'desert':
        return '#f59e0b';
      case 'swamp':
        return '#4c1d95';
      case 'plains':
      default:
        return '#22c55e';
    }
  };

  const handleTileClick = (tile: Tile) => {
    const tileKey = `${tile.coordinate.q},${tile.coordinate.r}`;
    const isVisible = visibilityMask.includes(tileKey);
    const isReachable = reachableTiles.includes(tileKey);
    
    console.log('Tile clicked:', tileKey, 'Visible:', isVisible, 'Reachable:', isReachable, 'Selected unit:', selectedUnit?.id);
    
    if (selectedUnit && isReachable) {
      console.log('Attempting to move unit to tile:', tile.coordinate);
      // Try to move the selected unit to this tile (allows exploration into fog of war)
      const { moveUnit } = useLocalGame.getState();
      moveUnit(selectedUnit.id, tile.coordinate);
    } else if (isVisible) {
      const pixelPos = hexToPixel(tile.coordinate, HEX_SIZE);
      setHoveredTile({ x: pixelPos.x, z: pixelPos.z, tile });
    } else {
      console.log('Tile click ignored - not reachable or visible');
    }
  };

  const handleTileHover = (tile: Tile) => {
    const tileKey = `${tile.coordinate.q},${tile.coordinate.r}`;
    const isVisible = visibilityMask.includes(tileKey);
    
    if (isVisible) {
      const pixelPos = hexToPixel(tile.coordinate, HEX_SIZE);
      setHoveredTile({ x: pixelPos.x, z: pixelPos.z, tile });
    }
  };

  return (
    <group ref={groupRef}>
      {map.tiles.map((tile) => {
        const pixelPos = hexToPixel(tile.coordinate, HEX_SIZE);
        const tileKey = `${tile.coordinate.q},${tile.coordinate.r}`;
        const isVisible = visibilityMask.includes(tileKey);
        const isExplored = tile.exploredBy.includes(currentPlayer?.id || '');
        const isReachable = reachableTiles.includes(tileKey);
        
        // Calculate current vision status for strategic fog of war
        const playerUnits = gameState?.units.filter(unit => unit.playerId === currentPlayer?.id) || [];
        const isInCurrentVision = playerUnits.some(unit => {
          const distance = Math.max(
            Math.abs(tile.coordinate.q - unit.coordinate.q),
            Math.abs(tile.coordinate.r - unit.coordinate.r),
            Math.abs(tile.coordinate.s - unit.coordinate.s)
          );
          return distance <= 2; // 2-tile vision radius
        });
        
        // Three fog of war states:
        // 1. Unexplored: Completely dark
        // 2. Explored but not in current vision: Dimmed
        // 3. In current vision: Fully visible
        if (!isExplored && !isInCurrentVision) {
          return (
            <mesh
              key={tileKey}
              position={[pixelPos.x, 0, pixelPos.z]}
              geometry={hexGeometry}
              rotation={[0, 0, 0]}
            >
              <meshBasicMaterial color="#0a0a0a" transparent opacity={0.1} />
            </mesh>
          );
        }

        return (
          <mesh
            key={tileKey}
            position={[pixelPos.x, 0, pixelPos.z]}
            geometry={hexGeometry}
            rotation={[0, 0, 0]}
            onClick={() => handleTileClick(tile)}
            onPointerEnter={() => handleTileHover(tile)}
            onPointerLeave={() => setHoveredTile(null)}
          >
            {(() => {
              // Determine tile visibility state for material properties
              let opacity = 1.0;
              let darkening = 1.0;
              
              if (isInCurrentVision) {
                // Fully visible - normal appearance
                opacity = 1.0;
                darkening = 1.0;
              } else if (isExplored) {
                // Explored but not in current vision - dimmed but visible
                opacity = 0.8;
                darkening = 0.5;
              } else {
                // Should not reach here due to earlier return
                opacity = 0.3;
                darkening = 0.2;
              }
              
              const baseColor = getTerrainColor(tile.terrain);
              const darkenedColor = `rgb(${Math.floor(parseInt(baseColor.slice(1, 3), 16) * darkening)}, ${Math.floor(parseInt(baseColor.slice(3, 5), 16) * darkening)}, ${Math.floor(parseInt(baseColor.slice(5, 7), 16) * darkening)})`;
              
              return tile.terrain === 'water' || tile.terrain === 'mountain' ? (
                <meshLambertMaterial 
                  color={darkenedColor}
                  transparent={opacity < 1}
                  opacity={opacity}
                />
              ) : (
                <meshLambertMaterial 
                  map={getTerrainTexture(tile.terrain)}
                  color={darkenedColor}
                  transparent={opacity < 1}
                  opacity={opacity}
                />
              );
            })()}
            
            {/* Movement highlight overlay */}
            {isReachable && selectedUnit && (
              <mesh position={[0, 0.01, 0]} rotation={[0, 0, 0]}>
                <cylinderGeometry args={[HEX_SIZE * 0.9, HEX_SIZE * 0.9, 0.02, 6]} />
                <meshBasicMaterial 
                  color="#60a5fa" 
                  transparent 
                  opacity={0.4}
                />
              </mesh>
            )}
          </mesh>
        );
      })}
    </group>
  );
}
