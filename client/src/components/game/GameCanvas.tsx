import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { useGameState } from "../../lib/stores/useGameState";
import { getVisibleUnits } from "@shared/logic/unitLogic";
import HexGridInstanced from "./HexGridInstanced";
import Unit from "./Unit";
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
      
      // Adjust zoom limits based on map size
      const mapSize = Math.max(gameState.map.width, gameState.map.height);
      controlsRef.current.minDistance = mapSize * 0.8;
      controlsRef.current.maxDistance = mapSize * 3;
      
      // Position camera to see the full hex grid
      const distance = mapSize * 2;
      camera.position.set(0, distance, distance);
      camera.lookAt(0, 0, 0);
      
      // Set the orbit target to the center of the map
      controlsRef.current.target.set(0, 0, 0);
    }
  }, [camera, gameState]);

  // Smooth camera centering when unit is selected (Polytopia-style)
  useEffect(() => {
    if (selectedUnit && controlsRef.current) {
      const pixelPos = hexToPixel(selectedUnit.coordinate, 1);
      const targetPosition = new THREE.Vector3(pixelPos.x, 0, pixelPos.y);

      // Use GSAP to animate the camera target
      gsap.to(controlsRef.current.target, {
        x: targetPosition.x,
        y: targetPosition.y,
        z: targetPosition.z,
        duration: 0.5,
        ease: "power2.inOut",
      });
    }
  }, [selectedUnit]);

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
