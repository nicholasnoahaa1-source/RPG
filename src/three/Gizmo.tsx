"use client";

import { useRef } from "react";
import { TransformControls } from "@react-three/drei";
import { Quaternion, Vector3 } from "three";
import { useWorkstation } from "@/store/workstation";
import { registry, type PartRecord } from "./registry";

interface Snapshot {
  p: Vector3;
  q: Quaternion;
  s: Vector3;
}

const snap = (rec: PartRecord): Snapshot => ({ p: rec.basePos.clone(), q: rec.baseQuat.clone(), s: rec.baseScale.clone() });

function apply(rec: PartRecord, t: Snapshot) {
  rec.basePos.copy(t.p);
  rec.baseQuat.copy(t.q);
  rec.baseScale.copy(t.s);
  registry.syncObject(rec);
  useWorkstation.getState().bumpTransform();
}

const same = (a: Snapshot, b: Snapshot) => a.p.equals(b.p) && a.q.equals(b.q) && a.s.equals(b.s);

/** Gizmo de transformação, ativo apenas nos modos de transformação (separado da navegação). */
export default function Gizmo() {
  const selectedId = useWorkstation((s) => s.selectedId);
  const interaction = useWorkstation((s) => s.interaction);
  const space = useWorkstation((s) => s.space);
  const snapOn = useWorkstation((s) => s.snap);
  const locked = useWorkstation((s) => (s.selectedId ? !!s.locked[s.selectedId] : false));
  const rec = registry.get(selectedId);
  const before = useRef<Snapshot | null>(null);

  if (!rec || interaction === "navigate" || interaction === "vertex" || locked || !rec.object.visible) return null;

  const onDown = () => {
    before.current = snap(rec);
  };
  const onChange = () => {
    registry.captureBase(rec);
    useWorkstation.getState().bumpTransform();
  };
  const onUp = () => {
    const b = before.current;
    before.current = null;
    registry.captureBase(rec);
    if (!b) return;
    const a = snap(rec);
    if (same(a, b)) return;
    const label = `${interaction === "translate" ? "Mover" : interaction === "rotate" ? "Girar" : "Escalar"} ${rec.object.name || "peça"}`;
    registry.history.push({ label, undo: () => apply(rec, b), redo: () => apply(rec, a) });
  };

  return (
    <TransformControls
      object={rec.object}
      mode={interaction}
      space={space}
      translationSnap={snapOn ? registry.modelSize / 100 : null}
      rotationSnap={snapOn ? Math.PI / 12 : null}
      scaleSnap={snapOn ? 0.05 : null}
      onMouseDown={onDown}
      onMouseUp={onUp}
      onObjectChange={onChange}
    />
  );
}
