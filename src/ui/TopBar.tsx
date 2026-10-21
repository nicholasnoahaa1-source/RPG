"use client";

import { useWorkstation } from "@/store/workstation";
import { VIEW_MODE_LABEL, resetProject, saveProject } from "@/three/actions";

export default function TopBar() {
  const model = useWorkstation((s) => s.model);
  const viewMode = useWorkstation((s) => s.viewMode);
  const fps = useWorkstation((s) => s.fps);
  const quality = useWorkstation((s) => s.quality);
  const status = useWorkstation((s) => s.status);
  const leftOpen = useWorkstation((s) => s.leftOpen);
  const rightOpen = useWorkstation((s) => s.rightOpen);
  const showGrid = useWorkstation((s) => s.showGrid);
  const showAxes = useWorkstation((s) => s.showAxes);
  const autoRotate = useWorkstation((s) => s.autoRotate);
  const set = useWorkstation((s) => s.set);

  return (
    <header className="topbar" role="banner">
      <div className="tb-id">
        <span className="tb-mark" aria-hidden="true" />
        <div>
          <div className="tb-project">STARK HOLOGRAPHIC WORKSTATION</div>
          <div className="tb-model">{model ? model.name : "SEM MODELO"}</div>
        </div>
      </div>

      <div className="tb-status" aria-live="polite">
        <span className="tb-k">MODO</span>
        <span className="tb-v">{VIEW_MODE_LABEL[viewMode]}</span>
        <span className="tb-k">RENDER</span>
        <span className="tb-v mono">{fps > 0 ? `${fps} FPS` : "—"} · {quality.toUpperCase()}</span>
        <span className="tb-msg">{status}</span>
      </div>

      <nav className="tb-actions" aria-label="Ações de projeto">
        <button className={`btn ${leftOpen ? "on" : ""}`} aria-pressed={leftOpen} onClick={() => set({ leftOpen: !leftOpen })} title="Painel de componentes">
          ÁRVORE
        </button>
        <button className={`btn ${rightOpen ? "on" : ""}`} aria-pressed={rightOpen} onClick={() => set({ rightOpen: !rightOpen })} title="Painel de propriedades">
          PROPS
        </button>
        <span className="sep" aria-hidden="true" />
        <button className={`btn ${showGrid ? "on" : ""}`} aria-pressed={showGrid} onClick={() => set({ showGrid: !showGrid })} title="Grade (G)">GRADE</button>
        <button className={`btn ${showAxes ? "on" : ""}`} aria-pressed={showAxes} onClick={() => set({ showAxes: !showAxes })} title="Eixos X Y Z">EIXOS</button>
        <button className={`btn ${autoRotate ? "on" : ""}`} aria-pressed={autoRotate} onClick={() => set({ autoRotate: !autoRotate })} title="Rotação automática (A)">AUTO-GIRO</button>
        <span className="sep" aria-hidden="true" />
        <button className="btn" disabled={!model} onClick={saveProject} title="Salvar sessão no navegador">SALVAR</button>
        <button className="btn" disabled={!model} onClick={resetProject} title="Restaurar transformações, visibilidade e câmera">RESET</button>
        <button className="btn" onClick={() => set({ settingsOpen: true })} title="Configurações gráficas e de câmera">CONFIG</button>
        <button className="btn" onClick={() => set({ shortcutsOpen: true })} title="Atalhos (?)">ATALHOS</button>
      </nav>
    </header>
  );
}
