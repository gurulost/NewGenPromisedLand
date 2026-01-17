import { Suspense, useMemo, useRef, useState, useEffect, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, useAnimations } from "@react-three/drei";
import * as THREE from "three";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { ErrorBoundary } from "../ErrorBoundary";
import {
  UNIT_ANIMATION_REGISTRY,
  getUnitAnimationSpec,
  getUnitAnimationOverrides,
  setUnitAnimationOverrides,
  clearUnitAnimationOverrides,
  type UnitAnimationState,
  type ClipEntry,
  type UnitAnimationSpec,
} from "../../utils/unitAnimationRegistry";

type UnitKey = keyof typeof UNIT_ANIMATION_REGISTRY;

const formatStateLabel = (state: UnitAnimationState) =>
  state.charAt(0).toUpperCase() + state.slice(1);

const ANIMATION_STATES: UnitAnimationState[] = [
  "idle",
  "move",
  "celebrate",
  "death",
  "attack",
  "hit",
  "ability",
];

type EditableClip = { name: string; weight: number };
type EditableSpec = {
  animatedModelPath?: string;
  clips: Record<UnitAnimationState, EditableClip[]>;
  moveSpeedTilesPerSec?: number;
  yawOffset?: number;
};

const toEditableClip = (entry: ClipEntry): EditableClip => {
  if (typeof entry === "string") {
    return { name: entry, weight: 1 };
  }
  return { name: entry.name, weight: entry.weight ?? 1 };
};

const normalizeClipList = (entries?: ClipEntry | ClipEntry[]): EditableClip[] => {
  if (!entries) return [];
  const list = Array.isArray(entries) ? entries : [entries];
  return list.map(toEditableClip);
};

const toEditableSpec = (spec: UnitAnimationSpec): EditableSpec => {
  const clips = {} as Record<UnitAnimationState, EditableClip[]>;
  ANIMATION_STATES.forEach((state) => {
    clips[state] = normalizeClipList(spec.clips?.[state]);
  });
  return {
    animatedModelPath: spec.animatedModelPath,
    moveSpeedTilesPerSec: spec.moveSpeedTilesPerSec,
    yawOffset: spec.yawOffset,
    clips,
  };
};

