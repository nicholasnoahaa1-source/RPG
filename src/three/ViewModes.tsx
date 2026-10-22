"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Material, Mesh, ShaderMaterial } from "three";
import { useWorkstation } from "@/store/workstation";
import { createHoloMaterial, createWireMaterial } from "./materials";
import { registry } from "./registry";

/** Aplica o modo de visualização trocando os materiais das malhas e animando a opacidade. */
export default function ViewModes() {
  const viewMode = useWorkstation((s) => s.viewMode);
  const tree = useWorkstation((s) => s.tree);
  const invalidate = useThree((s) => s.invalidate);

  const mats = useMemo(
    () => ({ holographic: createHoloMaterial("holographic"), xray: createHoloMaterial("xray"), wireframe: createWireMaterial() }),
    [],
  );
  useEffect(
    () => () => {
      mats.holographic.dispose();
      mats.xray.dispose();
      mats.wireframe.dispose();
    },
    [mats],
  );

  const fade = useRef(0);
  useEffect(() => {
    const swap = (m: Material | null) => {
      registry.parts.forEach((rec) => {
        const mesh = rec.object as Mesh;
        if (!mesh.isMesh) return;
        if (!rec.originalMaterial) rec.originalMaterial = mesh.material;
        mesh.material = m ?? rec.originalMaterial;
      });
    };
    if (viewMode === "holographic") swap(mats.holographic);
    else if (viewMode === "xray") swap(mats.xray);
    else if (viewMode === "wireframe") swap(mats.wireframe);
    else swap(null);
    fade.current = 0;
    invalidate();
  }, [viewMode, tree, mats, invalidate]);

  useFrame((state, dt) => {
    const t = Math.min(dt, 0.1);
    const animating = viewMode === "holographic" || viewMode === "xray";
    if (fade.current < 1) {
      fade.current = Math.min(1, fade.current + t * 3);
      invalidate();
    }
    for (const k of ["holographic", "xray"] as const) {
      const m = mats[k] as ShaderMaterial;
      m.uniforms.uOpacity!.value = fade.current;
      m.uniforms.uTime!.value = state.clock.elapsedTime;
    }
    (mats.wireframe as { opacity: number }).opacity = 0.85 * fade.current;
    if (animating) invalidate();
  });

  return null;
}
