import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { HexCoordinate } from '@shared/types/coordinates';
import { useLocalGame } from '../../lib/stores/useLocalGame';
import { getUnitAbilityStates } from '../../utils/unitAbilityState';

interface UnitSelectionProps {
  selectedCoordinate: HexCoordinate | null;
  hoveredCoordinate: HexCoordinate | null;
  validMoveCoordinates: HexCoordinate[];
  validAttackCoordinates: HexCoordinate[];
}

export function UnitSelectionEffects({
  selectedCoordinate,
  hoveredCoordinate,
  validMoveCoordinates,
  validAttackCoordinates
}: UnitSelectionProps) {
  return (
    <group>
      {/* Selected Unit Glow */}
      {selectedCoordinate && (
        <SelectionGlow coordinate={selectedCoordinate} type="selected" />
      )}

      {/* Hovered Tile Highlight */}
      {hoveredCoordinate && (
        <SelectionGlow coordinate={hoveredCoordinate} type="hovered" />
      )}

      {/* Movement Range Indicators */}
      {validMoveCoordinates.map((coord, index) => {
        return (
          <MovementIndicator 
            key={`move-${coord.q}-${coord.r}-${coord.s}`}
            coordinate={coord}
            delay={index * 0.05}
          />
        );
      })}

      {/* Attack Range Indicators */}
      {validAttackCoordinates.map((coord, index) => (
        <AttackIndicator 
          key={`attack-${coord.q}-${coord.r}-${coord.s}`}
          coordinate={coord}
          delay={index * 0.03}
        />
      ))}
    </group>
  );
}

export function AbilityTargetHighlights({
  coordinates,
  selectedCoordinate,
}: {
  coordinates: HexCoordinate[];
  selectedCoordinate?: HexCoordinate | null;
}) {
  return (
    <group>
      {coordinates.map((coordinate, index) => (
        <AbilityTargetIndicator
          key={`ability-${coordinate.q}-${coordinate.r}-${coordinate.s}`}
          coordinate={coordinate}
          delay={index * 0.04}
          isSelected={
            Boolean(
              selectedCoordinate &&
              coordinate.q === selectedCoordinate.q &&
              coordinate.r === selectedCoordinate.r &&
              coordinate.s === selectedCoordinate.s
            )
          }
        />
      ))}
    </group>
  );
}

function SelectionGlow({ 
  coordinate, 
  type 
}: { 
  coordinate: HexCoordinate; 
  type: 'selected' | 'hovered' 
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);

  const hexPosition = coordinateToWorldPosition(coordinate);

  useFrame((state) => {
    if (!materialRef.current) return;

    const time = state.clock.getElapsedTime();
    
    if (type === 'selected') {
      // Pulsing golden glow for selected units
      const intensity = 0.3 + Math.sin(time * 3) * 0.2;
      materialRef.current.opacity = intensity;
      
      if (meshRef.current) {
        meshRef.current.rotation.z = time * 0.5;
        meshRef.current.scale.setScalar(1 + Math.sin(time * 2) * 0.1);
      }
    } else {
      // Subtle blue glow for hovered tiles
      const intensity = 0.2 + Math.sin(time * 4) * 0.1;
      materialRef.current.opacity = intensity;
    }
  });

  const color = type === 'selected' ? '#FFD700' : '#4A90E2';
  const size = type === 'selected' ? 1.4 : 1.2;

  return (
    <mesh
      ref={meshRef}
      position={[hexPosition.x, 0.02, hexPosition.z]}
      rotation={[Math.PI / 2, 0, 0]}
    >
      <ringGeometry args={[0.8, size, 32]} />
      <meshBasicMaterial
        ref={materialRef}
        color={color}
        transparent
        opacity={0.3}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function MovementIndicator({ 
  coordinate, 
  delay = 0 
}: { 
  coordinate: HexCoordinate; 
  delay?: number; 
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const outerRingRef = useRef<THREE.Mesh>(null);
  const outerMaterialRef = useRef<THREE.MeshBasicMaterial>(null);

  const hexPosition = coordinateToWorldPosition(coordinate);

  useFrame((state) => {
    if (!materialRef.current || !meshRef.current || !outerMaterialRef.current || !outerRingRef.current) return;

    const time = state.clock.getElapsedTime() + delay;
    
    // Elegant pulsing animation with wave effect
    const pulse = 0.5 + Math.sin(time * 2.5) * 0.3;
    const outerPulse = 0.2 + Math.sin(time * 3 + 0.5) * 0.2;
    
    materialRef.current.opacity = pulse;
    outerMaterialRef.current.opacity = outerPulse;
    
    // Gentle scale animation with offset
    const scale = 1 + Math.sin(time * 1.8) * 0.15;
    const outerScale = 1 + Math.sin(time * 2.2 + 1) * 0.1;
    
    meshRef.current.scale.setScalar(scale);
    outerRingRef.current.scale.setScalar(outerScale);
    
    // Subtle rotation for elegance
    outerRingRef.current.rotation.z = time * 0.3;
  });

  return (
    <group position={[hexPosition.x, 0.03, hexPosition.z]}>
      {/* Main movement indicator */}
      <mesh
        ref={meshRef}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[0.7, 32]} />
        <meshBasicMaterial
          ref={materialRef}
          color="#00E5FF"
          transparent
          opacity={0.5}
        />
      </mesh>
      
      {/* Outer elegant ring */}
      <mesh
        ref={outerRingRef}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.8, 1.0, 32]} />
        <meshBasicMaterial
          ref={outerMaterialRef}
          color="#40E0D0"
          transparent
          opacity={0.2}
        />
      </mesh>
      
      {/* Hexagonal border for precision */}
      <mesh
        position={[0, 0.001, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.85, 0.95, 6]} />
        <meshBasicMaterial
          color="#FFFFFF"
          transparent
          opacity={0.6}
        />
      </mesh>
    </group>
  );
}

