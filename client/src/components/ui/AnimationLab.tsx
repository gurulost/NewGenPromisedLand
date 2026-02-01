import { Suspense, useMemo, useRef, useState, useEffect, useCallback, useLayoutEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF, useAnimations } from "@react-three/drei";
import * as THREE from "three";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
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
import { useUnitAnimationRegistryVersion } from "../../hooks/useUnitAnimationRegistryVersion";

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

type EditableClip = { name: string; weight: number; label?: string };
type EditableSpec = {
  animatedModelPath?: string;
  clips: Record<UnitAnimationState, EditableClip[]>;
  moveSpeedTilesPerSec?: number;
  yawOffset?: number;
};

type ExportSpec = {
  animatedModelPath?: string;
  clips: Partial<Record<UnitAnimationState, EditableClip[]>>;
  moveSpeedTilesPerSec?: number;
  yawOffset?: number;
  eventDurationsMs?: Partial<Record<UnitAnimationState, number>>;
  clipDurationsMs?: Record<string, number>;
};

const toEditableClip = (entry: ClipEntry): EditableClip => {
  if (typeof entry === "string") {
    return { name: entry, weight: 1 };
  }
  return { name: entry.name, weight: entry.weight ?? 1, label: entry.label };
};

const normalizeClipList = (entries?: ClipEntry | ClipEntry[]): EditableClip[] => {
  if (!entries) return [];
  const list = Array.isArray(entries) ? entries : [entries];
  return list.map(toEditableClip);
};

const escapeTsString = (value: string) => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

const formatClipEntry = (entry: EditableClip): string => {
  const name = escapeTsString(entry.name);
  const hasLabel = typeof entry.label === "string" && entry.label.trim().length > 0;
  const weight = Number.isFinite(entry.weight) ? entry.weight : 1;
  if (!hasLabel && weight === 1) return `"${name}"`;
  const parts = [`name: "${name}"`];
  if (weight !== 1) parts.push(`weight: ${weight}`);
  if (hasLabel) parts.push(`label: "${escapeTsString(entry.label!.trim())}"`);
  return `{ ${parts.join(", ")} }`;
};

const indent = (level: number) => "  ".repeat(level);

const formatClipList = (entries: EditableClip[], level: number): string => {
  if (!entries.length) return "[]";
  const itemIndent = indent(level);
  const closingIndent = indent(level - 1);
  const lines = entries.map((entry) => `${itemIndent}${formatClipEntry(entry)},`);
  return `[\n${lines.join("\n")}\n${closingIndent}]`;
};

const formatNumberRecord = (record: Record<string, number> | undefined, level: number): string | null => {
  if (!record) return null;
  const keys = Object.keys(record);
  if (!keys.length) return null;
  const itemIndent = indent(level);
  const closingIndent = indent(level - 1);
  const lines = keys
    .sort((a, b) => a.localeCompare(b))
    .map((key) => `${itemIndent}"${escapeTsString(key)}": ${record[key]},`);
  return `{\n${lines.join("\n")}\n${closingIndent}}`;
};

const buildExportSpec = (unitKey: UnitKey, editableSpec: EditableSpec | undefined): ExportSpec | null => {
  const base = UNIT_ANIMATION_REGISTRY[unitKey];
  if (!base && !editableSpec) return null;
  const clips: Partial<Record<UnitAnimationState, EditableClip[]>> = {};
  ANIMATION_STATES.forEach((state) => {
    const currentList = editableSpec?.clips?.[state]
      ?? normalizeClipList(base?.clips?.[state]);
    const baseHasClips = base?.clips?.[state] !== undefined;
    if (currentList.length > 0 || baseHasClips) {
      clips[state] = currentList;
    }
  });
  return {
    animatedModelPath: editableSpec?.animatedModelPath ?? base?.animatedModelPath,
    clips,
    moveSpeedTilesPerSec: editableSpec?.moveSpeedTilesPerSec ?? base?.moveSpeedTilesPerSec,
    yawOffset: editableSpec?.yawOffset ?? base?.yawOffset,
    eventDurationsMs: base?.eventDurationsMs,
    clipDurationsMs: base?.clipDurationsMs,
  };
};

