"use client";

import { useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { ACESFilmicToneMapping } from "three";
import { useWorkstation, type Quality } from "@/store/workstation";
import ModelRoot from "./ModelRoot";
import CameraRig from "./CameraRig";
import ViewModes from "./ViewModes";
import Gizmo from "./Gizmo";
import Stage from "./Stage";
import Post from "./Post";
import Engineering from "./Engineering";
import VertexEditor from "./VertexEditor";

const DPR: Record<Quality, [number, number]> = { low: [1, 1], medium: [1, 1.5], high: [1, 2], ultra: [1, 2.5] };
const CAMERA = { fov: 35, near: 0.05, far: 200, position: [4, 3, 5] } as const;
const GL = { antialias: true, powerPreference: "high-performance", toneMapping: ACESFilmicToneMapping } as const;
const ORDER: Quality[] = ["low", "medium", "high", "ultra"];

function FpsMeter() {
  let frames = 0;
  let last = performance.now();
  useFrame(() => {
    frames++;
    const now = performance.now();
    if (now - last >= 1000) {
      useWorkstation.setState({ fps: Math.round((frames * 1000) / (now - last)) });
      frames = 0;
      last = now;
    }
  });
  return null;
}

/** Em qualidade Low o loop é sob demanda; qualquer mudança de estado pede um novo quadro. */
function Invalidator() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => useWorkstation.subscribe(() => invalidate()), [invalidate]);
  return null;
}

function ContextGuard() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    const dbg = (window as unknown as { __ws?: Record<string, unknown> }).__ws;
    if (dbg) dbg.camera = camera;
  }, [camera]);
  useEffect(() => {
    const el = gl.domElement;
    const lost = (e: Event) => {
      e.preventDefault();
      useWorkstation.setState({ contextLost: true, status: "CONTEXTO WEBGL PERDIDO" });
    };
    const restored = () => useWorkstation.setState({ contextLost: false, status: "CONTEXTO WEBGL RESTAURADO" });
    el.addEventListener("webglcontextlost", lost);
    el.addEventListener("webglcontextrestored", restored);
    return () => {
      el.removeEventListener("webglcontextlost", lost);
      el.removeEventListener("webglcontextrestored", restored);
    };
  }, [gl]);
  return null;
}

export default function Scene() {
  const quality = useWorkstation((s) => s.quality);
  const set = useWorkstation((s) => s.set);

  const step = (dir: 1 | -1) => {
    const st = useWorkstation.getState();
    if (!st.qualityAuto) return;
    const i = ORDER.indexOf(st.quality) + dir;
    const next = ORDER[Math.min(Math.max(i, 0), ORDER.length - 1)];
    if (next && next !== st.quality) set({ quality: next, status: `QUALIDADE AUTO: ${next.toUpperCase()}` });
  };

  return (
    <Canvas
      className="scene-canvas"
      shadows={quality !== "low"}
      frameloop={quality === "low" ? "demand" : "always"}
      dpr={DPR[quality]}
      camera={CAMERA as unknown as { fov: number }}
      gl={GL}
      onPointerMissed={() => {
        if (useWorkstation.getState().interaction !== "vertex") useWorkstation.getState().select(null);
      }}
    >
      <PerformanceMonitor flipflops={3} onDecline={() => step(-1)} onIncline={() => step(1)} />
      <FpsMeter />
      <ContextGuard />
      {quality === "low" && <Invalidator />}
      <Stage />
      <ModelRoot />
      <ViewModes />
      <Engineering />
      <Gizmo />
      <VertexEditor />
      <CameraRig />
      <Post />
    </Canvas>
  );
}
