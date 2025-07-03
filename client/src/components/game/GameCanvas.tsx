import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { useGameState } from "../../lib/stores/useGameState";
import { getVisibleUnits } from "@shared/logic/unitLogic";
import HexGridInstanced from "./HexGridInstanced";
import Unit from "./Unit";
import * as THREE from "three";

export default function GameCanvas() {
  const { gameState } = useLocalGame();
  const { selectedUnit, hoveredTile } = useGameState();
  const { camera } = useThree();
  const controlsRef = useRef<any>();

  // Setup camera controls
  useEffect(() => {
    if (controlsRef.current && gameState) {
      controlsRef.current.enableDamping = true;
      controlsRef.current.dampingFactor = 0.05;
      controlsRef.current.maxPolarAngle = Math.PI / 2.5; // Allow more vertical rotation
      controlsRef.current.minDistance = 5;
      controlsRef.current.maxDistance = 40;
      
      // Calculate map bounds to center camera properly
      const mapSize = Math.max(gameState.map.width, gameState.map.height);
      const distance = mapSize * 2; // Scale camera distance with map size
      
      // Position camera to see the full hex grid
      camera.position.set(0, distance, distance);
      camera.lookAt(0, 0, 0);
      
      // Set the orbit target to the center of the map
      controlsRef.current.target.set(0, 0, 0);
    }
  }, [camera, gameState]);

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
        enableRotate={true}
      />
      
      {/* Fog for atmosphere */}
      <fog attach="fog" args={["#0f172a", 15, 35]} />
      
      {/* Grid - Using Instanced Rendering for Performance */}
      <HexGridInstanced map={gameState.map} />
      
      {/* Units - using centralized vision system */}
      {(() => {
        const visibleUnits = getVisibleUnits(gameState);
        console.log('Visible units in GameCanvas:', visibleUnits.length, visibleUnits.map(u => u.id));
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
