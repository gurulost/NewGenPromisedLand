import { useRef, useMemo, useEffect } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { TextureLoader } from "three";
import * as THREE from "three";
import { Tile, GameMap } from "@shared/types/game";
import type { HexCoordinate } from "@shared/types/coordinates";
import { hexDistance, hexToPixel, pixelToHex } from "@shared/utils/hex";
import { getUnitDefinition } from "@shared/data/units";
import { WORLD_ELEMENTS } from "@shared/data/worldElements";
import { getVisibleTilesInRange, calculateFogOfWarState } from "@shared/utils/lineOfSight";
import { calculateReachableTiles } from "@shared/logic/unitLogic";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { useGameState, TileContextMenuOption } from "../../lib/stores/useGameState";
import { getWorldElementRequirementSummary } from "../../utils/worldElementRequirements";
import { IMPROVEMENT_DEFINITIONS, STRUCTURE_DEFINITIONS } from "@shared/types/city";
import { getFriendlyBuildAnchors, isTileExploredByPlayer, isWithinFriendlyBuildRadius } from "@shared/logic/constructionRules";
import { createCloudShader } from './cloudShader';

interface HexGridInstancedProps {
  map: GameMap;
}

const HEX_SIZE = 1;

// Helper functions for construction validation
function getValidConstructionTiles(gameState: any, buildingType: string, category: string, cityId: string) {
  const validTiles: string[] = [];
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  if (!currentPlayer) return validTiles;
  const anchorCoords = getFriendlyBuildAnchors(gameState, currentPlayer.id);

  // Get city for reference
  const city = gameState.cities?.find((c: any) => c.id === cityId);
  if (!city) return validTiles;

  // For each visible tile, check if it's valid for construction
  gameState.map.tiles.forEach((tile: any) => {
    if (isValidConstructionTile(gameState, tile.coordinate, buildingType, category, cityId, anchorCoords)) {
      validTiles.push(`${tile.coordinate.q},${tile.coordinate.r}`);
    }
  });

  return validTiles;
}

function isValidConstructionTile(
  gameState: any,
  coordinate: any,
  buildingType: string,
  category: string,
  cityId: string,
  anchorCoords?: HexCoordinate[]
): boolean {
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const city = gameState.cities?.find((c: any) => c.id === cityId);

  if (!city || !currentPlayer) return false;

  // Tech gating for constructions
  if (category === 'units') {
    const unitDef = getUnitDefinition(buildingType as any);
    if (unitDef?.requiredTechnology && !currentPlayer.researchedTechs?.includes(unitDef.requiredTechnology)) {
      return false;
    }
  } else if (category === 'improvements') {
    const improvementDef = IMPROVEMENT_DEFINITIONS[buildingType as keyof typeof IMPROVEMENT_DEFINITIONS];
    if (improvementDef?.requiredTech && !currentPlayer.researchedTechs?.includes(improvementDef.requiredTech)) {
      return false;
    }
  } else if (category === 'structures') {
    const structureDef = STRUCTURE_DEFINITIONS[buildingType as keyof typeof STRUCTURE_DEFINITIONS];
    if (structureDef?.requiredTech && !currentPlayer.researchedTechs?.includes(structureDef.requiredTech)) {
      return false;
    }
  }

  // Check if tile is explored to current player
  if (!isTileExploredByPlayer(gameState, currentPlayer.id, coordinate)) return false;

  const buildAnchors = anchorCoords ?? getFriendlyBuildAnchors(gameState, currentPlayer.id);
  const requiresAnchor = category === 'structures' || category === 'improvements';
  if (requiresAnchor && !isWithinFriendlyBuildRadius(buildAnchors, coordinate)) return false;

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
  const hasStructureOnTile = gameState.structures?.some((s: any) =>
    s.coordinate &&
    s.coordinate.q === coordinate.q &&
    s.coordinate.r === coordinate.r
  );
  const hasQueuedConstruction = gameState.players?.some((p: any) =>
    (p.constructionQueue || []).some((item: any) =>
      item.coordinate &&
      item.coordinate.q === coordinate.q &&
      item.coordinate.r === coordinate.r
    )
  );
  const hasCity = gameState.cities?.some((c: any) =>
    c.coordinate.q === coordinate.q && c.coordinate.r === coordinate.r
  );

  if (category === 'units') {
    // Units can be placed on:
    if (buildingType === 'boat') {
      // Boats need adjacent water tiles or city on water
      const isCityTile = tile.coordinate.q === city.coordinate.q && tile.coordinate.r === city.coordinate.r;
      if (isCityTile && tile.terrain === 'water') return true;
      return tile.terrain === 'water' && hexDistance(tile.coordinate, city.coordinate) === 1 && !hasUnit;
    }

    // Other units need land tiles within spawn radius
    return tile.terrain !== 'water' &&
      hexDistance(tile.coordinate, city.coordinate) <= 2 &&
      !hasUnit &&
      !hasQueuedConstruction;
  } else if (category === 'improvements') {
    const improvementDef = IMPROVEMENT_DEFINITIONS[buildingType as keyof typeof IMPROVEMENT_DEFINITIONS];
    if (!improvementDef) return false;

    return improvementDef.validTerrain.includes(tile.terrain) &&
      !hasImprovement &&
      !hasStructureOnTile &&
      !hasQueuedConstruction &&
      !hasCity &&
      !hasUnit &&
      tile.feature !== 'village';
  } else if (category === 'structures') {
    // Structures can be built on most land tiles
    const hasStructureInCity = gameState.structures?.some((s: any) =>
      s.cityId === cityId && s.type === buildingType
    );
    return tile.terrain !== 'water' &&
      !hasImprovement &&
      !hasStructureOnTile &&
      !hasQueuedConstruction &&
      !hasCity &&
      !hasUnit &&
      tile.feature !== 'village' &&
      !hasStructureInCity;
  }

  return false;
}

