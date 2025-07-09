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
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Always use fallback geometry for now (GLB models cause hooks issues)
  return (
    <TerrainFallback 
      terrain={terrain}
      position={position}
      color={color}
      opacity={opacity}
    />
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
        // Create mountain peaks - more compact for overlay
        const mountainGeometry = new THREE.ConeGeometry(0.6, 1.0, 6);
        mountainGeometry.translate(0, 0.5, 0);
        return mountainGeometry;
        
      case 'forest':
        // Forest canopy - cluster of small trees
        const forestGeometry = new THREE.BufferGeometry();
        const positions: number[] = [];
        const normals: number[] = [];
        
        // Create 3 small tree cones
        for (let i = 0; i < 3; i++) {
          const treeGeometry = new THREE.ConeGeometry(0.15, 0.5, 5);
          const angle = (i / 3) * Math.PI * 2;
          const radius = 0.2;
          treeGeometry.translate(
            Math.cos(angle) * radius,
            0.25,
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
        // Create gentle rolling hills - smaller for overlay
        const hillGeometry = new THREE.SphereGeometry(0.7, 8, 4);
        hillGeometry.scale(1, 0.2, 1);
        hillGeometry.translate(0, 0.1, 0);
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
        
        // Add small grass details - very minimal
        for (let i = 0; i < 5; i++) {
          const grassBlade = new THREE.ConeGeometry(0.05, 0.1, 3);
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.random() * 0.4;
          grassBlade.translate(
            Math.cos(angle) * radius,
            0.05,
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