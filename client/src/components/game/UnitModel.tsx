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
      
      {/* Unit status indicators */}
      {unit.status !== 'active' && (
        <mesh position={[0, 0.8, 0]}>
          <sphereGeometry args={[0.05]} />
          <meshBasicMaterial 
            color={
              unit.status === 'stealthed' ? "#9333EA" :
              unit.status === 'siege_mode' ? "#F59E0B" :
              unit.status === 'formation' ? "#3B82F6" :
              unit.status === 'rallied' ? "#10B981" :
              "#6B7280"
            }
            transparent 
            opacity={0.9} 
          />
        </mesh>
      )}
      
      {/* Health indicator for damaged units */}
      {unit.hp < unit.maxHp && (
        <group position={[0, 0.9, 0]}>
          {/* Health bar background */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.3, 0.05, 0.01]} />
            <meshBasicMaterial color="#FF0000" transparent opacity={0.7} />
          </mesh>
          {/* Health bar foreground */}
          <mesh position={[-0.15 + (0.15 * unit.hp / unit.maxHp), 0, 0.001]}>
            <boxGeometry args={[0.3 * (unit.hp / unit.maxHp), 0.05, 0.01]} />
            <meshBasicMaterial color="#00FF00" transparent opacity={0.9} />
          </mesh>
        </group>
      )}
      
      {/* Movement indicator for units that can still move */}
      {unit.remainingMovement > 0 && (
        <mesh position={[0, -0.04, 0]}>
          <cylinderGeometry args={[0.6, 0.6, 0.01, 16]} />
          <meshBasicMaterial 
            color={isPlayerUnit ? "#22C55E" : "#EF4444"} 
            transparent 
            opacity={0.3} 
          />
        </mesh>
      )}
    </group>
  );
}

// Model preloading is now handled by the centralized modelManager.ts