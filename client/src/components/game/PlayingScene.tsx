import { Suspense, lazy } from "react";
import { Canvas } from "@react-three/fiber";
import { KeyboardControls } from "@react-three/drei";
import * as THREE from "three";
import { WorldBuildLoader } from "../ui/WorldBuildLoader";
import { useMobileUI } from "../../hooks/useMobileUI";
import { usePerformanceMode } from "../../hooks/usePerformanceMode";

const GameCanvas = lazy(() => import("./GameCanvas"));
const GameUI = lazy(() => import("./GameUI"));

const minimalGameStageEnabled =
  (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_E2E_MINIMAL_GAME_STAGE === "true";

const controls = [
  { name: "select", keys: ["Enter", "Space"] },
  { name: "cancel", keys: ["Escape"] },
  { name: "endTurn", keys: ["KeyT"] },
  { name: "save", keys: ["KeyS"] },
  { name: "load", keys: ["KeyL"] },
  { name: "diplomacy", keys: ["KeyD"] },
  { name: "chat", keys: ["KeyC"] },
  { name: "attack", keys: ["KeyA"] },
  { name: "move", keys: ["KeyM"] },
  { name: "ability", keys: ["KeyQ"] },
];

function CanvasLoadingFallback() {
  return (
    <group>
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.65, 0.8, 6]} />
        <meshBasicMaterial
          color="#94a3b8"
          transparent
          opacity={0.45}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.45, 6]} />
        <meshBasicMaterial
          color="#1e293b"
          transparent
          opacity={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

function GameStage() {
  const { isMobileUI } = useMobileUI();
  const perfMode = usePerformanceMode();
  const allowShadows = perfMode === "high" && !isMobileUI;
  const dpr = isMobileUI ? ([1, 1.5] as [number, number]) : undefined;

  return (
    <Canvas
      shadows={allowShadows}
      dpr={dpr}
      camera={{
        position: [0, 8, 8],
        fov: 45,
        near: 0.5,
        far: 1000,
      }}
      gl={{
        antialias: perfMode === "high" && !isMobileUI,
        powerPreference: "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.3,
      }}
      className="absolute inset-0"
    >
      <color attach="background" args={["#0f172a"]} />

      {minimalGameStageEnabled ? (
        // Playwright only needs a live canvas surface; skip GLTF-heavy scene loading in CI.
        <ambientLight intensity={0.35} color="#ffffff" />
      ) : (
        <>
          <ambientLight intensity={1.15} color="#ffffff" />
          <hemisphereLight
            color="#ffffff"
            groundColor="#6b7280"
            intensity={0.65}
          />
          <directionalLight
            position={[10, 10, 5]}
            intensity={3.0}
            color="#fff3d6"
            castShadow={allowShadows}
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <directionalLight
            position={[-10, 10, -5]}
            intensity={1.8}
            color="#e0f2fe"
            castShadow={allowShadows}
          />

          <Suspense fallback={<CanvasLoadingFallback />}>
            <GameCanvas />
          </Suspense>
        </>
      )}
    </Canvas>
  );
}

export default function PlayingScene() {
  return (
    <KeyboardControls map={controls}>
      <GameStage />
      <Suspense fallback={null}>
        <GameUI />
      </Suspense>
      <WorldBuildLoader enabled />
    </KeyboardControls>
  );
}
