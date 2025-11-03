import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { Unit } from '@shared/types/unit';
import { useLocalGame } from '../../lib/stores/useLocalGame';
import { getUnitModelPath, getUnitModelScale, getUnitMaterialEnhancements } from '../../utils/modelManager';
import { GroundedModel } from './GroundedModel';
import { GLTFErrorBoundary } from './GLTFErrorBoundary';

interface UnitModelProps {
  unit: Unit;
  position: { x: number; y: number };
  isPlayerUnit: boolean;
}

// Fallback component when model fails to load
function UnitFallback({ position, isPlayerUnit }: { position: { x: number; y: number }, isPlayerUnit: boolean }) {
  return (
    <group position={[position.x, 0, position.y]}>
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial 
          color={isPlayerUnit ? "#00AA00" : "#AA0000"}
          metalness={0.3}
          roughness={0.7}
        />
      </mesh>
    </group>
  );
}

// Main component wrapped with error handling
function UnitModelInner({ unit, position, isPlayerUnit }: UnitModelProps) {
  const { gameState } = useLocalGame();
  
  // Get the player's faction to determine which model variant to use
  const player = gameState?.players.find(p => p.id === unit.playerId);
  const playerFaction = player?.factionId;

  const modelPath = getUnitModelPath(unit.type, playerFaction);
  const gltf = useGLTF(modelPath);
  const scene = gltf?.scene;
  
  // Return fallback if scene failed to load
  if (!scene) {
    console.warn(`Unit model scene is null for path: ${modelPath}`);
    return <UnitFallback position={position} isPlayerUnit={isPlayerUnit} />;
  }
  
  // Use centralized scaling system from modelManager
  const unitScale = useMemo(() => {
    return getUnitModelScale(unit.type);
  }, [unit.type]);
  
  // Clone and modify the scene for materials and status effects
  const clonedScene = useMemo(() => {
    if (!scene) return null;
    const clone = scene.clone();
    
    // Get material enhancements from centralized system
    const enhancements = getUnitMaterialEnhancements(unit.type, playerFaction);
    
    // Adjust materials based on ownership, unit status, and faction
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.material) {
          // Clone material to avoid modifying the original
          const material = child.material.clone();
          
          // Apply centralized material enhancements
          if (material.color) {
            material.color.multiplyScalar(enhancements.colorMultiplier);
          }
          
          // Set metallic and roughness properties
          if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhysicalMaterial) {
            material.metalness = enhancements.metallic;
            material.roughness = enhancements.roughness;
          }
          
          // Adjust colors based on ownership
          if (isPlayerUnit) {
            // Player units get slightly brighter colors
            if (material.color) {
              material.color.multiplyScalar(1.1);
            }
            if (material.emissive) {
              material.emissive.setHex(0x002200); // Subtle green tint
              material.emissiveIntensity = enhancements.emissiveIntensity;
            }
          } else {
            // Enemy units get cooler colors
            if (material.color) {
              material.color.multiplyScalar(0.9);
            }
            if (material.emissive) {
              material.emissive.setHex(0x220000); // Subtle red tint
              material.emissiveIntensity = enhancements.emissiveIntensity;
            }
          }
          
          // Add status-based effects
          if (unit.status === 'stealthed') {
            material.transparent = true;
            material.opacity = 0.6;
          } else if (unit.status === 'siege_mode') {
            if (material.emissive) {
              material.emissive.setHex(0x442200); // Orange glow for siege mode
              material.emissiveIntensity = Math.max(enhancements.emissiveIntensity, 0.2);
            }
          } else if (unit.status === 'formation') {
            if (material.emissive) {
              material.emissive.setHex(0x000044); // Blue glow for formation
              material.emissiveIntensity = Math.max(enhancements.emissiveIntensity, 0.15);
            }
          }
          
          child.material = material;
        }
      }
    });
    
    return clone;
  }, [scene, isPlayerUnit, unit.status, unit.type, playerFaction]);
  
  // Apply auto-grounding to the cloned scene
  const groundedScene = useMemo(() => {
    if (!clonedScene) return null;
    const box = new THREE.Box3().setFromObject(clonedScene);
    const bottomShift = -box.min.y;
    clonedScene.position.set(0, bottomShift, 0);
    return clonedScene;
  }, [clonedScene]);
  
  if (!groundedScene) {
    return <UnitFallback position={position} isPlayerUnit={isPlayerUnit} />;
  }
  
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

// Export wrapped component with error boundary
export function UnitModel(props: UnitModelProps) {
  // Calculate the actual model path for key - ensures ErrorBoundary remounts on any path change
  const { gameState } = useLocalGame();
  const player = gameState?.players.find(p => p.id === props.unit.playerId);
  const playerFaction = player?.factionId;
  const modelPath = getUnitModelPath(props.unit.type, playerFaction);
  
  return (
    <GLTFErrorBoundary 
      key={modelPath}
      resetKey={modelPath}
      fallback={<UnitFallback position={props.position} isPlayerUnit={props.isPlayerUnit} />}
    >
      <UnitModelInner {...props} />
    </GLTFErrorBoundary>
  );
}

// Model preloading is now handled by the centralized modelManager.ts