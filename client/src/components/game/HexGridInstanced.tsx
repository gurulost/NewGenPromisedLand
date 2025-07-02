import { useRef, useMemo, useEffect } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { TextureLoader } from "three";
import * as THREE from "three";
import { Tile, GameMap } from "@shared/types/game";
import { hexToPixel, pixelToHex } from "@shared/utils/hex";
import { getUnitDefinition } from "@shared/data/units";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { useGameState } from "../../lib/stores/useGameState";

interface HexGridInstancedProps {
  map: GameMap;
}

const HEX_SIZE = 1;

export default function HexGridInstanced({ map }: HexGridInstancedProps) {
  const { gameState } = useLocalGame();
  const { setHoveredTile, selectedUnit, reachableTiles } = useGameState();
  const { camera, raycaster, gl } = useThree();
  
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  
  // Load textures
  const grassTexture = useLoader(TextureLoader, "/textures/grass.png");
  const sandTexture = useLoader(TextureLoader, "/textures/sand.jpg");
  const woodTexture = useLoader(TextureLoader, "/textures/wood.jpg");

  // Get current player and memoized visibility calculations
  const currentPlayer = gameState?.players[gameState.currentPlayerIndex];

  // Memoized fog of war calculation - massive CPU performance boost
  const { visibleTileKeys, exploredTileKeys, tileInstanceData } = useMemo(() => {
    const visible = new Set<string>();
    const explored = new Set<string>();
    const instanceData: Array<{
      position: [number, number, number];
      color: [number, number, number];
      opacity: number;
      textureId: number;
    }> = [];
    
    if (!gameState || !currentPlayer) {
      map.tiles.forEach((tile, index) => {
        const pixelPos = hexToPixel(tile.coordinate, HEX_SIZE);
        instanceData.push({
          position: [pixelPos.x, 0, pixelPos.z],
          color: [0.1, 0.1, 0.1],
          opacity: 0.1,
          textureId: 0
        });
      });
      return { visibleTileKeys: visible, exploredTileKeys: explored, tileInstanceData: instanceData };
    }

    // Calculate currently visible tiles
    const playerUnits = gameState.units.filter(unit => unit.playerId === currentPlayer.id);
    playerUnits.forEach(unit => {
      // Use unit's actual vision radius from definition
      const unitDef = getUnitDefinition(unit.type);
      const visionRadius = unitDef.baseStats.visionRadius;
      
      for (let q = unit.coordinate.q - visionRadius; q <= unit.coordinate.q + visionRadius; q++) {
        for (let r = unit.coordinate.r - visionRadius; r <= unit.coordinate.r + visionRadius; r++) {
          const s = -q - r;
          const distance = Math.max(
            Math.abs(q - unit.coordinate.q),
            Math.abs(r - unit.coordinate.r),
            Math.abs(s - unit.coordinate.s)
          );
          
          if (distance <= visionRadius) {
            visible.add(`${q},${r}`);
          }
        }
      }
    });

    // Calculate explored tiles
    map.tiles.forEach(tile => {
      if (tile.exploredBy.includes(currentPlayer.id)) {
        explored.add(`${tile.coordinate.q},${tile.coordinate.r}`);
      }
    });

    // Generate instance data for all tiles
    map.tiles.forEach((tile, index) => {
      const pixelPos = hexToPixel(tile.coordinate, HEX_SIZE);
      const tileKey = `${tile.coordinate.q},${tile.coordinate.r}`;
      const isInCurrentVision = visible.has(tileKey);
      const isExplored = explored.has(tileKey);
      
      let color: [number, number, number];
      let opacity: number;
      let textureId: number;
      
      // Determine visibility state and appearance
      if (isInCurrentVision) {
        // Fully visible - normal appearance
        color = getTerrainColor(tile.terrain);
        opacity = 1.0;
        textureId = getTextureId(tile.terrain);
      } else if (isExplored) {
        // Explored but not in current vision - dimmed
        const baseColor = getTerrainColor(tile.terrain);
        color = [baseColor[0] * 0.5, baseColor[1] * 0.5, baseColor[2] * 0.5];
        opacity = 0.8;
        textureId = getTextureId(tile.terrain);
      } else {
        // Unexplored - very dark
        color = [0.05, 0.05, 0.05];
        opacity = 0.1;
        textureId = 0;
      }
      
      instanceData.push({
        position: [pixelPos.x, 0, pixelPos.z],
        color,
        opacity,
        textureId
      });
    });

    return { visibleTileKeys: visible, exploredTileKeys: explored, tileInstanceData: instanceData };
  }, [gameState?.units, currentPlayer?.id, map.tiles]);

  // Create hex geometry once
  const hexGeometry = useMemo(() => {
    const geometry = new THREE.CylinderGeometry(HEX_SIZE, HEX_SIZE, 0.1, 6);
    geometry.rotateX(-Math.PI / 2);
    return geometry;
  }, []);

  // Custom shader material for instanced rendering with fog of war
  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      vertexShader: `
        attribute vec3 instanceColor;
        attribute float instanceOpacity;
        attribute float instanceTextureId;
        
        varying vec3 vColor;
        varying float vOpacity;
        varying float vTextureId;
        varying vec2 vUv;
        
        void main() {
          vColor = instanceColor;
          vOpacity = instanceOpacity;
          vTextureId = instanceTextureId;
          vUv = uv;
          
          vec3 transformed = position;
          vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(transformed, 1.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D grassTexture;
        uniform sampler2D sandTexture;
        uniform sampler2D woodTexture;
        
        varying vec3 vColor;
        varying float vOpacity;
        varying float vTextureId;
        varying vec2 vUv;
        
        void main() {
          vec3 texColor = vColor;
          
          if (vTextureId > 0.5) {
            if (vTextureId < 1.5) {
              texColor *= texture2D(grassTexture, vUv).rgb;
            } else if (vTextureId < 2.5) {
              texColor *= texture2D(sandTexture, vUv).rgb;
            } else if (vTextureId < 3.5) {
              texColor *= texture2D(woodTexture, vUv).rgb;
            }
          }
          
          gl_FragColor = vec4(texColor, vOpacity);
        }
      `,
      uniforms: {
        grassTexture: { value: grassTexture },
        sandTexture: { value: sandTexture },
        woodTexture: { value: woodTexture }
      }
    });
  }, [grassTexture, sandTexture, woodTexture]);

  // Update instance attributes when tile data changes
  useEffect(() => {
    if (!meshRef.current || tileInstanceData.length === 0) return;

    const mesh = meshRef.current;
    const count = tileInstanceData.length;
    
    // Set up instance attributes
    const colors = new Float32Array(count * 3);
    const opacities = new Float32Array(count);
    const textureIds = new Float32Array(count);
    
    tileInstanceData.forEach((data, i) => {
      // Position (handled by instanceMatrix)
      const matrix = new THREE.Matrix4();
      matrix.setPosition(data.position[0], data.position[1], data.position[2]);
      mesh.setMatrixAt(i, matrix);
      
      // Color
      colors[i * 3] = data.color[0];
      colors[i * 3 + 1] = data.color[1];
      colors[i * 3 + 2] = data.color[2];
      
      // Opacity and texture
      opacities[i] = data.opacity;
      textureIds[i] = data.textureId;
    });
    
    mesh.geometry.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(colors, 3));
    mesh.geometry.setAttribute('instanceOpacity', new THREE.InstancedBufferAttribute(opacities, 1));
    mesh.geometry.setAttribute('instanceTextureId', new THREE.InstancedBufferAttribute(textureIds, 1));
    
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = count;
    
  }, [tileInstanceData]);

  // Handle interactions with proper raycasting for instanced rendering
  const handleClick = (event: any) => {
    if (!meshRef.current) return;
    
    // Get mouse position in normalized device coordinates
    const mouse = new THREE.Vector2();
    const rect = gl.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // Update raycaster with camera and mouse position
    raycaster.setFromCamera(mouse, camera);
    
    // Check for intersections with the instanced mesh
    const intersects = raycaster.intersectObject(meshRef.current);
    
    if (intersects.length > 0) {
      const intersection = intersects[0];
      // instanceId tells us which tile was clicked
      const instanceId = intersection.instanceId;
      
      if (instanceId !== undefined && instanceId < map.tiles.length) {
        const clickedTile = map.tiles[instanceId];
        console.log('Tile clicked:', clickedTile.coordinate);
        // TODO: Implement tile selection logic here
      }
    }
  };

  const handlePointerMove = (event: any) => {
    if (!meshRef.current) return;
    
    // Get mouse position in normalized device coordinates
    const mouse = new THREE.Vector2();
    const rect = gl.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // Update raycaster with camera and mouse position
    raycaster.setFromCamera(mouse, camera);
    
    // Check for intersections with the instanced mesh
    const intersects = raycaster.intersectObject(meshRef.current);
    
    if (intersects.length > 0) {
      const intersection = intersects[0];
      const instanceId = intersection.instanceId;
      
      if (instanceId !== undefined && instanceId < map.tiles.length) {
        const hoveredTile = map.tiles[instanceId];
        const pixelPos = hexToPixel(hoveredTile.coordinate, HEX_SIZE);
        setHoveredTile({
          x: pixelPos.x,
          z: pixelPos.z,
          tile: hoveredTile
        });
      }
    } else {
      setHoveredTile(null);
    }
  };

  return (
    <instancedMesh 
      ref={meshRef}
      args={[hexGeometry, shaderMaterial, map.tiles.length]}
      onClick={handleClick}
      onPointerMove={handlePointerMove}
    />
  );
}

// Helper functions
function getTerrainColor(terrain: string): [number, number, number] {
  switch (terrain) {
    case 'water': return [0.15, 0.39, 0.93]; // #2563eb
    case 'mountain': return [0.42, 0.45, 0.50]; // #6b7280
    case 'forest': return [0.09, 0.64, 0.29]; // #16a34a
    case 'desert': return [0.96, 0.62, 0.04]; // #f59e0b
    case 'swamp': return [0.30, 0.11, 0.58]; // #4c1d95
    case 'plains':
    default: return [0.13, 0.77, 0.37]; // #22c55e
  }
}

function getTextureId(terrain: string): number {
  switch (terrain) {
    case 'plains':
    case 'forest': return 1; // grass texture
    case 'desert': return 2; // sand texture
    case 'swamp': return 3; // wood texture
    default: return 0; // no texture
  }
}