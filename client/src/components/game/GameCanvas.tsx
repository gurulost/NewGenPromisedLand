import { useRef, useEffect, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { useGameState } from "../../lib/stores/useGameState";
import { getVisibleUnits } from "@shared/logic/unitLogic";
import { useUserPreferences } from "../../hooks/useUserPreferences";
import HexGridInstanced from "./HexGridInstanced";


import Unit from "./Unit";
import MapFeatures from "./MapFeatures";
import { useGameDebugger } from "../../utils/gameDebug";
import { hexToPixel } from "@shared/utils/hex";
import { gsap } from "gsap";
import * as THREE from "three";
import { AbilityTargetHighlights, UnitSelectionEffects, useUnitSelection } from "../effects/UnitSelection";
import { calculateReachableTiles } from "@shared/logic/unitLogic";
import MovementOverlay from "./MovementOverlay";
import { getReachableTiles } from "@shared/logic/pathfinding";

export default function GameCanvas() {
  const { gameState, dispatch } = useLocalGame();
  const { selectedUnit, hoveredTile, setSelectedUnit, isMovementMode, setMovementMode, reachableCoordinates, setReachableCoordinates, abilityTargetMode } = useGameState();
  const { camera } = useThree();
  const controlsRef = useRef<any>();
  const debug = useGameDebugger();
  const { preferences } = useUserPreferences();
  const activeAnimationsRef = useRef<gsap.core.Tween[]>([]);
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  
  // Enhanced selection and effects
  const {
    selectedCoordinate,
    hoveredCoordinate,
    validMoveCoordinates,
    validAttackCoordinates,
    selectUnit,
    clearSelection,
    hoverTile
  } = useUnitSelection();

  const abilityTargetCoordinates = abilityTargetMode?.isActive && gameState
    ? abilityTargetMode.eligibleUnitIds
        .map((unitId) => gameState.units.find((unit) => unit.id === unitId)?.coordinate)
        .filter((coordinate): coordinate is { q: number; r: number; s: number } => Boolean(coordinate))
    : [];
  const selectedAbilityTargetCoordinate = abilityTargetMode?.selectedUnitId && gameState
    ? gameState.units.find((unit) => unit.id === abilityTargetMode.selectedUnitId)?.coordinate || null
    : null;

  // Calculate reachable tiles when movement mode is activated
  useEffect(() => {
    if (isMovementMode && selectedUnit && gameState) {
      const reachable = getReachableTiles(
        selectedUnit.coordinate,
        selectedUnit.remainingMovement,
        (coord) => {
          const tile = gameState.map.tiles.find(t => 
            t.coordinate.q === coord.q && t.coordinate.r === coord.r
          );
          return Boolean(tile && tile.terrain !== 'water');
        }
      );
      setReachableCoordinates(reachable);
    } else {
      setReachableCoordinates([]);
    }
  }, [isMovementMode, selectedUnit, gameState, setReachableCoordinates]);
  
  // Combat effects moved to GameUI to avoid HTML in R3F

  // Kill all active GSAP animations
  const killActiveAnimations = () => {
    activeAnimationsRef.current.forEach(anim => anim.kill());
    activeAnimationsRef.current = [];
  };

  // Setup camera controls - Pure panning like RTS games
  useEffect(() => {
    if (controlsRef.current && gameState) {
      // Enable smooth damping for responsive feel - increased for stability
      controlsRef.current.enableDamping = true;
      controlsRef.current.dampingFactor = 0.25; // Increased from 0.1 for more stability
      
      // Disable rotation completely - only allow panning and zooming
      controlsRef.current.enableRotate = false;
      
      // Enable panning (click and drag to move)
      controlsRef.current.enablePan = true;
      controlsRef.current.panSpeed = preferences?.camera.cameraSpeed || 1.0;
      
      // Enable zooming with mouse wheel
      controlsRef.current.enableZoom = true;
      controlsRef.current.zoomSpeed = preferences?.camera.zoomSpeed || 1.0;
      
      // Set zoom limits based on map size - fix terrain disappearing
      const mapSize = Math.max(gameState.map.width || 10, gameState.map.height || 10);
      controlsRef.current.minDistance = 5; // Prevent getting too close to terrain
      controlsRef.current.maxDistance = mapSize * 4; // Prevent too far zoom
      
      // Fix camera clipping planes to prevent terrain disappearing
      camera.near = 0.5; // Increase near plane to prevent clipping
      camera.far = mapSize * 15; // Increase far plane for better coverage
      camera.updateProjectionMatrix();
      
      // Position camera near current player's starting area
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      const playerCity = gameState.cities?.find(city => 
        currentPlayer.citiesOwned.includes(city.id)
      );
      
      let cameraTargetPosition = { x: 0, z: 0 }; // Default to center
      
      if (playerCity) {
        // Convert hex coordinates to world position
        const pixelPos = hexToPixel(playerCity.coordinate, 1);
        cameraTargetPosition = { x: pixelPos.x, z: pixelPos.y };
      }
      
      // Position camera in fixed isometric view above the map
      const distance = mapSize * 1.2;
      camera.position.set(
        cameraTargetPosition.x, 
        distance, 
        cameraTargetPosition.z + distance * 0.7 // Slightly angled for isometric view
      );
      camera.lookAt(cameraTargetPosition.x, 0, cameraTargetPosition.z);
      
      // Set the orbit target to the player's starting area
      controlsRef.current.target.set(cameraTargetPosition.x, 0, cameraTargetPosition.z);
      
      // Add event listeners to detect user interaction
      const startHandler = () => {
        setIsUserInteracting(true);
        killActiveAnimations(); // Stop any ongoing animations
      };
      const endHandler = () => setIsUserInteracting(false);
      
      controlsRef.current.addEventListener('start', startHandler);
      controlsRef.current.addEventListener('end', endHandler);
      
      return () => {
        controlsRef.current?.removeEventListener('start', startHandler);
        controlsRef.current?.removeEventListener('end', endHandler);
      };
    }
  }, [camera, gameState]);

  // Smooth camera repositioning when players change turns (user configurable)
  useEffect(() => {
    // Don't animate if user is currently interacting with the camera
    if (isUserInteracting) return;
    
    if (controlsRef.current && gameState && preferences?.camera.autoFollowTurnChange && preferences.ui.showAnimations && !preferences.ui.reducedMotion) {
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      const playerCity = gameState.cities?.find(city => 
        currentPlayer.citiesOwned.includes(city.id)
      );
      
      if (playerCity) {
        // Kill any existing animations before starting new ones
        killActiveAnimations();
        
        // Convert hex coordinates to world position
        const pixelPos = hexToPixel(playerCity.coordinate, 1);
        const cameraTargetPosition = { x: pixelPos.x, z: pixelPos.y };
        
        // Smoothly move camera to focus on current player's area
        const mapSize = Math.max(gameState.map.width || 10, gameState.map.height || 10);
        const distance = mapSize * 1.2;
        
        // Use GSAP for smooth camera transition with user-configured speed
        const animationDuration = (2 - preferences.camera.cameraSpeed) * 0.8; // Faster = shorter duration
        
        const posAnim = gsap.to(camera.position, {
          x: cameraTargetPosition.x,
          y: distance,
          z: cameraTargetPosition.z + distance * 0.7,
          duration: animationDuration,
          ease: "power2.inOut",
        });
        
        const targetAnim = gsap.to(controlsRef.current.target, {
          x: cameraTargetPosition.x,
          y: 0,
          z: cameraTargetPosition.z,
          duration: animationDuration,
          ease: "power2.inOut",
        });
        
        // Store animations for cleanup
        activeAnimationsRef.current = [posAnim, targetAnim];

        debug.logRendering('Camera transition to new player', {
          playerId: currentPlayer.id,
          playerName: currentPlayer.name,
          cityCoordinate: playerCity.coordinate,
          animationDuration
        });
      }
    }
  }, [gameState?.currentPlayerIndex, camera, gameState, preferences, debug, isUserInteracting]);

  // Optional camera centering on unit selection (user configurable)
  useEffect(() => {
    // Don't animate if user is currently interacting with the camera
    if (isUserInteracting) return;
    
    if (selectedUnit && controlsRef.current && preferences?.camera.autoFollowUnitSelection && preferences.ui.showAnimations && !preferences.ui.reducedMotion) {
      // Kill any existing animations before starting new one
      killActiveAnimations();
      
      const pixelPos = hexToPixel(selectedUnit.coordinate, 1);
      const targetPosition = new THREE.Vector3(pixelPos.x, 0, pixelPos.y);

      // Use GSAP to animate the camera target with user-configured speed
      const animationDuration = (2 - preferences.camera.cameraSpeed) * 0.4; // Faster = shorter duration
      
      const targetAnim = gsap.to(controlsRef.current.target, {
        x: targetPosition.x,
        y: targetPosition.y,
        z: targetPosition.z,
        duration: animationDuration,
        ease: "power2.inOut",
      });
      
      // Store animation for cleanup
      activeAnimationsRef.current = [targetAnim];

      debug.logUIInteraction('Camera focused on selected unit', {
        unitId: selectedUnit.id,
        unitType: selectedUnit.type,
        coordinate: selectedUnit.coordinate,
        animationDuration
      });
    }
  }, [selectedUnit, preferences, debug, isUserInteracting]);

  // Cleanup animations on unmount
  useEffect(() => {
    return () => {
      killActiveAnimations();
    };
  }, []);

  useFrame(() => {
    if (controlsRef.current) {
      controlsRef.current.update();
    }
  });

  if (!gameState) {
    return null;
  }

  // Calculate map size for fog and lighting
  const mapSize = Math.max(gameState.map.width || 10, gameState.map.height || 10);

  return (
    <>
      <OrbitControls
        ref={controlsRef}
        target={[0, 0, 0]}
        enablePan={true}
        enableZoom={true}
        enableRotate={false}
        makeDefault
        mouseButtons={{
          LEFT: THREE.MOUSE.PAN,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN
        }}
        touches={{
          ONE: THREE.TOUCH.PAN,
          TWO: THREE.TOUCH.DOLLY_ROTATE
        }}
      />
      
      {/* Fog for atmosphere - adjusted for map size to prevent darkening on zoom */}
      <fog attach="fog" args={["#0f172a", mapSize * 3, mapSize * 12]} />
      
      {/* Grid - Using Instanced Rendering for Performance */}
      <HexGridInstanced map={gameState.map} />
      

      
      {/* Map Features - Cities, Ruins, and other structures */}
      <MapFeatures />
      
      {/* Units - using centralized vision system */}
      {(() => {
        const visibleUnits = getVisibleUnits(gameState);
        debug.logRendering(`GameCanvas rendering ${visibleUnits.length} visible units`, {
          totalUnits: gameState.units.length,
          visibleUnits: visibleUnits.length,
          unitIds: visibleUnits.map(u => u.id),
          currentPlayer: gameState.players[gameState.currentPlayerIndex]?.name
        });
        
        return visibleUnits.map((unit: any) => (
          <Unit
            key={unit.id}
            unit={unit}
            isSelected={selectedUnit?.id === unit.id}
            onUnitClick={(unit) => {
              setSelectedUnit(unit);
              // Only show selection, don't show movement tiles yet
              selectUnit(unit.coordinate, [], []);
            }}
          />
        ));
      })()}

      {abilityTargetCoordinates.length > 0 && (
        <AbilityTargetHighlights
          coordinates={abilityTargetCoordinates}
          selectedCoordinate={selectedAbilityTargetCoordinate}
        />
      )}

      {/* Enhanced Unit Selection Effects */}
      <UnitSelectionEffects
        selectedCoordinate={selectedCoordinate}
        hoveredCoordinate={hoveredCoordinate}
        validMoveCoordinates={validMoveCoordinates}
        validAttackCoordinates={validAttackCoordinates}
      />

      {/* Professional Movement Overlay */}
      {isMovementMode && selectedUnit && reachableCoordinates.length > 0 && (
        <MovementOverlay 
          reachableTiles={reachableCoordinates}
          selectedTile={hoveredTile ? { 
            q: Math.round(hoveredTile.tile.coordinate.q), 
            r: Math.round(hoveredTile.tile.coordinate.r),
            s: Math.round(hoveredTile.tile.coordinate.s || 0)
          } : null}
          onTileHover={(coord) => {
            // Handle tile hover for movement preview
          }}
          onTileClick={(coord) => {
            if (!selectedUnit || !gameState) return;
            dispatch({
              type: 'MOVE_UNIT',
              payload: {
                unitId: selectedUnit.id,
                targetCoordinate: coord
              }
            });

            setMovementMode(false);
            setReachableCoordinates([]);

            const latestState = useLocalGame.getState().gameState;
            const updatedUnit = latestState?.units.find(u => u.id === selectedUnit.id);

            if (updatedUnit) {
              setSelectedUnit(updatedUnit);
              selectUnit(updatedUnit.coordinate, [], []);
            } else {
              setSelectedUnit(null);
              clearSelection();
            }
          }}
        />
      )}

      {/* Combat Effects - Note: Moved to GameUI to avoid HTML in R3F */}
      
      {/* Selection indicator */}
      {hoveredTile && (
        <mesh
          position={[hoveredTile.x, 0.02, hoveredTile.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.8, 1.0, 6]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.5}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </>
  );
}
