import { beforeEach, describe, expect, it } from "vitest";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Quaternion } from "three";
import { registry, type PartRecord } from "@/three/registry";
import { useWorkstation } from "@/store/workstation";
import { runBoolean } from "@/three/editing";

function addPart(root: Group, name: string, g: BoxGeometry, x: number): PartRecord {
  const m = new Mesh(g, new MeshStandardMaterial({ name }));
  m.name = name;
  m.position.set(x, 0, 0);
  root.add(m);
  const rec: PartRecord = {
    id: m.uuid, object: m, basePos: m.position.clone(), baseQuat: new Quaternion(), baseScale: m.scale.clone(),
    origPos: m.position.clone(), origQuat: new Quaternion(), origScale: m.scale.clone(),
    explodeDir: m.position.clone().set(0, 0, 0), path: `/${name}`,
  } as unknown as PartRecord;
  registry.parts.set(m.uuid, rec);
  return rec;
}

describe("booleanas", () => {
  let root: Group;
  let a: PartRecord;
  let b: PartRecord;
  beforeEach(() => {
    registry.clear();
    root = new Group();
    root.updateMatrixWorld(true);
    registry.root = root;
    registry.modelSize = 3;
    useWorkstation.setState({ locked: {}, hidden: {}, model: null, tree: null });
    a = addPart(root, "A", new BoxGeometry(2, 2, 2), 0);
    b = addPart(root, "B", new BoxGeometry(1, 1, 3), 0.5);
  });

  it("subtração substitui A e B por um resultado, e desfazer restaura", () => {
    const r = runBoolean(a.id, b.id, "subtract");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(root.children.map((c) => c.name)).toEqual(["A_subtract_B"]);
    expect(r.triangles).toBeGreaterThan(12);
    registry.history.undo();
    expect(root.children.map((c) => c.name).sort()).toEqual(["A", "B"]);
    registry.history.redo();
    expect(root.children.map((c) => c.name)).toEqual(["A_subtract_B"]);
  });

  it("interseção sem sobreposição falha com mensagem", () => {
    b.object.position.set(10, 0, 0);
    const r = runBoolean(a.id, b.id, "intersect");
    expect(r.ok).toBe(false);
    expect(root.children.length).toBe(2);
  });

  it("recusa a mesma peça e peça travada", () => {
    expect(runBoolean(a.id, a.id, "union").ok).toBe(false);
    useWorkstation.setState({ locked: { [b.id]: true } });
    expect(runBoolean(a.id, b.id, "union").ok).toBe(false);
  });
});
