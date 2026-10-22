"use client";

import { useEffect, useRef, useState } from "react";
import { useWorkstation, type CameraView, type InteractionMode, type ViewMode } from "@/store/workstation";
import { cameraView, redo, setInteraction, setViewMode, toggleExplode, undo } from "@/three/actions";
import { registry } from "@/three/registry";
import { formatZoom, sliderToZoom, zoomToSlider } from "@/lib/zoom";

const TOOLS: { id: InteractionMode; label: string; key: string; tip: string }[] = [
  { id: "navigate", label: "NAVEGAR", key: "Q", tip: "Câmera: arrastar gira, botão direito move, roda dá zoom" },
  { id: "translate", label: "MOVER", key: "W", tip: "Gizmo de translação da peça selecionada" },
  { id: "rotate", label: "GIRAR", key: "E", tip: "Gizmo de rotação da peça selecionada" },
  { id: "scale", label: "ESCALAR", key: "R", tip: "Gizmo de escala da peça selecionada" },
  { id: "vertex", label: "VÉRTICES", key: "T", tip: "Editar vértices da malha selecionada" },
];
const VIEWS: { id: CameraView; label: string; key: string }[] = [
  { id: "front", label: "FRONT", key: "1" },
  { id: "back", label: "BACK", key: "2" },
  { id: "right", label: "DIR", key: "3" },
  { id: "left", label: "ESQ", key: "4" },
  { id: "top", label: "TOPO", key: "5" },
  { id: "iso", label: "ISO", key: "" },
];
const MODES: { id: ViewMode; label: string; key: string }[] = [
  { id: "standard", label: "STANDARD", key: "⇧1" },
  { id: "holographic", label: "HOLO", key: "⇧2" },
  { id: "wireframe", label: "WIRE", key: "⇧3" },
  { id: "xray", label: "X-RAY", key: "⇧4" },
  { id: "engineering", label: "ENG", key: "⇧5" },
];

