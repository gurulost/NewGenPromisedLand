import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { City } from '@shared/types/city';
import { getCityModelPath } from '../../utils/modelManager';

interface CityModelProps {
  city: City;
  position: { x: number; y: number };
  isPlayerCity: boolean;
}

export function CityModel({ city, position, isPlayerCity }: CityModelProps) {
  // Use centralized model manager for consistent model loading
  const modelPath = getCityModelPath(city.level);
  const { scene } = useGLTF(modelPath);
  
  // Clone the scene to avoid modifying the original
  const clonedScene = useMemo(() => {
    const clone = scene.clone();
    
    // Scale the model based on city level
    // Level 1: 0.8 scale (fits in 1 tile)
    // Level 2: 0.9 scale (slightly larger, still 1 tile)
    // Level 3+: 2.4 scale (spans 3 tiles wide, HEX_SIZE = 1, so 3 * 0.8 = 2.4)
    let levelScale;
    if (city.level >= 3) {
      levelScale = 2.4; // Three tiles wide
    } else if (city.level >= 2) {
      levelScale = 0.9; // Medium city
    } else {
      levelScale = 0.8; // Small city
    }
    
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
      <primitive object={clonedScene} position={[0, 0.3, 0]} />
      
      {/* City level indicator - floating text above the model */}
      <mesh position={[0, city.level >= 3 ? 2.0 : 1.2, 0]}>
        <sphereGeometry args={[0.1]} />
        <meshBasicMaterial 
          color={isPlayerCity ? "#00FF00" : "#FF6B6B"} 
          transparent 
          opacity={0.8} 
        />
      </mesh>
      
      {/* Add a subtle glow effect for higher level cities */}
      {city.level > 1 && (
        <mesh position={[0, -0.05, 0]}>
          <cylinderGeometry args={[
            city.level >= 3 ? 2.4 : 1.0, 
            city.level >= 3 ? 2.4 : 1.0, 
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

// Preload all three models
useGLTF.preload('/models/city_level1.glb');
useGLTF.preload('/models/city_level2.glb');
useGLTF.preload('/models/city_level3.glb');