export default function HexGridInstanced({ map }: HexGridInstancedProps) {
  const { gameState, moveUnit, attackUnit, onlineSession } = useLocalGame();
  const { setHoveredTile, selectedUnit, reachableTiles, setSelectedUnit, setReachableTiles, constructionMode, cancelConstruction, spawnSelectionMode, cancelSpawnSelection, isMovementMode, setMovementMode, isAttackMode, setAttackMode, attackableTargets, isRoadBuildMode, roadBuildUnitId, cancelRoadBuild, openTileContextMenu, closeTileContextMenu } = useGameState();
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

  // Long-press detection for touch tile preview
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressCoordRef = useRef<{ x: number; y: number } | null>(null);
  const LONG_PRESS_DURATION = 400; // ms
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

    if (!gameState || !viewPlayer) {
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
    const playerUnits = gameState.units.filter(unit => unit.playerId === viewPlayer.id);
    playerUnits.forEach(unit => {
      // Use unit's actual vision radius from definition
      const unitDef = getUnitDefinition(unit.type);
      const visionRadius = unit.visionRadius ?? unitDef.baseStats.visionRadius;

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
      if (tile.exploredBy.includes(viewPlayer.id)) {
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
      
      // Check for spawn selection mode highlighting
      const isValidSpawnTile = spawnSelectionMode.isActive && spawnSelectionMode.validSpawnTiles.some(
        coord => coord.q === tile.coordinate.q && coord.r === tile.coordinate.r
      );

      if (isValidSpawnTile && (isCurrentlyVisible || hasBeenExplored)) {
        // Valid spawn tiles are highlighted in cyan/teal for unit placement
        baseColor = [0.2, 0.9, 0.9]; // Bright cyan for spawn selection
      } else if (isValidConstructionTile && (isCurrentlyVisible || hasBeenExplored)) {
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
  }, [
    gameState,
    viewPlayer,
    map,
    validConstructionTiles,
    spawnSelectionMode.isActive,
    spawnSelectionMode.validSpawnTiles,
  ]);

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
    plainsTexture,
    forestTexture,
    mountainTexture,
    waterTexture,
    desertTexture,
    swampTexture,
    grassTexture,
    sandTexture,
    woodTexture
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

    const mesh = meshRef.current as any;
    if (typeof mesh.setMatrixAt !== 'function' || !mesh.geometry || !mesh.instanceMatrix) return;
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

        const currentPlayer = activePlayer;
        const tileKey = `${clickedTile.coordinate.q},${clickedTile.coordinate.r}`;
        const worldElementIds = (clickedTile.resources || []).filter(resource => WORLD_ELEMENTS[resource]);
        const primaryWorldElementId = worldElementIds[0];
        const hasWorldElement = worldElementIds.length > 0;
        const isVillage = clickedTile.feature === 'village';
        const isNeutralVillage = isVillage && !clickedTile.cityOwner;
        const isRuinFeature = clickedTile.feature === 'ruin';
        const cityOnTile = gameState?.cities?.find(c =>
          c.coordinate.q === clickedTile.coordinate.q &&
          c.coordinate.r === clickedTile.coordinate.r
        );
        const isOwnedCity = !!(currentPlayer && cityOnTile && cityOnTile.ownerId === currentPlayer.id);

        // Check if there's a visible unit on this tile
        const unitOnTile = gameState?.units.find(unit => {
          if (
            unit.coordinate.q !== clickedTile.coordinate.q ||
            unit.coordinate.r !== clickedTile.coordinate.r
          ) {
            return false;
          }

          if (!viewPlayer) return true;
          if (unit.playerId === viewPlayer.id) return true;
          return visibleTileKeys.has(tileKey);
        });

        if (viewPlayer && !viewPlayer.exploredTiles?.includes(tileKey)) {
          closeTileContextMenu();
          return;
        }

        // Handle spawn selection mode - tile selection for unit spawning
        if (spawnSelectionMode.isActive && currentPlayer) {
          console.log('Spawn selection mode: selecting tile for', spawnSelectionMode.unitType);
          
          // Check if this tile is a valid spawn tile
          const isValidSpawnTile = spawnSelectionMode.validSpawnTiles.some(
            coord => coord.q === clickedTile.coordinate.q && coord.r === clickedTile.coordinate.r
          );
          
          if (isValidSpawnTile) {
            console.log('Valid spawn tile selected:', clickedTile.coordinate);
            // Call the callback with the selected coordinate
            if (spawnSelectionMode.onSelectTile) {
              spawnSelectionMode.onSelectTile(clickedTile.coordinate);
            }
            cancelSpawnSelection();
          } else {
            console.log('Invalid spawn tile - cancelling selection');
            cancelSpawnSelection();
          }
          return;
        }

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
          let costStars = 0;
          let requirementNote = '';
          if (category === 'units') {
            const unitDef = getUnitDefinition(buildingName as any);
            if (unitDef) {
              costStars = unitDef.cost; // Units have direct cost number
              const req: string[] = [];
              if (unitDef.requirements?.faith) req.push(`Faith ${unitDef.requirements.faith}+`);
              if (unitDef.requirements?.pride) req.push(`Pride ${unitDef.requirements.pride}+`);
              if (unitDef.requirements?.dissent) req.push(`Dissent ${unitDef.requirements.dissent}+`);
              if (req.length > 0) requirementNote = ` (requires ${req.join(', ')})`;
            }
          } else if (category === 'improvements') {
            const improvementDef = IMPROVEMENT_DEFINITIONS[buildingName as keyof typeof IMPROVEMENT_DEFINITIONS];
            if (improvementDef) {
              costStars = improvementDef.cost;
            }
          } else if (category === 'structures') {
            const structureDef = STRUCTURE_DEFINITIONS[buildingName as keyof typeof STRUCTURE_DEFINITIONS];
            if (structureDef) {
              costStars = structureDef.cost;
            }
          }

          const confirmed = window.confirm(
            `Build ${buildingName} for ${costStars} stars${requirementNote}?`
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

        // Handle road building mode (worker places a road on a clicked tile)
        if (isRoadBuildMode && currentPlayer) {
          closeTileContextMenu();
          const builder = gameState?.units.find(u => u.id === roadBuildUnitId && u.playerId === currentPlayer.id);
          if (!builder) {
            cancelRoadBuild();
            return;
          }

          const isValidDistance = hexDistance(builder.coordinate, clickedTile.coordinate) <= 1;
          const isValidTerrain = clickedTile.terrain !== 'water' && clickedTile.terrain !== 'mountain';

          if (!isValidDistance || !isValidTerrain) {
            console.log('Invalid road tile selected');
            return;
          }

          const { dispatch } = useLocalGame.getState();
          dispatch({
            type: 'BUILD_ROAD',
            payload: { unitId: builder.id, targetCoordinate: clickedTile.coordinate, playerId: currentPlayer.id },
          });

          cancelRoadBuild();
          return;
        }

        if (unitOnTile && currentPlayer) {
          // If clicking on a unit
          if (unitOnTile.playerId === currentPlayer.id) {
            const menuOptions: TileContextMenuOption[] = [];
            const unitDef = getUnitDefinition(unitOnTile.type);
            const unitName = unitDef?.name || unitOnTile.type;

            menuOptions.push({
              id: 'select-unit',
              label: `Select ${unitName}`,
              icon: '⚔️',
              action: () => {
                setSelectedUnit(unitOnTile);
                setMovementMode(false);
                setAttackMode(false);
              }
            });

            if (hasWorldElement && primaryWorldElementId) {
              const resourceName = primaryWorldElementId.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
              const requirementSummary = getWorldElementRequirementSummary(primaryWorldElementId);
              menuOptions.push({
                id: 'interact-element',
                label: `Interact with ${resourceName}`,
                icon: '🏛️',
                subLabel: requirementSummary ? `Requires: ${requirementSummary}` : undefined,
                action: () => {
                  const worldElementEvent = new CustomEvent('worldElementClick', {
                    detail: {
                      coordinate: clickedTile.coordinate,
                      resources: worldElementIds,
                      terrain: clickedTile.terrain
                    }
                  });
                  window.dispatchEvent(worldElementEvent);
                }
              });
            }

            if (isNeutralVillage) {
              menuOptions.push({
                id: 'interact-village',
                label: 'Interact with Village',
                icon: '🏘️',
                subLabel: 'Conquer or Convert',
                action: () => {
                  const villageEvent = new CustomEvent('villageEncounter', {
                    detail: {
                      unitId: unitOnTile.id,
                      coordinate: clickedTile.coordinate
                    }
                  });
                  window.dispatchEvent(villageEvent);
                }
              });
            }

            if (isRuinFeature) {
              menuOptions.push({
                id: 'explore-ruins',
                label: 'Explore Ruins',
                icon: '🏛️',
                subLabel: 'Ancient ruins reward',
                action: () => {
                  const { dispatch } = useLocalGame.getState();
                  dispatch({
                    type: 'EXPLORE_RUINS',
                    payload: {
                      unitId: unitOnTile.id,
                      playerId: currentPlayer.id,
                      coordinate: clickedTile.coordinate
                    }
                  });
                }
              });
            }

            if (isOwnedCity) {
              menuOptions.push({
                id: 'open-city',
                label: 'Open City',
                icon: '🏙️',
                action: () => {
                  const cityEvent = new CustomEvent('openCityPanel', {
                    detail: { cityId: cityOnTile?.id }
                  });
                  window.dispatchEvent(cityEvent);
                }
              });
            }

            if (menuOptions.length > 1) {
              console.log('Tile has unit plus interactables - showing context menu');
              event.stopPropagation();
              openTileContextMenu(
                { x: event.clientX, y: event.clientY },
                clickedTile.coordinate,
                menuOptions
              );
              return;
            }

            // Select own unit (but don't show movement tiles yet)
            console.log('Unit clicked:', unitOnTile.id, 'Current player:', currentPlayer.id, 'Unit player:', unitOnTile.playerId);
            closeTileContextMenu();
            setSelectedUnit(unitOnTile);
            // Exit any previous modes
            setMovementMode(false);
            setAttackMode(false);
          } else {
            // Clicking on enemy/neutral unit
            if (hasWorldElement && primaryWorldElementId && !isAttackMode) {
              // Enemy unit on tile with resources - show context menu to interact with resource
              const resourceName = primaryWorldElementId.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
              const requirementSummary = primaryWorldElementId ? getWorldElementRequirementSummary(primaryWorldElementId) : null;
              const menuOptions: TileContextMenuOption[] = [
                {
                  id: 'interact-element',
                  label: `Interact with ${resourceName}`,
                  icon: '🏛️',
                  subLabel: requirementSummary ? `Requires: ${requirementSummary}` : undefined,
                  action: () => {
                    const worldElementEvent = new CustomEvent('worldElementClick', {
                      detail: {
                        coordinate: clickedTile.coordinate,
                        resources: worldElementIds,
                        terrain: clickedTile.terrain
                      }
                    });
                    window.dispatchEvent(worldElementEvent);
                  }
                }
              ];

              console.log('Enemy unit on tile with resources - showing context menu');
              event.stopPropagation();
              openTileContextMenu(
                { x: event.clientX, y: event.clientY },
                clickedTile.coordinate,
                menuOptions
              );
              return;
            }

            if (selectedUnit && selectedUnit.playerId === currentPlayer.id && isAttackMode) {
              // Check if target is in attackable range
              const isValidTarget = attackableTargets.some(
                target => target.q === unitOnTile.coordinate.q && target.r === unitOnTile.coordinate.r
              );

              if (isValidTarget) {
                console.log('Attacking target:', unitOnTile.id);
                closeTileContextMenu();
                attackUnit(selectedUnit.id, unitOnTile.id);
                setAttackMode(false);
              } else {
                console.log('Target not in range');
                closeTileContextMenu();
              }
            } else if (!isAttackMode) {
              console.log('Attack target clicked (not in attack mode):', unitOnTile.id);
              closeTileContextMenu();
            }
          }
        } else if (selectedUnit && selectedUnit.playerId === currentPlayer?.id && isMovementMode) {
          // Move selected unit to empty tile only if in movement mode
          const tileKey = `${clickedTile.coordinate.q},${clickedTile.coordinate.r}`;

          if (reachableTiles.includes(tileKey)) {
            console.log('Moving unit to:', clickedTile.coordinate);
            closeTileContextMenu();
            moveUnit(selectedUnit.id, clickedTile.coordinate);
            // Exit movement mode after moving
            setMovementMode(false);
          } else {
            console.log('Tile not reachable');
            closeTileContextMenu();
          }
        } else if (!unitOnTile) {
          // Check for world elements on this tile first
          if (hasWorldElement) {
            console.log('🎯 Tile clicked with resources:', clickedTile.resources, 'at coordinate:', clickedTile.coordinate);
            console.log('🔍 Tile terrain:', clickedTile.terrain, 'Tile details:', clickedTile);

            closeTileContextMenu();
            // Dispatch custom event for world element interaction
            const worldElementEvent = new CustomEvent('worldElementClick', {
              detail: {
                coordinate: clickedTile.coordinate,
                resources: worldElementIds,
                terrain: clickedTile.terrain
              }
            });

            console.log('📡 Dispatching worldElementClick event:', worldElementEvent.detail);
            window.dispatchEvent(worldElementEvent);
            return; // Don't deselect unit if clicking on world element
          } else {
            console.log('🔍 Clicked tile has no resources:', clickedTile);
          }

          // Clicked on empty tile - exit movement mode and deselect
          console.log('Clicked on empty tile - exiting movement mode');
          closeTileContextMenu();
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

    // Cancel long-press if finger moves too far (user is dragging/panning)
    if (event.pointerType === 'touch' && longPressCoordRef.current) {
      const dx = event.clientX - longPressCoordRef.current.x;
      const dy = event.clientY - longPressCoordRef.current.y;
      const moveThreshold = 10; // pixels
      if (Math.abs(dx) > moveThreshold || Math.abs(dy) > moveThreshold) {
        // User is dragging, cancel long-press
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        longPressCoordRef.current = null;
      }
    }

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
        const currentPlayer = viewPlayer;
        const tileKey = `${hoveredTile.coordinate.q},${hoveredTile.coordinate.r}`;
        if (currentPlayer && !currentPlayer.exploredTiles?.includes(tileKey)) {
          setHoveredTile(null);
          return;
        }
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

  // Long-press handler for touch devices - shows tile preview
  const handlePointerDown = (event: any) => {
    // Only track touch events for long-press
    if (event.pointerType !== 'touch') return;

    longPressCoordRef.current = { x: event.clientX, y: event.clientY };

    // Start long-press timer
    longPressTimerRef.current = setTimeout(() => {
      if (!meshRef.current) return;

      // Calculate which tile is under the touch point
      const mouse = new THREE.Vector2();
      const rect = gl.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(meshRef.current);

      if (intersects.length > 0) {
        const instanceId = intersects[0].instanceId;
        if (instanceId !== undefined && instanceId < map.tiles.length) {
          const hoveredTile = map.tiles[instanceId];
          const currentPlayer = viewPlayer;
          const tileKey = `${hoveredTile.coordinate.q},${hoveredTile.coordinate.r}`;

          // Only show preview for explored tiles
          if (!currentPlayer || currentPlayer.exploredTiles?.includes(tileKey)) {
            const pixelPos = hexToPixel(hoveredTile.coordinate, HEX_SIZE);
            setHoveredTile({
              x: pixelPos.x,
              z: pixelPos.y,
              tile: hoveredTile
            });
          }
        }
      }
    }, LONG_PRESS_DURATION);
  };

  const handlePointerUp = () => {
    // Clear long-press timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressCoordRef.current = null;
  };

  const handlePointerCancel = () => {
    handlePointerUp();
  };

  return (
    <group>
      <instancedMesh
        ref={meshRef}
        args={[hexGeometry, shaderMaterial, map.tiles.length]}
        onClick={handleClick}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
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
