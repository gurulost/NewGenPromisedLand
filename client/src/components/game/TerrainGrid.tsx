import React, { useMemo } from 'react';
import { GameMap } from '@shared/types/game';
import { hexToPixel } from '@shared/utils/hex';
import { useLocalGame } from '../../lib/stores/useLocalGame';
import TerrainTile from './TerrainTile';

interface TerrainGridProps {
  map: GameMap;
}

const HEX_SIZE = 1;

// Terrain colors for fog of war and tinting
const TERRAIN_COLORS = {
  plains: [0.4, 0.7, 0.3] as [number, number, number],
  forest: [0.2, 0.5, 0.2] as [number, number, number],
  mountain: [0.5, 0.5, 0.6] as [number, number, number],
  hill: [0.6, 0.5, 0.3] as [number, number, number],
  water: [0.2, 0.4, 0.8] as [number, number, number],
  desert: [0.8, 0.7, 0.4] as [number, number, number],
  swamp: [0.3, 0.4, 0.2] as [number, number, number],
};

export default function TerrainGrid({ map }: TerrainGridProps) {
  const { gameState } = useLocalGame();
  
  // Get current player for fog of war
  const currentPlayer = gameState?.players?.[gameState.currentPlayerIndex];
  
  // Calculate fog of war states for all tiles
  const tileStates = useMemo(() => {
    if (!currentPlayer) return [];
    
    return map.tiles.map(tile => {
      const tileKey = `${tile.coordinate.q},${tile.coordinate.r}`;
      const pixelPos = hexToPixel(tile.coordinate, HEX_SIZE);
      
      // Check visibility states
      const isCurrentlyVisible = gameState.visibility?.[currentPlayer.id]?.has(tileKey) || false;
      const hasBeenExplored = tile.exploredBy?.includes(currentPlayer.id) || false;
      
      // Check for special features
      const cityOnTile = gameState.cities?.find(city =>
        city.coordinate.q === tile.coordinate.q && city.coordinate.r === tile.coordinate.r
      );
      
      // Determine color and opacity based on fog of war state
      let color = TERRAIN_COLORS[tile.terrain] || TERRAIN_COLORS.plains;
      let opacity = 1.0;
      
      // Apply special coloring for cities
      if (cityOnTile && (isCurrentlyVisible || hasBeenExplored)) {
        color = [0.9, 0.8, 0.2]; // Golden for cities
      }
      // Enhance resource tiles
      else if (tile.resources.length > 0 && (isCurrentlyVisible || hasBeenExplored)) {
        color = [
          Math.min(1.0, color[0] * 1.2),
          Math.min(1.0, color[1] * 1.2),
          Math.min(1.0, color[2] * 1.2)
        ];
      }
      
      // Apply fog of war effects
      if (isCurrentlyVisible) {
        // Full visibility
        opacity = 1.0;
      } else if (hasBeenExplored) {
        // Explored but not currently visible - dimmed
        color = [color[0] * 0.6, color[1] * 0.6, color[2] * 0.6];
        opacity = 0.7;
      } else {
        // Unexplored - very dark
        color = [0.05, 0.05, 0.1];
        opacity = 1.0;
      }
      
      return {
        tile,
        position: [pixelPos.x, 0.05, pixelPos.y] as [number, number, number], // Slightly elevated above hex grid
        color,
        opacity,
        isVisible: isCurrentlyVisible,
        isExplored: hasBeenExplored
      };
    });
  }, [map.tiles, currentPlayer?.id, gameState?.visibility, gameState?.cities]);
  
  return (
    <group>
      {tileStates.map(({ tile, position, color, opacity, isVisible, isExplored }) => {
        // Only render 3D overlays for visible/explored tiles
        if (!isVisible && !isExplored) return null;
        
        return (
          <TerrainTile
            key={`${tile.coordinate.q},${tile.coordinate.r}`}
            terrain={tile.terrain}
            position={position}
            color={color}
            opacity={tile.terrain === 'water' ? Math.min(opacity, 0.7) : Math.min(opacity, 0.9)}
          />
        );
      })}
    </group>
  );
}