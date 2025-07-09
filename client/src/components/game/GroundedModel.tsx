import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';

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
  const { scene } = useGLTF(src);

  // Clone once so multiple instances don't mutate the shared scene graph
  const object = useMemo(() => scene.clone(), [scene]);

  // Calculate bounding box and shift object so its bottom is at local Y = 0
  const bottomShift = useMemo(() => {
    const box = new THREE.Box3().setFromObject(object);
    return -box.min.y; // distance we have to lift it
  }, [object]);

  // Apply the bottom shift to position the model correctly
  useMemo(() => {
    object.position.set(0, bottomShift, 0);
  }, [object, bottomShift]);

  return (
    <group 
      position={[position.x, tileY, position.y]} 
      scale={Array.isArray(scale) ? scale : [scale, scale, scale]}
    >
      <primitive object={object} />
    </group>
  );
}