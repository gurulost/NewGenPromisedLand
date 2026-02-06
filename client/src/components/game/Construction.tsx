import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { hexToPixel } from "@shared/utils/hex";
import { ConstructionItem } from "@shared/types/game";
import { disposeClonedMaterials } from "../../lib/memoryUtils";
import { getImprovementModelPath, getStructureModelPath, getUnitModelPath } from "../../utils/modelManager";

interface ConstructionProps {
  construction: ConstructionItem;
}

const HEX_SIZE = 1;
const PARTICLE_COUNT = 24;
const FALLBACK_MODEL_PATH = "/models/warrior.glb";

const IMPROVEMENT_SCALES: Record<string, number> = {
  farm: 0.35,
  mine: 0.4,
  forest_camp: 0.35,
  lumber_hut: 0.35,
  sawmill: 0.4,
  plantation: 0.4,
  irrigation: 0.35,
  workshop: 0.4,
  port: 0.4,
  aqueduct: 0.45,
  road: 0.3,
  shrine: 0.4,
};

const STRUCTURE_SCALES: Record<string, number> = {
  temple: 0.35,
  granary: 0.35,
  lighthouse: 0.4,
  cathedral: 0.4,
  academy: 0.35,
  library: 0.35,
  fortress: 0.4,
};

const getConstructionModelPath = (construction: ConstructionItem): string | null => {
  switch (construction.category) {
    case "improvements":
      return getImprovementModelPath(construction.type);
    case "structures":
      return getStructureModelPath(construction.type);
    case "units":
      return getUnitModelPath(construction.type);
    default:
      return null;
  }
};

// Holographic shader for the ghostly construction effect
const holographicVertexShader = `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec2 vUv;
  uniform float time;
  
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    vUv = uv;
    
    // Subtle vertex displacement for shimmer
    vec3 pos = position;
    pos.y += sin(position.x * 10.0 + time * 3.0) * 0.01;
    pos.y += sin(position.z * 8.0 + time * 2.5) * 0.01;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const holographicFragmentShader = `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec2 vUv;
  uniform float time;
  uniform float progress;
  uniform float baseOpacity;
  uniform vec3 baseColor;
  uniform vec3 cameraPos;
  
  void main() {
    // Fresnel edge glow - use passed camera position
    vec3 viewDir = normalize(cameraPos - vWorldPosition);
    float fresnel = pow(1.0 - abs(dot(viewDir, vNormal)), 2.0);
    
    // Animated scan lines moving upward
    float scanLine = sin(vWorldPosition.y * 20.0 - time * 4.0) * 0.5 + 0.5;
    scanLine = smoothstep(0.4, 0.6, scanLine);
    
    // Shimmer effect
    float shimmer = sin(time * 5.0 + vWorldPosition.x * 15.0 + vWorldPosition.z * 12.0) * 0.5 + 0.5;
    
    // Combine effects
    vec3 glowColor = vec3(1.0, 0.85, 0.4); // Golden glow
    vec3 holoColor = mix(baseColor, glowColor, fresnel * 0.6);
    holoColor += glowColor * scanLine * 0.15;
    holoColor += vec3(0.1, 0.12, 0.15) * shimmer * 0.2;
    
    // Progress-based opacity - more visible as construction completes
    float alpha = baseOpacity + fresnel * 0.25;
    alpha += scanLine * 0.08;
    alpha = clamp(alpha, 0.2, 0.85);
    
    gl_FragColor = vec4(holoColor, alpha);
  }
`;

// Glow disc shader
const glowDiscFragmentShader = `
  varying vec2 vUv;
  uniform float time;
  uniform vec3 glowColor;
  
  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center) * 2.0;
    
    // Radial gradient with soft edges
    float alpha = 1.0 - smoothstep(0.0, 1.0, dist);
    alpha = pow(alpha, 1.8);
    
    // Smooth pulsing animation
    float pulse = sin(time * 2.0) * 0.12 + 0.88;
    alpha *= pulse;
    
    // Subtle concentric rings
    float rings = sin(dist * 10.0 - time * 2.5) * 0.08 + 0.92;
    alpha *= rings;
    
    // Soft glow color with slight warmth boost
    vec3 finalColor = glowColor + vec3(0.1, 0.05, 0.0);
    
    gl_FragColor = vec4(finalColor, alpha * 0.45);
  }
