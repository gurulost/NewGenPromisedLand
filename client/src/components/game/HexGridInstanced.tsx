import { useRef, useMemo, useEffect } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { TextureLoader } from "three";
import * as THREE from "three";
import { Tile, GameMap } from "@shared/types/game";
import { hexToPixel, pixelToHex } from "@shared/utils/hex";
import { getUnitDefinition } from "@shared/data/units";
import { getVisibleTilesInRange, calculateFogOfWarState } from "@shared/utils/lineOfSight";
import { calculateReachableTiles } from "@shared/logic/unitLogic";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { useGameState } from "../../lib/stores/useGameState";
import { IMPROVEMENT_DEFINITIONS, STRUCTURE_DEFINITIONS } from "@shared/types/city";
import { createCloudShader } from './cloudShader';

interface HexGridInstancedProps {
  map: GameMap;
}

const HEX_SIZE = 1;

// Helper functions for construction validation
function getValidConstructionTiles(gameState: any, buildingType: string, category: string, cityId: string) {
  const validTiles: string[] = [];
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  
  // Get city for reference
  const city = gameState.cities?.find((c: any) => c.id === cityId);
  if (!city) return validTiles;
  
  // For each visible tile, check if it's valid for construction
  gameState.map.tiles.forEach((tile: any) => {
    if (isValidConstructionTile(gameState, tile.coordinate, buildingType, category, cityId)) {
      validTiles.push(`${tile.coordinate.q},${tile.coordinate.r}`);
    }
  });
  
  return validTiles;
}

function isValidConstructionTile(gameState: any, coordinate: any, buildingType: string, category: string, cityId: string): boolean {
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const city = gameState.cities?.find((c: any) => c.id === cityId);
  
  if (!city || !currentPlayer) return false;
  
  // Check if tile is explored/visible to current player
  const tileKey = `${coordinate.q},${coordinate.r}`;
  if (!currentPlayer.exploredTiles?.includes(tileKey)) return false;
  
  // Find the tile
  const tile = gameState.map.tiles.find((t: any) => 
    t.coordinate.q === coordinate.q && t.coordinate.r === coordinate.r
  );
  if (!tile) return false;
  
  // Check if tile already has something built on it
  const hasUnit = gameState.units?.some((u: any) => 
    u.coordinate.q === coordinate.q && u.coordinate.r === coordinate.r
  );
  const hasImprovement = gameState.improvements?.some((i: any) => 
    i.coordinate.q === coordinate.q && i.coordinate.r === coordinate.r
  );
  const hasStructure = gameState.structures?.some((s: any) => 
    s.coordinate.q === coordinate.q && s.coordinate.r === coordinate.r
  );
  
  if (category === 'units') {
    // Units can be placed on:
    if (buildingType === 'boat') {
      // Boats need water tiles or adjacent to city
      return tile.terrain === 'water' || 
             (tile.coordinate.q === city.coordinate.q && tile.coordinate.r === city.coordinate.r);
    } else {
      // Other units need land tiles without obstacles
      return tile.terrain !== 'water' && !hasUnit && !hasImprovement && !hasStructure;
    }
  } else if (category === 'improvements') {
    // Improvements have terrain requirements
    if (buildingType === 'forest_camp') {
      return tile.terrain === 'forest' && !hasImprovement && !hasStructure;
    } else if (buildingType === 'mine') {
      return tile.terrain === 'mountain' && !hasImprovement && !hasStructure;
    } else if (buildingType === 'farm') {
      return tile.terrain === 'plains' && !hasImprovement && !hasStructure;
    }
    // Default: any land tile without obstacles
    return tile.terrain !== 'water' && !hasImprovement && !hasStructure;
  } else if (category === 'structures') {
    // Structures can be built on most land tiles
    return tile.terrain !== 'water' && !hasImprovement && !hasStructure;
  }
  
  return false;
}

