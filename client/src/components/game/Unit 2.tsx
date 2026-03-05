import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Cylinder, Text } from "@react-three/drei";
import * as THREE from "three";
import type { Unit as UnitType } from "@shared/types/unit";
import { hexToPixel } from "@shared/utils/hex";
import { getFaction } from "@shared/data/factions";
import { canSelectUnit } from "@shared/logic/unitLogic";
import { getReachableTilesAsync } from "../../lib/pathfindingClient";
import { useGameState } from "../../lib/stores/useGameState";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { GLTFErrorBoundary } from "./GLTFErrorBoundary";
import { UnitModel } from "./UnitModel";
import { usePerformanceMode } from "../../hooks/usePerformanceMode";
import { useUnitMotionStore } from "../../lib/stores/useUnitMotionStore";
import { useMapPulseStore } from "../effects/MapPulseEffects";
import { getUnitAnimationYawOffset, UnitAnimationState } from "../../utils/unitAnimationRegistry";
import { buildPathfindingInputs } from "../../lib/pathfindingInputs";
import { useUnitAnimationEventStore } from "../../lib/stores/useUnitAnimationEventStore";

function StatusIcon({ icon, color, label }: { icon: string; color: string; label: string }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.1;
    }
  });

  return (
    <group ref={ref}>
      <Billboard follow={true} lockX={false} lockY={false} lockZ={false}>
        <Text
          fontSize={0.4}
          color={color}
          outlineWidth={0.02}
          outlineColor="#000000"
          anchorX="center"
          anchorY="bottom"
        >
          {icon}
        </Text>
        <Text
          position={[0, -0.25, 0]}
          fontSize={0.12}
          color="white"
          outlineWidth={0.01}
          outlineColor="#000000"
          fontWeight="bold"
          anchorX="center"
          anchorY="top"
        >
          {label}
        </Text>
      </Billboard>
    </group>
  );
}

