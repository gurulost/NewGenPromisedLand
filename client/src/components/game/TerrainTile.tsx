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
        // Create mountain peaks
        const mountainGeometry = new THREE.ConeGeometry(0.8, 1.5, 8);
        mountainGeometry.translate(0, 0.75, 0);
        return mountainGeometry;
        
      case 'forest':
        // Simplified forest - single elevated cone for performance
        const forestGeometry = new THREE.ConeGeometry(0.8, 1.2, 8);
        forestGeometry.translate(0, 0.6, 0);
        return forestGeometry;
        
      case 'hill':
        // Create gentle hills
        const hillGeometry = new THREE.SphereGeometry(0.9, 8, 4);
        hillGeometry.scale(1, 0.3, 1);
        return hillGeometry;
        
      case 'water':
        // Create water surface with slight animation-ready deformation
        const waterGeometry = new THREE.PlaneGeometry(2, 2, 4, 4);
        waterGeometry.rotateX(-Math.PI / 2);
        
        // Add slight wave-like deformation
        const positionAttribute = waterGeometry.attributes.position;
        for (let i = 0; i < positionAttribute.count; i++) {
          const x = positionAttribute.getX(i);
          const z = positionAttribute.getZ(i);
          const wave = Math.sin(x * 2) * Math.cos(z * 2) * 0.05;
          positionAttribute.setY(i, wave);
        }
        waterGeometry.computeVertexNormals();
        
        return waterGeometry;
        
      default:
        // Plains - rolling surface
        const plainsGeometry = new THREE.CylinderGeometry(1, 1, 0.1, 6);
        
        // Add subtle height variations
        const plainsPosAttribute = plainsGeometry.attributes.position;
        for (let i = 0; i < plainsPosAttribute.count; i++) {
          const x = plainsPosAttribute.getX(i);
          const z = plainsPosAttribute.getZ(i);
          const height = Math.sin(x * 3) * Math.cos(z * 3) * 0.02;
          plainsPosAttribute.setY(i, plainsPosAttribute.getY(i) + height);
        }
        plainsGeometry.computeVertexNormals();
        
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
      mat.opacity = Math.min(opacity, 0.8);
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