"use client";

import { useMemo } from "react";
import { Bloom, EffectComposer, Outline, ToneMapping, Vignette } from "@react-three/postprocessing";
import { Mesh, type Object3D } from "three";
import { useWorkstation } from "@/store/workstation";
import { registry } from "./registry";

function meshesOf(id: string | null): Object3D[] {
  const rec = registry.get(id);
  if (!rec) return [];
  const out: Object3D[] = [];
  rec.object.traverse((o) => {
    if ((o as Mesh).isMesh && o.visible) out.push(o);
  });
  return out;
}

export default function Post() {
  const quality = useWorkstation((s) => s.quality);
  const selectedId = useWorkstation((s) => s.selectedId);
  const hoveredId = useWorkstation((s) => s.hoveredId);
  const tree = useWorkstation((s) => s.tree);
  const hidden = useWorkstation((s) => s.hidden);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const selected = useMemo(() => meshesOf(selectedId), [selectedId, tree, hidden]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const hovered = useMemo(() => (hoveredId && hoveredId !== selectedId ? meshesOf(hoveredId) : []), [hoveredId, selectedId, tree, hidden]);

  if (quality === "low") return null;
  return (
    <EffectComposer autoClear={false} multisampling={quality === "ultra" ? 8 : quality === "high" ? 4 : 0}>
      <Bloom mipmapBlur intensity={quality === "medium" ? 0.35 : 0.6} luminanceThreshold={0.7} luminanceSmoothing={0.2} />
      <Outline selection={hovered} edgeStrength={2} blur={false} visibleEdgeColor={0x46d2ff} hiddenEdgeColor={0x0b3a4a} />
      <Outline selection={selected} edgeStrength={4} blur visibleEdgeColor={0xffb347} hiddenEdgeColor={0x6a4210} xRay />
      <Vignette eskil={false} offset={0.3} darkness={0.7} />
      <ToneMapping />
    </EffectComposer>
  );
}
