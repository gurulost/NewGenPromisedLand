import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { Unit as UnitType } from "@shared/types/unit";
import { hexToPixel } from "@shared/utils/hex";
import { getFaction } from "@shared/data/factions";
import { getReachableTiles } from "@shared/logic/pathfinding";
import { useGameState } from "../../lib/stores/useGameState";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import * as THREE from "three";

interface UnitProps {
  unit: UnitType;
  isSelected: boolean;
}

const UNIT_HEIGHT = 0.5;
const HEX_SIZE = 1;

export default function Unit({ unit, isSelected }: UnitProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { setSelectedUnit, setReachableTiles } = useGameState();
  const { gameState } = useLocalGame();
  
  const pixelPos = hexToPixel(unit.coordinate, HEX_SIZE);
  
  // Get player and faction info
  const player = gameState?.players.find(p => p.id === unit.playerId);
  const faction = player ? getFaction(player.factionId as any) : null;
  
  // Calculate reachable tiles when this unit is selected
  useEffect(() => {
    if (isSelected && gameState) {
      console.log('Calculating reachable tiles for unit:', unit.id, 'Movement:', unit.remainingMovement);
      
      const isPassable = (coord: any): boolean => {
        const tile = gameState.map.tiles.find(t => 
          t.coordinate.q === coord.q && t.coordinate.r === coord.r
        );
        return !!(tile && tile.terrain !== 'water' && tile.terrain !== 'mountain');
      };
      
      const reachable = getReachableTiles(
        unit.coordinate, 
        unit.remainingMovement, 
        isPassable
      );
      
      const reachableKeys = reachable.map(coord => `${coord.q},${coord.r}`);
      console.log('Reachable tiles:', reachableKeys);
      setReachableTiles(reachableKeys);
    } else if (!isSelected) {
      setReachableTiles([]);
    }
  }, [isSelected, unit.coordinate, unit.remainingMovement, gameState, setReachableTiles]);
  
  // Animation for selected unit
  useFrame((state) => {
    if (meshRef.current && isSelected) {
      meshRef.current.position.y = UNIT_HEIGHT + Math.sin(state.clock.elapsedTime * 3) * 0.1;
    }
  });

  // Unit geometry based on type
  const geometry = useMemo(() => {
    switch (unit.type) {
      case 'warrior':
      case 'stripling_warrior':
        return new THREE.ConeGeometry(0.3, 0.8, 8);
      case 'missionary':
        return new THREE.SphereGeometry(0.25, 8, 6);
      case 'scout':
        return new THREE.CylinderGeometry(0.2, 0.3, 0.6, 6);
      case 'commander':
        return new THREE.CylinderGeometry(0.4, 0.4, 0.9, 8);
      default:
        return new THREE.BoxGeometry(0.4, 0.6, 0.4);
    }
  }, [unit.type]);

  const handleClick = () => {
    console.log('Unit clicked:', unit.id, 'Current player:', gameState?.players[gameState.currentPlayerIndex]?.id, 'Unit player:', unit.playerId);
    setSelectedUnit(unit);
  };

  // Health bar color
  const healthPercent = unit.hp / unit.maxHp;
  const healthColor = healthPercent > 0.6 ? "#22c55e" : 
                     healthPercent > 0.3 ? "#f59e0b" : "#ef4444";

  return (
    <group position={[pixelPos.x, 0, pixelPos.z]}>
      {/* Unit mesh */}
      <mesh
        ref={meshRef}
        geometry={geometry}
        position={[0, UNIT_HEIGHT, 0]}
        onClick={handleClick}
        onPointerEnter={() => document.body.style.cursor = 'pointer'}
        onPointerLeave={() => document.body.style.cursor = 'default'}
      >
        <meshLambertMaterial 
          color={faction?.color || '#888888'}
          transparent={unit.status === 'exhausted'}
          opacity={unit.status === 'exhausted' ? 0.7 : 1}
        />
      </mesh>

      {/* Selection ring */}
      {isSelected && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.6, 0.8, 16]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
        </mesh>
      )}

      {/* Health bar */}
      <group position={[0, UNIT_HEIGHT * 2 + 0.3, 0]}>
        {/* Background */}
        <mesh position={[0, 0, 0]}>
          <planeGeometry args={[0.6, 0.08]} />
          <meshBasicMaterial color="#333333" transparent opacity={0.8} />
        </mesh>
        
        {/* Health fill */}
        <mesh position={[-0.3 + (0.6 * healthPercent) / 2, 0, 0.001]}>
          <planeGeometry args={[0.6 * healthPercent, 0.06]} />
          <meshBasicMaterial color={healthColor} />
        </mesh>
      </group>

      {/* Unit type label */}
      <Text
        position={[0, UNIT_HEIGHT * 2 + 0.6, 0]}
        fontSize={0.2}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {unit.type.replace('_', ' ').toUpperCase()}
      </Text>

      {/* Movement indicator for selected unit */}
      {isSelected && unit.remainingMovement > 0 && (
        <Text
          position={[0, UNIT_HEIGHT * 2 + 0.8, 0]}
          fontSize={0.15}
          color="#60a5fa"
          anchorX="center"
          anchorY="middle"
        >
          Move: {unit.remainingMovement}
        </Text>
      )}
    </group>
  );
}
