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
      controlsRef.current.maxPolarAngle = Math.PI / 2.5; // Allow more vertical rotation
      controlsRef.current.minDistance = 3;
      controlsRef.current.maxDistance = 25;
      // Position camera to see the hex grid better
      camera.position.set(0, 12, 12);
      camera.lookAt(0, 0, 0);
    }
  }, [camera]);

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
      
      {/* Units - show own units always, enemy units only in current vision */}
      {gameState.units.filter((unit: any) => {
        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        
        // Show own units always
        if (unit.playerId === currentPlayer.id) {
          return true;
        }
        
        // Only show enemy units if they're in CURRENT vision range
        const playerUnits = gameState.units.filter((u: any) => u.playerId === currentPlayer.id);
        const isInCurrentVision = playerUnits.some((friendlyUnit: any) => {
          const distance = Math.max(
            Math.abs(unit.coordinate.q - friendlyUnit.coordinate.q),
            Math.abs(unit.coordinate.r - friendlyUnit.coordinate.r),
            Math.abs(unit.coordinate.s - friendlyUnit.coordinate.s)
          );
          
          return distance <= 2; // 2-tile vision radius
        });
        
        return isInCurrentVision;
      }).map((unit: any) => (
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
