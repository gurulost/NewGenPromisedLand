import { useGLTF, useAnimations } from '@react-three/drei';
import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Unit } from '@shared/types/unit';
import { useLocalGame } from '../../lib/stores/useLocalGame';
import { getUnitModelPath } from '../../utils/modelManager';
import { disposeClonedMaterials } from '../../lib/memoryUtils';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import {
  getAnimatedModelPathForUnit,
  getUnitAnimationClipPool,
  getUnitAnimationSpec,
  pickWeightedClipName,
  UnitAnimationState,
} from '../../utils/unitAnimationRegistry';

interface UnitModelProps {
  unit: Unit;
  position: { x: number; y: number };
  isPlayerUnit: boolean;
  isMoving?: boolean;
  animationsEnabled?: boolean;
  animationState?: UnitAnimationState;
  animationVariantKey?: string;
  animationClipName?: string;
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

export function UnitModel({
  unit,
  position,
  isPlayerUnit,
  isMoving = false,
  animationsEnabled = false,
  animationState,
  animationVariantKey,
  animationClipName,
}: UnitModelProps) {
  const { gameState } = useLocalGame();
  const groupRef = useRef<THREE.Group>(null);

  // Get the player's faction to determine which model variant to use
  const player = gameState?.players.find(p => p.id === unit.playerId);
  const playerFaction = player?.factionId;

  const animationSpec = getUnitAnimationSpec(unit.type);
  const animatedPath = animationsEnabled && animationSpec ? getAnimatedModelPathForUnit(unit.type) : null;
  const modelPath = animatedPath ?? getUnitModelPath(unit.type);
  const { scene, animations } = useGLTF(modelPath);
  const isAnimatedWorker = !!animatedPath && !!animationSpec;

  // Calculate total upgrades for visual indicators
  const totalUpgrades = getTotalUpgrades(unit);

  // Standardized unit scales - all units proportionally sized relative to each other
  const unitScale = useMemo(() => {
    const UNIT_SCALES: Record<string, number> = {
      // Small/civilian units
      worker: 0.55,
      
      // Scout-type units (medium-small, agile)
      scout: 0.6,
      slinger: 0.6,
      wilderness_hunter: 0.6,
      
      // Religious/diplomatic units (medium)
      missionary: 0.58,
      royal_envoy: 0.58,
      priestcraft_preacher: 0.58,
      converted_missionary: 0.58,
      scribe_teacher: 0.58,
      prophet: 0.6,
      
      // Standard infantry (medium)
      warrior: 0.65,
      spearman: 0.65,
      guard: 0.65,
      peacekeeping_guard: 0.65,
      commander: 0.7,
      
      // Elite/special infantry (medium-large)
      stripling_warrior: 0.7,
      
      // Large units
      ancient_giant: 0.85,
      cavalry: 0.75,
      catapult: 0.7,
      
      // Naval units
      boat: 0.8,
    };
    
    return UNIT_SCALES[unit.type] ?? 0.65;
  }, [unit.type]);

  // Clone and modify the scene for materials and status effects
  const clonedScene = useMemo(() => {
    const clone = isAnimatedWorker ? SkeletonUtils.clone(scene) : scene.clone();

    // Adjust materials based on ownership and unit status
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.material) {
          const cloneMaterial = (m: any) => (m && typeof m.clone === 'function' ? m.clone() : m);

          // Clone material(s) to avoid modifying the original
          const clonedMaterial = Array.isArray(child.material)
            ? child.material.map(cloneMaterial)
            : cloneMaterial(child.material);
          child.material = clonedMaterial;

          const materials = Array.isArray(clonedMaterial) ? clonedMaterial : [clonedMaterial];
          for (const material of materials) {
            // Adjust colors based on ownership
            if (isPlayerUnit) {
              // Player units get slightly brighter colors
              if (material?.color) {
                material.color.multiplyScalar(1.1);
              }
              if (material?.emissive) {
                material.emissive.setHex(0x002200); // Subtle green tint
              }
            } else {
              // Enemy units get cooler colors
              if (material?.color) {
                material.color.multiplyScalar(0.9);
              }
              if (material?.emissive) {
                material.emissive.setHex(0x220000); // Subtle red tint
              }
            }

            // Enhanced glow for upgraded units
            if (totalUpgrades > 0 && material?.emissive) {
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
              if (material?.emissive) {
                material.emissive.setHex(0x442200); // Orange glow for siege mode
              }
            } else if (unit.status === 'formation') {
              if (material?.emissive) {
                material.emissive.setHex(0x000044); // Blue glow for formation
              }
            }
          }
        }
      }
    });

    return clone;
  }, [scene, isAnimatedWorker, isPlayerUnit, unit.status, totalUpgrades]);

  // Apply auto-grounding to the cloned scene
  const groundedScene = useMemo(() => {
    const box = new THREE.Box3().setFromObject(clonedScene);
    const bottomShift = -box.min.y;
    clonedScene.position.set(0, bottomShift, 0);
    return clonedScene;
  }, [clonedScene]);

  // Dispose cloned materials on unmount to free GPU memory
  useEffect(() => {
    return () => {
      disposeClonedMaterials(clonedScene);
    };
  }, [clonedScene]);

  const { actions } = useAnimations(isAnimatedWorker ? animations : [], groupRef);
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);
  const resolvedState: UnitAnimationState = animationState ?? (isMoving ? "move" : "idle");

  useEffect(() => {
    if (!isAnimatedWorker) return;
    if (!actions) return;

    const preferredPool = getUnitAnimationClipPool(unit.type, resolvedState);
    const defaultIdle = ["Idle_12", "Idle_7", "Idle_3", "Idle_15"];
    const defaultMove = ["Walking", "walking_2_inplace", "Stumble_Walk", "Running", "Confident_Strut"];
    const isLoopingState = resolvedState === "idle" || resolvedState === "move";
    const fallbackClips = resolvedState === "move" ? defaultMove : defaultIdle;
    const fallbackPool = fallbackClips.map((name) => ({ name, weight: 1 }));
    const candidatePool = isLoopingState ? [...preferredPool, ...fallbackPool] : preferredPool;
    const availablePool = candidatePool.filter((entry) => actions[entry.name]);
    const selectionKey = `${unit.id}:${resolvedState}:${animationVariantKey ?? "default"}`;
    const selectedName = animationClipName && actions[animationClipName]
      ? animationClipName
      : pickWeightedClipName(availablePool, selectionKey);
    const nextAction = selectedName ? actions[selectedName] : undefined;
    if (!nextAction) {
      const current = currentActionRef.current;
      if (current) {
        const currentName = current.getClip?.().name;
        const allowed = candidatePool.some((entry) => entry.name === currentName);
        if (!allowed) {
          current.fadeOut(0.2);
          currentActionRef.current = null;
        }
      }
      return;
    }
    if (currentActionRef.current === nextAction) return;

    if (isLoopingState) {
      nextAction.setLoop(THREE.LoopRepeat, Infinity);
      nextAction.clampWhenFinished = false;
    } else {
      nextAction.setLoop(THREE.LoopOnce, 1);
      nextAction.clampWhenFinished = true;
    }

    nextAction.reset().fadeIn(0.2).play();
    if (currentActionRef.current) {
      currentActionRef.current.fadeOut(0.2);
    }
    currentActionRef.current = nextAction;

    return () => {
      nextAction.fadeOut(0.15);
    };
  }, [actions, isAnimatedWorker, resolvedState, unit.type, animationVariantKey, animationClipName]);

  useEffect(() => {
    if (!isAnimatedWorker) return;
    return () => {
      Object.values(actions || {}).forEach((action) => action?.stop?.());
    };
  }, [actions, isAnimatedWorker]);

  return (
    <group ref={groupRef} position={[position.x, 0, position.y]}>
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
