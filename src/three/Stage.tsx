"use client";

import { useMemo } from "react";
import { ContactShadows, Environment, Grid, Html, Lightformer, Sparkles } from "@react-three/drei";
import { BufferGeometry, Float32BufferAttribute, LineBasicMaterial } from "three";
import { useWorkstation } from "@/store/workstation";

const AXIS = { x: "#ff7a59", y: "#8dffa8", z: "#6fb4ff" };

function Axes({ size }: { size: number }) {
  const geos = useMemo(() => {
    const mk = (a: [number, number, number]) => {
      const g = new BufferGeometry();
      g.setAttribute("position", new Float32BufferAttribute([0, 0, 0, ...a], 3));
      return g;
    };
    return {
      x: mk([size, 0, 0]),
      y: mk([0, size, 0]),
      z: mk([0, 0, size]),
      mat: {
        x: new LineBasicMaterial({ color: AXIS.x }),
        y: new LineBasicMaterial({ color: AXIS.y }),
        z: new LineBasicMaterial({ color: AXIS.z }),
      },
    };
  }, [size]);
  const label = (text: string, pos: [number, number, number], color: string) => (
    <Html position={pos} center style={{ pointerEvents: "none" }}>
      <span className="axis-label" style={{ color }}>{text}</span>
    </Html>
  );
  return (
    <group>
      <lineSegments geometry={geos.x} material={geos.mat.x} />
      <lineSegments geometry={geos.y} material={geos.mat.y} />
      <lineSegments geometry={geos.z} material={geos.mat.z} />
      {label("X", [size * 1.08, 0, 0], AXIS.x)}
      {label("Y", [0, size * 1.08, 0], AXIS.y)}
      {label("Z", [0, 0, size * 1.08], AXIS.z)}
    </group>
  );
}

function Rings({ r }: { r: number }) {
  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001 * r, 0]}>
      {[1, 1.5, 2.2].map((k, i) => (
        <mesh key={k}>
          <ringGeometry args={[r * k - r * 0.004, r * k, 128]} />
          <meshBasicMaterial color="#46d2ff" transparent opacity={0.5 - i * 0.14} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

export default function Stage() {
  const size = useWorkstation((s) => s.model?.size);
  const showGrid = useWorkstation((s) => s.showGrid);
  const showAxes = useWorkstation((s) => s.showAxes);
  const quality = useWorkstation((s) => s.quality);
  const loaded = useWorkstation((s) => s.loadState === "ready");
  const unit = size ? Math.max(size[0], size[1], size[2]) || 1 : 2;
  const sparkles = { low: 0, medium: 40, high: 90, ultra: 160 }[quality];

  return (
    <>
      <color attach="background" args={["#02060a"]} />
      <fog attach="fog" args={["#02060a", unit * 8, unit * 45]} />
      <ambientLight intensity={0.15} color="#9fdcff" />
      <directionalLight position={[unit * 2, unit * 3, unit * 2]} intensity={1.8} color="#e8f6ff" castShadow={quality !== "low"} shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-unit * 3, unit, -unit * 2]} intensity={1.2} color="#46d2ff" />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.2} color="#bfeaff" position={[0, 5, -6]} scale={[14, 4, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#46d2ff" position={[-6, 1, 3]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} />
        <Lightformer form="rect" intensity={0.8} color="#ffb870" position={[6, 2, 3]} rotation-y={-Math.PI / 2} scale={[6, 2, 1]} />
      </Environment>

      {showGrid && (
        <>
          <Grid
            infiniteGrid
            cellSize={unit / 10}
            sectionSize={unit / 2}
            cellThickness={0.6}
            sectionThickness={1.2}
            cellColor="#0f4a5e"
            sectionColor="#2aa6c9"
            fadeDistance={unit * 12}
            fadeStrength={1.6}
          />
          <Rings r={unit * 0.9} />
        </>
      )}
      {showAxes && <Axes size={unit * 0.8} />}
      {loaded && quality !== "low" && (
        <ContactShadows position={[0, 0.002, 0]} opacity={0.5} scale={unit * 5} blur={2.5} far={unit * 2} color="#001018" />
      )}
      {sparkles > 0 && <Sparkles count={sparkles} scale={unit * 4} size={2} speed={0.2} opacity={0.5} color="#7fe6ff" />}
    </>
  );
}
