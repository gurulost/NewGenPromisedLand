import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import { GLTFErrorBoundary } from './GLTFErrorBoundary';

interface GroundedModelProps {
  src: string;
  position: { x: number; y: number };
  scale?: number | [number, number, number];
  tileY?: number; // y-value of the tile's top surface
}

export function GroundedModel({
  src,
  position,
  scale = 1,
  tileY = 0
}: GroundedModelProps) {
  return (
    <GLTFErrorBoundary
      resetKey={src}
      fallback={<GroundedModelFallback position={position} scale={scale} tileY={tileY} />}
    >
      <LoadedGroundedModel src={src} position={position} scale={scale} tileY={tileY} />
    </GLTFErrorBoundary>
  );
}

function LoadedGroundedModel({
  src,
  position,
  scale = 1,
  tileY = 0
}: GroundedModelProps) {
  const { scene } = useGLTF(src);

  const object = useMemo(() => {
    const clone = scene.clone();
    const box = new THREE.Box3().setFromObject(clone);
    clone.position.set(0, Number.isFinite(box.min.y) ? -box.min.y : 0, 0);
    return clone;
  }, [scene]);

  // Note: No disposal needed here because GroundedModel uses scene.clone()
  // which only clones the structure but keeps references to the original
  // cached materials. The materials are managed by drei's useGLTF cache.

  return (
    <group 
      position={[position.x, tileY, position.y]} 
      scale={toModelScale(scale)}
    >
      <primitive object={object} />
    </group>
  );
}

function GroundedModelFallback({
  position,
  scale = 1,
  tileY = 0
}: Omit<GroundedModelProps, 'src'>) {
  return (
    <group
      position={[position.x, tileY, position.y]}
      scale={toModelScale(scale)}
    >
      <mesh position={[0, 0.08, 0]}>
        <boxGeometry args={[0.32, 0.16, 0.32]} />
        <meshStandardMaterial color="#8b7355" roughness={0.9} />
      </mesh>
    </group>
  );
}

function toModelScale(scale: number | [number, number, number]): [number, number, number] {
  return Array.isArray(scale) ? scale : [scale, scale, scale];
}
