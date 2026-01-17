import { Suspense, useMemo, useRef, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, useAnimations } from "@react-three/drei";
import * as THREE from "three";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { ErrorBoundary } from "../ErrorBoundary";
import {
  UNIT_ANIMATION_REGISTRY,
  getUnitAnimationSpec,
  type UnitAnimationState,
  type ClipEntry,
} from "../../utils/unitAnimationRegistry";

type UnitKey = keyof typeof UNIT_ANIMATION_REGISTRY;

const formatStateLabel = (state: UnitAnimationState) =>
  state.charAt(0).toUpperCase() + state.slice(1);

const getClipName = (entry: ClipEntry) => (typeof entry === "string" ? entry : entry.name);
const getClipWeight = (entry: ClipEntry) => (typeof entry === "string" ? undefined : entry.weight);

function AnimationPreview({
  scene,
  animations,
  clipName,
  loop,
}: {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  clipName: string | null;
  loop: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const clonedScene = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const { actions } = useAnimations(animations, groupRef);

  useEffect(() => {
    if (!actions) return;
    Object.values(actions).forEach((action) => action?.stop());
    if (!clipName) return;
    const nextAction = actions[clipName];
    if (!nextAction) return;

    nextAction.reset();
    nextAction.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    nextAction.clampWhenFinished = !loop;
    nextAction.fadeIn(0.15).play();
    return () => {
      nextAction.fadeOut(0.1);
    };
  }, [actions, clipName, loop]);

  useEffect(() => {
    const box = new THREE.Box3().setFromObject(clonedScene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z, 0.0001);
    const scale = 2.1 / maxDim;
    clonedScene.position.set(0, 0, 0);
    clonedScene.scale.setScalar(scale);
    clonedScene.position.sub(center.multiplyScalar(scale));
    clonedScene.position.y -= box.min.y * scale;
  }, [clonedScene]);

  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} />
    </group>
  );
}

