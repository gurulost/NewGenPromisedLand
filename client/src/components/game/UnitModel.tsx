import { useGLTF } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Unit } from '@shared/types/unit';
import { useLocalGame } from '../../lib/stores/useLocalGame';
import { getUnitModelPath } from '../../utils/modelManager';
import { GroundedModel } from './GroundedModel';

interface UnitModelProps {
  unit: Unit;
  position: { x: number; y: number };
  isPlayerUnit: boolean;
}

// Calculate total upgrades for a unit
function getTotalUpgrades(unit: Unit): number {
  if (!unit.upgrades) return 0;
  return (unit.upgrades.attack || 0) +
    (unit.upgrades.defense || 0) +
    (unit.upgrades.movement || 0) +
    (unit.upgrades.vision || 0);
}

// Upgrade indicator component - floating chevrons above unit
function UpgradeIndicators({ upgradeCount, isPlayerUnit }: { upgradeCount: number; isPlayerUnit: boolean }) {
  const groupRef = useRef<THREE.Group>(null);

  // Animate the indicators
  useFrame((state) => {
    if (groupRef.current) {
      // Gentle floating animation
      groupRef.current.position.y = 1.2 + Math.sin(state.clock.elapsedTime * 2) * 0.05;
      // Slow rotation
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.5;
    }
  });

  if (upgradeCount === 0) return null;

  // Determine indicator style based on upgrade count
  const indicatorColor = isPlayerUnit ? '#06B6D4' : '#F97316';
  const glowColor = isPlayerUnit ? '#67E8F9' : '#FBBF24';

  // Show stars based on upgrade tiers
  const starCount = Math.min(upgradeCount, 5); // Cap at 5 stars
  const starRadius = 0.15;
  const starSpacing = 0.25;

  return (
    <group ref={groupRef} position={[0, 1.2, 0]}>
      {/* Star indicators arranged in arc */}
      {Array.from({ length: starCount }).map((_, i) => {
        const angle = ((i - (starCount - 1) / 2) / Math.max(starCount - 1, 1)) * Math.PI * 0.6;
        const x = Math.sin(angle) * starSpacing * 1.5;
        const z = Math.cos(angle) * starSpacing * 0.5;

        return (
          <group key={i} position={[x, 0, z]}>
            {/* Glowing star core */}
            <mesh>
              <sphereGeometry args={[0.06, 8, 8]} />
              <meshBasicMaterial color={glowColor} />
            </mesh>
            {/* Outer glow */}
            <mesh>
              <sphereGeometry args={[0.1, 8, 8]} />
              <meshBasicMaterial
                color={indicatorColor}
                transparent
                opacity={0.4}
              />
            </mesh>
          </group>
        );
      })}

      {/* Central glow ring for highly upgraded units (3+) */}
      {upgradeCount >= 3 && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
          <ringGeometry args={[0.35, 0.45, 16]} />
          <meshBasicMaterial
            color={upgradeCount >= 5 ? '#FFD700' : indicatorColor}
            transparent
            opacity={0.6}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
}

export function UnitModel({ unit, position, isPlayerUnit }: UnitModelProps) {
  const { gameState } = useLocalGame();

  // Get the player's faction to determine which model variant to use
  const player = gameState?.players.find(p => p.id === unit.playerId);
  const playerFaction = player?.factionId;

  const modelPath = getUnitModelPath(unit.type);
  const { scene } = useGLTF(modelPath);

  // Calculate total upgrades for visual indicators
  const totalUpgrades = getTotalUpgrades(unit);

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

          // Enhanced glow for upgraded units
          if (totalUpgrades > 0 && material.emissive) {
            const glowIntensity = Math.min(totalUpgrades * 0.05, 0.25);
            if (isPlayerUnit) {
              material.emissive.setHex(0x004444); // Cyan tint for upgraded player units
            } else {
              material.emissive.setHex(0x442200); // Orange tint for upgraded enemy units
            }
            material.emissiveIntensity = 1 + glowIntensity;
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
  }, [scene, isPlayerUnit, unit.status, totalUpgrades]);

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

      {/* Upgrade Indicators - floating stars above unit */}
      <UpgradeIndicators upgradeCount={totalUpgrades} isPlayerUnit={isPlayerUnit} />

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
