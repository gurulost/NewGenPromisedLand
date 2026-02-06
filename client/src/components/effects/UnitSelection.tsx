import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { HexCoordinate } from '@shared/types/coordinates';

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


// UI Selection Polish Component
export function UnitSelectionUI({ 
  selectedUnit, 
  onUnitAction 
}: { 
  selectedUnit: any; 
  onUnitAction: (action: string) => void; 
}) {
  if (!selectedUnit) return null;

  return (
    <motion.div
      className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-[var(--z-floating)] pointer-events-auto"
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
              disabled={(selectedUnit.actionsRemaining ?? selectedUnit.maxActions ?? 1) <= 0}
            />
            <ActionButton
              icon="🏃"
              label="Move"
              hotkey="M"
              onClick={() => onUnitAction('move')}
              disabled={(selectedUnit.currentMovement || selectedUnit.remainingMovement || 0) === 0}
            />
            <ActionButton
              icon="⚡"
              label="Ability"
              hotkey="Q"
              onClick={() => onUnitAction('ability')}
              disabled={(selectedUnit.actionsRemaining ?? selectedUnit.maxActions ?? 1) <= 0}
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
  disabled = false 
}: {
  icon: string;
  label: string;
  hotkey: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <motion.button
      className={`
        relative flex flex-col items-center gap-1 p-2 rounded-lg border transition-all
        ${disabled 
          ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed' 
          : 'bg-slate-700 border-slate-500 text-white hover:bg-slate-600 hover:border-slate-400'
        }
      `}
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? {} : { scale: 1.05 }}
      whileTap={disabled ? {} : { scale: 0.95 }}
    >
      <span className="text-lg">{icon}</span>
      <span className="text-xs font-medium">{label}</span>
      
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
