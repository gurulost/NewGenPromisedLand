import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GameMap } from '@shared/types/game';
import { hexToPixel } from '@shared/utils/hex';
import { useLocalGame } from '../../lib/stores/useLocalGame';

interface WaterAnimationProps {
  map: GameMap;
}

const HEX_SIZE = 1;

export default function WaterAnimation({ map }: WaterAnimationProps) {
  const { gameState } = useLocalGame();
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  
  // Get current player for fog of war
  const currentPlayer = gameState?.players?.[gameState.currentPlayerIndex];
  
  // Find all water tiles that are visible or explored
  const waterTiles = useMemo(() => {
    if (!currentPlayer) return [];
    
    return map.tiles.filter(tile => {
      if (tile.terrain !== 'water') return false;
      
      const tileKey = `${tile.coordinate.q},${tile.coordinate.r}`;
      const isCurrentlyVisible = gameState?.visibility?.[currentPlayer.id]?.has(tileKey) || false;
      const hasBeenExplored = tile.exploredBy?.includes(currentPlayer.id) || false;
      
      return isCurrentlyVisible || hasBeenExplored;
    }).map(tile => {
      const pixelPos = hexToPixel(tile.coordinate, HEX_SIZE);
      return {
        position: [pixelPos.x, 0.02, pixelPos.y] as [number, number, number],
        coordinate: tile.coordinate
      };
    });
  }, [map.tiles, currentPlayer?.id, gameState?.visibility]);
  
  // Custom water shader for beautiful animated water
  const waterMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(0.4, 0.7, 0.9) },
        opacity: { value: 0.7 }
      },
      vertexShader: `
        uniform float time;
        varying vec2 vUv;
        varying vec3 vPosition;
        
        void main() {
          vUv = uv;
          vPosition = position;
          
          // Add gentle wave animation
          vec3 pos = position;
          pos.y += sin(pos.x * 3.0 + time) * 0.02;
          pos.y += cos(pos.z * 2.0 + time * 0.8) * 0.015;
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 color;
        uniform float opacity;
        varying vec2 vUv;
        varying vec3 vPosition;
        
        void main() {
          // Create subtle water ripple patterns
          float wave1 = sin(vUv.x * 10.0 + time * 2.0) * 0.1;
          float wave2 = cos(vUv.y * 8.0 + time * 1.5) * 0.1;
          float ripple = (wave1 + wave2) * 0.2 + 0.8;
          
          // Add fresnel-like effect for depth
          float fresnel = pow(1.0 - abs(dot(normalize(vPosition), vec3(0.0, 1.0, 0.0))), 2.0);
          
          vec3 finalColor = color * ripple + vec3(0.2, 0.3, 0.5) * fresnel;
          
          gl_FragColor = vec4(finalColor, opacity);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide
    });
  }, []);
  
  // Animate the water
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = state.clock.elapsedTime;
    }
  });
  
  if (waterTiles.length === 0) return null;
  
  return (
    <group>
      {waterTiles.map(({ position, coordinate }) => (
        <mesh
          key={`water-${coordinate.q}-${coordinate.r}`}
          position={position}
        >
          <cylinderGeometry args={[0.95, 0.95, 0.02, 6]} />
          <shaderMaterial
            ref={materialRef}
            {...waterMaterial}
          />
        </mesh>
      ))}
    </group>
  );
}