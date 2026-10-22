import { useWorkstation } from "@/store/workstation";
import { registry } from "./registry";
import { loadSession, saveSession, type SavedSession } from "@/lib/persist";

/** Pose de câmera restaurada, consumida uma vez pelo CameraRig. */
export const pendingCamera: { value: SavedSession["camera"] | null } = { value: null };

export function currentSession(camera?: SavedSession["camera"]): SavedSession {
  const st = useWorkstation.getState();
  const byId = (m: Record<string, true>) =>
    Object.keys(m).map((id) => registry.get(id)?.path).filter((p): p is string => !!p);
  const transforms: SavedSession["transforms"] = {};
  registry.parts.forEach((rec) => {
    const moved =
      !rec.basePos.equals(rec.origPos) || !rec.baseQuat.equals(rec.origQuat) || !rec.baseScale.equals(rec.origScale);
    if (moved) {
      transforms[rec.path] = {
        p: rec.basePos.toArray() as [number, number, number],
        q: rec.baseQuat.toArray() as [number, number, number, number],
        s: rec.baseScale.toArray() as [number, number, number],
      };
    }
  });
  return { v: 1, camera, viewMode: st.viewMode, hidden: byId(st.hidden), locked: byId(st.locked), transforms };
}

export function persistNow(camera?: SavedSession["camera"]) {
  const name = useWorkstation.getState().model?.name;
  if (!name) return false;
  return saveSession(name, currentSession(camera));
}

/** Restaura a sessão salva do modelo. Retorna true se havia sessão. */
export function restoreSession(modelName: string): boolean {
  const data = loadSession(modelName);
  if (!data) return false;
  const byPath = new Map<string, string>();
  registry.parts.forEach((rec, id) => byPath.set(rec.path, id));

  for (const [path, t] of Object.entries(data.transforms)) {
    const id = byPath.get(path);
    const rec = id ? registry.parts.get(id) : undefined;
    if (!rec) continue;
    rec.basePos.fromArray(t.p);
    rec.baseQuat.fromArray(t.q);
    rec.baseScale.fromArray(t.s);
    registry.syncObject(rec);
  }
  const toIds = (paths: string[]) => {
    const out: Record<string, true> = {};
    for (const p of paths) {
      const id = byPath.get(p);
      if (id) out[id] = true;
    }
    return out;
  };
  useWorkstation.setState({ hidden: toIds(data.hidden), locked: toIds(data.locked) });
  if (data.camera) pendingCamera.value = data.camera;
  return true;
}
