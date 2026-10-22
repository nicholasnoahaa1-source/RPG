import type { ViewMode } from "@/store/workstation";

export interface SavedTransform {
  p: [number, number, number];
  q: [number, number, number, number];
  s: [number, number, number];
}

export interface SavedSession {
  v: 1;
  camera?: { pos: [number, number, number]; target: [number, number, number] };
  viewMode?: ViewMode;
  hidden: string[];
  locked: string[];
  transforms: Record<string, SavedTransform>;
}

const key = (model: string) => `swk:session:${model}`;

export function loadSession(model: string): SavedSession | null {
  try {
    const raw = localStorage.getItem(key(model));
    if (!raw) return null;
    const data = JSON.parse(raw) as SavedSession;
    return data.v === 1 ? data : null;
  } catch {
    return null;
  }
}

export function saveSession(model: string, data: SavedSession): boolean {
  try {
    localStorage.setItem(key(model), JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSession(model: string) {
  try {
    localStorage.removeItem(key(model));
  } catch {
    /* armazenamento indisponível */
  }
}
