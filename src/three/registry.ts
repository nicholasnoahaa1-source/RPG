import { Box3, BufferGeometry, Material, Mesh, Object3D, Quaternion, Vector3 } from "three";
import { History } from "@/lib/history";
import { explodeOffset } from "@/lib/explode";

/** Estado do motor 3D fora do React: refs de objetos, transformações-base e histórico. */
export interface PartRecord {
  id: string;
  object: Object3D;
  /** posição local do usuário, sem o deslocamento de desmontagem */
  basePos: Vector3;
  baseQuat: Quaternion;
  baseScale: Vector3;
  origPos: Vector3;
  origQuat: Quaternion;
  origScale: Vector3;
  explodeDir: Vector3;
  originalMaterial?: Material | Material[];
  path: string;
}

class Registry {
  root: Object3D | null = null;
  parts = new Map<string, PartRecord>();
  history = new History();
  modelSize = 1;
  /** intensidade de desmontagem atualmente aplicada */
  explodeApplied = 0;

  clear() {
    this.root = null;
    this.parts.clear();
    this.history.clear();
    this.explodeApplied = 0;
  }

  get(id: string | null): PartRecord | undefined {
    return id ? this.parts.get(id) : undefined;
  }

  offsetFor(rec: PartRecord, out = new Vector3()) {
    return explodeOffset(rec.explodeDir, this.explodeApplied, out);
  }

  /** aplica basePos + deslocamento de desmontagem ao objeto */
  syncObject(rec: PartRecord) {
    const off = this.offsetFor(rec);
    rec.object.position.copy(rec.basePos).add(off);
    rec.object.quaternion.copy(rec.baseQuat);
    rec.object.scale.copy(rec.baseScale);
  }

  /** lê a transformação atual do objeto de volta para a base (após gizmo) */
  captureBase(rec: PartRecord) {
    const off = this.offsetFor(rec);
    rec.basePos.copy(rec.object.position).sub(off);
    rec.baseQuat.copy(rec.object.quaternion);
    rec.baseScale.copy(rec.object.scale);
  }

  applyExplode(amount: number) {
    this.explodeApplied = amount;
    this.parts.forEach((rec) => {
      if (rec.explodeDir.lengthSq() === 0) return;
      rec.object.position.copy(rec.basePos).add(this.offsetFor(rec));
    });
  }

  resetTransforms() {
    this.parts.forEach((rec) => {
      rec.basePos.copy(rec.origPos);
      rec.baseQuat.copy(rec.origQuat);
      rec.baseScale.copy(rec.origScale);
      this.syncObject(rec);
    });
  }

  worldBox(obj: Object3D, out = new Box3()) {
    return out.setFromObject(obj);
  }
}

export const registry = new Registry();

export function meshStats(root: Object3D) {
  let vertices = 0;
  let triangles = 0;
  let meshes = 0;
  let skinned = false;
  const edges: number[] = [];
  const a = new Vector3();
  const b = new Vector3();
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    meshes++;
    if ((m as unknown as { isSkinnedMesh?: boolean }).isSkinnedMesh) skinned = true;
    const g: BufferGeometry = m.geometry;
    const pos = g.getAttribute("position");
    if (!pos) return;
    vertices += pos.count;
    const idx = g.getIndex();
    const tri = (idx ? idx.count : pos.count) / 3;
    triangles += tri;
    // amostra de arestas (até 200 triângulos por malha) para estimar resolução geométrica
    const step = Math.max(1, Math.floor(tri / 200));
    const scale = new Vector3();
    m.getWorldScale(scale);
    const s = (Math.abs(scale.x) + Math.abs(scale.y) + Math.abs(scale.z)) / 3;
    for (let t = 0; t < tri; t += step) {
      const i0 = idx ? idx.getX(t * 3) : t * 3;
      const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
      a.fromBufferAttribute(pos, i0);
      b.fromBufferAttribute(pos, i1);
      const e = a.distanceTo(b) * s;
      if (e > 0) edges.push(e);
    }
  });
  edges.sort((x, y) => x - y);
  const medianEdge = edges.length ? (edges[Math.floor(edges.length / 2)] ?? 0) : 0;
  return { vertices, triangles, meshes, skinned, medianEdge };
}
