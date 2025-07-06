import { useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import * as THREE from "three";
import { hexToPixel } from "@shared/utils/hex";
import { ConstructionItem } from "@shared/types/game";

interface ConstructionProps {
  construction: ConstructionItem;
}

const HEX_SIZE = 1;

export default function Construction({ construction }: ConstructionProps) {
  const meshRef = useRef<THREE.Group>(null);
  
  // Calculate opacity based on construction progress
  const progress = (construction.totalTurns - construction.turnsRemaining) / construction.totalTurns;
  const opacity = Math.max(0.2, progress); // Minimum 20% opacity for visibility
  
  // Position the construction at the correct hex coordinate
  const pixelPos = hexToPixel(construction.coordinate, HEX_SIZE);
  
  // Try to load the model based on construction type
  let model = null;
  try {
    if (construction.type === 'boat') {
      const gltf = useLoader(GLTFLoader, "/models/boat.glb");
      model = gltf.scene.clone();
    }
  } catch (error) {
    console.log(`No 3D model found for ${construction.type}, using placeholder`);
  }
  
  // Animation - gentle bobbing for ghost effect
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y = 0.1 + Math.sin(state.clock.elapsedTime * 2) * 0.05;
    }
  });
  
  return (
    <group
      ref={meshRef}
      position={[pixelPos.x, 0.1, pixelPos.y]}
      scale={[2.5, 2.5, 2.5]} // Scale up as mentioned in guidelines
    >
      {model ? (
        // Use the loaded 3D model
        <primitive 
          object={model}
          scale={[1, 1, 1]}
        />
      ) : (
        // Fallback to simple geometry
        <mesh>
          {construction.type === 'boat' ? (
            <boxGeometry args={[0.8, 0.3, 1.5]} />
          ) : construction.category === 'units' ? (
            <cylinderGeometry args={[0.2, 0.2, 0.5]} />
          ) : (
            <boxGeometry args={[0.5, 0.5, 0.5]} />
          )}
          <meshStandardMaterial 
            color={
              construction.category === 'units' ? '#4A90E2' : 
              construction.category === 'improvements' ? '#7ED321' : 
              '#F5A623'
            }
            transparent
            opacity={opacity}
            emissive={new THREE.Color(0x404040)}
            emissiveIntensity={0.1}
          />
        </mesh>
      )}
      
      {/* Construction progress indicator */}
      <mesh position={[0, 0.8, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 0.4, 8]} />
        <meshBasicMaterial 
          color="#FFD700" 
          transparent 
          opacity={0.8}
        />
      </mesh>
      
      {/* Progress fill */}
      <mesh position={[0, 0.81, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 0.4, 8, 1, 0, Math.PI * 2 * progress]} />
        <meshBasicMaterial 
          color="#00FF00" 
          transparent 
          opacity={0.9}
        />
      </mesh>
    </group>
  );
}