function AbilityTargetIndicator({
  coordinate,
  delay = 0,
  isSelected = false,
}: {
  coordinate: HexCoordinate;
  delay?: number;
  isSelected?: boolean;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  const ringMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const auraRef = useRef<THREE.Mesh>(null);
  const auraMaterialRef = useRef<THREE.MeshBasicMaterial>(null);

  const hexPosition = coordinateToWorldPosition(coordinate);

  useFrame((state) => {
    if (!ringRef.current || !ringMaterialRef.current || !auraRef.current || !auraMaterialRef.current) return;

    const time = state.clock.getElapsedTime() + delay;
    const baseRingOpacity = isSelected ? 0.6 : 0.45;
    const baseAuraOpacity = isSelected ? 0.35 : 0.25;
    const ringPulse = baseRingOpacity + Math.sin(time * 3) * 0.25;
    const auraPulse = baseAuraOpacity + Math.sin(time * 2.2) * 0.2;

    ringMaterialRef.current.opacity = ringPulse;
    auraMaterialRef.current.opacity = auraPulse;

    const scaleBase = isSelected ? 1.1 : 1;
    const scale = scaleBase + Math.sin(time * 1.6) * 0.12;
    ringRef.current.scale.setScalar(scale);
    auraRef.current.rotation.z = time * 0.6;
  });

  return (
    <group position={[hexPosition.x, 0.04, hexPosition.z]}>
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.75, 1.05, 32]} />
        <meshBasicMaterial
          ref={ringMaterialRef}
          color={isSelected ? '#f59e0b' : '#fbbf24'}
          transparent
          opacity={0.45}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={auraRef} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <circleGeometry args={[0.65, 32]} />
        <meshBasicMaterial
          ref={auraMaterialRef}
          color={isSelected ? '#facc15' : '#fcd34d'}
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

function AttackIndicator({ 
  coordinate, 
  delay = 0 
}: { 
  coordinate: HexCoordinate; 
  delay?: number; 
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);

  const hexPosition = coordinateToWorldPosition(coordinate);

  useFrame((state) => {
    if (!materialRef.current || !meshRef.current) return;

    const time = state.clock.getElapsedTime() + delay;
    
    // More aggressive pulsing for attack indicators
    const pulse = 0.3 + Math.sin(time * 3) * 0.3;
    materialRef.current.opacity = pulse;
    
    // Slight rotation
    meshRef.current.rotation.z = time * 0.8;
  });

  return (
    <mesh
      ref={meshRef}
      position={[hexPosition.x, 0.01, hexPosition.z]}
      rotation={[Math.PI / 2, 0, 0]}
    >
      <ringGeometry args={[0.4, 0.8, 6]} />
      <meshBasicMaterial
        ref={materialRef}
        color="#FF4444"
        transparent
        opacity={0.3}
      />
    </mesh>
  );
}

// UI Selection Polish Component
export function UnitSelectionUI({ 
  selectedUnit, 
  onUnitAction 
}: { 
  selectedUnit: any; 
  onUnitAction: (action: string) => void; 
}) {
  const { gameState } = useLocalGame();
  const currentPlayer = gameState?.players.find(player => player.id === selectedUnit?.playerId) ?? null;
  const abilityStates = selectedUnit && currentPlayer && gameState
    ? getUnitAbilityStates(selectedUnit, currentPlayer, gameState)
    : [];
  const activeAbilities = abilityStates.filter(state => !state.isPassive);
  const highlightedAbility =
    activeAbilities.find(state => state.status === 'ready') ??
    activeAbilities[0] ??
    null;

  const abilityStatusText = highlightedAbility
    ? highlightedAbility.status === 'ready'
      ? 'Ready'
      : highlightedAbility.reason || (highlightedAbility.status === 'exhausted' ? 'Spent this turn' : 'Unavailable')
    : abilityStates.length === 0
      ? 'No abilities'
      : 'Passive only';

  const abilityButtonTone: 'ready' | 'warning' | 'muted' | 'default' =
    highlightedAbility
      ? highlightedAbility.status === 'ready'
        ? 'ready'
        : highlightedAbility.status === 'exhausted'
          ? 'muted'
          : 'warning'
      : abilityStates.length === 0
        ? 'muted'
        : 'default';

  const abilityButtonDisabled = activeAbilities.length === 0;

  if (!selectedUnit) return null;

  return (
    <motion.div
      className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-40 pointer-events-auto"
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="bg-slate-900/95 backdrop-blur-md rounded-xl border border-slate-600 p-4 shadow-2xl">
        <div className="flex items-center gap-4">
          {/* Unit Icon */}
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-2xl">⚔️</span>
          </div>

          {/* Unit Info */}
          <div className="flex-1">
            <h3 className="font-semibold text-white font-cinzel">
              {selectedUnit.type} 
            </h3>
            <div className="flex gap-4 text-sm text-slate-300">
              <span>❤️ {selectedUnit.currentHp || selectedUnit.hp}/{selectedUnit.maxHp}</span>
              <span>🏃 {selectedUnit.currentMovement || selectedUnit.remainingMovement}/{selectedUnit.maxMovement || selectedUnit.movement}</span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2">
            <ActionButton
              icon="🎯"
              label="Attack"
              hotkey="A"
              onClick={() => onUnitAction('attack')}
              disabled={selectedUnit.hasAttacked}
            />
            <ActionButton
              icon="🏃"
              label="Move"
              hotkey="M"
              onClick={() => onUnitAction('move')}
              disabled={(selectedUnit.currentMovement || selectedUnit.remainingMovement || 0) === 0}
            />
            <ActionButton
              icon={highlightedAbility?.status === 'ready' ? '✨' : '⚡'}
              label={highlightedAbility?.name || 'Ability'}
              hotkey="Q"
              onClick={() => onUnitAction('ability')}
              disabled={abilityButtonDisabled}
              subtitle={abilityStatusText}
              tone={abilityButtonTone}
              tooltip={highlightedAbility?.description || abilityStatusText}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ActionButton({ 
  icon, 
  label, 
  hotkey, 
  onClick, 
  disabled = false,
  subtitle,
  tooltip,
  tone = 'default',
}: {
  icon: string;
  label: string;
  hotkey: string;
  onClick: () => void;
  disabled?: boolean;
  subtitle?: string;
  tooltip?: string;
  tone?: 'default' | 'ready' | 'warning' | 'muted';
}) {
  const toneClass = disabled
    ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
    : tone === 'ready'
      ? 'bg-emerald-600/90 border-emerald-400 text-white hover:bg-emerald-500/90 hover:border-emerald-300'
      : tone === 'warning'
        ? 'bg-amber-700/90 border-amber-500 text-amber-100 hover:bg-amber-600/90 hover:border-amber-400'
        : tone === 'muted'
          ? 'bg-slate-800 border-slate-600 text-slate-300'
          : 'bg-slate-700 border-slate-500 text-white hover:bg-slate-600 hover:border-slate-400';

  return (
    <motion.button
      className={`
        relative flex flex-col items-center gap-1 p-2 rounded-lg border transition-all min-w-[72px]
        ${toneClass}
      `}
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      whileHover={disabled ? {} : { scale: 1.05 }}
      whileTap={disabled ? {} : { scale: 0.95 }}
    >
      <span className="text-lg">{icon}</span>
      <span className="text-xs font-semibold text-center leading-tight">{label}</span>
      {subtitle && (
        <span className="text-[10px] text-slate-300 leading-tight text-center">
          {subtitle}
        </span>
      )}
      
      {/* Hotkey Indicator */}
      <div className="absolute -top-1 -right-1 bg-slate-600 text-xs px-1 rounded border border-slate-500">
        {hotkey}
      </div>
    </motion.button>
  );
}

// Utility function to convert hex coordinates to world position
function coordinateToWorldPosition(coordinate: HexCoordinate): { x: number; z: number } {
  const size = 1;
  const x = size * (3/2 * coordinate.q);
  const z = size * (Math.sqrt(3)/2 * coordinate.q + Math.sqrt(3) * coordinate.r);
  return { x, z };
}

// Hook for managing unit selection state
export function useUnitSelection() {
  const [selectedCoordinate, setSelectedCoordinate] = useState<HexCoordinate | null>(null);
  const [hoveredCoordinate, setHoveredCoordinate] = useState<HexCoordinate | null>(null);
  const [validMoveCoordinates, setValidMoveCoordinates] = useState<HexCoordinate[]>([]);
  const [validAttackCoordinates, setValidAttackCoordinates] = useState<HexCoordinate[]>([]);

  const selectUnit = (coordinate: HexCoordinate, moveCoords: HexCoordinate[] = [], attackCoords: HexCoordinate[] = []) => {
    setSelectedCoordinate(coordinate);
    setValidMoveCoordinates(moveCoords);
    setValidAttackCoordinates(attackCoords);
  };

  const clearSelection = () => {
    setSelectedCoordinate(null);
    setValidMoveCoordinates([]);
    setValidAttackCoordinates([]);
  };

  const hoverTile = (coordinate: HexCoordinate | null) => {
    setHoveredCoordinate(coordinate);
  };

  return {
    selectedCoordinate,
    hoveredCoordinate,
    validMoveCoordinates,
    validAttackCoordinates,
    selectUnit,
    clearSelection,
    hoverTile
  };
}
