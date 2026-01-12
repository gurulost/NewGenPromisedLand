import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { hexToPixel } from "@shared/utils/hex";
import { HexCoordinate } from "@shared/types/coordinates";

interface MovementOverlayProps {
  reachableTiles: HexCoordinate[];
  selectedTile?: HexCoordinate | null;
  onTileHover?: (coordinate: HexCoordinate | null) => void;
  onTileClick?: (coordinate: HexCoordinate) => void;
}

const HEX_SIZE = 1;

export default function MovementOverlay({ 
  reachableTiles, 
  selectedTile,
  onTileHover,
  onTileClick 
}: MovementOverlayProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const hoveredMeshRef = useRef<THREE.InstancedMesh>(null);
  const timeRef = useRef(0);

  // Create hex geometry for overlays
  const hexGeometry = useMemo(() => {
    const geometry = new THREE.CylinderGeometry(HEX_SIZE * 0.9, HEX_SIZE * 0.9, 0.02, 6, 1);
    geometry.rotateY(Math.PI / 6); // Align with flat-top hexagon
    return geometry;
  }, []);

  // Create materials with professional AAA game styling
  const movementMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color(0x4ade80), // Emerald green
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  const hoveredMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color(0xfbbf24), // Amber yellow
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  const selectedMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color(0x3b82f6), // Blue
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  // Create border geometry for elegant tile borders
  const borderGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    const radius = HEX_SIZE * 0.92;
    
    // Create hexagon border path
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3 + Math.PI / 6;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      
      if (i === 0) {
        shape.moveTo(x, z);
      } else {
        shape.lineTo(x, z);
      }
    }
    shape.closePath();

    const geometry = new THREE.ShapeGeometry(shape);
    return geometry;
  }, []);

  const borderMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color(0x10b981), // Emerald
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }, []);

  // Animate the movement tiles with subtle pulsing
  useFrame((state, delta) => {
    timeRef.current += delta;
    
    // Animate pulsing effect for movement tiles
    const pulseIntensity = 0.5 + Math.sin(timeRef.current * 3) * 0.15;
    movementMaterial.opacity = pulseIntensity;
  });

  // Set up instanced mesh positions
  useMemo(() => {
    if (!meshRef.current || reachableTiles.length === 0) return;

    const matrix = new THREE.Matrix4();
    reachableTiles.forEach((coord, index) => {
      const pixelPos = hexToPixel(coord, HEX_SIZE);
      matrix.setPosition(pixelPos.x, 0.05, pixelPos.y);
      meshRef.current!.setMatrixAt(index, matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [reachableTiles]);

  // Handle hovered tile
  useMemo(() => {
    if (!hoveredMeshRef.current) return;

    if (selectedTile && reachableTiles.some(tile => 
      tile.q === selectedTile.q && tile.r === selectedTile.r
    )) {
      const matrix = new THREE.Matrix4();
      const pixelPos = hexToPixel(selectedTile, HEX_SIZE);
      matrix.setPosition(pixelPos.x, 0.06, pixelPos.y);
      hoveredMeshRef.current.setMatrixAt(0, matrix);
      hoveredMeshRef.current.instanceMatrix.needsUpdate = true;
      hoveredMeshRef.current.count = 1;
    } else {
      hoveredMeshRef.current.count = 0;
    }
  }, [selectedTile, reachableTiles]);

  if (reachableTiles.length === 0) return null;

  return (
    <group>
      {/* Movement Range Borders - Elegant outline effect */}
      {reachableTiles.map((coord, index) => {
        const pixelPos = hexToPixel(coord, HEX_SIZE);
        return (
          <mesh
            key={`border-${coord.q}-${coord.r}`}
            position={[pixelPos.x, 0.051, pixelPos.y]}
            rotation={[-Math.PI / 2, 0, 0]}
            geometry={borderGeometry}
            material={borderMaterial}
            onClick={(e) => {
              e.stopPropagation();
              onTileClick?.(coord);
            }}
            onPointerEnter={(e) => {
              e.stopPropagation();
              onTileHover?.(coord);
            }}
            onPointerLeave={(e) => {
              e.stopPropagation();
              onTileHover?.(null);
            }}
          />
        );
      })}

      {/* Main Movement Tiles - Interactive */}
      {reachableTiles.map((coord, index) => {
        const pixelPos = hexToPixel(coord, HEX_SIZE);
        return (
          <mesh
            key={`movement-${coord.q}-${coord.r}`}
            position={[pixelPos.x, 0.05, pixelPos.y]}
            geometry={hexGeometry}
            material={movementMaterial}
            onClick={(e) => {
              e.stopPropagation();
              onTileClick?.(coord);
            }}
            onPointerEnter={(e) => {
              e.stopPropagation();
              onTileHover?.(coord);
            }}
            onPointerLeave={(e) => {
              e.stopPropagation();
              onTileHover?.(null);
            }}
          />
        );
      })}

      {/* Hovered Tile Highlight */}
      <instancedMesh
        ref={hoveredMeshRef}
        args={[hexGeometry, hoveredMaterial, 1]}
        count={0}
      />

      {/* Movement Range Indicators intentionally removed to avoid dueling overlays */}
    </group>
  );
}
