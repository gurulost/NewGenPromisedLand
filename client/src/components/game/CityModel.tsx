import { useGLTF, Text, Billboard } from '@react-three/drei';
import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import type { City } from '@shared/types/city';
import { getCityModelPath } from '../../utils/modelManager';
import { disposeClonedMaterials } from '../../lib/memoryUtils';

interface CityModelProps {
  city: City;
  position: { x: number; y: number };
  isPlayerCity: boolean;
}

export function CityModel({ city, position, isPlayerCity }: CityModelProps) {
  // Use centralized model manager for consistent model loading
  const modelPath = getCityModelPath(city.level);
  const { scene } = useGLTF(modelPath);

  // Calculate city scale based on level - increased sizes to fill hex tiles
  const cityScale = useMemo(() => {
    if (city.level >= 3) {
      return 2.8; // Large city spanning multiple tiles
    } else if (city.level >= 2) {
      return 1.4; // Medium city filling hex tile nicely
    } else {
      return 1.1; // Level 1 city fills to hex tile edges
    }
  }, [city.level]);

  // Safe display name with fallback
  const displayName = city.name || 'City';

  // Clone and modify the scene for materials and colors
  const clonedScene = useMemo(() => {
    const clone = scene.clone();

    // Ensure proper materials and colors based on ownership
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.material) {
          const cloneMaterial = (m: any) => (m && typeof m.clone === 'function' ? m.clone() : m);
          const clonedMaterial = Array.isArray(child.material)
            ? child.material.map(cloneMaterial)
            : cloneMaterial(child.material);
          child.material = clonedMaterial;
          const materials = Array.isArray(clonedMaterial) ? clonedMaterial : [clonedMaterial];

          for (const material of materials) {
            // Adjust colors based on ownership
            if (isPlayerCity) {
              // Player cities get warmer, friendlier colors
              if (material?.color) {
                material.color.multiplyScalar(1.1); // Slightly brighter
              }
              if (material?.emissive) {
                material.emissive.setHex(0x004400); // Subtle green glow
              }
            } else {
              // Neutral/enemy cities get cooler colors
              if (material?.color) {
                material.color.multiplyScalar(0.9); // Slightly darker
              }
              if (material?.emissive) {
                material.emissive.setHex(0x440000); // Subtle red glow
              }
            }
          }
        }
      }
    });

    return clone;
  }, [scene, isPlayerCity, city.level]);

  // Apply auto-grounding to the cloned scene
  const groundedScene = useMemo(() => {
    const box = new THREE.Box3().setFromObject(clonedScene);
    const bottomShift = -box.min.y;
    clonedScene.position.set(0, bottomShift, 0);
    return clonedScene;
  }, [clonedScene]);

  // Dispose cloned materials on unmount to free GPU memory
  useEffect(() => {
    return () => {
      disposeClonedMaterials(clonedScene);
    };
  }, [clonedScene]);

  return (
    <group position={[position.x, 0, position.y]}>
      <primitive object={groundedScene} scale={[cityScale, cityScale, cityScale]} />

      {/* City Name Label - floating above the city */}
      <Billboard
        follow={true}
        lockX={false}
        lockY={false}
        lockZ={false}
        position={[0, city.level >= 3 ? 3.0 : city.level >= 2 ? 2.2 : 1.8, 0]}
      >
        {/* Name background for readability */}
        <mesh position={[0, 0, -0.01]}>
          <planeGeometry args={[displayName.length * 0.18 + 0.4, 0.4]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.7} />
        </mesh>
        {/* City name text */}
        <Text
          fontSize={0.25}
          color={isPlayerCity ? "#4ade80" : "#f87171"}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {displayName}
        </Text>
        {/* Population badge */}
        <group position={[displayName.length * 0.09 + 0.35, 0, 0]}>
          <mesh>
            <circleGeometry args={[0.12, 16]} />
            <meshBasicMaterial color={isPlayerCity ? "#22c55e" : "#ef4444"} />
          </mesh>
          <Text
            fontSize={0.12}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
            position={[0, 0, 0.01]}
          >
            {city.population}
          </Text>
        </group>
      </Billboard>

      {/* Add a subtle glow effect for higher level cities */}
      {city.level > 1 && (
        <mesh position={[0, -0.05, 0]}>
          <cylinderGeometry args={[
            city.level >= 3 ? 2.8 : 1.4,
            city.level >= 3 ? 2.8 : 1.4,
            0.02,
            16
          ]} />
          <meshBasicMaterial
            color={isPlayerCity ? "#4CAF50" : "#F44336"}
            transparent
            opacity={city.level >= 3 ? 0.2 : 0.3}
          />
        </mesh>
      )}

      {/* Additional grandeur effects for level 3+ cities */}
      {city.level >= 3 && (
        <>
          {/* Outer ring effect */}
          <mesh position={[0, -0.09, 0]}>
            <cylinderGeometry args={[2.6, 2.6, 0.01, 32]} />
            <meshBasicMaterial
              color={isPlayerCity ? "#FFD700" : "#FF4444"}
              transparent
              opacity={0.15}
            />
          </mesh>

          {/* Pulsing center core */}
          <mesh position={[0, 0.0, 0]}>
            <cylinderGeometry args={[0.3, 0.3, 0.05, 16]} />
            <meshBasicMaterial
              color={isPlayerCity ? "#00FF00" : "#FF0000"}
              transparent
              opacity={0.6}
            />
          </mesh>
        </>
      )}
    </group>
  );
}
