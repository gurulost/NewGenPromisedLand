import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { useGameState } from "../../lib/stores/useGameState";
import { getVisibleUnits } from "@shared/logic/unitLogic";
import HexGridInstanced from "./HexGridInstanced";
import Unit from "./Unit";
import MapFeatures from "./MapFeatures";
import { useGameDebugger } from "../../utils/gameDebug";
import { hexToPixel } from "@shared/utils/hex";
import { gsap } from "gsap";
import * as THREE from "three";

export default function GameCanvas() {
  const { gameState } = useLocalGame();
  const { selectedUnit, hoveredTile } = useGameState();
  const { camera } = useThree();
  const controlsRef = useRef<any>();
  const debug = useGameDebugger();

  // Setup camera controls - Polytopia style
  useEffect(() => {
    if (controlsRef.current && gameState) {
      controlsRef.current.enableDamping = true;
      controlsRef.current.dampingFactor = 0.05;
      
      // Lock camera angle like Polytopia - fixed isometric view
      const isometricAngle = Math.PI / 4; // 45 degrees
      controlsRef.current.minPolarAngle = isometricAngle;
      controlsRef.current.maxPolarAngle = isometricAngle;
      
      // Adjust zoom limits based on map size - closer like Polytopia
      const mapSize = Math.max(gameState.map.width, gameState.map.height);
      controlsRef.current.minDistance = mapSize * 0.5; // Allow closer zoom
      controlsRef.current.maxDistance = mapSize * 2; // Prevent too far zoom
      
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
      
      // Position camera closer like Polytopia - focused on player's area
      const distance = mapSize * 1.2;
      camera.position.set(
        cameraTargetPosition.x, 
        distance, 
        cameraTargetPosition.z + distance
      );
      camera.lookAt(cameraTargetPosition.x, 0, cameraTargetPosition.z);
      
      // Set the orbit target to the player's starting area
      controlsRef.current.target.set(cameraTargetPosition.x, 0, cameraTargetPosition.z);
    }
  }, [camera, gameState]);

  // Reposition camera when player changes (at start of each turn)
  useEffect(() => {
    if (controlsRef.current && gameState) {
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      const playerCity = gameState.cities?.find(city => 
        currentPlayer.citiesOwned.includes(city.id)
      );
      
      if (playerCity) {
        // Convert hex coordinates to world position
        const pixelPos = hexToPixel(playerCity.coordinate, 1);
        const cameraTargetPosition = { x: pixelPos.x, z: pixelPos.y };
        
        // Smoothly move camera to focus on current player's area
        const mapSize = Math.max(gameState.map.width, gameState.map.height);
        const distance = mapSize * 1.2;
        
        // Use GSAP for smooth camera transition
        gsap.to(camera.position, {
          x: cameraTargetPosition.x,
          y: distance,
          z: cameraTargetPosition.z + distance,
          duration: 1,
          ease: "power2.inOut",
        });
        
        gsap.to(controlsRef.current.target, {
          x: cameraTargetPosition.x,
          y: 0,
          z: cameraTargetPosition.z,
          duration: 1,
          ease: "power2.inOut",
        });
      }
    }
  }, [gameState?.currentPlayerIndex, camera, gameState]);

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

  if (!gameState) {
    return null;
  }

  return (
    <>
      <OrbitControls
        ref={controlsRef}
        target={[0, 0, 0]}
        enablePan={true}
        enableZoom={true}
        enableRotate={false}
      />
      
      {/* Fog for atmosphere */}
      <fog attach="fog" args={["#0f172a", 15, 35]} />
      
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
          />
        ));
      })()}
      
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
