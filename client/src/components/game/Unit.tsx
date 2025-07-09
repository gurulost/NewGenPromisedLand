import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Text, Box, Cylinder, Sphere, Cone, Torus } from "@react-three/drei";
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
import { UnitModel } from "./UnitModel";
import * as THREE from "three";

interface UnitProps {
  unit: UnitType;
  isSelected: boolean;
  onUnitClick?: (unit: UnitType) => void;
}

const UNIT_HEIGHT = 0.2;
const HEX_SIZE = 1;

export default function Unit({ unit, isSelected, onUnitClick }: UnitProps) {
  const meshRef = useRef<THREE.Group>(null);
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

  // Keep the old procedural model as backup (commented out for now)
  const ProceeduralUnitModel = useMemo(() => {
    const factionColor = faction?.color || '#888888';
    const metalColor = '#C0C0C0';
    const weaponColor = '#654321';
    const shieldColor = '#8B4513';
    const primaryColor = factionColor;
    const accentColor = faction?.id === 'NEPHITES' ? '#FFD700' : 
                        faction?.id === 'LAMANITES' ? '#8B0000' :
                        faction?.id === 'MULEKITES' ? '#4169E1' :
                        faction?.id === 'ANTI_NEPHI_LEHIES' ? '#FFFFFF' :
                        faction?.id === 'ZORAMITES' ? '#9932CC' :
                        faction?.id === 'JAREDITES' ? '#2F4F4F' : '#888888';
    
    switch (unit.type) {
      case 'warrior':
        return (
          <group scale={[0.8, 0.8, 0.8]}>
            {/* Body/Torso */}
            <Cylinder position={[0, 0.25, 0]} args={[0.15, 0.2, 0.4, 8]}>
              <meshStandardMaterial color={primaryColor} metalness={0.3} roughness={0.7} />
            </Cylinder>
            
            {/* Head/Helmet */}
            <Sphere position={[0, 0.55, 0]} args={[0.12, 8, 6]}>
              <meshStandardMaterial color={metalColor} metalness={0.8} roughness={0.2} />
            </Sphere>
            
            {/* Helmet Crest */}
            <Cylinder position={[0, 0.65, 0]} args={[0.02, 0.05, 0.15, 6]}>
              <meshStandardMaterial color={accentColor} metalness={0.6} roughness={0.4} />
            </Cylinder>
            
            {/* Shield (left arm) */}
            <Cylinder position={[-0.25, 0.3, 0]} args={[0.15, 0.15, 0.03, 8]} rotation={[0, 0, Math.PI/6]}>
              <meshStandardMaterial color={shieldColor} metalness={0.4} roughness={0.6} />
            </Cylinder>
            
            {/* Sword (right arm) */}
            <Box position={[0.25, 0.4, 0]} args={[0.03, 0.3, 0.02]} rotation={[0, 0, -Math.PI/4]}>
              <meshStandardMaterial color={metalColor} metalness={0.9} roughness={0.1} />
            </Box>
            
            {/* Sword Handle */}
            <Cylinder position={[0.25, 0.2, 0]} args={[0.02, 0.02, 0.1, 6]} rotation={[0, 0, -Math.PI/4]}>
              <meshStandardMaterial color={weaponColor} metalness={0.2} roughness={0.8} />
            </Cylinder>
            
            {/* Legs */}
            <Cylinder position={[-0.07, 0.05, 0]} args={[0.06, 0.08, 0.2, 6]}>
              <meshStandardMaterial color={primaryColor} metalness={0.3} roughness={0.7} />
            </Cylinder>
            <Cylinder position={[0.07, 0.05, 0]} args={[0.06, 0.08, 0.2, 6]}>
              <meshStandardMaterial color={primaryColor} metalness={0.3} roughness={0.7} />
            </Cylinder>
            
            {/* Cape */}
            <Box position={[0, 0.3, -0.15]} args={[0.25, 0.35, 0.02]} rotation={[0.3, 0, 0]}>
              <meshStandardMaterial color={accentColor} transparent opacity={0.8} />
            </Box>
          </group>
        );
        
      case 'stripling_warrior':
        return (
          <group scale={[0.8, 0.8, 0.8]}>
            {/* Young warrior - lighter armor, divine glow */}
            
            {/* Body */}
            <Cylinder position={[0, 0.25, 0]} args={[0.14, 0.18, 0.38, 8]}>
              <meshStandardMaterial color={primaryColor} metalness={0.2} roughness={0.6} />
            </Cylinder>
            
            {/* Head */}
            <Sphere position={[0, 0.5, 0]} args={[0.11, 8, 6]}>
              <meshStandardMaterial color="#FDBCB4" />
            </Sphere>
            
            {/* Divine Halo */}
            <Torus position={[0, 0.6, 0]} args={[0.16, 0.01, 8, 16]}>
              <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.5} />
            </Torus>
            
            {/* Light Armor Chest */}
            <Box position={[0, 0.35, 0.05]} args={[0.2, 0.15, 0.05]}>
              <meshStandardMaterial color={metalColor} metalness={0.7} roughness={0.3} />
            </Box>
            
            {/* Spear */}
            <Cylinder position={[0.2, 0.45, 0]} args={[0.015, 0.015, 0.6, 6]} rotation={[0, 0, -Math.PI/8]}>
              <meshStandardMaterial color={weaponColor} />
            </Cylinder>
            
            {/* Spear Tip */}
            <Cone position={[0.25, 0.75, 0]} args={[0.03, 0.08, 6]} rotation={[0, 0, -Math.PI/8]}>
              <meshStandardMaterial color={metalColor} metalness={0.9} roughness={0.1} />
            </Cone>
            
            {/* Small Shield */}
            <Cylinder position={[-0.2, 0.25, 0]} args={[0.12, 0.12, 0.025, 8]}>
              <meshStandardMaterial color="#FFD700" metalness={0.6} roughness={0.3} />
            </Cylinder>
            
            {/* Legs */}
            <Cylinder position={[-0.06, 0.05, 0]} args={[0.055, 0.075, 0.18, 6]}>
              <meshStandardMaterial color={primaryColor} />
            </Cylinder>
            <Cylinder position={[0.06, 0.05, 0]} args={[0.055, 0.075, 0.18, 6]}>
              <meshStandardMaterial color={primaryColor} />
            </Cylinder>
          </group>
        );
        
      case 'scout':
        return (
          <group scale={[1.0, 1.0, 1.0]}>
            {/* Lean, agile scout design */}
            
            {/* Body - slimmer */}
            <Cylinder position={[0, 0.22, 0]} args={[0.12, 0.15, 0.35, 8]}>
              <meshStandardMaterial color={primaryColor} metalness={0.1} roughness={0.9} />
            </Cylinder>
            
            {/* Head with hood */}
            <Sphere position={[0, 0.45, 0]} args={[0.1, 8, 6]}>
              <meshStandardMaterial color="#FDBCB4" />
            </Sphere>
            
            {/* Hood */}
            <Cone position={[0, 0.52, -0.02]} args={[0.14, 0.2, 8]} rotation={[0.3, 0, 0]}>
              <meshStandardMaterial color={primaryColor} transparent opacity={0.8} />
            </Cone>
            
            {/* Bow */}
            <Torus position={[-0.15, 0.35, -0.1]} args={[0.15, 0.01, 8, 16]} rotation={[0, Math.PI/4, Math.PI/6]}>
              <meshStandardMaterial color={weaponColor} />
            </Torus>
            
            {/* Quiver */}
            <Cylinder position={[0, 0.4, -0.15]} args={[0.04, 0.05, 0.2, 6]}>
              <meshStandardMaterial color={weaponColor} />
            </Cylinder>
            
            {/* Arrows */}
            <Cylinder position={[0, 0.5, -0.15]} args={[0.005, 0.005, 0.15, 4]}>
              <meshStandardMaterial color={weaponColor} />
            </Cylinder>
            <Cylinder position={[0.02, 0.52, -0.15]} args={[0.005, 0.005, 0.15, 4]}>
              <meshStandardMaterial color={weaponColor} />
            </Cylinder>
            
            {/* Boots - higher for travel */}
            <Cylinder position={[-0.06, 0.08, 0]} args={[0.05, 0.07, 0.15, 6]}>
              <meshStandardMaterial color={weaponColor} />
            </Cylinder>
            <Cylinder position={[0.06, 0.08, 0]} args={[0.05, 0.07, 0.15, 6]}>
              <meshStandardMaterial color={weaponColor} />
            </Cylinder>
            
            {/* Cloak */}
            <Box position={[0, 0.25, -0.12]} args={[0.22, 0.3, 0.015]} rotation={[0.2, 0, 0]}>
              <meshStandardMaterial color={accentColor} transparent opacity={0.7} />
            </Box>
          </group>
        );
        
      case 'missionary':
        return (
          <group scale={[1.0, 1.0, 1.0]}>
            {/* Peaceful religious figure */}
            
            {/* Robes */}
            <Cylinder position={[0, 0.25, 0]} args={[0.18, 0.22, 0.45, 8]}>
              <meshStandardMaterial color="#FFFFFF" metalness={0.0} roughness={1.0} />
            </Cylinder>
            
            {/* Head */}
            <Sphere position={[0, 0.52, 0]} args={[0.11, 8, 6]}>
              <meshStandardMaterial color="#FDBCB4" />
            </Sphere>
            
            {/* Halo */}
            <Torus position={[0, 0.62, 0]} args={[0.15, 0.008, 8, 16]}>
              <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.6} />
            </Torus>
            
            {/* Cross/Holy Symbol */}
            <Box position={[0, 0.4, 0.2]} args={[0.02, 0.1, 0.02]}>
              <meshStandardMaterial color="#FFD700" metalness={0.8} roughness={0.2} />
            </Box>
            <Box position={[0, 0.45, 0.2]} args={[0.06, 0.02, 0.02]}>
              <meshStandardMaterial color="#FFD700" metalness={0.8} roughness={0.2} />
            </Box>
            
            {/* Staff */}
            <Cylinder position={[0.25, 0.35, 0]} args={[0.015, 0.015, 0.7, 6]}>
              <meshStandardMaterial color={weaponColor} />
            </Cylinder>
            
            {/* Staff Top Ornament */}
            <Sphere position={[0.25, 0.7, 0]} args={[0.04, 8, 6]}>
              <meshStandardMaterial color="#FFD700" metalness={0.8} roughness={0.2} />
            </Sphere>
            
            {/* Prayer Beads */}
            <Torus position={[-0.15, 0.3, 0.1]} args={[0.05, 0.008, 8, 16]}>
              <meshStandardMaterial color="#8B4513" />
            </Torus>
            
            {/* Divine Light Effect */}
            <Sphere position={[0, 0.3, 0]} args={[0.3, 8, 6]}>
              <meshStandardMaterial 
                color="#FFFFFF" 
                transparent 
                opacity={0.1} 
                emissive="#FFFFFF" 
                emissiveIntensity={0.2} 
              />
            </Sphere>
          </group>
        );
        
      case 'commander':
        return (
          <group scale={[0.8, 0.8, 0.8]}>
            {/* Elite commander with ornate armor */}
            
            {/* Body - Heavy Armor */}
            <Cylinder position={[0, 0.28, 0]} args={[0.16, 0.22, 0.45, 8]}>
              <meshStandardMaterial color={metalColor} metalness={0.8} roughness={0.2} />
            </Cylinder>
            
            {/* Ornate Chest Plate */}
            <Box position={[0, 0.4, 0.08]} args={[0.25, 0.2, 0.06]}>
              <meshStandardMaterial color={accentColor} metalness={0.9} roughness={0.1} />
            </Box>
            
            {/* Head with Crown/Plume */}
            <Sphere position={[0, 0.6, 0]} args={[0.13, 8, 6]}>
              <meshStandardMaterial color={metalColor} metalness={0.8} roughness={0.2} />
            </Sphere>
            
            {/* Command Plume */}
            <Box position={[0, 0.75, 0]} args={[0.03, 0.2, 0.08]} rotation={[0.2, 0, 0]}>
              <meshStandardMaterial color={accentColor} transparent opacity={0.9} />
            </Box>
            
            {/* Large Sword */}
            <Box position={[0.3, 0.5, 0]} args={[0.04, 0.4, 0.03]} rotation={[0, 0, -Math.PI/6]}>
              <meshStandardMaterial color={metalColor} metalness={0.95} roughness={0.05} />
            </Box>
            
            {/* Sword Hilt */}
            <Box position={[0.25, 0.25, 0]} args={[0.1, 0.03, 0.03]} rotation={[0, 0, -Math.PI/6]}>
              <meshStandardMaterial color={accentColor} metalness={0.8} roughness={0.3} />
            </Box>
            
            {/* Tower Shield */}
            <Box position={[-0.3, 0.35, 0]} args={[0.04, 0.35, 0.2]} rotation={[0, 0, Math.PI/8]}>
              <meshStandardMaterial color={primaryColor} metalness={0.6} roughness={0.4} />
            </Box>
            
            {/* Shield Emblem */}
            <Sphere position={[-0.3, 0.35, 0.12]} args={[0.04, 8, 6]}>
              <meshStandardMaterial color={accentColor} metalness={0.8} roughness={0.2} />
            </Sphere>
            
            {/* Armored Legs */}
            <Cylinder position={[-0.08, 0.08, 0]} args={[0.07, 0.09, 0.22, 6]}>
              <meshStandardMaterial color={metalColor} metalness={0.7} roughness={0.3} />
            </Cylinder>
            <Cylinder position={[0.08, 0.08, 0]} args={[0.07, 0.09, 0.22, 6]}>
              <meshStandardMaterial color={metalColor} metalness={0.7} roughness={0.3} />
            </Cylinder>
            
            {/* Command Aura */}
            <Torus position={[0, 0.1, 0]} args={[0.4, 0.01, 8, 16]} rotation={[-Math.PI/2, 0, 0]}>
              <meshStandardMaterial 
                color={accentColor} 
                emissive={accentColor} 
                emissiveIntensity={0.3} 
                transparent 
                opacity={0.6} 
              />
            </Torus>
          </group>
        );
        
      default:
        return (
          <group scale={[1.0, 1.0, 1.0]}>
            {/* Default unit - simple but detailed */}
            <Cylinder position={[0, 0.2, 0]} args={[0.12, 0.15, 0.3, 8]}>
              <meshStandardMaterial color={primaryColor} metalness={0.4} roughness={0.6} />
            </Cylinder>
            
            <Sphere position={[0, 0.4, 0]} args={[0.09, 8, 6]}>
              <meshStandardMaterial color="#FDBCB4" />
            </Sphere>
            
            <Cylinder position={[-0.05, 0.05, 0]} args={[0.04, 0.06, 0.15, 6]}>
              <meshStandardMaterial color={primaryColor} />
            </Cylinder>
            <Cylinder position={[0.05, 0.05, 0]} args={[0.04, 0.06, 0.15, 6]}>
              <meshStandardMaterial color={primaryColor} />
            </Cylinder>
          </group>
        );
    }
  }, [unit.type, faction]);

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
      {/* AAA-Quality Unit Model */}
      <group
        ref={meshRef}
        position={[0, UNIT_HEIGHT, 0]}
        onClick={handleClick}
        onPointerEnter={() => document.body.style.cursor = 'pointer'}
        onPointerLeave={() => document.body.style.cursor = 'default'}
      >
        <group
          scale={unit.status === 'exhausted' ? [0.9, 0.9, 0.9] : [1.0, 1.0, 1.0]}
        >
          {/* Use the new 3D unit model */}
          <UnitModel 
            unit={unit}
            position={{ x: 0, y: -UNIT_HEIGHT + 0.025 }}
            isPlayerUnit={gameState?.players[gameState.currentPlayerIndex]?.id === unit.playerId}
          />
          
          {/* Status Effect Visual Indicators */}
          {unit.status === 'stealthed' && (
            <mesh position={[0, 0.8, 0]}>
              <ringGeometry args={[0.2, 0.3, 8]} />
              <meshBasicMaterial 
                color="#4169E1" 
                transparent 
                opacity={0.6}
              />
            </mesh>
          )}
          
          {unit.status === 'rallied' && (
            <mesh position={[0, 0.8, 0]}>
              <ringGeometry args={[0.2, 0.3, 8]} />
              <meshBasicMaterial 
                color="#FFD700" 
                transparent 
                opacity={0.8}
              />
            </mesh>
          )}
          
          {unit.status === 'formation' && (
            <mesh position={[0, 0.8, 0]}>
              <ringGeometry args={[0.2, 0.3, 4]} />
              <meshBasicMaterial 
                color="#32CD32" 
                transparent 
                opacity={0.7}
              />
            </mesh>
          )}
          
          {unit.status === 'siege_mode' && (
            <mesh position={[0, 0.8, 0]}>
              <boxGeometry args={[0.4, 0.1, 0.4]} />
              <meshBasicMaterial 
                color="#8B0000" 
                transparent 
                opacity={0.8}
              />
            </mesh>
          )}
        </group>
      </group>

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
