"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import {
  Box3, Group, Material, Mesh, Object3D, PointLight, Quaternion, Vector3,
} from "three";
import { useWorkstation, type PartNode } from "@/store/workstation";
import { loadGltf } from "./loader";
import { meshStats, registry, type PartRecord } from "./registry";
import { disposeTree } from "./disposal";
import { explodeVector } from "@/lib/explode";
import { restoreSession } from "./session";

function buildTree(obj: Object3D, parentPath: string, index: number, onPart: (o: Object3D, path: string) => void): PartNode | null {
  const name = obj.name || ((obj as Mesh).isMesh ? `Mesh_${index}` : `Node_${index}`);
  const path = `${parentPath}/${name}[${index}]`;
  const children: PartNode[] = [];
  obj.children.forEach((c, i) => {
    const n = buildTree(c, path, i, onPart);
    if (n) children.push(n);
  });
  const isMesh = !!(obj as Mesh).isMesh;
  if (!isMesh && children.length === 0) return null;
  onPart(obj, path);
  return { id: obj.uuid, name, kind: isMesh ? "mesh" : "group", children };
}

export default function ModelRoot() {
  const source = useWorkstation((s) => s.source);
  const [loaded, setLoaded] = useState<{ obj: Object3D; src: { url: string; name: string } } | null>(null);
  const scene = loaded?.obj ?? null;
  const wrapper = useRef<Group>(null);
  const originals = useRef(new Map<string, Material | Material[]>());
  const invalidate = useThree((s) => s.invalidate);

  // carregamento
  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    setLoaded(null);
    const st = useWorkstation.getState();
    st.set({ loadState: "loading", loadError: null, loadProgress: 0, status: `CARREGANDO ${source.name.toUpperCase()}` });
    loadGltf(source.url, (p) => useWorkstation.getState().set({ loadProgress: p }))
      .then((obj) => {
        if (cancelled) {
          disposeTree(obj);
          return;
        }
        setLoaded({ obj, src: source });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        useWorkstation.getState().set({
          loadState: "error",
          loadError: `Falha ao carregar o modelo: ${msg}`,
          status: "ERRO DE CARREGAMENTO",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [source]);

  // preparação da cena carregada
  useEffect(() => {
    if (!loaded) return;
    const { obj: scene, src: source } = loaded;
    const st = useWorkstation.getState();
    registry.clear();
    originals.current.clear();

    const box = new Box3().setFromObject(scene);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    // centraliza em X/Z e apoia a base em y=0 usando o wrapper; objetos do arquivo não são alterados
    if (wrapper.current) wrapper.current.position.set(-center.x, -box.min.y, -center.z);
    wrapper.current?.updateMatrixWorld(true);
    const worldBox = new Box3().setFromObject(scene);
    const worldCenter = worldBox.getCenter(new Vector3());
    const modelSize = Math.max(size.x, size.y, size.z) || 1;

    const stats = meshStats(scene);
    let idx = 0;
    const tree = buildTree(scene, "", 0, (o, path) => {
      const mesh = o as Mesh;
      let dir = new Vector3();
      if (mesh.isMesh) {
        originals.current.set(mesh.uuid, mesh.material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const c = new Box3().setFromObject(mesh).getCenter(new Vector3());
        const worldDir = explodeVector(c, worldCenter, modelSize, idx++);
        const parent = o.parent;
        if (parent) {
          parent.updateWorldMatrix(true, false);
          const a = parent.worldToLocal(c.clone().add(worldDir));
          const b = parent.worldToLocal(c.clone());
          dir = a.sub(b);
        } else dir = worldDir;
      }
      const rec: PartRecord = {
        id: o.uuid,
        object: o,
        basePos: o.position.clone(),
        baseQuat: o.quaternion.clone() as Quaternion,
        baseScale: o.scale.clone(),
        origPos: o.position.clone(),
        origQuat: o.quaternion.clone() as Quaternion,
        origScale: o.scale.clone(),
        explodeDir: dir,
        path,
      };
      registry.parts.set(o.uuid, rec);
    });

    registry.root = scene;
    registry.modelSize = modelSize;

    // fov padrão 35°: distância de enquadramento 1×
    const refDistance = (modelSize / 2 / Math.tan((35 * Math.PI) / 360)) * 1.35;
    const name = source.name;
    st.set({
      tree,
      loadState: "ready",
      loadError: null,
      refDistance,
      model: {
        name,
        source: source.url.startsWith("blob:") ? "arquivo local" : source.url,
        parts: registry.parts.size,
        meshes: stats.meshes,
        vertices: stats.vertices,
        triangles: stats.triangles,
        size: [size.x, size.y, size.z],
        medianEdge: stats.medianEdge,
        hasSkinned: stats.skinned,
      },
      status: "MODELO PRONTO",
    });
    if (restoreSession(name)) useWorkstation.getState().say("SESSÃO RESTAURADA");

    // reator ARC: só se o modelo tiver peça com esse nome
    let reactor: PointLight | null = null;
    registry.parts.forEach((rec) => {
      if (!reactor && (rec.object as Mesh).isMesh && /arc|reactor|reator/i.test(rec.object.name)) {
        reactor = new PointLight("#7fe6ff", 3, modelSize * 2, 2);
        rec.object.add(reactor);
      }
    });

    invalidate();
    const orig = originals.current;
    return () => {
      (reactor as PointLight | null)?.removeFromParent();
      registry.clear();
      disposeTree(scene, orig);
      orig.clear();
      useWorkstation.setState({ model: null, tree: null, selectedId: null, hoveredId: null });
    };
  }, [loaded, invalidate]);

  // visibilidade, ocultar e isolamento
  const hidden = useWorkstation((s) => s.hidden);
  const isolatedId = useWorkstation((s) => s.isolatedId);
  const tree = useWorkstation((s) => s.tree);
  useEffect(() => {
    if (!registry.root) return;
    const isolated = isolatedId ? registry.parts.get(isolatedId)?.object : undefined;
    registry.parts.forEach((rec) => {
      const o = rec.object;
      let visible = !hidden[rec.id];
      if (visible && isolated) {
        let inside = false;
        for (let p: Object3D | null = o; p; p = p.parent) if (p === isolated) inside = true;
        let isAncestor = false;
        isolated.traverseAncestors((a) => {
          if (a === o) isAncestor = true;
        });
        visible = inside || isAncestor;
      }
      o.visible = visible;
    });
    invalidate();
  }, [hidden, isolatedId, tree, invalidate]);

  // desmontagem: animação interruptível
  const explodeCur = useRef(0);
  useFrame((_, dt) => {
    const st = useWorkstation.getState();
    if (!registry.root) return;
    const target = st.exploded;
    if (st.explodePlaying) {
      const next = target + (explodeCur.current - target) * Math.exp(-6 * Math.min(dt, 0.1));
      explodeCur.current = Math.abs(next - target) < 1e-4 ? target : next;
    }
    if (Math.abs(registry.explodeApplied - explodeCur.current) > 1e-5) {
      registry.applyExplode(explodeCur.current);
      invalidate();
    }
    if (st.explodePlaying && explodeCur.current !== target) invalidate();
  });

  // seleção por clique, hover
  const select = useWorkstation((s) => s.select);
  const set = useWorkstation((s) => s.set);
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (useWorkstation.getState().interaction === "vertex") return;
    select(e.object.uuid);
  };
  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    set({ hoveredId: e.object.uuid });
    document.body.style.cursor = "crosshair";
  };
  const onOut = () => {
    set({ hoveredId: null });
    document.body.style.cursor = "";
  };
  const onDouble = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    select(e.object.uuid);
    useWorkstation.getState().camera({ kind: "frame-selection" });
  };

  const prim = useMemo(() => scene, [scene]);
  return (
    <group ref={wrapper}>
      {prim && (
        <primitive object={prim} onClick={onClick} onDoubleClick={onDouble} onPointerOver={onOver} onPointerOut={onOut} />
      )}
    </group>
  );
}
