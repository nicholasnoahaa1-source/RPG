import { create } from "zustand";

export type ViewMode = "standard" | "holographic" | "wireframe" | "xray" | "engineering";
export type InteractionMode = "navigate" | "translate" | "rotate" | "scale" | "vertex";
export type Quality = "low" | "medium" | "high" | "ultra";
export type LoadState = "empty" | "loading" | "ready" | "error";
export type CameraView = "front" | "back" | "left" | "right" | "top" | "iso";

export interface PartNode {
  id: string;
  name: string;
  kind: "group" | "mesh";
  children: PartNode[];
}

export interface ModelInfo {
  name: string;
  source: string;
  parts: number;
  meshes: number;
  vertices: number;
  triangles: number;
  size: [number, number, number];
  medianEdge: number;
  hasSkinned: boolean;
}

export interface CameraCommand {
  seq: number;
  kind: "view" | "frame-all" | "frame-selection" | "zoom";
  view?: CameraView;
  zoom?: number;
}

interface State {
  boot: "idle" | "running" | "done";
  bootStep: number;

  source: { url: string; name: string } | null;
  loadState: LoadState;
  loadError: string | null;
  loadProgress: number;
  model: ModelInfo | null;
  tree: PartNode | null;

  selectedId: string | null;
  hoveredId: string | null;
  hidden: Record<string, true>;
  locked: Record<string, true>;
  isolatedId: string | null;

  interaction: InteractionMode;
  space: "world" | "local";
  snap: boolean;

  viewMode: ViewMode;
  showGrid: boolean;
  showAxes: boolean;

  exploded: number;
  explodePlaying: boolean;
  explodeTarget: number;

  autoRotate: boolean;
  rotateSpeed: number;
  damping: number;
  verticalLimit: boolean;
  maxZoom: number;
  nearFactor: number;
  zoom: number;
  refDistance: number;
  beyondDetail: boolean;
  cameraCmd: CameraCommand;

  quality: Quality;
  qualityAuto: boolean;
  fps: number;
  contextLost: boolean;

  history: { canUndo: boolean; canRedo: boolean; undoLabel: string | null; redoLabel: string | null };
  transformTick: number;
  vertexSel: number;
  vertexTotal: number;

  leftOpen: boolean;
  rightOpen: boolean;
  shortcutsOpen: boolean;
  settingsOpen: boolean;
  status: string;
}

interface Actions {
  set: (patch: Partial<State>) => void;
  select: (id: string | null) => void;
  toggleHidden: (id: string) => void;
  toggleLocked: (id: string) => void;
  isolate: (id: string | null) => void;
  camera: (cmd: Omit<CameraCommand, "seq">) => void;
  bumpTransform: () => void;
  say: (msg: string) => void;
}

const initial: State = {
  boot: "idle",
  bootStep: 0,

  source: null,
  loadState: "empty",
  loadError: null,
  loadProgress: 0,
  model: null,
  tree: null,

  selectedId: null,
  hoveredId: null,
  hidden: {},
  locked: {},
  isolatedId: null,

  interaction: "navigate",
  space: "world",
  snap: false,

  viewMode: "standard",
  showGrid: true,
  showAxes: true,

  exploded: 0,
  explodePlaying: true,
  explodeTarget: 0,

  autoRotate: false,
  rotateSpeed: 1,
  damping: 0.08,
  verticalLimit: true,
  maxZoom: 2000,
  nearFactor: 0.02,
  zoom: 1,
  refDistance: 5,
  beyondDetail: false,
  cameraCmd: { seq: 0, kind: "frame-all" },

  quality: "high",
  qualityAuto: true,
  fps: 0,
  contextLost: false,

  history: { canUndo: false, canRedo: false, undoLabel: null, redoLabel: null },
  transformTick: 0,
  vertexSel: 0,
  vertexTotal: 0,

  leftOpen: true,
  rightOpen: true,
  shortcutsOpen: false,
  settingsOpen: false,
  status: "SISTEMA EM ESPERA",
};

export const useWorkstation = create<State & Actions>((set, get) => ({
  ...initial,
  set: (patch) => set(patch),
  select: (id) => set({ selectedId: id }),
  toggleHidden: (id) =>
    set((s) => {
      const hidden = { ...s.hidden };
      if (hidden[id]) delete hidden[id];
      else hidden[id] = true;
      return { hidden };
    }),
  toggleLocked: (id) =>
    set((s) => {
      const locked = { ...s.locked };
      if (locked[id]) delete locked[id];
      else locked[id] = true;
      return { locked };
    }),
  isolate: (id) => set({ isolatedId: id }),
  camera: (cmd) => set({ cameraCmd: { ...cmd, seq: get().cameraCmd.seq + 1 } }),
  bumpTransform: () => set((s) => ({ transformTick: s.transformTick + 1 })),
  say: (msg) => set({ status: msg }),
}));

export function resetModelState() {
  useWorkstation.setState({
    selectedId: null,
    hoveredId: null,
    hidden: {},
    locked: {},
    isolatedId: null,
    exploded: 0,
    explodeTarget: 0,
    history: initial.history,
    tree: null,
    model: null,
    beyondDetail: false,
  });
}
