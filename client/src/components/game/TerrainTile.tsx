import React, { useRef, useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
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
  water: '/models/terrain_water.glb',
  // desert and swamp will use procedural fallbacks for better visual distinction
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
  const groupRef = useRef<THREE.Group>(null);
  
  // Use procedural fallbacks for desert and swamp for better visual distinction
  if (terrain === 'desert' || terrain === 'swamp') {
    return (
      <TerrainFallback 
        terrain={terrain}
        position={position}
        color={color}
        opacity={opacity}
      />
    );
  }
  
  const modelPath = TERRAIN_MODELS[terrain] || TERRAIN_MODELS.plains;
  
  let gltf;
  let loadingError = false;
  
  try {
    gltf = useLoader(GLTFLoader, modelPath, (loader) => {
      // Configure loader for better error handling
      loader.setPath('/models/');
    });
  } catch (error) {
    loadingError = true;
  }
  
  // Handle loading failures or invalid/empty models
  if (loadingError || !gltf || !gltf.scene) {
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
    
    clone.traverse((child: THREE.Object3D) => {
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
    <group ref={groupRef} position={position}>
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
    switch (terrain) {
      case 'mountain': {
        const mountainGeometry = new THREE.ConeGeometry(0.3, 0.4, 6);
        mountainGeometry.translate(0, 0.2, 0);
        return mountainGeometry;
      }
        
      case 'forest': {
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
      }

      case 'desert': {
        // Create sand dunes with rocky outcroppings
        const desertGeometry = new THREE.BufferGeometry();
        const dunePositions: number[] = [];
        const duneNormals: number[] = [];
        
        // Create 2 small sand dunes
        for (let i = 0; i < 2; i++) {
          const duneGeometry = new THREE.SphereGeometry(0.3, 6, 4);
          duneGeometry.scale(1.5, 0.1, 1);
          const angle = (i / 2) * Math.PI;
          const radius = 0.2;
          duneGeometry.translate(
            Math.cos(angle) * radius,
            0.05,
            Math.sin(angle) * radius
          );
          
          const dunePos = duneGeometry.attributes.position.array;
          const duneNorm = duneGeometry.attributes.normal.array;
          
          for (let j = 0; j < dunePos.length; j += 3) {
            dunePositions.push(dunePos[j], dunePos[j + 1], dunePos[j + 2]);
          }
          for (let j = 0; j < duneNorm.length; j += 3) {
            duneNormals.push(duneNorm[j], duneNorm[j + 1], duneNorm[j + 2]);
          }
        }
        
        // Add a small rocky outcropping
        const rockGeometry = new THREE.DodecahedronGeometry(0.05);
        rockGeometry.translate(0.25, 0.05, 0.1);
        
        const rockPos = rockGeometry.attributes.position.array;
        const rockNorm = rockGeometry.attributes.normal.array;
        
        for (let j = 0; j < rockPos.length; j += 3) {
          dunePositions.push(rockPos[j], rockPos[j + 1], rockPos[j + 2]);
        }
        for (let j = 0; j < rockNorm.length; j += 3) {
          duneNormals.push(rockNorm[j], rockNorm[j + 1], rockNorm[j + 2]);
        }
        
        desertGeometry.setAttribute('position', new THREE.Float32BufferAttribute(dunePositions, 3));
        desertGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(duneNormals, 3));
        return desertGeometry;
      }

      case 'swamp': {
        // Create swamp with muddy mounds and cattails
        const swampGeometry = new THREE.BufferGeometry();
        const swampPositions: number[] = [];
        const swampNormals: number[] = [];
        
        // Create muddy mounds
        for (let i = 0; i < 3; i++) {
          const moundGeometry = new THREE.SphereGeometry(0.15, 6, 4);
          moundGeometry.scale(1, 0.3, 1);
          const angle = (i / 3) * Math.PI * 2;
          const radius = 0.2;
          moundGeometry.translate(
            Math.cos(angle) * radius,
            0.03,
            Math.sin(angle) * radius
          );
          
          const moundPos = moundGeometry.attributes.position.array;
          const moundNorm = moundGeometry.attributes.normal.array;
          
          for (let j = 0; j < moundPos.length; j += 3) {
            swampPositions.push(moundPos[j], moundPos[j + 1], moundPos[j + 2]);
          }
          for (let j = 0; j < moundNorm.length; j += 3) {
            swampNormals.push(moundNorm[j], moundNorm[j + 1], moundNorm[j + 2]);
          }
        }
        
        // Add cattail reeds
        for (let i = 0; i < 4; i++) {
          const reedGeometry = new THREE.CylinderGeometry(0.008, 0.008, 0.15, 4);
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.random() * 0.35;
          reedGeometry.translate(
            Math.cos(angle) * radius,
            0.075,
            Math.sin(angle) * radius
          );
          
          const reedPos = reedGeometry.attributes.position.array;
          const reedNorm = reedGeometry.attributes.normal.array;
          
          for (let j = 0; j < reedPos.length; j += 3) {
            swampPositions.push(reedPos[j], reedPos[j + 1], reedPos[j + 2]);
          }
          for (let j = 0; j < reedNorm.length; j += 3) {
            swampNormals.push(reedNorm[j], reedNorm[j + 1], reedNorm[j + 2]);
          }
        }
        
        swampGeometry.setAttribute('position', new THREE.Float32BufferAttribute(swampPositions, 3));
        swampGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(swampNormals, 3));
        return swampGeometry;
      }

      case 'water': {
        // Create beautiful hexagonal water surface - rotated to match hex grid
        const waterGeometry = new THREE.CylinderGeometry(0.95, 0.95, 0.02, 6);
        waterGeometry.rotateY(Math.PI / 6); // Rotate 30 degrees to align with hex grid
        waterGeometry.translate(0, 0.01, 0); // Slightly above hex grid
        return waterGeometry;
      }
        
      default: {
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
    }
  }, [terrain]);
  
  // Create material with appropriate properties
  const material = useMemo(() => {
    // Enhanced material system for better visual distinction
    switch (terrain) {
      case 'water':
        return new THREE.MeshLambertMaterial({
          color: new THREE.Color(0.3, 0.6, 0.9),
          transparent: true,
          opacity: Math.min(opacity, 0.7),
          emissive: new THREE.Color(0.05, 0.1, 0.2),
        });
        
      case 'desert':
        return new THREE.MeshLambertMaterial({
          color: color.length === 3 ? new THREE.Color(color[0], color[1], color[2]) : new THREE.Color(0.9, 0.8, 0.6),
          transparent: opacity < 1,
          opacity: opacity,
        });
        
      case 'swamp':
        return new THREE.MeshLambertMaterial({
          color: color.length === 3 ? new THREE.Color(color[0], color[1], color[2]) : new THREE.Color(0.4, 0.5, 0.3),
          transparent: opacity < 1,
          opacity: opacity,
          emissive: new THREE.Color(0.02, 0.04, 0.01),
        });
        
      case 'forest':
        return new THREE.MeshLambertMaterial({
          color: color.length === 3 ? new THREE.Color(color[0], color[1], color[2]) : new THREE.Color(0.2, 0.6, 0.2),
          transparent: opacity < 1,
          opacity: opacity,
          emissive: new THREE.Color(0.01, 0.03, 0.01),
        });
        
      case 'mountain':
        return new THREE.MeshLambertMaterial({
          color: color.length === 3 ? new THREE.Color(color[0], color[1], color[2]) : new THREE.Color(0.6, 0.6, 0.7),
          transparent: opacity < 1,
          opacity: opacity,
        });
        
      case 'plains':
      default:
        return new THREE.MeshLambertMaterial({
          color: new THREE.Color(0.4, 0.7, 0.3),
          transparent: opacity < 1,
          opacity: opacity,
        });
    }
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