const formatExportSpec = (spec: ExportSpec, level: number): string => {
  const propIndent = indent(level);
  const closingIndent = indent(level - 1);
  const lines: string[] = [];
  if (spec.animatedModelPath) {
    lines.push(`${propIndent}animatedModelPath: "${escapeTsString(spec.animatedModelPath)}",`);
  }
  lines.push(`${propIndent}clips: {`);
  ANIMATION_STATES.forEach((state) => {
    const list = spec.clips?.[state];
    if (!list) return;
    lines.push(`${propIndent}  ${state}: ${formatClipList(list, level + 2)},`);
  });
  lines.push(`${propIndent}},`);
  if (spec.moveSpeedTilesPerSec !== undefined) {
    lines.push(`${propIndent}moveSpeedTilesPerSec: ${spec.moveSpeedTilesPerSec},`);
  }
  if (spec.yawOffset !== undefined) {
    lines.push(`${propIndent}yawOffset: ${spec.yawOffset},`);
  }
  const eventDurations = formatNumberRecord(spec.eventDurationsMs as Record<string, number> | undefined, level + 1);
  if (eventDurations) {
    lines.push(`${propIndent}eventDurationsMs: ${eventDurations},`);
  }
  const clipDurations = formatNumberRecord(spec.clipDurationsMs, level + 1);
  if (clipDurations) {
    lines.push(`${propIndent}clipDurationsMs: ${clipDurations},`);
  }
  return `{\n${lines.join("\n")}\n${closingIndent}}`;
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
    clips[state] = list.map((entry) => ({
      name: entry.name,
      weight: entry.weight,
      label: entry.label,
    }));
  });
  return { clips };
};

