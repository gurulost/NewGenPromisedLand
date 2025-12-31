import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { create } from 'zustand';
import { hexToWorldPos } from '../../lib/stores/useMapToasts';
import { pushCapped, enforceCapAndTTL, MEMORY_LIMITS } from '../../lib/memoryUtils';

export type MapPulseType = 'capture' | 'conversion' | 'construction' | 'unit' | 'tech' | 'levelup';

interface MapPulseEvent {
  id: string;
  position: { x: number; y: number; z: number };
  type: MapPulseType;
  startTime: number;
}

interface MapPulseProps {
  event: MapPulseEvent;
  onComplete: () => void;
}

const PULSE_CONFIG: Record<MapPulseType, { color: string; duration: number; startScale: number; endScale: number; maxOpacity: number }> = {
  capture: { color: '#fb923c', duration: 1100, startScale: 0.9, endScale: 2.9, maxOpacity: 0.7 },
  conversion: { color: '#60a5fa', duration: 1100, startScale: 0.9, endScale: 2.6, maxOpacity: 0.6 },
  construction: { color: '#fbbf24', duration: 900, startScale: 0.8, endScale: 2.0, maxOpacity: 0.55 },
  unit: { color: '#a78bfa', duration: 900, startScale: 0.8, endScale: 1.9, maxOpacity: 0.5 },
  tech: { color: '#22d3ee', duration: 1200, startScale: 1.0, endScale: 2.4, maxOpacity: 0.6 },
  levelup: { color: '#fde68a', duration: 1000, startScale: 0.9, endScale: 2.2, maxOpacity: 0.65 },
};

function MapPulse({ event, onComplete }: MapPulseProps) {
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const outerRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const startTime = useRef(Date.now());

  const config = PULSE_CONFIG[event.type];

  const color = useMemo(() => new THREE.Color(config.color), [config.color]);

  useFrame(() => {
    const elapsed = Date.now() - startTime.current;
    const progress = elapsed / config.duration;

    if (progress >= 1) {
      onComplete();
      return;
    }

    const eased = 1 - Math.pow(1 - progress, 3);
    const scale = config.startScale + (config.endScale - config.startScale) * eased;
    const opacity = config.maxOpacity * (1 - progress);

    if (groupRef.current) {
      groupRef.current.rotation.z = progress * Math.PI * 0.6;
    }
    if (innerRef.current) {
      innerRef.current.scale.setScalar(scale * 0.9);
      const material = innerRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = opacity;
    }
    if (outerRef.current) {
      outerRef.current.scale.setScalar(scale * 1.1);
      const material = outerRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = opacity * 0.7;
    }
    if (glowRef.current) {
      glowRef.current.scale.setScalar(scale * 0.6);
      const material = glowRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = opacity * 0.4;
    }
  });

  return (
    <group ref={groupRef} position={[event.position.x, event.position.y + 0.05, event.position.z]}>
      <mesh ref={innerRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.6, 1.0, 48]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={config.maxOpacity}
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh ref={outerRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 1.3, 48]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={config.maxOpacity * 0.7}
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh ref={glowRef} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.6, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={config.maxOpacity * 0.3}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

interface MapPulseStore {
  events: MapPulseEvent[];
  addPulse: (type: MapPulseType, coordinate: { q: number; r: number }) => void;
  removePulse: (id: string) => void;
  cleanupStale: () => void;
}

export const useMapPulseStore = create<MapPulseStore>((set) => ({
  events: [],
  addPulse: (type, coordinate) => {
    const worldPos = hexToWorldPos(coordinate.q, coordinate.r);
    const event: MapPulseEvent = {
      id: `pulse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      position: worldPos,
      type,
      startTime: Date.now(),
    };
    set((state) => ({
      events: pushCapped(state.events, event, MEMORY_LIMITS.MAP_PULSE_MAX_ITEMS),
    }));
  },
  removePulse: (id) => {
    set((state) => ({ events: state.events.filter((e) => e.id !== id) }));
  },
  cleanupStale: () => {
    set((state) => ({
      events: enforceCapAndTTL(
        state.events,
        (e) => e.startTime,
        MEMORY_LIMITS.MAP_PULSE_TTL_MS,
        MEMORY_LIMITS.MAP_PULSE_MAX_ITEMS
      ),
    }));
  },
}));

export function MapPulseEffects() {
  const { events, removePulse } = useMapPulseStore();

  return (
    <>
      {events.map((event) => (
        <MapPulse
          key={event.id}
          event={event}
          onComplete={() => removePulse(event.id)}
        />
      ))}
    </>
  );
}
