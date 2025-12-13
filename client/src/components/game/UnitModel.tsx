import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { Unit } from '@shared/types/unit';
import { useLocalGame } from '../../lib/stores/useLocalGame';
import { getUnitModelPath } from '../../utils/modelManager';
import { GroundedModel } from './GroundedModel';

interface UnitModelProps {
  unit: Unit;
  position: { x: number; y: number };
  isPlayerUnit: boolean;
}

export function UnitModel({ unit, position, isPlayerUnit }: UnitModelProps) {
  const { gameState } = useLocalGame();

  // Get the player's faction to determine which model variant to use
  const player = gameState?.players.find(p => p.id === unit.playerId);
  const playerFaction = player?.factionId;

  const modelPath = getUnitModelPath(unit.type);
  const { scene } = useGLTF(modelPath);

  // Calculate unit scale based on type - increased for better visibility
  const unitScale = useMemo(() => {
    if (unit.type === 'worker') {
      return 0.55; // Increased for civilian units
    } else if (unit.type === 'scout' || unit.type === 'wilderness_hunter') {
      return 0.6; // Increased for ranged units
    } else if (unit.type === 'missionary' || unit.type === 'royal_envoy') {
      return 0.58; // Increased for religious units
    } else if (unit.type === 'stripling_warrior') {
      return 0.7; // Slightly larger for elite Nephite warriors
    }
    return 0.65; // Increased default scale for most units
  }, [unit.type]);

  // Clone and modify the scene for materials and status effects
  const clonedScene = useMemo(() => {
    const clone = scene.clone();

    // Adjust materials based on ownership and unit status
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.material) {
          // Clone material to avoid modifying the original
          const material = child.material.clone();

          // Adjust colors based on ownership
          if (isPlayerUnit) {
            // Player units get slightly brighter colors
            if (material.color) {
              material.color.multiplyScalar(1.1);
            }
            if (material.emissive) {
              material.emissive.setHex(0x002200); // Subtle green tint
            }
          } else {
            // Enemy units get cooler colors
            if (material.color) {
              material.color.multiplyScalar(0.9);
            }
            if (material.emissive) {
              material.emissive.setHex(0x220000); // Subtle red tint
            }
          }

          // Add status-based effects
          if (unit.status === 'stealthed') {
            material.transparent = true;
            material.opacity = 0.6;
          } else if (unit.status === 'siege_mode') {
            if (material.emissive) {
              material.emissive.setHex(0x442200); // Orange glow for siege mode
            }
          } else if (unit.status === 'formation') {
            if (material.emissive) {
              material.emissive.setHex(0x000044); // Blue glow for formation
            }
          }

          child.material = material;
        }
      }
    });

    return clone;
  }, [scene, isPlayerUnit, unit.status]);

  // Apply auto-grounding to the cloned scene
  const groundedScene = useMemo(() => {
    const box = new THREE.Box3().setFromObject(clonedScene);
    const bottomShift = -box.min.y;
    clonedScene.position.set(0, bottomShift, 0);
    return clonedScene;
  }, [clonedScene]);

  return (
    <group position={[position.x, 0, position.y]}>
      <primitive object={groundedScene} scale={[unitScale, unitScale, unitScale]} />





      {/* Movement indicator for units that can still move */}
      {unit.remainingMovement > 0 && (

        <group position={[0, -0.04, 0]}>
          {/* Main Disc Body - High contrast opacity */}
          <mesh>
            <cylinderGeometry args={[0.6, 0.6, 0.01, 32]} />
            <meshBasicMaterial
              color={isPlayerUnit ? "#06B6D4" : "#EF4444"}
              transparent
              opacity={0.5}
            />
          </mesh>

          {/* Bright Outer Rim for Definition */}
          <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.55, 0.6, 32]} />
            <meshBasicMaterial
              color={isPlayerUnit ? "#67E8F9" : "#FCA5A5"}
              transparent
              opacity={0.9}
            />
          </mesh>
        </group>
      )}

    </group>
  );
}

// Model preloading is now handled by the centralized modelManager.ts