const toOverrideSpec = (spec: EditableSpec): Partial<UnitAnimationSpec> => {
  const clips: UnitAnimationSpec["clips"] = {};
  ANIMATION_STATES.forEach((state) => {
    const list = spec.clips[state] ?? [];
    clips[state] = list.map((entry) => ({ name: entry.name, weight: entry.weight }));
  });
  return { clips };
};

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
    Object.values(actions).forEach((action) => action?.stop?.());
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
  onUpdateClip,
  onRemoveClip,
  onAddClip,
  onMoveClip,
}: {
  unitSpec: EditableSpec | undefined;
  modelPath: string;
  selectedClip: string | null;
  setSelectedClip: (clip: string | null) => void;
  loop: boolean;
  setLoop: (value: boolean) => void;
  onUpdateClip: (state: UnitAnimationState, index: number, updates: Partial<EditableClip>) => void;
  onRemoveClip: (state: UnitAnimationState, index: number) => void;
  onAddClip: (state: UnitAnimationState) => void;
  onMoveClip: (state: UnitAnimationState, index: number, nextState: UnitAnimationState) => void;
}) {
  const { scene, animations } = useGLTF(modelPath);

  const clipDurations = useMemo(() => {
    return new Map(animations.map((clip) => [clip.name, clip.duration]));
  }, [animations]);

  const registryClipNames = useMemo(() => {
    const names = new Set<string>();
    ANIMATION_STATES.forEach((state) => {
      unitSpec?.clips?.[state]?.forEach((clip) => names.add(clip.name));
    });
    return names;
  }, [unitSpec]);

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
            <Canvas camera={{ position: [0, 2.5, 6], fov: 40 }}>
              <color attach="background" args={["#0f172a"]} />
              <ambientLight intensity={0.9} />
              <directionalLight position={[5, 6, 3]} intensity={2.4} />
              <directionalLight position={[-4, 5, -3]} intensity={1.4} />
              <OrbitControls enablePan={false} target={[0, 1.0, 0]} />
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
            {ANIMATION_STATES.map((state) => {
              const list = unitSpec?.clips?.[state] ?? [];
              return (
                <div key={state}>
                  <div className="text-sm font-semibold text-amber-300">
                    {formatStateLabel(state)}
                  </div>
                  {list.length === 0 ? (
                    <div className="mt-2 text-xs text-slate-500">No clips assigned.</div>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {list.map((entry, index) => {
                        const exists = clipDurations.has(entry.name);
                        return (
                          <div key={`${state}-${index}`} className="flex flex-wrap items-center gap-2">
                            <input
                              type="text"
                              list="animation-lab-clip-list"
                              value={entry.name}
                              onChange={(event) => {
                                const nextName = event.target.value;
                                if (selectedClip === entry.name) {
                                  setSelectedClip(nextName);
                                }
                                onUpdateClip(state, index, { name: nextName });
                              }}
                              className="w-40 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                            />
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={Number.isFinite(entry.weight) ? entry.weight : 0}
                              onChange={(event) =>
                                onUpdateClip(state, index, { weight: Number(event.target.value) || 0 })
                              }
                              className="w-16 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                            />
                            <select
                              value={state}
                              onChange={(event) =>
                                onMoveClip(state, index, event.target.value as UnitAnimationState)
                              }
                              className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                            >
                              {ANIMATION_STATES.map((option) => (
                                <option key={option} value={option}>
                                  {formatStateLabel(option)}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => setSelectedClip(entry.name)}
                              className="px-2 py-1 rounded border border-slate-600 text-xs text-slate-200 hover:border-amber-300"
                            >
                              Play
                            </button>
                            <button
                              onClick={() => onRemoveClip(state, index)}
                              className="px-2 py-1 rounded border border-slate-600 text-xs text-red-300 hover:border-red-300"
                            >
                              Remove
                            </button>
                            {!exists && (
                              <span className="text-[10px] text-red-400">missing</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <button
                    onClick={() => onAddClip(state)}
                    className="mt-2 inline-flex items-center gap-1 rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:border-amber-300"
                  >
                    + Add clip
                  </button>
                </div>
              );
            })}
            <datalist id="animation-lab-clip-list">
              {fileClipNames.map((clip) => (
                <option key={clip} value={clip} />
              ))}
            </datalist>
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

  const buildRegistrySpecs = useCallback(() => {
    const next: Partial<Record<UnitKey, EditableSpec>> = {};
    (Object.entries(UNIT_ANIMATION_REGISTRY) as Array<[UnitKey, UnitAnimationSpec | undefined]>).forEach(
      ([key, spec]) => {
        if (!spec) return;
        next[key] = toEditableSpec(spec);
      }
    );
    return next;
  }, []);

  const buildInitialSpecs = useCallback(() => {
    const next: Partial<Record<UnitKey, EditableSpec>> = {};
    (Object.keys(UNIT_ANIMATION_REGISTRY) as UnitKey[]).forEach((key) => {
      const spec = getUnitAnimationSpec(key as any);
      if (!spec) return;
      next[key] = toEditableSpec(spec);
    });
    return next;
  }, []);

  const [editableSpecs, setEditableSpecs] = useState<Partial<Record<UnitKey, EditableSpec>>>(buildInitialSpecs);
  const [dirtyUnits, setDirtyUnits] = useState<Set<UnitKey>>(() => {
    const overrides = getUnitAnimationOverrides();
    return new Set(Object.keys(overrides) as UnitKey[]);
  });
  const [selectedUnit, setSelectedUnit] = useState<UnitKey | null>(
    animatedUnits.length ? animatedUnits[0] : null
  );
  const [selectedClip, setSelectedClip] = useState<string | null>(null);
  const [loop, setLoop] = useState(true);
  const [persisted, setPersisted] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "auto";
    document.documentElement.style.overflow = "auto";
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, []);

  const unitSpec = selectedUnit ? editableSpecs[selectedUnit] : undefined;
  const modelPath = unitSpec?.animatedModelPath ?? null;

  const markDirty = useCallback((unit: UnitKey) => {
    setDirtyUnits((prev) => {
      if (prev.has(unit)) return prev;
      const next = new Set(prev);
      next.add(unit);
      return next;
    });
  }, []);

  const clearDirty = useCallback((unit: UnitKey) => {
    setDirtyUnits((prev) => {
      if (!prev.has(unit)) return prev;
      const next = new Set(prev);
      next.delete(unit);
      return next;
    });
  }, []);

  useEffect(() => {
    const overrides: Partial<Record<UnitKey, Partial<UnitAnimationSpec>>> = {};
    dirtyUnits.forEach((unitKey) => {
      const spec = editableSpecs[unitKey];
      if (!spec) return;
      overrides[unitKey] = toOverrideSpec(spec);
    });
    setUnitAnimationOverrides(overrides);
    if (typeof window !== "undefined") {
      if (Object.keys(overrides).length === 0) {
        window.localStorage.removeItem("animationLabOverrides");
      } else {
        window.localStorage.setItem("animationLabOverrides", JSON.stringify(overrides));
      }
      setPersisted(true);
      const timer = window.setTimeout(() => setPersisted(false), 1200);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [dirtyUnits, editableSpecs]);

  const handleUpdateClip = useCallback(
    (state: UnitAnimationState, index: number, updates: Partial<EditableClip>) => {
      if (!selectedUnit) return;
      setEditableSpecs((prev) => {
        const spec = prev[selectedUnit];
        if (!spec) return prev;
        const nextClips = [...spec.clips[state]];
        const current = nextClips[index];
        if (!current) return prev;
        nextClips[index] = { ...current, ...updates };
        return {
          ...prev,
          [selectedUnit]: {
            ...spec,
            clips: { ...spec.clips, [state]: nextClips },
          },
        };
      });
      markDirty(selectedUnit);
    },
    [selectedUnit, markDirty]
  );

  const handleRemoveClip = useCallback(
    (state: UnitAnimationState, index: number) => {
      if (!selectedUnit) return;
      setEditableSpecs((prev) => {
        const spec = prev[selectedUnit];
        if (!spec) return prev;
        const nextClips = spec.clips[state].filter((_, idx) => idx !== index);
        return {
          ...prev,
          [selectedUnit]: {
            ...spec,
            clips: { ...spec.clips, [state]: nextClips },
          },
        };
      });
      markDirty(selectedUnit);
    },
    [selectedUnit, markDirty]
  );

  const handleAddClip = useCallback(
    (state: UnitAnimationState) => {
      if (!selectedUnit) return;
      setEditableSpecs((prev) => {
        const spec = prev[selectedUnit];
        if (!spec) return prev;
        const name = selectedClip ?? "";
        const nextClips = [...spec.clips[state], { name, weight: 1 }];
        return {
          ...prev,
          [selectedUnit]: {
            ...spec,
            clips: { ...spec.clips, [state]: nextClips },
          },
        };
      });
      markDirty(selectedUnit);
    },
    [selectedUnit, selectedClip, markDirty]
  );

  const handleMoveClip = useCallback(
    (state: UnitAnimationState, index: number, nextState: UnitAnimationState) => {
      if (!selectedUnit || state === nextState) return;
      setEditableSpecs((prev) => {
        const spec = prev[selectedUnit];
        if (!spec) return prev;
        const clip = spec.clips[state][index];
        if (!clip) return prev;
        const nextFrom = spec.clips[state].filter((_, idx) => idx !== index);
        const nextTo = [...spec.clips[nextState], clip];
        return {
          ...prev,
          [selectedUnit]: {
            ...spec,
            clips: { ...spec.clips, [state]: nextFrom, [nextState]: nextTo },
          },
        };
      });
      markDirty(selectedUnit);
    },
    [selectedUnit, markDirty]
  );

  const handleResetUnit = useCallback(() => {
    if (!selectedUnit) return;
    const baseSpec = UNIT_ANIMATION_REGISTRY[selectedUnit];
    if (!baseSpec) return;
    setEditableSpecs((prev) => ({ ...prev, [selectedUnit]: toEditableSpec(baseSpec) }));
    clearDirty(selectedUnit);
  }, [selectedUnit, clearDirty]);

  const handleClearOverrides = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem("animationLabOverrides");
    clearUnitAnimationOverrides();
    setEditableSpecs(buildRegistrySpecs());
    setDirtyUnits(new Set());
  }, [buildRegistrySpecs]);

  useEffect(() => {
    document.body.style.overflow = 'auto';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6 pb-16">
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

        {selectedUnit && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
            <button
              onClick={handleResetUnit}
              className="rounded border border-slate-600 px-3 py-1 hover:border-amber-300"
            >
              Reset this unit
            </button>
            <button
              onClick={handleClearOverrides}
              className="rounded border border-slate-600 px-3 py-1 text-red-300 hover:border-red-300"
            >
              Clear live overrides
            </button>
            {persisted && <span className="text-amber-300">Applied.</span>}
            <span className="text-slate-500">
              Edits apply instantly to the game and persist in this browser.
            </span>
            <span className="text-slate-500">
              Reset this unit = discard edits for the selected unit only. Clear live overrides = discard edits for all units.
            </span>
          </div>
        )}

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
              onUpdateClip={handleUpdateClip}
              onRemoveClip={handleRemoveClip}
              onAddClip={handleAddClip}
              onMoveClip={handleMoveClip}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
