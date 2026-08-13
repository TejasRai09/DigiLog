import React, { useRef, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, ContactShadows } from "@react-three/drei";

function SpinningFan({ color = "#a78bfa", speed = 1.2 }) {
  const ref = useRef();
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.z += dt * speed;
  });
  return (
    <group ref={ref} position={[0, 0.15, 0]}>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} rotation={[0, 0, (i * Math.PI) / 2]} position={[0.28, 0, 0]}>
          <boxGeometry args={[0.55, 0.12, 0.06]} />
          <meshStandardMaterial color={color} metalness={0.35} roughness={0.35} />
        </mesh>
      ))}
      <mesh>
        <cylinderGeometry args={[0.12, 0.12, 0.1, 16]} />
        <meshStandardMaterial color="#f8fafc" metalness={0.5} roughness={0.25} />
      </mesh>
    </group>
  );
}

function FarmScene() {
  const cane = useRef();
  useFrame((state) => {
    if (cane.current) cane.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.6) * 0.15;
  });
  return (
    <Float speed={1.4} rotationIntensity={0.25} floatIntensity={0.5}>
      <group ref={cane}>
        <mesh position={[0, -0.35, 0]} receiveShadow>
          <boxGeometry args={[1.6, 0.18, 1.1]} />
          <meshStandardMaterial color="#4d7c0f" roughness={0.9} />
        </mesh>
        {[-0.45, -0.15, 0.15, 0.45].map((x, i) => (
          <mesh key={i} position={[x, 0.15, (i % 2) * 0.15 - 0.08]} rotation={[0.1, 0, 0.05 * (i - 1.5)]}>
            <cylinderGeometry args={[0.04, 0.05, 0.9, 8]} />
            <meshStandardMaterial color={i % 2 ? "#65a30d" : "#84cc16"} roughness={0.7} />
          </mesh>
        ))}
        <mesh position={[0.55, -0.05, 0.35]} rotation={[0, 0.4, 0]}>
          <boxGeometry args={[0.35, 0.22, 0.55]} />
          <meshStandardMaterial color="#f59e0b" roughness={0.6} />
        </mesh>
      </group>
    </Float>
  );
}

function WarehouseScene({ accent = "#38bdf8" }) {
  return (
    <Float speed={1.2} rotationIntensity={0.2} floatIntensity={0.4}>
      <group>
        <mesh position={[0, -0.15, 0]}>
          <boxGeometry args={[1.3, 0.7, 0.9]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.55} />
        </mesh>
        <mesh position={[0, 0.35, 0]} rotation={[0, 0, 0]}>
          <coneGeometry args={[0.95, 0.45, 4]} />
          <meshStandardMaterial color={accent} roughness={0.45} metalness={0.1} />
        </mesh>
        <mesh position={[0, -0.25, 0.46]}>
          <boxGeometry args={[0.35, 0.4, 0.04]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        <mesh position={[-0.55, -0.35, 0.55]} rotation={[0, 0.3, 0]}>
          <boxGeometry args={[0.45, 0.22, 0.28]} />
          <meshStandardMaterial color="#2563eb" metalness={0.2} roughness={0.4} />
        </mesh>
      </group>
    </Float>
  );
}

function YardScene() {
  return (
    <Float speed={1.1} rotationIntensity={0.18} floatIntensity={0.35}>
      <group>
        <mesh position={[0, -0.4, 0]}>
          <boxGeometry args={[1.5, 0.08, 1.2]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.05, -0.15]}>
          <boxGeometry args={[1.1, 0.75, 0.7]} />
          <meshStandardMaterial color="#bae6fd" roughness={0.5} />
        </mesh>
        <mesh position={[-0.45, -0.22, 0.4]} rotation={[0, 0.5, 0]}>
          <boxGeometry args={[0.4, 0.2, 0.25]} />
          <meshStandardMaterial color="#f97316" />
        </mesh>
        <mesh position={[0.35, -0.22, 0.35]} rotation={[0, -0.3, 0]}>
          <boxGeometry args={[0.4, 0.2, 0.25]} />
          <meshStandardMaterial color="#3b82f6" />
        </mesh>
      </group>
    </Float>
  );
}

function MillScene() {
  return (
    <Float speed={1} rotationIntensity={0.15} floatIntensity={0.3}>
      <group>
        <mesh position={[0, -0.2, 0]}>
          <boxGeometry args={[1.1, 0.85, 0.9]} />
          <meshStandardMaterial color="#ddd6fe" roughness={0.45} />
        </mesh>
        <mesh position={[0.35, 0.45, 0]}>
          <cylinderGeometry args={[0.12, 0.14, 0.7, 12]} />
          <meshStandardMaterial color="#64748b" metalness={0.4} roughness={0.3} />
        </mesh>
        <group position={[-0.15, 0.2, 0.5]}>
          <SpinningFan color="#8b5cf6" speed={1.6} />
        </group>
        {/* cane blocks on belt */}
        {[-0.35, 0, 0.35].map((x, i) => (
          <mesh key={i} position={[x, -0.45, 0.55]}>
            <boxGeometry args={[0.18, 0.1, 0.14]} />
            <meshStandardMaterial color="#eab308" />
          </mesh>
        ))}
      </group>
    </Float>
  );
}

const SCENE_MAP = {
  farm: FarmScene,
  centers: () => <WarehouseScene accent="#38bdf8" />,
  yard: YardScene,
  mill: MillScene,
  gate: () => <WarehouseScene accent="#fbbf24" />,
};

/**
 * Compact animated Three.js stage icon for Procurement flow.
 * @param {"farm"|"centers"|"yard"|"mill"|"gate"} variant
 */
export default function ProcurementStage3D({ variant = "farm", height = 88, className = "" }) {
  const Scene = SCENE_MAP[variant] || FarmScene;
  return (
    <div className={`w-full overflow-hidden rounded-xl ${className}`} style={{ height }}>
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [2.2, 1.6, 2.4], fov: 38 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.85} />
        <directionalLight position={[4, 6, 3]} intensity={1.15} castShadow />
        <Suspense fallback={null}>
          <Scene />
          <ContactShadows position={[0, -0.55, 0]} opacity={0.35} scale={6} blur={2.2} far={2} />
        </Suspense>
      </Canvas>
    </div>
  );
}
