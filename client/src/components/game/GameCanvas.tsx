import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { useGameState } from "../../lib/stores/useGameState";
import HexGrid from "./HexGrid";
import Unit from "./Unit";
import * as THREE from "three";

export default function GameCanvas() {
  const { gameState } = useLocalGame();
  const { selectedUnit, hoveredTile } = useGameState();
  const { camera } = useThree();
  const controlsRef = useRef<any>();

  // Setup camera controls
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.enableDamping = true;
      controlsRef.current.dampingFactor = 0.05;
      controlsRef.current.maxPolarAngle = Math.PI / 3; // Limit vertical rotation
      controlsRef.current.minDistance = 5;
      controlsRef.current.maxDistance = 20;
    }
  }, []);

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
      
      {/* Grid */}
      <HexGrid map={gameState.map} />
      
      {/* Units */}
      {gameState.units.map((unit: any) => (
        <Unit
          key={unit.id}
          unit={unit}
          isSelected={selectedUnit?.id === unit.id}
        />
      ))}
      
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
