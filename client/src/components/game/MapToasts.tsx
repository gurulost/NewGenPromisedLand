import React, { useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useMapToastStore, MapToast } from '../../lib/stores/useMapToasts';


interface MapToastProps {
    toast: MapToast;
    onComplete: (id: string) => void;
}

const typeStyles: Record<MapToast['type'], { color: string; icon: string; bgColor: string }> = {
    stars: { color: '#FDE047', icon: '⭐', bgColor: 'rgba(253, 224, 71, 0.2)' },
    faith: { color: '#60A5FA', icon: '✨', bgColor: 'rgba(96, 165, 250, 0.2)' },
    pride: { color: '#A78BFA', icon: '👑', bgColor: 'rgba(167, 139, 250, 0.2)' },
    dissent: { color: '#F87171', icon: '⚠️', bgColor: 'rgba(248, 113, 113, 0.2)' },
    tech: { color: '#34D399', icon: '📜', bgColor: 'rgba(52, 211, 153, 0.2)' },
    unit: { color: '#FB923C', icon: '⚔️', bgColor: 'rgba(251, 146, 60, 0.2)' },
    construction: { color: '#FBBF24', icon: '🏗️', bgColor: 'rgba(251, 191, 36, 0.2)' },
    levelup: { color: '#FDE68A', icon: '🛡️', bgColor: 'rgba(253, 230, 138, 0.2)' },
    population: { color: '#22C55E', icon: '👥', bgColor: 'rgba(34, 197, 94, 0.2)' },
    reveal: { color: '#818CF8', icon: '🗺️', bgColor: 'rgba(129, 140, 248, 0.2)' },
    damage: { color: '#EF4444', icon: '💥', bgColor: 'rgba(239, 68, 68, 0.2)' },
    heal: { color: '#4ADE80', icon: '❤️', bgColor: 'rgba(22, 101, 52, 0.6)' },
    combat: { color: '#F87171', icon: '⚔️', bgColor: 'rgba(127, 29, 29, 0.6)' },
    reward: { color: '#FBBF24', icon: '🎁', bgColor: 'rgba(120, 53, 15, 0.6)' },
};

// Individual floating toast in 3D space
function FloatingToast({ toast, onComplete }: MapToastProps) {
    const groupRef = useRef<THREE.Group>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const elapsedRef = useRef(0);
    const opacityRef = useRef(1);
    const completedRef = useRef(false);
    const duration = toast.duration || 2000;

    // Animate float up and fade
    useFrame((_state, delta) => {
        if (completedRef.current) return;
        if (!groupRef.current) return;

        elapsedRef.current += delta * 1000;
        const progress = Math.min(elapsedRef.current / duration, 1);

        // Float upward
        groupRef.current.position.y = toast.position.y + progress * 2;

        // Fade out in last 30%
        const nextOpacity = progress > 0.7 ? 1 - ((progress - 0.7) / 0.3) : 1;
        if (containerRef.current && Math.abs(opacityRef.current - nextOpacity) > 0.01) {
            opacityRef.current = nextOpacity;
            containerRef.current.style.opacity = nextOpacity.toFixed(3);
        }

        // Remove when complete
        if (progress >= 1) {
            completedRef.current = true;
            onComplete(toast.id);
        }
    });

    const style = typeStyles[toast.type];

    return (
        <group
            ref={groupRef}
            position={[toast.position.x, toast.position.y + 1, toast.position.z]}
        >
            <Html
                center
                distanceFactor={10}
                style={{
                    pointerEvents: 'none',
                    transition: 'opacity 0.1s ease-out',
                }}
            >
                <div
                    ref={containerRef}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 14px',
                        borderRadius: '20px',
                        backgroundColor: style.bgColor,
                        border: `2px solid ${style.color}`,
                        boxShadow: `0 0 20px ${style.color}40, 0 4px 12px rgba(0,0,0,0.3)`,
                        backdropFilter: 'blur(4px)',
                        whiteSpace: 'nowrap',
                        transform: 'scale(1.2)',
                    }}
                >
                    <span style={{ fontSize: '18px' }}>{style.icon}</span>
                    <span
                        style={{
                            color: style.color,
                            fontWeight: 'bold',
                            fontSize: '16px',
                            textShadow: `0 0 10px ${style.color}80`,
                            fontFamily: 'system-ui, sans-serif',
                        }}
                    >
                        {toast.message}
                    </span>
                </div>
            </Html>
        </group>
    );
}

// Container component that uses the global store
export function MapToastContainer() {
    const { toasts, removeToast } = useMapToastStore();

    return (
        <>
            {toasts.map(toast => (
                <FloatingToast
                    key={toast.id}
                    toast={toast}
                    onComplete={removeToast}
                />
            ))}
        </>
    );
}

// Helper to convert hex coordinates to world position for toasts
export function hexToWorldPosition(q: number, r: number, hexSize: number = 1): { x: number; y: number; z: number } {
    // Standard hex grid conversion
    const x = hexSize * (3 / 2 * q);
    const z = hexSize * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);
    return { x, y: 0.5, z };
}
