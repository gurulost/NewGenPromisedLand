import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { Unit } from '@shared/types/unit';
import { useLocalGame } from '../../lib/stores/useLocalGame';

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
  
  // Determine which upgraded 3D model to load based on unit type
  // All factions now use the same high-quality models consistently
  const getModelPath = (unitType: string) => {
    switch (unitType) {
      case 'warrior':
      case 'spearman':
      case 'commander':
      case 'stripling_warrior':
        return '/attached_assets/0-2_1751822119779.glb'; // High-quality warrior model
      case 'worker':
      case 'settler':
        return '/attached_assets/Worker_1751829936748.glb'; // Latest worker model
      case 'scout':
      case 'archer':
      case 'wilderness_hunter':
        return '/attached_assets/Fun Scout_1751831308185.glb'; // High-quality scout model
      case 'missionary':
      case 'royal_envoy':
        return '/attached_assets/Fun Scout_1751831308185.glb'; // Use scout model for missionaries temporarily
      case 'boat':
        return '/attached_assets/0-2_1751822119779.glb'; // Use warrior model for boats temporarily
      case 'catapult':
      case 'ancient_giant':
        return '/attached_assets/0-2_1751822119779.glb'; // Use warrior model for siege units temporarily
      case 'guard':
      case 'peacekeeping_guard':
        return '/attached_assets/0-2_1751822119779.glb'; // Use warrior model for guards
      default:
        return '/attached_assets/0-2_1751822119779.glb'; // Default to warrior model
    }
  };

  const modelPath = getModelPath(unit.type);
  const { scene } = useGLTF(modelPath);
  
  // Clone the scene to avoid modifying the original
  const clonedScene = useMemo(() => {
    const clone = scene.clone();
    
    // Scale the model to fit within a hex tile properly
    // Different unit types may need different scaling
    let scale = 0.4; // Default scale for most units
    
    // Adjust scale based on unit type if needed
    if (unit.type === 'worker') {
      scale = 0.35; // Slightly smaller for civilian units
    } else if (unit.type === 'scout' || unit.type === 'wilderness_hunter') {
      scale = 0.38; // Medium scale for ranged units
    } else if (unit.type === 'missionary' || unit.type === 'royal_envoy') {
      scale = 0.37; // Special scale for religious units
    }
    
    clone.scale.setScalar(scale);
    
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
  
  return (
    <group position={[position.x, 0.05, position.y]}>
      <primitive object={clonedScene} />
      
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

// Preload all upgraded 3D unit models
useGLTF.preload('/attached_assets/0-2_1751822119779.glb'); // Warrior model
useGLTF.preload('/attached_assets/Worker_1751829936748.glb'); // Worker model  
useGLTF.preload('/attached_assets/Fun Scout_1751831308185.glb'); // Scout model