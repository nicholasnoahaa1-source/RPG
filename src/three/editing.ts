import {
  BufferGeometry, Float32BufferAttribute, Material, Mesh, Object3D, Quaternion, Vector3, Box3,
} from "three";
import { ADDITION, Brush, Evaluator, INTERSECTION, SUBTRACTION } from "three-bvh-csg";
import { useWorkstation, type PartNode } from "@/store/workstation";
import { explodeVector } from "@/lib/explode";
import { registry, meshStats, type PartRecord } from "./registry";

export type BoolOp = "union" | "subtract" | "intersect";

export const BOOL_LABEL: Record<BoolOp, string> = { union: "UNIÃO", subtract: "SUBTRAÇÃO", intersect: "INTERSEÇÃO" };
const OPS = { union: ADDITION, subtract: SUBTRACTION, intersect: INTERSECTION } as const;

let csgCounter = 0;

function nodeName(o: Object3D, i: number) {
  return o.name || ((o as Mesh).isMesh ? `Mesh_${i}` : `Node_${i}`);
}

function buildNodes(o: Object3D, index: number): PartNode | null {
  const children: PartNode[] = [];
  o.children.forEach((c, i) => {
    const n = buildNodes(c, i);
    if (n) children.push(n);
  });
  const isMesh = !!(o as Mesh).isMesh;
  if (!isMesh && children.length === 0) return null;
  return { id: o.uuid, name: nodeName(o, index), kind: isMesh ? "mesh" : "group", children };
}

/** Reconstrói a árvore e as estatísticas do modelo após adicionar ou remover peças. */
export function refreshTree() {
  const root = registry.root;
  if (!root) return;
  const st = useWorkstation.getState();
  const stats = meshStats(root);
  useWorkstation.setState({
    tree: buildNodes(root, 0),
    model: st.model
      ? { ...st.model, parts: registry.parts.size, meshes: stats.meshes, vertices: stats.vertices, triangles: stats.triangles, medianEdge: stats.medianEdge }
      : st.model,
    transformTick: st.transformTick + 1,
  });
}

export function isEditableMesh(rec: PartRecord | undefined): rec is PartRecord {
  const m = rec?.object as Mesh | undefined;
  if (!m || !m.isMesh) return false;
  if ((m as unknown as { isSkinnedMesh?: boolean }).isSkinnedMesh) return false;
  const g = m.geometry;
  if (g.morphAttributes && Object.keys(g.morphAttributes).length > 0) return false;
  const pos = g.getAttribute("position");
  return !!pos && !("isInterleavedBufferAttribute" in pos && (pos as { isInterleavedBufferAttribute?: boolean }).isInterleavedBufferAttribute) && pos.array instanceof Float32Array;
}

/** Geometria própria da peça: evita que a edição altere outras peças que compartilham a mesma geometria. */
const owned = new WeakSet<BufferGeometry>();
export function ensureOwnGeometry(mesh: Mesh) {
  if (owned.has(mesh.geometry)) return;
  const old = mesh.geometry;
  mesh.geometry = old.clone();
  owned.add(mesh.geometry);
  registry.disposables.add(old);
}

function prepForCsg(src: BufferGeometry): BufferGeometry {
  const g = src.clone();
  for (const name of Object.keys(g.attributes)) {
    if (name !== "position" && name !== "normal" && name !== "uv") g.deleteAttribute(name);
  }
  const pos = g.getAttribute("position");
  if (!g.getAttribute("normal")) g.computeVertexNormals();
  if (!g.getAttribute("uv")) g.setAttribute("uv", new Float32BufferAttribute(new Float32Array(pos.count * 2), 2));
  return g;
}

export type BoolResult = { ok: true; id: string; triangles: number } | { ok: false; error: string };

