"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import { TransformControls } from "@react-three/drei";
import { BufferAttribute, BufferGeometry, Float32BufferAttribute, Mesh, Object3D, Vector3 } from "three";
import { useWorkstation } from "@/store/workstation";
import { registry, type PartRecord } from "./registry";
import { ensureOwnGeometry, isEditableMesh } from "./editing";
import { weldPositions, type Welded } from "@/lib/mesh";

export const MAX_EDIT_VERTICES = 50000;
const PICK_RADIUS_PX = 14;
const CYAN: [number, number, number] = [0.27, 0.82, 1];
const AMBER: [number, number, number] = [1, 0.7, 0.28];

/** Ponte para os botões do painel (selecionar tudo, limpar). */
export const vertexBridge = { selectAll: () => {}, clear: () => {} };

function fail(msg: string) {
  useWorkstation.setState({ interaction: "navigate", status: msg.toUpperCase(), vertexSel: 0, vertexTotal: 0 });
}

export default function VertexEditor() {
  const interaction = useWorkstation((s) => s.interaction);
  const selectedId = useWorkstation((s) => s.selectedId);
  const rec = registry.get(selectedId);
  if (interaction !== "vertex" || !rec) return null;
  return <Editor key={rec.id} rec={rec} />;
}

function Editor({ rec }: { rec: PartRecord }) {
  const mesh = rec.object as Mesh;
  const { camera, gl, invalidate } = useThree();
  const tick = useWorkstation((s) => s.transformTick);
  const [welded, setWelded] = useState<Welded | null>(null);
  const [ver, setVer] = useState(0);
  const [proxy, setProxy] = useState<Object3D | null>(null);
  const sel = useRef(new Set<number>());
  const gizmoActive = useRef(false);

  // validação e preparo da geometria
  useEffect(() => {
    const st = useWorkstation.getState();
    if (!isEditableMesh(rec)) return fail("Edição de vértices exige malha rígida (sem skinning, morph ou posições quantizadas)");
    if (st.locked[rec.id]) return fail("Peça travada");
    if (registry.explodeApplied > 1e-3) return fail("Remonte a Exploded View antes de editar vértices");
    ensureOwnGeometry(mesh);
    const pos = mesh.geometry.getAttribute("position");
    const w = weldPositions(pos.array, pos.count);
    if (w.members.length > MAX_EDIT_VERTICES) {
      return fail(`Malha com ${w.members.length.toLocaleString("pt-BR")} vértices únicos: limite de edição é ${MAX_EDIT_VERTICES.toLocaleString("pt-BR")}`);
    }
    sel.current.clear();
    setWelded(w);
    useWorkstation.setState({ vertexSel: 0, vertexTotal: w.members.length, status: `EDITANDO ${(mesh.name || "MALHA").toUpperCase()}` });
    return () => useWorkstation.setState({ vertexSel: 0, vertexTotal: 0 });
  }, [rec, mesh]);

  const world = useMemo(() => (welded ? new Float32Array(welded.members.length * 3) : null), [welded]);
  const geo = useMemo(() => {
    if (!welded || !world) return null;
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(world, 3));
    g.setAttribute("color", new Float32BufferAttribute(new Float32Array(welded.members.length * 3), 3));
    return g;
  }, [welded, world]);
  useEffect(() => () => geo?.dispose(), [geo]);

  const syncWorld = () => {
    if (!welded || !world || !geo) return;
    mesh.updateWorldMatrix(true, false);
    const pos = mesh.geometry.getAttribute("position") as BufferAttribute;
    const v = new Vector3();
    welded.members.forEach((m, u) => {
      v.fromBufferAttribute(pos, m[0]!).applyMatrix4(mesh.matrixWorld);
      world[u * 3] = v.x; world[u * 3 + 1] = v.y; world[u * 3 + 2] = v.z;
    });
    const attr = geo.getAttribute("position") as BufferAttribute;
    attr.needsUpdate = true;
    geo.computeBoundingSphere();
    paint();
    invalidate();
  };
  const paint = () => {
    if (!geo || !welded) return;
    const col = geo.getAttribute("color") as BufferAttribute;
    for (let u = 0; u < welded.members.length; u++) {
      const c = sel.current.has(u) ? AMBER : CYAN;
      col.setXYZ(u, c[0], c[1], c[2]);
    }
    col.needsUpdate = true;
  };
  const centroid = (out = new Vector3()) => {
    out.set(0, 0, 0);
    if (!world || sel.current.size === 0) return out;
    sel.current.forEach((u) => out.add(new Vector3(world[u * 3], world[u * 3 + 1], world[u * 3 + 2])));
    return out.multiplyScalar(1 / sel.current.size);
  };
  const refreshSelection = () => {
    paint();
    if (proxy && sel.current.size > 0) proxy.position.copy(centroid());
    useWorkstation.setState({ vertexSel: sel.current.size });
    setVer((n) => n + 1);
    invalidate();
  };

  useEffect(syncWorld, [welded, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    vertexBridge.selectAll = () => {
      if (!welded) return;
      sel.current = new Set(welded.members.keys());
      refreshSelection();
    };
    vertexBridge.clear = () => {
      sel.current.clear();
      refreshSelection();
    };
    return () => {
      vertexBridge.selectAll = () => {};
      vertexBridge.clear = () => {};
    };
  });

  // seleção por clique (sem arrastar), Shift soma ou alterna
  useEffect(() => {
    if (!welded || !world) return;
    const el = gl.domElement;
    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => {
      down = e.button === 0 ? { x: e.clientX, y: e.clientY } : null;
    };
    const onUp = (e: PointerEvent) => {
      const d = down;
      down = null;
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5 || gizmoActive.current) return;
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const v = new Vector3();
      let best = -1, bestD = PICK_RADIUS_PX * PICK_RADIUS_PX;
      for (let u = 0; u < welded.members.length; u++) {
        v.set(world[u * 3]!, world[u * 3 + 1]!, world[u * 3 + 2]!).project(camera);
        if (v.z > 1 || v.z < -1) continue;
        const dx = (v.x * 0.5 + 0.5) * rect.width - mx;
        const dy = (-v.y * 0.5 + 0.5) * rect.height - my;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD) { bestD = d2; best = u; }
      }
      if (best >= 0) {
        if (e.shiftKey) {
          if (sel.current.has(best)) sel.current.delete(best);
          else sel.current.add(best);
        } else sel.current = new Set([best]);
      } else if (!e.shiftKey) sel.current.clear();
      refreshSelection();
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
    };
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // arrasto do gizmo
  const drag = useRef<{ start: Vector3; p0: Vector3; inv: import("three").Matrix4; idx: number[]; before: Float32Array } | null>(null);
  const writePositions = (idx: number[], data: Float32Array) => {
    const pos = mesh.geometry.getAttribute("position") as BufferAttribute;
    idx.forEach((vi, k) => pos.setXYZ(vi, data[k * 3]!, data[k * 3 + 1]!, data[k * 3 + 2]!));
    pos.needsUpdate = true;
  };
  const finishGeometry = () => {
    const g = mesh.geometry;
    if (g.getAttribute("normal")) g.computeVertexNormals();
    g.computeBoundingBox();
    g.computeBoundingSphere();
  };
  const onDown = () => {
    if (!proxy || !welded) return;
    gizmoActive.current = true;
    const idx: number[] = [];
    sel.current.forEach((u) => idx.push(...welded.members[u]!));
    const pos = mesh.geometry.getAttribute("position") as BufferAttribute;
    const before = new Float32Array(idx.length * 3);
    idx.forEach((vi, k) => { before[k * 3] = pos.getX(vi); before[k * 3 + 1] = pos.getY(vi); before[k * 3 + 2] = pos.getZ(vi); });
    mesh.updateWorldMatrix(true, false);
    const inv = mesh.matrixWorld.clone().invert();
    const start = proxy.position.clone();
    drag.current = { start, p0: start.clone().applyMatrix4(inv), inv, idx, before };
  };
  const onChange = () => {
    const d = drag.current;
    if (!d || !proxy) return;
    const delta = proxy.position.clone().sub(d.start);
    const dl = d.start.clone().add(delta).applyMatrix4(d.inv).sub(d.p0);
    const next = new Float32Array(d.before.length);
    for (let k = 0; k < d.idx.length; k++) {
      next[k * 3] = d.before[k * 3]! + dl.x;
      next[k * 3 + 1] = d.before[k * 3 + 1]! + dl.y;
      next[k * 3 + 2] = d.before[k * 3 + 2]! + dl.z;
    }
    writePositions(d.idx, next);
    syncWorld();
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    requestAnimationFrame(() => { gizmoActive.current = false; });
    if (!d) return;
    const pos = mesh.geometry.getAttribute("position") as BufferAttribute;
    const after = new Float32Array(d.before.length);
    d.idx.forEach((vi, k) => { after[k * 3] = pos.getX(vi); after[k * 3 + 1] = pos.getY(vi); after[k * 3 + 2] = pos.getZ(vi); });
    finishGeometry();
    if (after.every((v, i) => v === d.before[i])) return;
    const before = d.before;
    const apply = (data: Float32Array) => {
      writePositions(d.idx, data);
      finishGeometry();
      useWorkstation.getState().bumpTransform();
    };
    registry.history.push({
      label: `Mover ${sel.current.size} vértice(s) de ${mesh.name || "malha"}`,
      undo: () => apply(before),
      redo: () => apply(after),
    });
    useWorkstation.getState().bumpTransform();
  };

  void ver;
  if (!geo) return null;
  return (
    <>
      <points geometry={geo} frustumCulled={false} renderOrder={999}>
        <pointsMaterial size={8} sizeAttenuation={false} vertexColors depthTest={false} transparent toneMapped={false} />
      </points>
      <object3D ref={setProxy} />
      {proxy && sel.current.size > 0 && (
        <TransformControls object={proxy} mode="translate" onMouseDown={onDown} onMouseUp={onUp} onObjectChange={onChange} />
      )}
    </>
  );
}