function AnimationInspector({
  unitSpec,
  modelPath,
  selectedClip,
  setSelectedClip,
  loop,
  setLoop,
}: {
  unitSpec: ReturnType<typeof getUnitAnimationSpec>;
  modelPath: string;
  selectedClip: string | null;
  setSelectedClip: (clip: string | null) => void;
  loop: boolean;
  setLoop: (value: boolean) => void;
}) {
  const { scene, animations } = useGLTF(modelPath);

  const clipDurations = useMemo(() => {
    return new Map(animations.map((clip) => [clip.name, clip.duration]));
  }, [animations]);

  const registryStates = useMemo(() => {
    const clips = unitSpec?.clips ?? {};
    return Object.entries(clips) as Array<[UnitAnimationState, ClipEntry | ClipEntry[]]>;
  }, [unitSpec]);

  const registryClipNames = useMemo(() => {
    const names = new Set<string>();
    registryStates.forEach(([, entries]) => {
      const list = Array.isArray(entries) ? entries : [entries];
      list.forEach((entry) => names.add(getClipName(entry)));
    });
    return names;
  }, [registryStates]);

  const fileClipNames = useMemo(() => animations.map((clip) => clip.name).sort(), [animations]);

  useEffect(() => {
    if (!selectedClip) {
      setSelectedClip(fileClipNames[0] ?? null);
    }
  }, [selectedClip, fileClipNames, setSelectedClip]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm text-slate-400">Model</div>
            <div className="text-base font-medium">{modelPath}</div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={loop}
              onChange={(event) => setLoop(event.target.checked)}
              className="accent-amber-400"
            />
            Loop
          </label>
        </div>
        <div className="h-[420px] rounded-md overflow-hidden border border-slate-700">
          <ErrorBoundary fallback={
            <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-300 text-sm">
              WebGL is required for animation preview. Please use a browser with WebGL support.
            </div>
          }>
            <Canvas camera={{ position: [0, 2.2, 3.2], fov: 40 }}>
              <color attach="background" args={["#0f172a"]} />
              <ambientLight intensity={0.9} />
              <directionalLight position={[5, 6, 3]} intensity={2.4} />
              <directionalLight position={[-4, 5, -3]} intensity={1.4} />
              <OrbitControls enablePan={false} />
              <Suspense fallback={null}>
                <AnimationPreview scene={scene} animations={animations} clipName={selectedClip} loop={loop} />
              </Suspense>
            </Canvas>
          </ErrorBoundary>
        </div>
        <div className="mt-3 text-sm text-slate-400">
          Selected clip: <span className="text-slate-200">{selectedClip ?? "None"}</span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-4">
          <h2 className="text-sm uppercase tracking-wide text-slate-400">Registry Mapping</h2>
          <div className="mt-3 space-y-3">
            {registryStates.map(([state, entries]) => {
              const list = Array.isArray(entries) ? entries : [entries];
              return (
                <div key={state}>
                  <div className="text-sm font-semibold text-amber-300">
                    {formatStateLabel(state)}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {list.map((entry) => {
                      const name = getClipName(entry);
                      const weight = getClipWeight(entry);
                      const exists = clipDurations.has(name);
                      return (
                        <button
                          key={`${state}-${name}`}
                          onClick={() => setSelectedClip(name)}
                          className={`px-2 py-1 rounded border text-xs ${
                            selectedClip === name
                              ? "bg-amber-400 text-slate-900 border-amber-300"
                              : "border-slate-600 text-slate-200 hover:border-amber-300"
                          }`}
                        >
                          {name}
                          {weight !== undefined && (
                            <span className="ml-1 text-[10px] text-slate-500">
                              {weight}
                            </span>
                          )}
                          {!exists && (
                            <span className="ml-1 text-[10px] text-red-400">missing</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-4">
          <h2 className="text-sm uppercase tracking-wide text-slate-400">All Clips in File</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {fileClipNames.map((clip) => {
              const duration = clipDurations.get(clip);
              const inRegistry = registryClipNames.has(clip);
              return (
                <button
                  key={clip}
                  onClick={() => setSelectedClip(clip)}
                  className={`px-2 py-1 rounded border text-xs ${
                    selectedClip === clip
                      ? "bg-amber-400 text-slate-900 border-amber-300"
                      : "border-slate-600 text-slate-200 hover:border-amber-300"
                  }`}
                >
                  {clip}
                  {duration !== undefined && (
                    <span className="ml-1 text-[10px] text-slate-500">
                      {duration.toFixed(2)}s
                    </span>
                  )}
                  {!inRegistry && (
                    <span className="ml-1 text-[10px] text-slate-500">unmapped</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AnimationLab() {
  const animatedUnits = useMemo(() => {
    return Object.entries(UNIT_ANIMATION_REGISTRY)
      .filter(([, spec]) => spec?.animatedModelPath)
      .map(([key]) => key as UnitKey);
  }, []);

  const [selectedUnit, setSelectedUnit] = useState<UnitKey | null>(
    animatedUnits.length ? animatedUnits[0] : null
  );
  const [selectedClip, setSelectedClip] = useState<string | null>(null);
  const [loop, setLoop] = useState(true);

  const unitSpec = selectedUnit ? getUnitAnimationSpec(selectedUnit as any) : undefined;
  const modelPath = unitSpec?.animatedModelPath ?? null;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold">Animation Lab</h1>
          <p className="text-sm text-slate-400">
            Diagnostic page: select a unit, then click a clip name to preview the animation.
          </p>
        </header>

        <div className="flex flex-wrap gap-2">
          {animatedUnits.map((unit) => (
            <button
              key={unit}
              onClick={() => {
                setSelectedUnit(unit);
                setSelectedClip(null);
              }}
              className={`px-3 py-1 rounded-full text-sm border ${
                selectedUnit === unit
                  ? "bg-amber-400 text-slate-900 border-amber-300"
                  : "border-slate-600 text-slate-200 hover:border-amber-300"
              }`}
            >
              {unit}
            </button>
          ))}
        </div>

        {!modelPath ? (
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 text-sm text-slate-300">
            Select a unit with an animated model to continue.
          </div>
        ) : (
          <Suspense fallback={null}>
            <AnimationInspector
              unitSpec={unitSpec}
              modelPath={modelPath}
              selectedClip={selectedClip}
              setSelectedClip={setSelectedClip}
              loop={loop}
              setLoop={setLoop}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
