import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { City } from '@shared/types/game';

interface CityModelProps {
  city: City;
  position: { x: number; y: number };
  isPlayerCity: boolean;
}

export function CityModel({ city, position, isPlayerCity }: CityModelProps) {
  // Determine which model to load based on city level
  const modelPath = city.level >= 2 ? '/models/city_level2.glb' : '/models/city_level1.glb';
  const { scene } = useGLTF(modelPath);
  
  // Clone the scene to avoid modifying the original
  const clonedScene = useMemo(() => {
    const clone = scene.clone();
    
    // Scale the model to fit within a hex tile (HEX_SIZE = 1)
    // Level 2 cities should be slightly larger to show progression
    const baseScale = 0.8;
    const levelScale = city.level >= 2 ? 0.9 : 0.8; // Level 2+ cities are 10% larger
    clone.scale.setScalar(levelScale);
    
    // Ensure proper materials and colors based on ownership
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.material) {
          // Clone material to avoid modifying the original
          const material = child.material.clone();
          
          // Adjust colors based on ownership
          if (isPlayerCity) {
            // Player cities get warmer, friendlier colors
            if (material.color) {
              material.color.multiplyScalar(1.1); // Slightly brighter
            }
            if (material.emissive) {
              material.emissive.setHex(0x004400); // Subtle green glow
            }
          } else {
            // Neutral/enemy cities get cooler colors
            if (material.color) {
              material.color.multiplyScalar(0.9); // Slightly darker
            }
            if (material.emissive) {
              material.emissive.setHex(0x440000); // Subtle red glow
            }
          }
          
          child.material = material;
        }
      }
    });
    
    return clone;
  }, [scene, isPlayerCity, city.level]);
  
  return (
    <group position={[position.x, 0, position.y]}>
      <primitive object={clonedScene} />
      
      {/* City level indicator - floating text above the model */}
      <mesh position={[0, 1.2, 0]}>
        <sphereGeometry args={[0.1]} />
        <meshBasicMaterial 
          color={isPlayerCity ? "#00FF00" : "#FF6B6B"} 
          transparent 
          opacity={0.8} 
        />
      </mesh>
      
      {/* Add a subtle glow effect for higher level cities */}
      {city.level > 1 && (
        <mesh position={[0, 0.1, 0]}>
          <cylinderGeometry args={[1.0, 1.0, 0.02, 16]} />
          <meshBasicMaterial 
            color={isPlayerCity ? "#4CAF50" : "#F44336"} 
            transparent 
            opacity={0.3} 
          />
        </mesh>
      )}
    </group>
  );
}

// Preload both models
useGLTF.preload('/models/city_level1.glb');
useGLTF.preload('/models/city_level2.glb');