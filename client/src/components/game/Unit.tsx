import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { Unit as UnitType } from "@shared/types/unit";
import { hexToPixel } from "@shared/utils/hex";
import { getFaction } from "@shared/data/factions";
import { canSelectUnit, isPassableForUnit } from "@shared/logic/unitLogic";
import { getVisibleTilesInRange } from "@shared/utils/lineOfSight";
import { getUnitDefinition } from "@shared/data/units";
import { usePathfindingWorker } from "../../hooks/usePathfindingWorker";
import { useGameState } from "../../lib/stores/useGameState";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { useGameDebugger } from "../../utils/gameDebug";
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
  const { getReachableTiles: getReachableTilesWorker } = usePathfindingWorker();
  const debug = useGameDebugger();
  
  const pixelPos = hexToPixel(unit.coordinate, HEX_SIZE);
  
  // Debug unit rendering
  console.log(`🎨 Unit ${unit.id} rendering:`, {
    coordinate: unit.coordinate,
    pixelPos,
    type: unit.type,
    playerId: unit.playerId,
    visionRadius: unit.visionRadius,
    attackRange: unit.attackRange,
    isSelected
  });
  
  // Get player and faction info
  const player = gameState?.players.find(p => p.id === unit.playerId);
  const faction = player ? getFaction(player.factionId as any) : null;
  const currentPlayer = gameState?.players[gameState?.currentPlayerIndex || 0];
  const isCurrentPlayerUnit = currentPlayer?.id === unit.playerId;

  // Units are already filtered by GameCanvas using getVisibleUnits()
  // No need for additional visibility checks here - just render the unit
  console.log(`✅ Unit ${unit.id} passed visibility filter and is rendering`);
  
  // Calculate reachable tiles when this unit is selected (using web worker)
  useEffect(() => {
    if (isSelected && gameState) {
      console.log('Calculating reachable tiles for unit:', unit.id, 'Movement:', unit.remainingMovement);
      
      // Generate passable tiles list for the worker
      const passableTiles = gameState.map.tiles
        .filter(tile => isPassableForUnit(tile.coordinate, gameState, unit))
        .map(tile => `${tile.coordinate.q},${tile.coordinate.r}`);
      
      // Use worker for pathfinding calculation
      getReachableTilesWorker(
        unit.coordinate,
        unit.remainingMovement,
        passableTiles,
        (reachable, error) => {
          if (error) {
            console.error('Pathfinding worker error:', error);
            setReachableTiles([]);
            return;
          }
          
          const reachableKeys = reachable.map(coord => `${coord.q},${coord.r}`);
          console.log('Reachable tiles:', reachableKeys);
          setReachableTiles(reachableKeys);
        }
      );
    } else if (!isSelected) {
      setReachableTiles([]);
    }
  }, [isSelected, unit.coordinate, unit.remainingMovement, gameState, setReachableTiles, getReachableTilesWorker]);
  
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
    
    if (gameState && canSelectUnit(unit, gameState)) {
      setSelectedUnit(unit);
    } else {
      console.log('Cannot select unit - not current player\'s turn');
    }
  };

  // Health bar color
  const healthPercent = unit.hp / unit.maxHp;
  const healthColor = healthPercent > 0.6 ? "#22c55e" : 
                     healthPercent > 0.3 ? "#f59e0b" : "#ef4444";

  return (
    <group position={[pixelPos.x, 0, pixelPos.y]}>
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
          transparent={unit.status === 'exhausted' || !isCurrentPlayerUnit}
          opacity={unit.status === 'exhausted' ? 0.7 : !isCurrentPlayerUnit ? 0.4 : 1}
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
