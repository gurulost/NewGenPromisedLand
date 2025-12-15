import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useMapToastStore, hexToWorldPos } from '../../lib/stores/useMapToasts';

export type ParticleEventType = 'reward' | 'capture' | 'combat' | 'faith' | 'discovery';

interface ParticleEvent {
    id: string;
    position: { x: number; y: number; z: number };
    type: ParticleEventType;
    startTime: number;
}

interface ParticleBurstProps {
    event: ParticleEvent;
    onComplete: () => void;
}

// Individual particle burst effect
function ParticleBurst({ event, onComplete }: ParticleBurstProps) {
    const meshRef = useRef<THREE.Points>(null);
    const startTime = useRef(Date.now());
    const duration = 1500; // 1.5 seconds

    // Generate particle data
    const { positions, velocities, colors, count } = useMemo(() => {
        const count = 30;
        const positions = new Float32Array(count * 3);
        const velocities = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);

        // Color based on event type
        const baseColor = {
            reward: new THREE.Color('#FFD700'),
            capture: new THREE.Color('#FF6B35'),
            combat: new THREE.Color('#FF4444'),
            faith: new THREE.Color('#6366F1'),
            discovery: new THREE.Color('#22D3EE'),
        }[event.type];

        for (let i = 0; i < count; i++) {
            // Start at center
            positions[i * 3] = 0;
            positions[i * 3 + 1] = 0;
            positions[i * 3 + 2] = 0;

            // Random outward velocity
            const angle = Math.random() * Math.PI * 2;
            const elevation = (Math.random() - 0.3) * Math.PI;
            const speed = 0.5 + Math.random() * 1.5;

            velocities[i * 3] = Math.cos(angle) * Math.cos(elevation) * speed;
            velocities[i * 3 + 1] = Math.sin(elevation) * speed + 1; // Bias upward
            velocities[i * 3 + 2] = Math.sin(angle) * Math.cos(elevation) * speed;

            // Slightly varied colors
            const variation = 0.8 + Math.random() * 0.4;
            colors[i * 3] = baseColor.r * variation;
            colors[i * 3 + 1] = baseColor.g * variation;
            colors[i * 3 + 2] = baseColor.b * variation;
        }

        return { positions, velocities, colors, count };
    }, [event.type]);

    useFrame(() => {
        if (!meshRef.current) return;

        const elapsed = Date.now() - startTime.current;
        const progress = elapsed / duration;

        if (progress >= 1) {
            onComplete();
            return;
        }

        const positionAttr = meshRef.current.geometry.attributes.position as THREE.BufferAttribute;
        const posArray = positionAttr.array as Float32Array;

        // Update each particle
        for (let i = 0; i < count; i++) {
            const t = progress * 0.016; // deltaTime approximation
            posArray[i * 3] += velocities[i * 3] * t * 60;
            posArray[i * 3 + 1] += velocities[i * 3 + 1] * t * 60 - (progress * progress * 2); // Gravity
            posArray[i * 3 + 2] += velocities[i * 3 + 2] * t * 60;
        }

        positionAttr.needsUpdate = true;

        // Fade out
        const material = meshRef.current.material as THREE.PointsMaterial;
        material.opacity = 1 - (progress * progress);
    });

    return (
        <group position={[event.position.x, event.position.y + 0.5, event.position.z]}>
            <points ref={meshRef}>
                <bufferGeometry>
                    <bufferAttribute
                        attach="attributes-position"
                        count={count}
                        array={positions}
                        itemSize={3}
                    />
                    <bufferAttribute
                        attach="attributes-color"
                        count={count}
                        array={colors}
                        itemSize={3}
                    />
                </bufferGeometry>
                <pointsMaterial
                    size={0.15}
                    vertexColors
                    transparent
                    opacity={1}
                    sizeAttenuation
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                />
            </points>
        </group>
    );
}

// Global particle event store with bounded memory
interface ParticleStore {
    events: ParticleEvent[];
    addEvent: (type: ParticleEventType, coordinate: { q: number; r: number }) => void;
    removeEvent: (id: string) => void;
    cleanupStale: () => void;
}

import { create } from 'zustand';
import { pushCapped, enforceCapAndTTL, MEMORY_LIMITS } from '../../lib/memoryUtils';

export const useParticleStore = create<ParticleStore>((set) => ({
    events: [],
    addEvent: (type, coordinate) => {
        const worldPos = hexToWorldPos(coordinate.q, coordinate.r);
        const event: ParticleEvent = {
            id: `particle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            position: worldPos,
            type,
            startTime: Date.now(),
        };
        set((state) => ({
            events: pushCapped(state.events, event, MEMORY_LIMITS.PARTICLE_MAX_EVENTS)
        }));
    },
    removeEvent: (id) => {
        set((state) => ({ events: state.events.filter((e) => e.id !== id) }));
    },
    cleanupStale: () => {
        set((state) => ({
            events: enforceCapAndTTL(
                state.events,
                (e) => e.startTime,
                MEMORY_LIMITS.PARTICLE_TTL_MS,
                MEMORY_LIMITS.PARTICLE_MAX_EVENTS
            )
        }));
    },
}));

// Container component to render all active particle effects
export function ParticleEffectsContainer() {
    const { events, removeEvent } = useParticleStore();

    return (
        <>
            {events.map((event) => (
                <ParticleBurst
                    key={event.id}
                    event={event}
                    onComplete={() => removeEvent(event.id)}
                />
            ))}
        </>
    );
}