export function runBoolean(aId: string, bId: string, op: BoolOp): BoolResult {
  const ra = registry.get(aId);
  const rb = registry.get(bId);
  const root = registry.root;
  if (!root || !ra || !rb) return { ok: false, error: "Peça não encontrada." };
  if (ra.id === rb.id) return { ok: false, error: "Escolha duas peças diferentes." };
  if (!isEditableMesh(ra) || !isEditableMesh(rb)) return { ok: false, error: "As duas peças precisam ser malhas rígidas (sem skinning ou morph targets)." };
  if (registry.explodeApplied > 1e-3) return { ok: false, error: "Remonte a Exploded View antes de aplicar booleanas." };
  const st = useWorkstation.getState();
  if (st.locked[aId] || st.locked[bId]) return { ok: false, error: "Uma das peças está travada." };

  const a = ra.object as Mesh;
  const b = rb.object as Mesh;
  const mat = (r: PartRecord, m: Mesh): Material | Material[] => r.originalMaterial ?? m.material;
  const ga = prepForCsg(a.geometry);
  const gb = prepForCsg(b.geometry);
  const brushA = new Brush(ga, mat(ra, a));
  const brushB = new Brush(gb, mat(rb, b));
  a.updateWorldMatrix(true, false);
  b.updateWorldMatrix(true, false);
  a.matrixWorld.decompose(brushA.position, brushA.quaternion, brushA.scale);
  b.matrixWorld.decompose(brushB.position, brushB.quaternion, brushB.scale);
  brushA.updateMatrixWorld(true);
  brushB.updateMatrixWorld(true);

  let result: Brush;
  try {
    result = new Evaluator().evaluate(brushA, brushB, OPS[op]);
  } catch (e) {
    brushA.disposeCacheData(); brushB.disposeCacheData(); ga.dispose(); gb.dispose();
    return { ok: false, error: `Falha na operação: ${e instanceof Error ? e.message : String(e)}` };
  }
  const geo = result.geometry;
  const tris = (geo.getIndex()?.count ?? geo.getAttribute("position")?.count ?? 0) / 3;
  const worldMatrix = brushA.matrixWorld.clone();
  const resultMat = result.material;
  brushA.disposeCacheData();
  brushB.disposeCacheData();
  ga.dispose();
  gb.dispose();
  if (tris === 0) {
    geo.dispose();
    return { ok: false, error: "O resultado é vazio (as peças não se sobrepõem para esta operação)." };
  }

  const out = new Mesh(geo, resultMat);
  out.name = `${a.name || "A"}_${op}_${b.name || "B"}`;
  out.castShadow = true;
  out.receiveShadow = true;
  root.updateWorldMatrix(true, false);
  const local = root.matrixWorld.clone().invert().multiply(worldMatrix);
  local.decompose(out.position, out.quaternion, out.scale);

  const pa = a.parent;
  const pb = b.parent;
  if (!pa || !pb) return { ok: false, error: "Peça fora da cena." };

  const worldBox = new Box3().setFromObject(root);
  const modelCenter = worldBox.getCenter(new Vector3());
  root.add(out);
  out.updateWorldMatrix(true, false);
  const c = new Box3().setFromObject(out).getCenter(new Vector3());
  const worldDir = explodeVector(c, modelCenter, registry.modelSize, 0);
  const dir = root.worldToLocal(c.clone().add(worldDir)).sub(root.worldToLocal(c.clone()));
  const rec: PartRecord = {
    id: out.uuid,
    object: out,
    basePos: out.position.clone(),
    baseQuat: out.quaternion.clone() as Quaternion,
    baseScale: out.scale.clone(),
    origPos: out.position.clone(),
    origQuat: out.quaternion.clone() as Quaternion,
    origScale: out.scale.clone(),
    explodeDir: dir,
    path: `/csg/${++csgCounter}`,
  };
  registry.parts.set(out.uuid, rec);
  pa.remove(a);
  pb.remove(b);

  const finish = (selectId: string) => {
    useWorkstation.setState({ selectedId: selectId, hoveredId: null });
    refreshTree();
  };
  const redo = () => {
    a.removeFromParent();
    b.removeFromParent();
    root.add(out);
    finish(out.uuid);
  };
  const undo = () => {
    out.removeFromParent();
    pa.add(a);
    pb.add(b);
    finish(a.uuid);
  };
  registry.history.push({ label: `${BOOL_LABEL[op]} ${a.name || "A"} / ${b.name || "B"}`, undo, redo });
  finish(out.uuid);
  return { ok: true, id: out.uuid, triangles: tris };
}
