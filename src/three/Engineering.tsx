"use client";

import { useEffect, useMemo, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { Box3, Box3Helper, Color, Vector3 } from "three";
import { useWorkstation } from "@/store/workstation";
import { registry } from "./registry";

interface Dim {
  size: [number, number, number];
  min: [number, number, number];
  max: [number, number, number];
}

const fmt = (n: number) => (Math.abs(n) >= 100 ? n.toFixed(1) : Math.abs(n) >= 1 ? n.toFixed(3) : n.toFixed(4));

/** Caixas delimitadoras e medidas reais do modelo e da peça selecionada. Visível só no modo Engenharia. */
export default function Engineering() {
  const viewMode = useWorkstation((s) => s.viewMode);
  const selectedId = useWorkstation((s) => s.selectedId);
  const active = viewMode === "engineering";

  const modelBox = useMemo(() => new Box3(), []);
  const selBox = useMemo(() => new Box3(), []);
  const modelHelper = useMemo(() => new Box3Helper(modelBox, new Color("#46d2ff")), [modelBox]);
  const selHelper = useMemo(() => new Box3Helper(selBox, new Color("#ffb347")), [selBox]);
  useEffect(() => () => {
    modelHelper.dispose();
    selHelper.dispose();
  }, [modelHelper, selHelper]);

  const [model, setModel] = useState<Dim | null>(null);
  const [sel, setSel] = useState<Dim | null>(null);
  const acc = useMemo(() => ({ t: 0 }), []);

  useFrame((_, dt) => {
    if (!active || !registry.root) return;
    modelBox.setFromObject(registry.root);
    const rec = registry.get(selectedId);
    if (rec) selBox.setFromObject(rec.object);
    else selBox.makeEmpty();
    acc.t += dt;
    if (acc.t < 0.2) return;
    acc.t = 0;
    const toDim = (b: Box3): Dim => {
      const s = b.getSize(new Vector3());
      return { size: [s.x, s.y, s.z], min: b.min.toArray() as [number, number, number], max: b.max.toArray() as [number, number, number] };
    };
    setModel(toDim(modelBox));
    setSel(rec && !selBox.isEmpty() ? toDim(selBox) : null);
  });

  if (!active) return null;
  const label = (d: Dim, box: Box3, tone: string) => {
    const top = new Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2);
    return (
      <Html position={top} center style={{ pointerEvents: "none" }} zIndexRange={[5, 0]}>
        <div className="dim-label" style={{ borderColor: tone, color: tone }}>
          <span>L {fmt(d.size[0])}</span>
          <span>A {fmt(d.size[1])}</span>
          <span>P {fmt(d.size[2])}</span>
        </div>
      </Html>
    );
  };
  return (
    <>
      <primitive object={modelHelper} />
      {model && label(model, modelBox, "#46d2ff")}
      {sel && (
        <>
          <primitive object={selHelper} />
          {label(sel, selBox, "#ffb347")}
        </>
      )}
    </>
  );
}
