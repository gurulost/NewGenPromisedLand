import { useRef, useEffect, useMemo, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { useGameState } from "../../lib/stores/useGameState";
import { getVisibleUnits } from "@shared/logic/unitLogic";
import HexGridInstanced from "./HexGridInstanced";
import { getAttackableTargets } from "../../selectors/combat";

import Unit from "./Unit";
import MapFeatures from "./MapFeatures";
import { MapToastContainer } from "./MapToasts";
import { useGameDebugger } from "../../utils/gameDebug";
import { hexToPixel } from "@shared/utils/hex";
import { gsap } from "gsap";
import * as THREE from "three";
import { UnitSelectionEffects, useUnitSelection } from "../effects/UnitSelection";
import MovementOverlay from "./MovementOverlay";
import { ParticleEffectsContainer } from "../effects/ParticleEffects";
import { MapPulseEffects } from "../effects/MapPulseEffects";
import { usePerformanceMode, useShouldReduceEffects } from "../../hooks/usePerformanceMode";
import { useMobileUI } from "../../hooks/useMobileUI";
import { initModelPreloading } from "../../utils/modelManager";

export default function GameCanvas() {
  const { gameState, dispatch } = useLocalGame();
  const { selectedUnit, hoveredTile, setSelectedUnit, isMovementMode, setMovementMode, reachableCoordinates, setReachableCoordinates, isAttackMode, attackableTargets, setAttackableTargets, setAttackMode } = useGameState();
  const { camera } = useThree();
  const controlsRef = useRef<any>();
  const debug = useGameDebugger();
  const [ruinsSpotlight, setRuinsSpotlight] = useState<{ x: number; z: number } | null>(null);
  const spotlightRef = useRef<THREE.PointLight>(null);
  const spotlightTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const cinematicTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const preloadKeyRef = useRef<string | null>(null);
  const performanceMode = usePerformanceMode();
  const reduceEffects = useShouldReduceEffects();
  const { isMobileUI } = useMobileUI();

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

  const preloadSignature = useMemo(() => {
    if (!gameState) return null;
    const unitTypes = Array.from(new Set(gameState.units.map((unit) => unit.type))).sort();
    const improvementTypes = Array.from(
      new Set((gameState.improvements ?? []).map((improvement) => improvement.type))
    ).sort();
    const structureTypes = Array.from(
      new Set((gameState.structures ?? []).map((structure) => structure.type))
    ).sort();
    const cityLevels = Array.from(
      new Set((gameState.cities ?? []).map((city) => city.level))
    ).sort((a, b) => a - b);
    return [
      gameState.id ?? 'default',
      unitTypes.join(','),
      improvementTypes.join(','),
      structureTypes.join(','),
      cityLevels.join(','),
    ].join('|');
  }, [gameState]);

  useEffect(() => {
    if (!gameState || !preloadSignature) return;
    if (preloadKeyRef.current === preloadSignature) return;
    preloadKeyRef.current = preloadSignature;
    const mode = performanceMode === 'high' ? 'match' : 'none';
    return initModelPreloading({ mode, gameState, useIdle: true, deferMs: 400 });
  }, [gameState, performanceMode, preloadSignature]);

  // Calculate attackable targets when attack mode is activated
  useEffect(() => {
    if (isAttackMode && selectedUnit && gameState) {
      const targets = getAttackableTargets(selectedUnit, gameState);
      const targetCoordinates = targets.map(unit => ({
        q: unit.coordinate.q,
        r: unit.coordinate.r,
        s: unit.coordinate.s || 0
      }));
      setAttackableTargets(targetCoordinates);
    } else {
      setAttackableTargets([]);
    }
  }, [isAttackMode, selectedUnit, gameState, setAttackableTargets]);

  // Combat effects moved to GameUI to avoid HTML in R3F

  // Setup camera controls - Pure panning like RTS games
  useEffect(() => {
    if (controlsRef.current && gameState) {
      // Enable smooth damping for responsive feel
      controlsRef.current.enableDamping = true;
      controlsRef.current.dampingFactor = 0.1;

      // Disable rotation completely - only allow panning and zooming
      controlsRef.current.enableRotate = false;

      // Enable panning (click and drag to move)
      controlsRef.current.enablePan = true;
      controlsRef.current.panSpeed = 1.0;

      // Enable zooming with mouse wheel
      controlsRef.current.enableZoom = true;
      controlsRef.current.zoomSpeed = 1.0;

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
    }
  }, [camera, gameState]);

  // Disabled automatic camera repositioning when players change turns
  // Let players control camera position manually like in Polytopia
  // useEffect(() => {
  //   if (controlsRef.current && gameState) {
  //     const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  //     const playerCity = gameState.cities?.find(city => 
  //       currentPlayer.citiesOwned.includes(city.id)
  //     );
  //     
  //     if (playerCity) {
  //       // Convert hex coordinates to world position
  //       const pixelPos = hexToPixel(playerCity.coordinate, 1);
  //       const cameraTargetPosition = { x: pixelPos.x, z: pixelPos.y };
  //       
  //       // Smoothly move camera to focus on current player's area
  //       const mapSize = Math.max(gameState.map.width || 10, gameState.map.height || 10);
  //       const distance = mapSize * 1.2;
  //       
  //       // Use GSAP for smooth camera transition
  //       gsap.to(camera.position, {
  //         x: cameraTargetPosition.x,
  //         y: distance,
  //         z: cameraTargetPosition.z + distance,
  //         duration: 1,
  //         ease: "power2.inOut",
  //       });
  //       
  //       gsap.to(controlsRef.current.target, {
  //         x: cameraTargetPosition.x,
  //         y: 0,
  //         z: cameraTargetPosition.z,
  //         duration: 1,
  //         ease: "power2.inOut",
  //       });
  //     }
  //   }
  // }, [gameState?.currentPlayerIndex, camera, gameState]);

  // Disabled automatic camera centering on unit selection - let players control the view manually
  // In Polytopia, the camera stays where the player positioned it
  // useEffect(() => {
  //   if (selectedUnit && controlsRef.current) {
  //     const pixelPos = hexToPixel(selectedUnit.coordinate, 1);
  //     const targetPosition = new THREE.Vector3(pixelPos.x, 0, pixelPos.y);
  //
  //     // Use GSAP to animate the camera target
  //     gsap.to(controlsRef.current.target, {
  //       x: targetPosition.x,
  //       y: targetPosition.y,
  //       z: targetPosition.z,
  //       duration: 0.5,
  //       ease: "power2.inOut",
  //     });
  //   }
  // }, [selectedUnit]);

  useFrame(() => {
    if (controlsRef.current) {
      controlsRef.current.update();
    }
  });

  useEffect(() => {
    const handleRuinsCinematic = (event: CustomEvent) => {
      if (!controlsRef.current) return;

      const coordinate = event.detail?.coordinate;
      if (!coordinate) return;

      const focusMs = Number(event.detail?.focusMs ?? 280);
      const holdMs = Number(event.detail?.holdMs ?? 320);
      const returnMs = Number(event.detail?.returnMs ?? 320);

      const pixelPos = hexToPixel(coordinate, 1);
      const target = new THREE.Vector3(pixelPos.x, 0, pixelPos.y);

      const controls = controlsRef.current;
      const currentTarget = controls.target.clone();
      const currentPosition = camera.position.clone();
      const offset = new THREE.Vector3().subVectors(camera.position, controls.target);
      const focusPosition = new THREE.Vector3().addVectors(target, offset);

      cinematicTimelineRef.current?.kill();
      controls.enabled = false;

      const timeline = gsap.timeline({
        onComplete: () => {
          controls.enabled = true;
        }
      });

      timeline.to(controls.target, {
        x: target.x,
        y: 0,
        z: target.z,
        duration: focusMs / 1000,
        ease: "power2.out"
      }, 0);
      timeline.to(camera.position, {
        x: focusPosition.x,
        y: focusPosition.y,
        z: focusPosition.z,
        duration: focusMs / 1000,
        ease: "power2.out"
      }, 0);
      timeline.to({}, { duration: holdMs / 1000 });
      timeline.to(controls.target, {
        x: currentTarget.x,
        y: currentTarget.y,
        z: currentTarget.z,
        duration: returnMs / 1000,
        ease: "power2.inOut"
      });
      timeline.to(camera.position, {
        x: currentPosition.x,
        y: currentPosition.y,
        z: currentPosition.z,
        duration: returnMs / 1000,
        ease: "power2.inOut"
      }, "<");

      cinematicTimelineRef.current = timeline;

      setRuinsSpotlight({ x: target.x, z: target.z });
    };

    window.addEventListener('ruinsCinematic', handleRuinsCinematic as EventListener);

    return () => {
      window.removeEventListener('ruinsCinematic', handleRuinsCinematic as EventListener);
      cinematicTimelineRef.current?.kill();
      if (controlsRef.current) {
        controlsRef.current.enabled = true;
      }
    };
  }, [camera]);

  useEffect(() => {
    if (!ruinsSpotlight || !spotlightRef.current) return;

    const light = spotlightRef.current;
    light.intensity = 0;
    light.color.set('#f5e0a3');

    spotlightTimelineRef.current?.kill();
    const timeline = gsap.timeline({
      onComplete: () => setRuinsSpotlight(null)
    });

    timeline.to(light, { intensity: 2.2, duration: 0.2, ease: "power2.out" });
    timeline.to(light, { intensity: 0.0, duration: 0.45, ease: "power2.in" }, "+=0.35");

    spotlightTimelineRef.current = timeline;

    return () => {
      spotlightTimelineRef.current?.kill();
    };
  }, [ruinsSpotlight]);

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
        mouseButtons={{
          LEFT: THREE.MOUSE.PAN,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN
        }}
        touches={{
          ONE: THREE.TOUCH.PAN,
          TWO: THREE.TOUCH.DOLLY_PAN
        }}
      />

      {ruinsSpotlight && (
        <pointLight
          ref={spotlightRef}
          position={[ruinsSpotlight.x, 12, ruinsSpotlight.z]}
          intensity={2.0}
          distance={18}
          decay={2}
          color="#f5e0a3"
        />
      )}

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

      {/* Enhanced Unit Selection Effects */}
      <UnitSelectionEffects
        selectedCoordinate={selectedCoordinate}
        hoveredCoordinate={hoveredCoordinate}
        validMoveCoordinates={validMoveCoordinates}
        validAttackCoordinates={isAttackMode ? attackableTargets : validAttackCoordinates}
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
            // Handle tile hover for movement preview - coord available for future use
          }}
          onTileClick={(coord) => {
            // Execute unit movement
            if (selectedUnit && gameState) {
              dispatch({
                type: 'MOVE_UNIT',
                payload: {
                  unitId: selectedUnit.id,
                  targetCoordinate: coord
                }
              });
              setMovementMode(false);
              setReachableCoordinates([]);
            }
          }}
        />
      )}

      {/* Attack Range Overlay - Red tiles for valid attack targets */}
      {isAttackMode && selectedUnit && attackableTargets.length > 0 && (
        <group>
          {attackableTargets.map((coord, index) => {
            const pixelPos = hexToPixel(coord, 1);
            return (
              <group key={`attack-${index}`} position={[pixelPos.x, 0.05, pixelPos.y]}>
                {/* Red attack target ring */}
                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[0.7, 0.85, 6]} />
                  <meshBasicMaterial
                    color="#ef4444"
                    transparent
                    opacity={0.7}
                    side={THREE.DoubleSide}
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                  />
                </mesh>
                {/* Inner target indicator */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
                  <circleGeometry args={[0.3, 6]} />
                  <meshBasicMaterial
                    color="#dc2626"
                    transparent
                    opacity={0.5}
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                  />
                </mesh>
                {/* Crosshair indicator */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
                  <ringGeometry args={[0.1, 0.15, 8]} />
                  <meshBasicMaterial
                    color="#fca5a5"
                    transparent
                    opacity={0.8}
                    depthWrite={false}
                  />
                </mesh>
              </group>
            );
          })}
        </group>
      )}

      {/* Floating Map Toasts for rewards/combat feedback */}
      <MapToastContainer />

      {/* Particle Effects for captures and rewards */}
      {!(reduceEffects || isMobileUI) && <ParticleEffectsContainer />}

      {/* Map pulse rings for major events */}
      {!(reduceEffects || isMobileUI) && <MapPulseEffects />}

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