export default function BottomBar() {
  const s = useWorkstation();
  const ref = useRef<HTMLElement>(null);
  const [, force] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty("--dock", `${el.offsetHeight}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => registry.history.subscribe(() => force((n) => n + 1)), []);
  const ready = s.loadState === "ready";
  const explodable = (s.model?.meshes ?? 0) >= 2;
  const h = registry.history;

  return (
    <footer ref={ref} className="dock" role="toolbar" aria-label="Controles da estação">
      <div className="dock-row">
        <div className="grp" role="group" aria-label="Ferramentas">
          {TOOLS.map((t) => (
            <button key={t.id} className={`btn ${s.interaction === t.id ? "on" : ""}`} aria-pressed={s.interaction === t.id} title={`${t.tip} (${t.key})`} disabled={!ready && t.id !== "navigate"} onClick={() => setInteraction(t.id)}>
              {t.label}<kbd>{t.key}</kbd>
            </button>
          ))}
          <button className={`btn ${s.space === "local" ? "on" : ""}`} aria-pressed={s.space === "local"} onClick={() => s.set({ space: s.space === "world" ? "local" : "world" })} title="Eixos do gizmo: mundo ou locais da peça">
            {s.space === "world" ? "MUNDO" : "LOCAL"}
          </button>
          <button className={`btn ${s.snap ? "on" : ""}`} aria-pressed={s.snap} onClick={() => s.set({ snap: !s.snap })} title="Encaixe a passos fixos">SNAP</button>
        </div>

        <div className="grp" role="group" aria-label="Histórico">
          <button className="btn" disabled={!h.canUndo} onClick={undo} title={h.undoLabel ? `Desfazer: ${h.undoLabel} (Ctrl+Z)` : "Nada a desfazer"}>DESFAZER</button>
          <button className="btn" disabled={!h.canRedo} onClick={redo} title={h.redoLabel ? `Refazer: ${h.redoLabel} (Ctrl+Shift+Z)` : "Nada a refazer"}>REFAZER</button>
        </div>

        <div className="grp zoom" role="group" aria-label="Zoom">
          <button className="btn sq" disabled={!ready} aria-label="Reduzir zoom" onClick={() => s.camera({ kind: "zoom", zoom: s.zoom / 2 })}>−</button>
          <input
            type="range" min={0} max={1000} disabled={!ready}
            onPointerUp={(e) => e.currentTarget.blur()}
            aria-label="Zoom" aria-valuetext={formatZoom(s.zoom)}
            value={Math.round(zoomToSlider(s.zoom, s.maxZoom) * 1000)}
            onChange={(e) => s.camera({ kind: "zoom", zoom: sliderToZoom(Number(e.target.value) / 1000, s.maxZoom) })}
          />
          <button className="btn sq" disabled={!ready} aria-label="Aumentar zoom" onClick={() => s.camera({ kind: "zoom", zoom: s.zoom * 2 })}>+</button>
          <button className="btn" disabled={!ready} onClick={() => s.camera({ kind: "zoom", zoom: 1 })} title="Voltar a 1×">
            <span className={`mono zoom-val ${s.beyondDetail ? "warn" : ""}`}>{formatZoom(s.zoom)}</span>
          </button>
        </div>
      </div>

      <div className="dock-row">
        <div className="grp" role="group" aria-label="Visões de câmera">
          {VIEWS.map((v) => (
            <button key={v.id} className="btn" disabled={!ready} onClick={() => cameraView(v.id)} title={`Visão ${v.label}${v.key ? ` (${v.key})` : ""}`}>
              {v.label}
            </button>
          ))}
          <button className="btn" disabled={!ready} onClick={() => s.camera({ kind: "frame-all" })} title="Enquadrar tudo (Home)">ENQUADRAR</button>
          <button className="btn" disabled={!s.selectedId} onClick={() => s.camera({ kind: "frame-selection" })} title="Enquadrar seleção (F)">FOCAR</button>
        </div>
        <div className="grp" role="group" aria-label="Modos de visualização">
          {MODES.map((m) => (
            <button key={m.id} className={`btn ${s.viewMode === m.id ? "on" : ""}`} aria-pressed={s.viewMode === m.id} disabled={!ready} onClick={() => setViewMode(m.id)} title={`Modo ${m.label} (${m.key})`}>
              {m.label}
            </button>
          ))}
        </div>

        <div className="grp" role="group" aria-label="Exploded view">
          <button className={`btn ${s.exploded > 0.01 ? "on" : ""}`} aria-pressed={s.exploded > 0.01} disabled={!ready || !explodable} onClick={toggleExplode} title={explodable ? "Exploded View (X)" : "O modelo carregado tem menos de 2 peças separadas"}>
            EXPLODED VIEW<kbd>X</kbd>
          </button>
          <input
            type="range" min={0} max={100} disabled={!ready || !explodable}
            onPointerUp={(e) => e.currentTarget.blur()}
            aria-label="Intensidade de desmontagem" aria-valuetext={`${Math.round(s.exploded * 100)}%`}
            value={Math.round(s.exploded * 100)}
            onChange={(e) => s.set({ exploded: Number(e.target.value) / 100 })}
          />
          <button className={`btn ${!s.explodePlaying ? "on" : ""}`} aria-pressed={!s.explodePlaying} disabled={!ready || !explodable} onClick={() => s.set({ explodePlaying: !s.explodePlaying })} title="Pausar ou retomar a animação (Espaço)">
            {s.explodePlaying ? "PAUSAR" : "RETOMAR"}
          </button>
        </div>
      </div>
      {s.beyondDetail && <div className="detail-warn" role="status">ZOOM ALÉM DA RESOLUÇÃO GEOMÉTRICA DO MODELO: AUMENTO DIGITAL, SEM DETALHE NOVO</div>}
    </footer>
  );
}