export default function HexGridInstanced({ map }: HexGridInstancedProps) {
  const { gameState, moveUnit } = useLocalGame();
  const { setHoveredTile, selectedUnit, reachableTiles, setSelectedUnit, setReachableTiles, constructionMode, cancelConstruction, isMovementMode, setMovementMode } = useGameState();
  const { camera, raycaster, gl } = useThree();
  
  // Calculate valid construction tiles when in construction mode
  const validConstructionTiles = useMemo(() => {
    if (!constructionMode.isActive || !gameState) return [];
    
    return getValidConstructionTiles(
      gameState,
      constructionMode.buildingType!,
      constructionMode.buildingCategory!,
      constructionMode.cityId!
    );
  }, [constructionMode, gameState]);
  
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  
  // Load textures
  const plainsTexture = useLoader(TextureLoader, "/textures/mesoamerican_plains.png");
  const forestTexture = useLoader(TextureLoader, "/textures/mesoamerican_forest.png");
  const mountainTexture = useLoader(TextureLoader, "/textures/mesoamerican_mountain.png");
  const waterTexture = useLoader(TextureLoader, "/textures/mesoamerican_water_new.png");
  const desertTexture = useLoader(TextureLoader, "/textures/mesoamerican_desert.png");
  const swampTexture = useLoader(TextureLoader, "/textures/mesoamerican_swamp.png");
  const grassTexture = useLoader(TextureLoader, "/textures/grass.png");
  const sandTexture = useLoader(TextureLoader, "/textures/sand.jpg");
  const woodTexture = useLoader(TextureLoader, "/textures/wood.jpg");

  // Get current player and memoized visibility calculations
  const currentPlayer = gameState?.players[gameState.currentPlayerIndex];

  // Memoized fog of war calculation with line-of-sight - massive CPU performance boost
  const { visibleTileKeys, exploredTileKeys, tileInstanceData } = useMemo(() => {
    const visible = new Set<string>();
    const explored = new Set<string>();
    const instanceData: Array<{
      position: [number, number, number];
      color: [number, number, number];
      opacity: number;
      textureId: number;
    }> = [];
    
    if (!gameState || !currentPlayer) {
      // Show all tiles clearly when no game state (for debugging)
      map.tiles.forEach((tile, index) => {
        const pixelPos = hexToPixel(tile.coordinate, HEX_SIZE);
        const baseColor: [number, number, number] = [1.0, 1.0, 1.0]; // Pure white for texture clarity
        instanceData.push({
          position: [pixelPos.x, 0.1, pixelPos.y], // y becomes z in 3D space, slightly above ground
          color: baseColor,
          opacity: 1.0, // Fully visible for debugging
          textureId: getTextureId(tile.terrain)
        });
        // Add all tiles as visible for debugging
        visible.add(`${tile.coordinate.q},${tile.coordinate.r}`);
        explored.add(`${tile.coordinate.q},${tile.coordinate.r}`);
      });
      return { visibleTileKeys: visible, exploredTileKeys: explored, tileInstanceData: instanceData };
    }

    // Calculate currently visible tiles using line-of-sight
    const playerUnits = gameState.units.filter(unit => unit.playerId === currentPlayer.id);
    playerUnits.forEach(unit => {
      // Use unit's actual vision radius from definition
      const unitDef = getUnitDefinition(unit.type);
      const visionRadius = unitDef.baseStats.visionRadius;
      
      // Get visible tiles with line-of-sight calculations
      const unitVisibleTiles = getVisibleTilesInRange(
        unit.coordinate,
        visionRadius,
        map,
        true // Enable shadow casting for performance
      );
      
      // Add all visible tiles to the set
      unitVisibleTiles.forEach(tileKey => visible.add(tileKey));
    });

    // Calculate explored tiles
    map.tiles.forEach(tile => {
      if (tile.exploredBy.includes(currentPlayer.id)) {
        explored.add(`${tile.coordinate.q},${tile.coordinate.r}`);
      }
    });

    // Generate instance data for all tiles with improved fog of war
    map.tiles.forEach((tile, index) => {
      const pixelPos = hexToPixel(tile.coordinate, HEX_SIZE);
      const tileKey = `${tile.coordinate.q},${tile.coordinate.r}`;
      
      // Calculate fog of war state
      const fogState = calculateFogOfWarState(tileKey, visible, explored);
      
      let color: [number, number, number];
      let opacity: number;
      let textureId: number;
      
      // Apply three-tiered fog of war system
      let baseColor: [number, number, number] = [1.0, 1.0, 1.0]; // Default to white (no color tinting)
      
      // Check if tile is currently visible (use same calculation as MapFeatures)
      const isCurrentlyVisible = visible.has(tileKey);
      
      // Check if tile has been explored before (use same calculation as MapFeatures)
      const hasBeenExplored = explored.has(tileKey);
      
      // Check for cities on this tile first
      const cityOnTile = gameState.cities?.find(city =>
        city.coordinate.q === tile.coordinate.q && city.coordinate.r === tile.coordinate.r
      );
      
      // Check for construction mode highlighting first
      const isValidConstructionTile = validConstructionTiles.includes(tileKey);
      
      if (isValidConstructionTile && (isCurrentlyVisible || hasBeenExplored)) {
        // Valid construction tiles are highlighted in bright green
        baseColor = [0.2, 1.0, 0.3]; // Bright green for valid construction
      }
      // Check for cities on this tile and override color if found
      else if (cityOnTile && (isCurrentlyVisible || hasBeenExplored)) {
        // Cities are golden/yellow color
        baseColor = [0.9, 0.8, 0.2]; // Bright gold for cities
      }
      // For all other tiles, use pure white to let textures show clearly
      else {
        baseColor = [1.0, 1.0, 1.0]; // Pure white - no color tinting
      }
      
      
      if (isCurrentlyVisible) {
        // Visible: Full visibility of terrain and units
        color = baseColor;
        opacity = 1.0;
        textureId = getTextureId(tile.terrain);
      } else if (hasBeenExplored) {
        // Explored: Terrain visible but slightly dimmed (memory state)
        color = baseColor; // Keep pure white for texture clarity
        opacity = 0.85; // Increased from 0.7 to 0.85 for better visibility
        textureId = getTextureId(tile.terrain);
      } else {
        // Unexplored: Use textureId = 0 to trigger cloud shader
        color = [1.0, 1.0, 1.0]; // White base (shader will handle cloud colors)
        opacity = 1.0; // Full opacity for proper rendering
        textureId = 0; // No terrain texture visible (textureId < 0.5 triggers clouds)
      }
      
      instanceData.push({
        position: [pixelPos.x, 0.0, pixelPos.y], // y becomes z in 3D space, at ground level
        color,
        opacity,
        textureId
      });
    });

    return { visibleTileKeys: visible, exploredTileKeys: explored, tileInstanceData: instanceData };
  }, [gameState?.units, currentPlayer?.id, map.tiles]);

  // Create hex geometry once
  const hexGeometry = useMemo(() => {
    const geometry = new THREE.CylinderGeometry(HEX_SIZE, HEX_SIZE, 0.1, 6);
    // CylinderGeometry already lies flat in XZ-plane by default
    // Only rotate to align flat-top to north
    geometry.rotateY(Math.PI / 6); // Align flat-top to north
    return geometry;
  }, []);

  // Advanced cloud shader material using modular cloud shader
  const shaderMaterial = useMemo(() => createCloudShader({
    plainsTexture: { value: plainsTexture },
    forestTexture: { value: forestTexture },
    mountainTexture: { value: mountainTexture },
    waterTexture: { value: waterTexture },
    desertTexture: { value: desertTexture },
    swampTexture: { value: swampTexture },
    grassTexture: { value: grassTexture },
    sandTexture: { value: sandTexture },
    woodTexture: { value: woodTexture }
  }), [plainsTexture, forestTexture, mountainTexture, waterTexture, desertTexture, swampTexture, grassTexture, sandTexture, woodTexture]);

  // Animate the cloud fog of war
  useFrame(({ clock }) => {
    if (shaderMaterial) {
      shaderMaterial.uniforms.time.value = clock.elapsedTime;
    }
  });

  // Update instance attributes when tile data changes
  useEffect(() => {
    if (!meshRef.current || tileInstanceData.length === 0) return;

    const mesh = meshRef.current;
    const count = tileInstanceData.length;
    
    // Set up instance attributes
    const colors = new Float32Array(count * 3);
    const opacities = new Float32Array(count);
    const textureIds = new Float32Array(count);
    
    tileInstanceData.forEach((data, i) => {
      // Position (handled by instanceMatrix)
      const matrix = new THREE.Matrix4();
      matrix.setPosition(data.position[0], data.position[1], data.position[2]);
      mesh.setMatrixAt(i, matrix);
      
      // Color
      colors[i * 3] = data.color[0];
      colors[i * 3 + 1] = data.color[1];
      colors[i * 3 + 2] = data.color[2];
      
      // Opacity and texture
      opacities[i] = data.opacity;
      textureIds[i] = data.textureId;
    });
    
    mesh.geometry.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(colors, 3));
    mesh.geometry.setAttribute('instanceOpacity', new THREE.InstancedBufferAttribute(opacities, 1));
    mesh.geometry.setAttribute('instanceTextureId', new THREE.InstancedBufferAttribute(textureIds, 1));
    
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = count;
    
    // Force bounds computation to prevent culling issues
    mesh.computeBoundingSphere();
    mesh.computeBoundingBox();
    
  }, [tileInstanceData]);

  // Handle interactions with proper raycasting for instanced rendering
  const handleClick = (event: any) => {
    if (!meshRef.current) return;
    
    // Get mouse position in normalized device coordinates
    const mouse = new THREE.Vector2();
    const rect = gl.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // Update raycaster with camera and mouse position
    raycaster.setFromCamera(mouse, camera);
    
    // Check for intersections with the instanced mesh
    const intersects = raycaster.intersectObject(meshRef.current);
    
    if (intersects.length > 0) {
      const intersection = intersects[0];
      // instanceId tells us which tile was clicked
      const instanceId = intersection.instanceId;
      
      if (instanceId !== undefined && instanceId < map.tiles.length) {
        const clickedTile = map.tiles[instanceId];
        console.log('Tile clicked:', clickedTile.coordinate);
        
        // Check if there's a unit on this tile
        const unitOnTile = gameState?.units.find(unit => 
          unit.coordinate.q === clickedTile.coordinate.q &&
          unit.coordinate.r === clickedTile.coordinate.r
        );
        
        const currentPlayer = gameState?.players[gameState.currentPlayerIndex];
        
        // Handle construction mode - tile selection for building
        if (constructionMode.isActive && currentPlayer) {
          console.log('Construction mode: selecting tile for', constructionMode.buildingType);
          
          // Validate if this tile is valid for construction
          const isValidTile = isValidConstructionTile(
            gameState,
            clickedTile.coordinate,
            constructionMode.buildingType!,
            constructionMode.buildingCategory!,
            constructionMode.cityId!
          );
          
          if (!isValidTile) {
            console.log('Invalid construction tile selected');
            return;
          }
          
          // Show confirmation dialog before spending resources
          const buildingName = constructionMode.buildingType;
          const category = constructionMode.buildingCategory;
          
          // Get cost for confirmation
          let cost = { stars: 0, faith: 0, pride: 0 };
          if (category === 'units') {
            const unitDef = getUnitDefinition(buildingName as any);
            if (unitDef) {
              cost.stars = unitDef.cost; // Units have direct cost number
              cost.faith = unitDef.requirements?.faith || 0;
              cost.pride = unitDef.requirements?.pride || 0;
            }
          } else if (category === 'improvements') {
            const improvementDef = IMPROVEMENT_DEFINITIONS[buildingName as keyof typeof IMPROVEMENT_DEFINITIONS];
            if (improvementDef) {
              cost.stars = improvementDef.cost;
            }
          } else if (category === 'structures') {
            const structureDef = STRUCTURE_DEFINITIONS[buildingName as keyof typeof STRUCTURE_DEFINITIONS];
            if (structureDef) {
              cost.stars = structureDef.cost;
            }
          }
          
          const confirmed = window.confirm(
            `Build ${buildingName} for ${cost.stars} stars` +
            (cost.faith > 0 ? `, ${cost.faith} faith` : '') +
            (cost.pride > 0 ? `, ${cost.pride} pride` : '') +
            '?'
          );
          
          if (!confirmed) {
            return;
          }
          
          // Dispatch construction action
          if (gameState && constructionMode.buildingType && constructionMode.cityId) {
            const { dispatch } = useLocalGame.getState();
            
            dispatch({
              type: 'START_CONSTRUCTION',
              payload: {
                playerId: currentPlayer.id,
                buildingType: constructionMode.buildingType,
                category: constructionMode.buildingCategory!,
                coordinate: clickedTile.coordinate,
                cityId: constructionMode.cityId,
              },
            });
            
            // Exit construction mode
            cancelConstruction();
          }
          
          return; // Exit early, don't handle unit clicks in construction mode
        }
        
        if (unitOnTile && currentPlayer) {
          // If clicking on a unit
          if (unitOnTile.playerId === currentPlayer.id) {
            // Select own unit (but don't show movement tiles yet)
            console.log('Unit clicked:', unitOnTile.id, 'Current player:', currentPlayer.id, 'Unit player:', unitOnTile.playerId);
            setSelectedUnit(unitOnTile);
            // Exit any previous modes
            setMovementMode(false);
          } else if (selectedUnit && selectedUnit.playerId === currentPlayer.id) {
            // Attack enemy unit if we have a unit selected
            // This would need attack logic implementation
            console.log('Attack target clicked:', unitOnTile.id);
          }
        } else if (selectedUnit && selectedUnit.playerId === currentPlayer?.id && isMovementMode) {
          // Move selected unit to empty tile only if in movement mode
          const tileKey = `${clickedTile.coordinate.q},${clickedTile.coordinate.r}`;
          
          if (reachableTiles.includes(tileKey)) {
            console.log('Moving unit to:', clickedTile.coordinate);
            moveUnit(selectedUnit.id, clickedTile.coordinate);
            // Exit movement mode after moving
            setMovementMode(false);
          } else {
            console.log('Tile not reachable');
          }
        } else if (!unitOnTile) {
          // Clicked on empty tile - exit movement mode and deselect
          console.log('Clicked on empty tile - exiting movement mode');
          setMovementMode(false);
          if (!isMovementMode) {
            setSelectedUnit(null);
          }
        }
      }
    }
  };

  const handlePointerMove = (event: any) => {
    if (!meshRef.current) return;
    
    // Get mouse position in normalized device coordinates
    const mouse = new THREE.Vector2();
    const rect = gl.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // Update raycaster with camera and mouse position
    raycaster.setFromCamera(mouse, camera);
    
    // Check for intersections with the instanced mesh
    const intersects = raycaster.intersectObject(meshRef.current);
    
    if (intersects.length > 0) {
      const intersection = intersects[0];
      const instanceId = intersection.instanceId;
      
      if (instanceId !== undefined && instanceId < map.tiles.length) {
        const hoveredTile = map.tiles[instanceId];
        const pixelPos = hexToPixel(hoveredTile.coordinate, HEX_SIZE);
        setHoveredTile({
          x: pixelPos.x,
          z: pixelPos.y, // y becomes z in 3D space
          tile: hoveredTile
        });
      }
    } else {
      setHoveredTile(null);
    }
  };

  return (
    <group>
      <instancedMesh 
        ref={meshRef}
        args={[hexGeometry, shaderMaterial, map.tiles.length]}
        onClick={handleClick}
        onPointerMove={handlePointerMove}
        frustumCulled={false}
        renderOrder={0}
      />
    </group>
  );
}

// Helper functions
function getTerrainColor(terrain: string): [number, number, number] {
  switch (terrain) {
    case 'water': return [0.15, 0.39, 0.93]; // #2563eb
    case 'mountain': return [0.42, 0.45, 0.50]; // #6b7280
    case 'forest': return [0.09, 0.64, 0.29]; // #16a34a
    case 'desert': return [0.96, 0.62, 0.04]; // #f59e0b
    case 'swamp': return [0.30, 0.11, 0.58]; // #4c1d95
    case 'plains':
    default: return [0.13, 0.77, 0.37]; // #22c55e
  }
}

function getTextureId(terrain: string): number {
  switch (terrain) {
    case 'plains': return 1; // mesoamerican plains texture
    case 'forest': return 2; // mesoamerican forest texture
    case 'mountain': return 3; // mesoamerican mountain texture
    case 'water': return 4; // mesoamerican water texture
    case 'desert': return 5; // mesoamerican desert texture
    case 'swamp': return 6; // mesoamerican swamp texture
    default: return 0; // no texture
  }
}