// Action Badge - shows remaining actions as bobbing number
function ActionBadge({ count, color, animate }: { count: number; color: string; animate: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!animate) return;

    // Bob animation
    if (ref.current) {
      ref.current.position.y = 1.6 + Math.sin(state.clock.elapsedTime * 2.5) * 0.08;
    }

    // Ring pulse animation
    if (ringRef.current) {
      const pulse = 0.5 + Math.sin(state.clock.elapsedTime * 3) * 0.2;
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = pulse;
      const scale = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.08;
      ringRef.current.scale.set(scale, scale, 1);
    }
  });

  return (
    <>
      {/* Bobbing action count badge */}
      <group ref={ref} position={[0, 1.6, 0]}>
        <Billboard follow={true} lockX={false} lockY={false} lockZ={false}>
          {/* Badge background */}
          <mesh position={[0, 0, -0.01]}>
            <circleGeometry args={[0.18, 16]} />
            <meshBasicMaterial color={color} transparent opacity={0.85} />
          </mesh>
          {/* Badge border */}
          <mesh position={[0, 0, -0.005]}>
            <ringGeometry args={[0.16, 0.2, 16]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
          </mesh>
          {/* Action count number */}
          <Text
            fontSize={0.16}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.015}
            outlineColor="#000000"
            fontWeight="bold"
          >
            {count}
          </Text>
        </Billboard>
      </group>

      {/* Enhanced pulsing ring at base */}
      <mesh
        ref={ringRef}
        position={[0, 0.04, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.52, 0.6, 24]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}

function UnitModelFallback({ isPlayerUnit }: { isPlayerUnit: boolean }) {
  return (
    <mesh>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial color={isPlayerUnit ? "#22c55e" : "#ef4444"} />
    </mesh>
  );
}

interface UnitProps {
  unit: UnitType;
  isSelected: boolean;
  onUnitClick?: (unit: UnitType) => void;
}

const UNIT_HEIGHT = 0.2;
const HEX_SIZE = 1;

export default function Unit({ unit, isSelected }: UnitProps) {
  const isDev = import.meta.env.DEV;
  const meshRef = useRef<THREE.Group>(null);
  const unitGroupRef = useRef<THREE.Group>(null);
  const lastPulseIndexRef = useRef<number>(-1);
  const lastMotionIdRef = useRef<string | null>(null);
  const lastMotionPosRef = useRef<{ x: number; z: number } | null>(null);
  const lastMotionMoveAtRef = useRef<number>(0);
  const movingVisualRef = useRef(false);
  const { setSelectedUnit, setReachableTiles, setReachableCoordinates, isMovementMode } = useGameState();
  const { gameState } = useLocalGame();
  const reachableRequestIdRef = useRef(0);
  const motion = useUnitMotionStore((state) => state.motions[unit.id]);
  const stopMotion = useUnitMotionStore((state) => state.stopMotion);
  const addPulse = useMapPulseStore((state) => state.addPulse);

  const pixelPos = useMemo(() => hexToPixel(unit.coordinate, HEX_SIZE), [unit.coordinate]);

  if (isDev) {
    console.log(`🎨 Unit ${unit.id} rendering:`, {
      coordinate: unit.coordinate,
      pixelPos,
      type: unit.type,
      playerId: unit.playerId,
      visionRadius: unit.visionRadius,
      attackRange: unit.attackRange,
      isSelected,
    });
  }

  const player = gameState?.players.find((p) => p.id === unit.playerId);
  const faction = player ? getFaction(player.factionId as any) : null;
  const currentPlayer = gameState?.players[gameState?.currentPlayerIndex || 0];

  if (isDev) {
    console.log(`✅ Unit ${unit.id} passed visibility filter and is rendering`);
  }

  useEffect(() => {
    if (!isSelected) {
      return;
    }

    if (isMovementMode && gameState) {
      if (isDev) {
        console.log("Calculating reachable tiles for unit:", unit.id, "Movement:", unit.remainingMovement);
      }

      const { passableTiles, tileCosts } = buildPathfindingInputs(gameState, unit);

      const requestId = ++reachableRequestIdRef.current;
      void getReachableTilesAsync({
        start: unit.coordinate,
        passableTiles,
        tileCosts,
        maxCost: unit.remainingMovement,
        timeoutMs: 1500,
      })
        .then((reachable) => {
          if (reachableRequestIdRef.current !== requestId) return;
          const reachableMoves = reachable.filter(
            (coord) => coord.q !== unit.coordinate.q || coord.r !== unit.coordinate.r
          );
          const reachableKeys = reachableMoves.map((coord) => `${coord.q},${coord.r}`);
          if (isDev) {
            console.log("Reachable tiles:", reachableKeys);
          }
          setReachableTiles(reachableKeys);
          setReachableCoordinates(reachableMoves);
        })
        .catch((error) => {
          if (reachableRequestIdRef.current !== requestId) return;
          console.error("Pathfinding worker error:", error);
          setReachableTiles([]);
          setReachableCoordinates([]);
        });
    } else {
      setReachableTiles([]);
      setReachableCoordinates([]);
    }
  }, [
    isSelected,
    isMovementMode,
    unit,
    gameState,
    setReachableTiles,
    setReachableCoordinates,
    isDev,
  ]);

  const perfMode = usePerformanceMode();
  const animationsEnabled = perfMode === 'high';
  const motionNow = typeof performance !== "undefined" ? performance.now() : Date.now();
  const [isMovingVisual, setIsMovingVisual] = useState(false);
  const isMoving =
    motion?.mode === "active" && (!motion?.expiresAtMs || motion.expiresAtMs > motionNow);
  const animationEvent = useUnitAnimationEventStore((state) => state.active[unit.id]);
  const animationState: UnitAnimationState = animationEvent?.state ?? (isMovingVisual ? "move" : "idle");
  const [idleCycleKey, setIdleCycleKey] = useState(0);
  const isIdle = animationsEnabled && !isMovingVisual && !animationEvent;
  const animationVariantKey = animationEvent?.token ?? (isMovingVisual ? motion?.id : `idle_${unit.id}_${idleCycleKey}`);
  const animationClipName = animationEvent?.clipName;
  const initialMotionPos = motion?.points?.[0];
  const yawOffset = getUnitAnimationYawOffset(unit.type) ?? 0;
  const clearAnimationEvent = useUnitAnimationEventStore((state) => state.clearUnit);

  useEffect(() => {
    if (!motion) {
      lastPulseIndexRef.current = -1;
      if (unitGroupRef.current?.position) {
        unitGroupRef.current.position.set(pixelPos.x, 0, pixelPos.y);
      }
    }
  }, [motion, pixelPos.x, pixelPos.y]);

  useEffect(() => {
    return () => {
      stopMotion(unit.id);
      clearAnimationEvent(unit.id);
    };
  }, [stopMotion, clearAnimationEvent, unit.id]);

  useEffect(() => {
    if (!isIdle) return;
    const intervalId = setInterval(() => {
      setIdleCycleKey((value) => value + 1);
    }, 15000);
    return () => {
      clearInterval(intervalId);
    };
  }, [isIdle]);

  useFrame((state) => {
    const group = unitGroupRef.current;
    if (motion && group?.position) {
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      if (motion.expiresAtMs && motion.expiresAtMs <= now) {
        stopMotion(unit.id);
        lastPulseIndexRef.current = -1;
        lastMotionIdRef.current = null;
        lastMotionPosRef.current = null;
        lastMotionMoveAtRef.current = 0;
        if (movingVisualRef.current) {
          movingVisualRef.current = false;
          setIsMovingVisual(false);
        }
        return;
      }
      if (motion.mode === "active" && motion.points.length < 2) {
        stopMotion(unit.id);
        lastPulseIndexRef.current = -1;
        lastMotionIdRef.current = null;
        lastMotionPosRef.current = null;
        lastMotionMoveAtRef.current = 0;
        if (movingVisualRef.current) {
          movingVisualRef.current = false;
          setIsMovingVisual(false);
        }
        return;
      }
      if (motion.mode === "pending") {
        const hold = motion.points[0];
        if (hold) {
          group.position.set(hold.x, 0, hold.z);
        }
        if (movingVisualRef.current) {
          movingVisualRef.current = false;
          setIsMovingVisual(false);
        }
        return;
      }
      if (lastMotionIdRef.current !== motion.id) {
        lastMotionIdRef.current = motion.id;
        lastMotionMoveAtRef.current = 0;
        lastMotionPosRef.current = {
          x: group.position.x,
          z: group.position.z,
        };
      }
      const elapsedSec = (now - motion.startTimeMs) / 1000;
      const progressTiles = elapsedSec * motion.speedTilesPerSec;
      const maxIndex = motion.points.length - 1;

      if (progressTiles >= maxIndex) {
        const end = motion.points[maxIndex];
        group.position.set(end.x, 0, end.z);
        stopMotion(unit.id);
        lastPulseIndexRef.current = -1;
      } else {
        const idx = Math.max(0, Math.floor(progressTiles));
        const localT = progressTiles - idx;
        const from = motion.points[idx];
        const to = motion.points[idx + 1];

        if (from && to) {
          const x = from.x + (to.x - from.x) * localT;
          const z = from.z + (to.z - from.z) * localT;
          group.position.set(x, 0, z);

          if (meshRef.current) {
            const dx = to.x - from.x;
            const dz = to.z - from.z;
            meshRef.current.rotation.y = Math.atan2(dx, dz) + yawOffset;
          }

          const lastPos = lastMotionPosRef.current;
          if (lastPos) {
            const dxp = x - lastPos.x;
            const dzp = z - lastPos.z;
            if (dxp * dxp + dzp * dzp > 0.0001) {
              lastMotionMoveAtRef.current = now;
              lastMotionPosRef.current = { x, z };
            }
          } else {
            lastMotionMoveAtRef.current = now;
            lastMotionPosRef.current = { x, z };
          }
        }

        if (idx !== lastPulseIndexRef.current && motion.path[idx]) {
          if (perfMode === 'high') {
            addPulse('unit', motion.path[idx]);
          }
          lastPulseIndexRef.current = idx;
        }

        const timeSinceMove = lastMotionMoveAtRef.current === 0
          ? now - motion.startTimeMs
          : now - lastMotionMoveAtRef.current;
        const movingNow =
          lastMotionMoveAtRef.current !== 0 && (now - lastMotionMoveAtRef.current) < 250;
        if (movingVisualRef.current !== movingNow) {
          movingVisualRef.current = movingNow;
          setIsMovingVisual(movingNow);
        }

        if (timeSinceMove > 600) {
          stopMotion(unit.id);
          lastPulseIndexRef.current = -1;
          lastMotionIdRef.current = null;
          lastMotionPosRef.current = null;
          lastMotionMoveAtRef.current = 0;
          if (movingVisualRef.current) {
            movingVisualRef.current = false;
            setIsMovingVisual(false);
          }
          return;
        }
      }
    } else if (movingVisualRef.current) {
      movingVisualRef.current = false;
      setIsMovingVisual(false);
    }

    if (meshRef.current) {
      const bob = isSelected ? Math.sin(state.clock.elapsedTime * 3) * 0.1 : 0;
      meshRef.current.position.y = UNIT_HEIGHT + bob;
    }
  });

  const handleClick = () => {
    if (isDev) {
      console.log(
        "Unit clicked:",
        unit.id,
        "Current player:",
        gameState?.players[gameState.currentPlayerIndex]?.id,
        "Unit player:",
        unit.playerId
      );
    }

    if (gameState && canSelectUnit(unit, gameState)) {
      setSelectedUnit(unit);
    } else if (isDev) {
      console.log("Cannot select unit - not current player's turn");
    }
  };

  const healthPercent = unit.hp / unit.maxHp;
  const healthColor = healthPercent > 0.6 ? "#22c55e" : healthPercent > 0.3 ? "#f59e0b" : "#ef4444";
  const factionColor = faction?.color || "#ffffff";
  const actionsRemaining = unit.actionsRemaining ?? unit.maxActions ?? 1;
  const hasMovementRemaining = unit.remainingMovement > 0;
  const hasActionsRemaining = hasMovementRemaining || actionsRemaining > 0;
  const isPlayerUnit = currentPlayer?.id === unit.playerId;
  return (
    <group
      ref={unitGroupRef}
      position={[
        initialMotionPos ? initialMotionPos.x : pixelPos.x,
        0,
        initialMotionPos ? initialMotionPos.z : pixelPos.y
      ]}
    >
      {/* Faction Color Ownership Ring */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.35, 0.45, 24]} />
        <meshBasicMaterial
          color={factionColor}
          transparent
          opacity={hasActionsRemaining ? 0.9 : 0.5}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Inner glow for visibility */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.35, 24]} />
        <meshBasicMaterial
          color={factionColor}
          transparent
          opacity={0.15}
        />
      </mesh>

      {/* Action Badge - only shown for player's units with actions remaining */}
      {hasMovementRemaining && isPlayerUnit && !isSelected && (
        <ActionBadge
          count={unit.remainingMovement}
          color={factionColor}
          animate={animationsEnabled}
        />
      )}

      <group
        ref={meshRef}
        position={[0, UNIT_HEIGHT, 0]}
        onClick={handleClick}
        onPointerEnter={() => (document.body.style.cursor = "pointer")}
        onPointerLeave={() => (document.body.style.cursor = "default")}
      >
        <group scale={unit.status === "exhausted" ? [0.9, 0.9, 0.9] : [1.0, 1.0, 1.0]}>
          <GLTFErrorBoundary
            fallback={<UnitModelFallback isPlayerUnit={currentPlayer?.id === unit.playerId} />}
            resetKey={`${unit.id}:${unit.type}`}
          >
            <UnitModel
              unit={unit}
              position={{ x: 0, y: -UNIT_HEIGHT + 0.025 }}
              isPlayerUnit={currentPlayer?.id === unit.playerId}
              isMoving={isMoving}
              animationsEnabled={animationsEnabled}
              animationState={animationState}
              animationVariantKey={animationVariantKey}
              animationClipName={animationClipName}
            />
          </GLTFErrorBoundary>
        </group>
      </group>

      {isSelected && (
        <group position={[0, 2, 0]}>
          <Cylinder args={[0.4, 0.4, 4, 16, 1, true]} position={[0, 0, 0]}>
            <meshBasicMaterial
              color="#FDE047"
              transparent
              opacity={0.15}
              side={THREE.DoubleSide}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </Cylinder>
          <Cylinder args={[0.1, 0.1, 4, 8, 1, true]} position={[0, 0, 0]}>
            <meshBasicMaterial
              color="#FFFFFF"
              transparent
              opacity={0.2}
              side={THREE.DoubleSide}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </Cylinder>
          <mesh position={[0, -1.95, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.4, 0.5, 32]} />
            <meshBasicMaterial color="#FDE047" transparent opacity={0.5} blending={THREE.AdditiveBlending} />
          </mesh>
        </group>
      )}

      {unit.hp < unit.maxHp && (
        <group position={[0, 1.1, 0]}>
          <mesh position={[0, 0, -0.01]}>
            <planeGeometry args={[0.64, 0.12]} />
            <meshBasicMaterial color="#000000" transparent opacity={0.8} />
          </mesh>
          <mesh position={[0, 0, 0]}>
            <planeGeometry args={[0.6, 0.08]} />
            <meshBasicMaterial color="#1F2937" />
          </mesh>
          <mesh position={[-0.3 + (0.6 * healthPercent) / 2, 0, 0.001]}>
            <planeGeometry args={[0.6 * healthPercent, 0.08]} />
            <meshBasicMaterial color={healthColor} />
          </mesh>
        </group>
      )}

      <group position={[0, 1.4, 0]}>
        {unit.status === "stealthed" && <StatusIcon icon="👁️" color="#60A5FA" label="STEALTHED" />}
        {unit.status === "rallied" && <StatusIcon icon="🚩" color="#FCD34D" label="RALLIED" />}
        {unit.status === "formation" && <StatusIcon icon="🛡️" color="#4ADE80" label="FORMATION" />}
        {unit.status === "siege_mode" && <StatusIcon icon="🎯" color="#F87171" label="SIEGE" />}
        {unit.status === "exhausted" && <StatusIcon icon="💤" color="#9CA3AF" label="RESTING" />}
      </group>

      <Text position={[0, 1.0, 0]} fontSize={0.18} color="white" anchorX="center" anchorY="middle">
        {unit.type.replace("_", " ").toUpperCase()}
      </Text>

      {isSelected && unit.remainingMovement > 0 && (
        <Text position={[0, 1.2, 0]} fontSize={0.14} color="#60a5fa" anchorX="center" anchorY="middle">
          Move: {unit.remainingMovement}
        </Text>
      )}

      {/* Keep reference to faction to avoid unused import churn in dev; also makes debugging easier */}
      {isDev && faction ? null : null}
    </group>
  );
}
