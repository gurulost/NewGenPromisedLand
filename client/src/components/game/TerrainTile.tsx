import React, { useRef, useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import * as THREE from 'three';
import { TerrainType } from '@shared/types/game';

interface TerrainTileProps {
  terrain: TerrainType;
  position: [number, number, number];
  opacity?: number;
  color?: [number, number, number];
}

const TERRAIN_MODELS = {
  plains: '/models/terrain_plains.glb',
  forest: '/models/terrain_forest.glb',
  mountain: '/models/terrain_mountain.glb',
  hill: '/models/terrain_hill.glb',
  water: '/models/terrain_water.glb',
  // Fallback for any terrain types not yet modeled
  desert: '/models/terrain_plains.glb',
  swamp: '/models/terrain_water.glb'
};

export default function TerrainTile({ 
  terrain, 
  position, 
  opacity = 1.0, 
  color = [1, 1, 1] 
}: TerrainTileProps) {
  return (
    <TerrainModel 
      terrain={terrain}
      position={position}
      color={color}
      opacity={opacity}
    />
  );
}

// Component that safely loads GLB models with fallback
function TerrainModel({ terrain, position, color, opacity }: {
  terrain: TerrainType;
  position: [number, number, number];
  color: [number, number, number];
  opacity: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const modelPath = TERRAIN_MODELS[terrain] || TERRAIN_MODELS.plains;
  
  let gltf;
  try {
    gltf = useLoader(GLTFLoader, modelPath);
  } catch (error) {
    console.warn(`Failed to load terrain model: ${modelPath}`, error);
    // Return fallback if loading fails
    return (
      <TerrainFallback 
        terrain={terrain}
        position={position}
        color={color}
        opacity={opacity}
      />
    );
  }
  
  // Clone and apply materials to the loaded model
  const clonedScene = useMemo(() => {
    if (!gltf || !gltf.scene) return null;
    
    const clone = gltf.scene.clone();
    clone.scale.setScalar(0.6); // Scale down the large models to fit better
    
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const material = child.material as THREE.MeshStandardMaterial;
        const newMaterial = material.clone();
        newMaterial.color.setRGB(color[0], color[1], color[2]);
        newMaterial.transparent = opacity < 1;
        newMaterial.opacity = opacity;
        child.material = newMaterial;
      }
    });
    
    return clone;
  }, [gltf?.scene, color, opacity]);
  
  if (!clonedScene) {
    return (
      <TerrainFallback 
        terrain={terrain}
        position={position}
        color={color}
        opacity={opacity}
      />
    );
  }
  
  return (
    <group ref={meshRef} position={position}>
      <primitive object={clonedScene} />
    </group>
  );
}

// Beautiful procedural terrain fallback
function TerrainFallback({ terrain, position, color, opacity }: {
  terrain: TerrainType;
  position: [number, number, number];
  color: [number, number, number];
  opacity: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Create optimized geometry based on terrain type
  const geometry = useMemo(() => {
    const baseGeometry = new THREE.CylinderGeometry(1, 1, 0.05, 6);
    
    switch (terrain) {
      case 'mountain':
        // Create subtle mountain peaks - much smaller for overlay effect
        const mountainGeometry = new THREE.ConeGeometry(0.3, 0.4, 6);
        mountainGeometry.translate(0, 0.2, 0);
        return mountainGeometry;
        
      case 'forest':
        // Forest canopy - cluster of very small trees
        const forestGeometry = new THREE.BufferGeometry();
        const positions: number[] = [];
        const normals: number[] = [];
        
        // Create 3 tiny tree cones
        for (let i = 0; i < 3; i++) {
          const treeGeometry = new THREE.ConeGeometry(0.08, 0.25, 5);
          const angle = (i / 3) * Math.PI * 2;
          const radius = 0.15;
          treeGeometry.translate(
            Math.cos(angle) * radius,
            0.125,
            Math.sin(angle) * radius
          );
          
          const treePositions = treeGeometry.attributes.position.array;
          const treeNormals = treeGeometry.attributes.normal.array;
          
          for (let j = 0; j < treePositions.length; j += 3) {
            positions.push(treePositions[j], treePositions[j + 1], treePositions[j + 2]);
          }
          for (let j = 0; j < treeNormals.length; j += 3) {
            normals.push(treeNormals[j], treeNormals[j + 1], treeNormals[j + 2]);
          }
        }
        
        forestGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        forestGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        return forestGeometry;
        
      case 'hill':
        // Create gentle rolling hills - much more subtle
        const hillGeometry = new THREE.SphereGeometry(0.5, 8, 4);
        hillGeometry.scale(1, 0.15, 1);
        hillGeometry.translate(0, 0.075, 0);
        return hillGeometry;
        
      case 'water':
        // Create beautiful hexagonal water surface - rotated to match hex grid
        const waterGeometry = new THREE.CylinderGeometry(0.95, 0.95, 0.02, 6);
        waterGeometry.rotateY(Math.PI / 6); // Rotate 30 degrees to align with hex grid
        waterGeometry.translate(0, 0.01, 0); // Slightly above hex grid
        return waterGeometry;
        
      default:
        // Plains - subtle grass tufts or small details
        const plainsGeometry = new THREE.BufferGeometry();
        const grassPositions: number[] = [];
        const grassNormals: number[] = [];
        
        // Add tiny grass details - extremely minimal
        for (let i = 0; i < 3; i++) {
          const grassBlade = new THREE.ConeGeometry(0.02, 0.04, 3);
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.random() * 0.3;
          grassBlade.translate(
            Math.cos(angle) * radius,
            0.02,
            Math.sin(angle) * radius
          );
          
          const bladePositions = grassBlade.attributes.position.array;
          const bladeNormals = grassBlade.attributes.normal.array;
          
          for (let j = 0; j < bladePositions.length; j += 3) {
            grassPositions.push(bladePositions[j], bladePositions[j + 1], bladePositions[j + 2]);
          }
          for (let j = 0; j < bladeNormals.length; j += 3) {
            grassNormals.push(bladeNormals[j], bladeNormals[j + 1], bladeNormals[j + 2]);
          }
        }
        
        plainsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(grassPositions, 3));
        plainsGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(grassNormals, 3));
        return plainsGeometry;
    }
  }, [terrain]);
  
  // Create material with appropriate properties
  const material = useMemo(() => {
    const mat = new THREE.MeshLambertMaterial({
      color: new THREE.Color(color[0], color[1], color[2]),
      transparent: opacity < 1,
      opacity: opacity,
    });
    
    // Add special material properties for water
    if (terrain === 'water') {
      mat.transparent = true;
      mat.opacity = Math.min(opacity, 0.7);
      mat.color.setRGB(0.4, 0.7, 0.9); // Beautiful water blue
      // Add subtle metallic reflection for water
      if (mat instanceof THREE.MeshLambertMaterial) {
        const waterMat = new THREE.MeshPhongMaterial({
          color: new THREE.Color(0.4, 0.7, 0.9),
          transparent: true,
          opacity: Math.min(opacity, 0.7),
          shininess: 100,
          specular: 0x4499ff
        });
        return waterMat;
      }
    }
    
    return mat;
  }, [color, opacity, terrain]);
  
  return (
    <mesh 
      ref={meshRef} 
      position={position}
      geometry={geometry}
      material={material}
    />
  );
}