function AnimationStage({
  scene,
  animations,
  clipName,
  loop,
  playNonce,
  playbackRate,
  frameNonce,
  zoomScale,
  targetOffset,
}: {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  clipName: string | null;
  loop: boolean;
  playNonce: number;
  playbackRate: number;
  frameNonce: number;
  zoomScale: number;
  targetOffset: { x: number; y: number };
}) {
  const safeTargetOffset = targetOffset ?? { x: 0, y: 0 };
  const groupRef = useRef<THREE.Group>(null);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera, size } = useThree();
  const framedScene = useMemo(() => {
    const clone = SkeletonUtils.clone(scene);
    clone.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(clone);
    const bounds = new THREE.Vector3();
    if (!box.isEmpty()) {
      box.getSize(bounds);
      const center = new THREE.Vector3();
      box.getCenter(center);
      clone.position.set(-center.x, -box.min.y, -center.z);
    } else {
      bounds.set(1, 1, 1);
      clone.position.set(0, 0, 0);
    }
    return { clone, bounds };
  }, [scene]);
  const { actions } = useAnimations(animations, groupRef);
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);

  const fit = useMemo(() => {
    const bounds = framedScene.bounds;
    const height = Math.max(bounds.y, 0.0001);
    const width = Math.max(bounds.x, 0.0001);
    const vFov = THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov ?? 40);
    const aspect = (camera as THREE.PerspectiveCamera).aspect || size.width / Math.max(size.height, 1);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const paddedHeight = height * 1.3;
    const paddedWidth = width * 1.25;
    const distanceForHeight = (paddedHeight / 2) / Math.tan(vFov / 2);
    const distanceForWidth = (paddedWidth / 2) / Math.tan(hFov / 2);
    const distance = Math.max(distanceForHeight, distanceForWidth) * zoomScale;
    const viewHeight = 2 * distance * Math.tan(vFov / 2);
    const targetY = viewHeight / 2;
    return { distance, targetY };
  }, [framedScene.bounds, camera, size.width, size.height, zoomScale]);

  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const targetX = safeTargetOffset.x;
    const targetY = fit.targetY + safeTargetOffset.y;
    cam.position.set(targetX, targetY, fit.distance);
    cam.near = Math.max(0.01, fit.distance / 100);
    cam.far = Math.max(100, fit.distance * 30);
    cam.updateProjectionMatrix();
    cam.lookAt(targetX, targetY, 0);
    if (controlsRef.current) {
      controlsRef.current.target.set(targetX, targetY, 0);
      controlsRef.current.minDistance = Math.max(0.1, fit.distance * 0.6);
      controlsRef.current.maxDistance = Infinity;
      controlsRef.current.update();
    }
  }, [camera, fit, frameNonce, safeTargetOffset.x, safeTargetOffset.y]);

  useEffect(() => {
    if (!actions) return;
    Object.values(actions).forEach((action) => action?.stop?.());
    if (!clipName) return;
    const nextAction = actions[clipName];
    if (!nextAction) return;

    nextAction.reset();
    nextAction.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    nextAction.clampWhenFinished = !loop;
    nextAction.setEffectiveTimeScale(playbackRate);
    nextAction.fadeIn(0.15).play();
    currentActionRef.current = nextAction;
    return () => {
      nextAction.fadeOut(0.1);
    };
  }, [actions, clipName, loop, playNonce, playbackRate]);

  useEffect(() => {
    if (!currentActionRef.current) return;
    currentActionRef.current.setEffectiveTimeScale(playbackRate);
  }, [playbackRate]);

  return (
    <>
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom={false}
        enableDamping
        dampingFactor={0.08}
      />
      <group ref={groupRef}>
        <primitive object={framedScene.clone} />
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[4, 64]} />
        <meshBasicMaterial color="#0b1220" transparent opacity={0.55} />
      </mesh>
      <gridHelper args={[8, 16, "#1f2937", "#111827"]} position={[0, 0.001, 0]} />
    </>
  );
}

