import { Euler, Quaternion, Vector3 } from "three";
import { useWorkstation, type CameraView, type InteractionMode, type ViewMode } from "@/store/workstation";
import { registry } from "./registry";
import { clearSession } from "@/lib/persist";
import { persistNow } from "./session";

export const VIEW_MODE_LABEL: Record<ViewMode, string> = {
  standard: "STANDARD",
  holographic: "HOLOGRAPHIC",
  wireframe: "WIREFRAME",
  xray: "X-RAY",
  engineering: "ENGINEERING",
};

export const userTouchedMode = { value: false };

export function setViewMode(mode: ViewMode, fromUser = true) {
  if (fromUser) userTouchedMode.value = true;
  useWorkstation.getState().set({ viewMode: mode, status: `MODO ${VIEW_MODE_LABEL[mode]}` });
}

export function setInteraction(mode: InteractionMode) {
  const label = { navigate: "NAVEGAÇÃO", translate: "MOVER", rotate: "GIRAR", scale: "ESCALAR", vertex: "VÉRTICES" }[mode];
  useWorkstation.getState().set({ interaction: mode, status: `FERRAMENTA ${label}` });
}

export function cameraView(view: CameraView) {
  useWorkstation.getState().camera({ kind: "view", view });
}

export function undo() {
  const c = registry.history.undo();
  if (c) useWorkstation.getState().say(`DESFEITO: ${c.label.toUpperCase()}`);
}
export function redo() {
  const c = registry.history.redo();
  if (c) useWorkstation.getState().say(`REFEITO: ${c.label.toUpperCase()}`);
}

/** Registra no histórico uma mudança de ocultar/travar/isolar para poder desfazer. */
export function toggleHidden(id: string) {
  const st = useWorkstation.getState();
  const name = registry.get(id)?.object.name || "peça";
  const was = !!st.hidden[id];
  st.toggleHidden(id);
  registry.history.push({
    label: `${was ? "Mostrar" : "Ocultar"} ${name}`,
    undo: () => useWorkstation.getState().toggleHidden(id),
    redo: () => useWorkstation.getState().toggleHidden(id),
  });
}

export function toggleLocked(id: string) {
  const st = useWorkstation.getState();
  const name = registry.get(id)?.object.name || "peça";
  const was = !!st.locked[id];
  st.toggleLocked(id);
  registry.history.push({
    label: `${was ? "Destravar" : "Travar"} ${name}`,
    undo: () => useWorkstation.getState().toggleLocked(id),
    redo: () => useWorkstation.getState().toggleLocked(id),
  });
}

export function toggleIsolate(id: string | null) {
  const st = useWorkstation.getState();
  if (!id || st.isolatedId === id) st.isolate(null);
  else st.isolate(id);
}

export interface TransformPatch {
  position?: [number, number, number];
  rotationDeg?: [number, number, number];
  scale?: [number, number, number];
}

/** Aplica valores digitados no painel de propriedades como um comando desfazível. */
export function setPartTransform(id: string, patch: TransformPatch) {
  const rec = registry.get(id);
  if (!rec) return;
  if (useWorkstation.getState().locked[id]) {
    useWorkstation.getState().say("PEÇA TRAVADA");
    return;
  }
  const before = { p: rec.basePos.clone(), q: rec.baseQuat.clone(), s: rec.baseScale.clone() };
  if (patch.position) rec.basePos.set(...patch.position);
  if (patch.rotationDeg) {
    const [x, y, z] = patch.rotationDeg.map((d) => (d * Math.PI) / 180) as [number, number, number];
    rec.baseQuat.setFromEuler(new Euler(x, y, z, "XYZ"));
  }
  if (patch.scale) {
    const s = patch.scale.map((v) => (v === 0 ? 1e-6 : v)) as [number, number, number];
    rec.baseScale.set(...s);
  }
  const after = { p: rec.basePos.clone(), q: rec.baseQuat.clone() as Quaternion, s: rec.baseScale.clone() as Vector3 };
  const apply = (t: typeof before) => {
    rec.basePos.copy(t.p);
    rec.baseQuat.copy(t.q);
    rec.baseScale.copy(t.s);
    registry.syncObject(rec);
    useWorkstation.getState().bumpTransform();
  };
  apply(after);
  registry.history.push({ label: `Editar ${rec.object.name || "peça"}`, undo: () => apply(before), redo: () => apply(after) });
}

export function resetPart(id: string) {
  const rec = registry.get(id);
  if (!rec) return;
  setPartTransform(id, {
    position: rec.origPos.toArray() as [number, number, number],
    rotationDeg: (() => {
      const e = new Euler().setFromQuaternion(rec.origQuat, "XYZ");
      return [(e.x * 180) / Math.PI, (e.y * 180) / Math.PI, (e.z * 180) / Math.PI] as [number, number, number];
    })(),
    scale: rec.origScale.toArray() as [number, number, number],
  });
}

/** Reseta o projeto: transformações, visibilidade, desmontagem e sessão salva. */
export function resetProject() {
  const st = useWorkstation.getState();
  registry.resetTransforms();
  registry.history.clear();
  st.set({ hidden: {}, locked: {}, isolatedId: null, exploded: 0, selectedId: null, status: "PROJETO RESTAURADO" });
  st.bumpTransform();
  if (st.model) clearSession(st.model.name);
  st.camera({ kind: "frame-all" });
}

export function saveProject() {
  const cam = persistNow();
  useWorkstation.getState().say(cam ? "SESSÃO SALVA NO NAVEGADOR" : "FALHA AO SALVAR: ARMAZENAMENTO INDISPONÍVEL");
}

export function toggleExplode() {
  const st = useWorkstation.getState();
  if ((st.model?.meshes ?? 0) < 2) {
    st.say("EXPLODED VIEW EXIGE MODELO COM PEÇAS SEPARADAS");
    return;
  }
  st.set({ exploded: st.exploded > 0.01 ? 0 : 1, explodePlaying: true, status: st.exploded > 0.01 ? "REMONTANDO" : "DESMONTANDO" });
}