`;

// Rising particle dust component
function RisingParticles({ color, progress }: { color: THREE.Color; progress: number }) {
  const pointsRef = useRef<THREE.Points | null>(null);

  const { positions, velocities, geometry } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const velocities = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Random position in a disc around the construction
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 0.35;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.random() * 0.6; // Start at various heights
      positions[i * 3 + 2] = Math.sin(angle) * radius;
      velocities[i] = 0.25 + Math.random() * 0.35; // Random upward speed
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    return { positions, velocities, geometry: geo };
  }, []);

  // Cleanup geometry on unmount
  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;

    const posAttr = pointsRef.current.geometry.attributes.position;
    const posArray = posAttr.array as Float32Array;
    const time = state.clock.elapsedTime;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Move particles upward
      posArray[i * 3 + 1] += velocities[i] * delta;

      // Reset particles that go too high
      if (posArray[i * 3 + 1] > 1.0) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 0.35;
        posArray[i * 3] = Math.cos(angle) * radius;
        posArray[i * 3 + 1] = 0;
        posArray[i * 3 + 2] = Math.sin(angle) * radius;
      }

      // Gentle spiral drift
      const driftScale = 0.0015;
      posArray[i * 3] += Math.sin(time * 1.5 + i * 0.5) * driftScale;
      posArray[i * 3 + 2] += Math.cos(time * 1.2 + i * 0.7) * driftScale;
    }

    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        color={color}
        size={0.025}
        transparent
        opacity={0.5 + progress * 0.35}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

// Pulsing ground glow component
function PulsingGlow({ color }: { color: THREE.Color }) {
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);

  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        glowColor: { value: color },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: glowDiscFragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }, [color]);

  useEffect(() => {
    materialRef.current = shaderMaterial;
    return () => {
      shaderMaterial.dispose();
    };
  }, [shaderMaterial]);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = state.clock.elapsedTime;
    }
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
      <circleGeometry args={[0.55, 32]} />
      <primitive object={shaderMaterial} attach="material" />
    </mesh>
  );
}

// Animated progress pip that pulses smoothly
function ProgressPip({ color, progress }: { color: THREE.Color; progress: number }) {
  const meshRef = useRef<THREE.Mesh | null>(null);

  useFrame((state) => {
    if (meshRef.current) {
      const pulse = Math.sin(state.clock.elapsedTime * 3) * 0.15 + 0.85;
      meshRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0.02, 0]}>
      <sphereGeometry args={[0.05, 8, 8]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.7 + progress * 0.2}
      />
    </mesh>
  );
}

// Get color based on construction category
function getCategoryColor(category: string): THREE.Color {
  switch (category) {
    case 'units':
      return new THREE.Color(0x5BA3E8); // Softer blue for units
    case 'improvements':
      return new THREE.Color(0x8AE05A); // Vibrant green for improvements
    case 'structures':
    default:
      return new THREE.Color(0xF5A623); // Warm amber for structures
  }
}

export default function Construction({ construction }: ConstructionProps) {
  const meshRef = useRef<THREE.Group | null>(null);
  const hologramMaterialRef = useRef<THREE.ShaderMaterial | null>(null);

  // Calculate progress
  const progress = (construction.totalTurns - construction.turnsRemaining) / construction.totalTurns;
  const opacity = Math.max(0.25, progress * 0.5 + 0.25);

  // Position at hex coordinate
  const coord = construction.coordinate ?? { q: 0, r: 0, s: 0 };
  const pixelPos = hexToPixel(coord, HEX_SIZE);

  // Category-based color
  const categoryColor = useMemo(() => getCategoryColor(construction.category), [construction.category]);

  const modelPath = useMemo(() => getConstructionModelPath(construction), [construction]);
  const hasModel = Boolean(modelPath);
  const { scene: modelScene } = useGLTF(modelPath ?? FALLBACK_MODEL_PATH);

  // Create holographic shader material
  const hologramMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        progress: { value: progress },
        baseOpacity: { value: opacity },
        baseColor: { value: categoryColor },
        cameraPos: { value: new THREE.Vector3() },
      },
      vertexShader: holographicVertexShader,
      fragmentShader: holographicFragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }, [categoryColor, progress, opacity]);

  const modelScale = useMemo(() => {
    if (construction.category === "improvements") {
      return IMPROVEMENT_SCALES[construction.type] ?? 0.35;
    }
    if (construction.category === "structures") {
      return STRUCTURE_SCALES[construction.type] ?? 0.35;
    }
    return 1;
  }, [construction.category, construction.type]);

  // Clone model with holographic material
  const clonedModel = useMemo(() => {
    if (!hasModel) return null;

    const clone = modelScene.clone();
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = hologramMaterial;
      }
    });

    return clone;
  }, [hasModel, modelScene, hologramMaterial]);

  useEffect(() => {
    hologramMaterialRef.current = hologramMaterial;
  }, [hologramMaterial]);

  // Update uniforms each frame
  useFrame((state) => {
    if (hologramMaterialRef.current) {
      hologramMaterialRef.current.uniforms.time.value = state.clock.elapsedTime;
      hologramMaterialRef.current.uniforms.progress.value = progress;
      hologramMaterialRef.current.uniforms.baseOpacity.value = opacity;
      // Pass camera position for fresnel calculation
      hologramMaterialRef.current.uniforms.cameraPos.value.copy(state.camera.position);
    }

    // Gentle bobbing
    if (meshRef.current) {
      meshRef.current.position.y = 0.1 + Math.sin(state.clock.elapsedTime * 2) * 0.025;
    }
  });

  // Cleanup
  useEffect(() => {
    return () => {
      disposeClonedMaterials(clonedModel);
      hologramMaterial.dispose();
    };
  }, [clonedModel, hologramMaterial]);

  return (
    <group position={[pixelPos.x, 0, pixelPos.y]}>
      {/* Pulsing ground glow */}
      <PulsingGlow color={categoryColor} />

      {/* Rising particle dust */}
      <RisingParticles color={categoryColor} progress={progress} />

      {/* Main construction model/placeholder */}
      <group ref={meshRef} position={[0, 0.1, 0]} scale={[0.8, 0.8, 0.8]}>
        {clonedModel ? (
          <primitive object={clonedModel} scale={[modelScale, modelScale, modelScale]} />
        ) : (
          <mesh material={hologramMaterial}>
            {construction.category === 'units' ? (
              <cylinderGeometry args={[0.15, 0.15, 0.4, 12]} />
            ) : (
              <boxGeometry args={[0.4, 0.4, 0.4]} />
            )}
          </mesh>
        )}
      </group>

      {/* Progress ring - positioned above */}
      <group position={[0, 0.65, 0]}>
        {/* Background ring */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.16, 0.22, 24]} />
          <meshBasicMaterial color="#1a1a1a" transparent opacity={0.7} />
        </mesh>

        {/* Progress fill */}
        <mesh rotation={[-Math.PI / 2, 0, -Math.PI / 2]} position={[0, 0.005, 0]}>
          <ringGeometry args={[0.16, 0.22, 24, 1, 0, Math.PI * 2 * progress]} />
          <meshBasicMaterial
            color={categoryColor}
            transparent
            opacity={0.85}
          />
        </mesh>

        {/* Glowing center pip - animated separately */}
        <ProgressPip color={categoryColor} progress={progress} />
      </group>
    </group>
  );
}