function AnimationInspector({
  unitSpec,
  modelPath,
  selectedClip,
  onPlayClip,
  onReplay,
  playNonce,
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
  onPlayClip: (clip: string | null) => void;
  onReplay: () => void;
  playNonce: number;
  loop: boolean;
  setLoop: (value: boolean) => void;
  onUpdateClip: (state: UnitAnimationState, index: number, updates: Partial<EditableClip>) => void;
  onRemoveClip: (state: UnitAnimationState, index: number) => void;
  onAddClip: (state: UnitAnimationState, name: string) => void;
  onMoveClip: (state: UnitAnimationState, index: number, nextState: UnitAnimationState) => void;
}) {
  const { scene, animations } = useGLTF(modelPath);
  const [clipFilter, setClipFilter] = useState("");
  const [showUnmappedOnly, setShowUnmappedOnly] = useState(false);
  const [quickAssignState, setQuickAssignState] = useState<UnitAnimationState>("idle");
  const [playbackRate, setPlaybackRate] = useState(1);
  const [frameNonce, setFrameNonce] = useState(0);
  const [zoomScale, setZoomScale] = useState(1.6);
  const [targetOffset, setTargetOffset] = useState({ x: 0, y: 0 });
  const [nudgeStep, setNudgeStep] = useState(0.25);
  const zoomHoldRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clipDurations = useMemo(() => {
    return new Map(animations.map((clip) => [clip.name, clip.duration]));
  }, [animations]);

  const stopZoomHold = useCallback(() => {
    if (zoomHoldRef.current) {
      clearInterval(zoomHoldRef.current);
      zoomHoldRef.current = null;
    }
  }, []);

  const startZoomInHold = useCallback(() => {
    stopZoomHold();
    zoomHoldRef.current = setInterval(() => {
      setZoomScale((value) => Math.max(0.2, value - 0.2));
    }, 80);
  }, [stopZoomHold]);

  const startZoomOutHold = useCallback(() => {
    stopZoomHold();
    zoomHoldRef.current = setInterval(() => {
      setZoomScale((value) => value + 0.2);
    }, 80);
  }, [stopZoomHold]);

  useEffect(() => {
    return () => {
      stopZoomHold();
    };
  }, [stopZoomHold]);

  const registryClipNames = useMemo(() => {
    const names = new Set<string>();
    ANIMATION_STATES.forEach((state) => {
      unitSpec?.clips?.[state]?.forEach((clip) => names.add(clip.name));
    });
    return names;
  }, [unitSpec]);

  const fileClipNames = useMemo(() => animations.map((clip) => clip.name).sort(), [animations]);
  const fileClipSet = useMemo(() => new Set(fileClipNames), [fileClipNames]);
  const hasAnimations = animations.length > 0;
  const selectedClipExists = !!selectedClip && fileClipSet.has(selectedClip);
  const missingAssignedClips = useMemo(() => {
    const missing = new Set<string>();
    ANIMATION_STATES.forEach((state) => {
      unitSpec?.clips?.[state]?.forEach((clip) => {
        if (!fileClipSet.has(clip.name)) missing.add(clip.name);
      });
    });
    return missing;
  }, [unitSpec, fileClipSet]);
  const filteredClipNames = useMemo(() => {
    const term = clipFilter.trim().toLowerCase();
    return fileClipNames.filter((clip) => {
      if (showUnmappedOnly && registryClipNames.has(clip)) return false;
      if (!term) return true;
      return clip.toLowerCase().includes(term);
    });
  }, [fileClipNames, clipFilter, showUnmappedOnly, registryClipNames]);
  const preferredInitialClip = useMemo(() => {
    for (const state of ANIMATION_STATES) {
      const list = unitSpec?.clips?.[state] ?? [];
      for (const entry of list) {
        if (fileClipSet.has(entry.name)) return entry.name;
      }
    }
    return fileClipNames[0] ?? null;
  }, [unitSpec, fileClipSet, fileClipNames]);

  useEffect(() => {
    if (!hasAnimations) {
      if (selectedClip) onPlayClip(null);
      return;
    }
    if (!selectedClip || !fileClipSet.has(selectedClip)) {
      if (preferredInitialClip) {
        onPlayClip(preferredInitialClip);
      }
    }
  }, [selectedClip, fileClipSet, preferredInitialClip, hasAnimations, onPlayClip]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <div className="text-sm text-slate-400">Preview</div>
            <div className="text-base font-medium">{modelPath}</div>
            <div className="mt-1 text-xs text-slate-400">
              Clips: {fileClipNames.length} · Mapped: {registryClipNames.size} · Missing: {missingAssignedClips.size}
            </div>
          </div>
          <div className="text-xs text-slate-500">
            Footing aligned to floor · Auto framed
          </div>
        </div>
        {!hasAnimations && (
          <div className="mb-3 rounded border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
            No animation clips found in this file. Make sure the GLB contains animation tracks.
          </div>
        )}
        {selectedClip && !selectedClipExists && (
          <div className="mb-3 rounded border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">
            Selected clip is not present in this file. Pick another clip to preview.
          </div>
        )}
        <div className="h-[420px] rounded-md overflow-hidden border border-slate-700">
          <ErrorBoundary fallback={
            <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-300 text-sm">
              WebGL is required for animation preview. Please use a browser with WebGL support.
            </div>
          }>
            <Canvas camera={{ position: [0, 2, 6], fov: 35 }}>
              <color attach="background" args={["#0b1220"]} />
              <hemisphereLight intensity={0.5} groundColor="#0b1020" color="#dbeafe" />
              <directionalLight position={[5, 8, 6]} intensity={2.2} />
              <directionalLight position={[-6, 6, -4]} intensity={1.2} />
              <Suspense fallback={null}>
                <AnimationStage
                  scene={scene}
                  animations={animations}
                  clipName={selectedClip}
                  loop={loop}
                  playNonce={playNonce}
                  playbackRate={playbackRate}
                  frameNonce={frameNonce}
                  zoomScale={zoomScale}
                  targetOffset={targetOffset}
                />
              </Suspense>
            </Canvas>
          </ErrorBoundary>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
          <div>
            Selected clip: <span className="text-slate-200">{selectedClip ?? "None"}</span>
          </div>
          <div className="text-xs text-slate-500">
            Playback: {playbackRate.toFixed(2)}x
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <button
            onClick={() => {
              setZoomScale(1.6);
              setTargetOffset({ x: 0, y: 0 });
              setFrameNonce((value) => value + 1);
            }}
            className="px-3 py-1 rounded border border-slate-600 text-slate-200 hover:border-amber-300"
          >
            Reset view
          </button>
          <button
            onClick={() => {
              setZoomScale((value) => value + 0.4);
              setFrameNonce((value) => value + 1);
            }}
            onMouseDown={startZoomOutHold}
            onMouseUp={stopZoomHold}
            onMouseLeave={stopZoomHold}
            onTouchStart={startZoomOutHold}
            onTouchEnd={stopZoomHold}
            onTouchCancel={stopZoomHold}
            className="px-3 py-1 rounded border border-slate-600 text-slate-200 hover:border-amber-300"
          >
            Zoom out
          </button>
          <button
            onClick={() => {
              setZoomScale((value) => Math.max(0.2, value - 0.4));
              setFrameNonce((value) => value + 1);
            }}
            onMouseDown={startZoomInHold}
            onMouseUp={stopZoomHold}
            onMouseLeave={stopZoomHold}
            onTouchStart={startZoomInHold}
            onTouchEnd={stopZoomHold}
            onTouchCancel={stopZoomHold}
            className="px-3 py-1 rounded border border-slate-600 text-slate-200 hover:border-amber-300"
          >
            Zoom in
          </button>
          <button
            onClick={onReplay}
            disabled={!selectedClipExists}
            className="px-3 py-1 rounded border border-slate-600 text-slate-200 hover:border-amber-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Replay
          </button>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={loop}
              onChange={(event) => setLoop(event.target.checked)}
              className="accent-amber-400"
            />
            Loop
          </label>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Speed</span>
            <input
              type="range"
              min="0.25"
              max="2"
              step="0.05"
              value={playbackRate}
              onChange={(event) => setPlaybackRate(Number(event.target.value))}
              className="accent-amber-400"
            />
            <span className="text-slate-300">{playbackRate.toFixed(2)}x</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Zoom</span>
            <input
              type="range"
              min="0.2"
              max="10"
              step="0.05"
              value={zoomScale}
              onChange={(event) => setZoomScale(Number(event.target.value))}
              className="accent-amber-400"
            />
            <span className="text-slate-300">{zoomScale.toFixed(2)}x</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Nudge</span>
            <input
              type="range"
              min="0.05"
              max="2"
              step="0.05"
              value={nudgeStep}
              onChange={(event) => setNudgeStep(Number(event.target.value))}
              className="accent-amber-400"
            />
            <span className="text-slate-300">{nudgeStep.toFixed(2)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setTargetOffset((prev) => ({ ...prev, y: prev.y + nudgeStep }))}
              className="px-2 py-1 rounded border border-slate-600 text-xs text-slate-200 hover:border-amber-300"
            >
              Up
            </button>
            <button
              onClick={() => setTargetOffset((prev) => ({ ...prev, y: prev.y - nudgeStep }))}
              className="px-2 py-1 rounded border border-slate-600 text-xs text-slate-200 hover:border-amber-300"
            >
              Down
            </button>
            <button
              onClick={() => setTargetOffset((prev) => ({ ...prev, x: prev.x - nudgeStep }))}
              className="px-2 py-1 rounded border border-slate-600 text-xs text-slate-200 hover:border-amber-300"
            >
              Left
            </button>
            <button
              onClick={() => setTargetOffset((prev) => ({ ...prev, x: prev.x + nudgeStep }))}
              className="px-2 py-1 rounded border border-slate-600 text-xs text-slate-200 hover:border-amber-300"
            >
              Right
            </button>
            <button
              onClick={() => setTargetOffset({ x: 0, y: 0 })}
              className="px-2 py-1 rounded border border-slate-600 text-xs text-slate-200 hover:border-amber-300"
            >
              Center
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-4">
          <h2 className="text-sm uppercase tracking-wide text-slate-400">Registry Mapping</h2>
          <p className="mt-2 text-xs text-slate-500">
            Pick a source clip from the GLB list. Use Label for your friendly name.
          </p>
          <div className="mt-3 rounded border border-slate-700 bg-slate-900/60 p-3">
            <div className="text-xs text-slate-400">Quick assign selected clip</div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <div className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-slate-200">
                {selectedClip ?? "None selected"}
              </div>
              <select
                value={quickAssignState}
                onChange={(event) => setQuickAssignState(event.target.value as UnitAnimationState)}
                className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-100"
              >
                {ANIMATION_STATES.map((option) => (
                  <option key={option} value={option}>
                    {formatStateLabel(option)}
                  </option>
                ))}
              </select>
              <button
                onClick={() => selectedClip && onAddClip(quickAssignState, selectedClip)}
                disabled={!selectedClipExists}
                className="px-2 py-1 rounded border border-slate-600 text-slate-200 hover:border-amber-300 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Add to state
              </button>
            </div>
          </div>
          <div className="mt-3 space-y-3">
            {ANIMATION_STATES.map((state) => {
              const list = unitSpec?.clips?.[state] ?? [];
              const validCount = list.filter((entry) => fileClipSet.has(entry.name)).length;
              const missingCount = list.length - validCount;
              return (
                <div key={state}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-amber-300">
                      {formatStateLabel(state)}
                    </div>
                    <div className="text-xs text-slate-400">
                      Assigned: {list.length} · Missing: {missingCount}
                    </div>
                  </div>
                  {list.length === 0 ? (
                    <div className="mt-2 text-xs text-slate-500">No clips assigned.</div>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {list.map((entry, index) => {
                        const exists = clipDurations.has(entry.name);
                        return (
                          <div key={`${state}-${index}`} className="flex flex-wrap items-center gap-2">
                            <select
                              value={entry.name}
                              onChange={(event) => {
                                const nextName = event.target.value;
                                if (selectedClip === entry.name) {
                                  onPlayClip(nextName);
                                }
                                onUpdateClip(state, index, { name: nextName });
                              }}
                              className="w-52 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                            >
                              {!fileClipNames.includes(entry.name) && (
                                <option value={entry.name}>
                                  Missing: {entry.name}
                                </option>
                              )}
                              {fileClipNames.map((clip) => (
                                <option key={clip} value={clip}>
                                  {clip}
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              value={entry.label ?? ""}
                              onChange={(event) =>
                                onUpdateClip(state, index, { label: event.target.value || undefined })
                              }
                              className="w-40 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                              placeholder="Label (optional)"
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
                              onClick={() => onPlayClip(entry.name)}
                              className="px-2 py-1 rounded border border-slate-600 text-xs text-slate-200 hover:border-amber-300"
                            >
                              Play {entry.label ?? entry.name}
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
                    onClick={() => selectedClip && onAddClip(state, selectedClip)}
                    disabled={!selectedClipExists}
                    className="mt-2 inline-flex items-center gap-1 rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:border-amber-300 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    + Add selected
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-4">
          <h2 className="text-sm uppercase tracking-wide text-slate-400">All Clips in File</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <input
              type="text"
              value={clipFilter}
              onChange={(event) => setClipFilter(event.target.value)}
              placeholder="Filter clips..."
              className="min-w-[180px] flex-1 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-100"
            />
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={showUnmappedOnly}
                onChange={(event) => setShowUnmappedOnly(event.target.checked)}
                className="accent-amber-400"
              />
              Unmapped only
            </label>
            <div className="text-xs text-slate-500">
              Showing {filteredClipNames.length} of {fileClipNames.length}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {filteredClipNames.map((clip) => {
              const duration = clipDurations.get(clip);
              const inRegistry = registryClipNames.has(clip);
              return (
                <button
                  key={clip}
                  onClick={() => onPlayClip(clip)}
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
            {filteredClipNames.length === 0 && (
              <div className="text-xs text-slate-500">No clips match the current filter.</div>
            )}
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
  const registryVersion = useUnitAnimationRegistryVersion();
  const [selectedUnit, setSelectedUnit] = useState<UnitKey | null>(
    animatedUnits.length ? animatedUnits[0] : null
  );
  const [selectedClip, setSelectedClip] = useState<string | null>(null);
  const [playNonce, setPlayNonce] = useState(0);
  const [loop, setLoop] = useState(true);
  const [persisted, setPersisted] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportMode, setExportMode] = useState<"dirty" | "all">("dirty");
  const [exportCopied, setExportCopied] = useState(false);
  const [modelStatus, setModelStatus] = useState<"idle" | "checking" | "ok" | "missing">("idle");
  const [modelCheckNonce, setModelCheckNonce] = useState(0);

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
  const exportText = useMemo(() => {
    const keys = exportMode === "all"
      ? animatedUnits
      : Array.from(dirtyUnits);
    if (!keys.length) {
      return "// No units selected for export.";
    }
    const timestamp = new Date().toISOString();
    const lines: string[] = [];
    lines.push(`// Animation Lab export: ${timestamp}`);
    lines.push("export const ANIMATION_LAB_EXPORT = {");
    keys.forEach((unitKey) => {
      const spec = buildExportSpec(unitKey, editableSpecs[unitKey]);
      if (!spec) return;
      lines.push(`${indent(1)}${unitKey}: ${formatExportSpec(spec, 2)},`);
    });
    lines.push("} as const;");
    lines.push("");
    lines.push("// Paste each unit block into UNIT_ANIMATION_REGISTRY in client/src/utils/unitAnimationRegistry.ts");
    return lines.join("\n");
  }, [exportMode, animatedUnits, dirtyUnits, editableSpecs]);
  const copyExportText = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      setExportCopied(true);
      window.setTimeout(() => setExportCopied(false), 1400);
    } catch {
      setExportCopied(false);
    }
  }, [exportText]);
  const playClip = useCallback((clip: string | null) => {
    setSelectedClip(clip);
    if (clip) {
      setPlayNonce((value) => value + 1);
    }
  }, []);
  const replayClip = useCallback(() => {
    if (!selectedClip) return;
    setPlayNonce((value) => value + 1);
  }, [selectedClip]);

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

  useEffect(() => {
    let cancelled = false;
    if (!modelPath) {
      setModelStatus("idle");
      return () => {
        cancelled = true;
      };
    }
    setModelStatus("checking");
    const check = async () => {
      try {
        const range = await fetch(modelPath, { headers: { Range: "bytes=0-3" } });
        if (cancelled) return;
        if (!range.ok) {
          setModelStatus("missing");
          return;
        }
        const buffer = await range.arrayBuffer();
        if (cancelled) return;
        const bytes = new Uint8Array(buffer);
        const header = String.fromCharCode(bytes[0] ?? 0, bytes[1] ?? 0, bytes[2] ?? 0, bytes[3] ?? 0);
        if (header !== "glTF") {
          setModelStatus("missing");
          return;
        }
        setModelStatus("ok");
      } catch {
        if (!cancelled) setModelStatus("missing");
      }
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, [modelPath, modelCheckNonce]);

  useEffect(() => {
    const fresh = buildInitialSpecs();
    setEditableSpecs((prev) => {
      const next = { ...prev };
      (Object.keys(fresh) as UnitKey[]).forEach((key) => {
        if (dirtyUnits.has(key)) return;
        const spec = fresh[key];
        if (spec) next[key] = spec;
      });
      return next;
    });
  }, [registryVersion, buildInitialSpecs, dirtyUnits]);

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
    (state: UnitAnimationState, name: string) => {
      if (!selectedUnit) return;
      setEditableSpecs((prev) => {
        const spec = prev[selectedUnit];
        if (!spec) return prev;
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
    [selectedUnit, markDirty]
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
    <div className="min-h-screen bg-slate-900 text-slate-100 overflow-y-auto">
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
            <button
              onClick={() => setExportOpen((value) => !value)}
              className="rounded border border-slate-600 px-3 py-1 text-amber-200 hover:border-amber-300"
            >
              Export mapping to registry
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

        {exportOpen && (
          <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-4 text-sm text-slate-300 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-amber-300">Export Mapping to Registry</div>
                <div className="text-xs text-slate-400">
                  This creates a copy-ready snippet you can paste into `client/src/utils/unitAnimationRegistry.ts`.
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="exportMode"
                    value="dirty"
                    checked={exportMode === "dirty"}
                    onChange={() => setExportMode("dirty")}
                    className="accent-amber-400"
                  />
                  Dirty units only
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="exportMode"
                    value="all"
                    checked={exportMode === "all"}
                    onChange={() => setExportMode("all")}
                    className="accent-amber-400"
                  />
                  All animated units
                </label>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={copyExportText}
                className="px-3 py-1 rounded border border-slate-600 text-slate-200 hover:border-amber-300"
              >
                Copy export
              </button>
              {exportCopied && <span className="text-amber-300 text-xs">Copied.</span>}
            </div>
            <textarea
              value={exportText}
              readOnly
              className="w-full min-h-[220px] rounded border border-slate-700 bg-slate-900 p-3 text-xs text-slate-100 font-mono"
            />
            <div className="text-xs text-slate-500">
              Paste each unit block into `UNIT_ANIMATION_REGISTRY` and remove the `ANIMATION_LAB_EXPORT` wrapper.
            </div>
          </div>
        )}

        {!modelPath ? (
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 text-sm text-slate-300">
            Select a unit with an animated model to continue.
          </div>
        ) : modelStatus === "missing" ? (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200 space-y-2">
            <div className="font-semibold">Animated model not found.</div>
            <div className="text-xs text-red-100/80">
              Could not fetch <span className="font-mono">{modelPath}</span>. Ensure the file exists in
              <span className="font-mono"> client/public/models</span> and is available to the dev server.
            </div>
            <button
              onClick={() => setModelCheckNonce((value) => value + 1)}
              className="px-3 py-1 rounded border border-red-400/60 text-red-100 hover:border-red-300"
            >
              Retry check
            </button>
          </div>
        ) : modelStatus === "checking" ? (
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 text-sm text-slate-300">
            Checking model availability…
          </div>
        ) : (
          <ErrorBoundary fallback={
            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 text-sm text-slate-300">
              Failed to load animation data for <span className="font-mono">{modelPath}</span>. Check the model path and GLB file.
            </div>
          }>
            <Suspense fallback={null}>
              <AnimationInspector
                unitSpec={unitSpec}
                modelPath={modelPath}
                selectedClip={selectedClip}
                onPlayClip={playClip}
                onReplay={replayClip}
                playNonce={playNonce}
                loop={loop}
                setLoop={setLoop}
                onUpdateClip={handleUpdateClip}
                onRemoveClip={handleRemoveClip}
                onAddClip={handleAddClip}
                onMoveClip={handleMoveClip}
              />
            </Suspense>
          </ErrorBoundary>
        )}
      </div>
    </div>
  );
}
