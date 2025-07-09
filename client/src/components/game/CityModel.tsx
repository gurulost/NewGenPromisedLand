import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { City } from '@shared/types/city';
import { getCityModelPath } from '../../utils/modelManager';
import { GroundedModel } from './GroundedModel';

interface CityModelProps {
  city: City;
  position: { x: number; y: number };
  isPlayerCity: boolean;
}

export function CityModel({ city, position, isPlayerCity }: CityModelProps) {
  // Use centralized model manager for consistent model loading
  const modelPath = getCityModelPath(city.level);
  const { scene } = useGLTF(modelPath);
  
  // Calculate city scale based on level
  const cityScale = useMemo(() => {
    if (city.level >= 3) {
      return 2.4; // Three tiles wide
    } else if (city.level >= 2) {
      return 0.9; // Medium city
    } else {
      return 0.8; // Small city
    }
  }, [city.level]);
  
  // Clone and modify the scene for materials and colors
  const clonedScene = useMemo(() => {
    const clone = scene.clone();
    
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
  
  // Apply auto-grounding to the cloned scene
  const groundedScene = useMemo(() => {
    const box = new THREE.Box3().setFromObject(clonedScene);
    const bottomShift = -box.min.y;
    clonedScene.position.set(0, bottomShift, 0);
    return clonedScene;
  }, [clonedScene]);
  
  return (
    <group position={[position.x, 0, position.y]}>
      <primitive object={groundedScene} scale={[cityScale, cityScale, cityScale]} />
      
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