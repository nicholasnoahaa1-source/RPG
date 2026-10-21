"use client";

import { useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useWorkstation, type Quality } from "@/store/workstation";
import { openFile } from "@/three/loader";

export function EmptyState() {
  const loadState = useWorkstation((s) => s.loadState);
  const error = useWorkstation((s) => s.loadError);
  const progress = useWorkstation((s) => s.loadProgress);
  const source = useWorkstation((s) => s.source);
  const input = useRef<HTMLInputElement>(null);
  const visible = loadState !== "ready";

  return (
    <AnimatePresence>
      {visible && (
        <motion.section className="empty-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} aria-live="polite">
          {loadState === "loading" ? (
            <>
              <div className="es-k">CARREGANDO</div>
              <div className="es-title">{source?.name}</div>
              <div className="bar"><i style={{ width: `${Math.max(4, progress * 100)}%` }} /></div>
            </>
          ) : (
            <>
              <div className="es-k">{loadState === "error" ? "ERRO" : "SEM MODELO"}</div>
              <div className="es-title">{loadState === "error" ? "O arquivo não pôde ser aberto" : "Nenhum modelo 3D carregado"}</div>
              <p className="es-text">
                {error ??
                  "Abra um arquivo GLB ou glTF autocontido, ou arraste-o para esta janela. Se existir public/models/armor.glb ele é carregado sozinho. Nenhum modelo substituto é criado."}
              </p>
              <button className="btn solid" onClick={() => input.current?.click()}>ABRIR GLB / GLTF</button>
              <input ref={input} type="file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) openFile(f); e.target.value = ""; }} />
            </>
          )}
        </motion.section>
      )}
    </AnimatePresence>
  );
}

const QUALITIES: Quality[] = ["low", "medium", "high", "ultra"];
const QDESC: Record<Quality, string> = {
  low: "Sem pós-processamento, sem sombras, quadro sob demanda",
  medium: "Bloom leve, sombras, pixel ratio até 1.5",
  high: "Bloom, contornos, MSAA 4×, pixel ratio até 2",
  ultra: "MSAA 8×, mais partículas, pixel ratio até 2.5",
};

export function SettingsDialog() {
  const s = useWorkstation();
  return (
    <AnimatePresence>
      {s.settingsOpen && (
        <motion.div className="modal-back" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => s.set({ settingsOpen: false })}>
          <motion.div role="dialog" aria-modal="true" aria-label="Configurações" className="modal" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 12, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
            <div className="panel-h"><span>CONFIGURAÇÕES</span><button className="mini" onClick={() => s.set({ settingsOpen: false })}>FECHAR (ESC)</button></div>
            <div className="modal-body">
              <h3>QUALIDADE GRÁFICA</h3>
              <div className="btn-row">
                {QUALITIES.map((q) => (
                  <button key={q} className={`btn ${s.quality === q ? "on" : ""}`} aria-pressed={s.quality === q} onClick={() => s.set({ quality: q, qualityAuto: false })}>{q.toUpperCase()}</button>
                ))}
                <button className={`btn ${s.qualityAuto ? "on" : ""}`} aria-pressed={s.qualityAuto} onClick={() => s.set({ qualityAuto: !s.qualityAuto })}>AUTO</button>
              </div>
              <p className="hint">{QDESC[s.quality]}. Auto reduz a qualidade quando o FPS cai.</p>

              <h3>CÂMERA</h3>
              <label className="row"><span>Velocidade do auto-giro</span><input type="range" min={0.2} max={5} step={0.1} value={s.rotateSpeed} onChange={(e) => s.set({ rotateSpeed: Number(e.target.value) })} /><span className="mono">{s.rotateSpeed.toFixed(1)}</span></label>
              <label className="row"><span>Inércia</span><input type="range" min={0.01} max={0.3} step={0.01} value={0.31 - s.damping} onChange={(e) => s.set({ damping: 0.31 - Number(e.target.value) })} /><span className="mono">{Math.round(((0.31 - s.damping) / 0.3) * 100)}%</span></label>
              <label className="row"><span>Zoom máximo</span><input type="range" min={10} max={2000} step={10} value={s.maxZoom} onChange={(e) => s.set({ maxZoom: Number(e.target.value) })} /><span className="mono">{s.maxZoom}×</span></label>
              <label className="row"><span>Plano de corte próximo</span><input type="range" min={0.001} max={0.3} step={0.001} value={s.nearFactor} onChange={(e) => s.set({ nearFactor: Number(e.target.value) })} /><span className="mono">{(s.nearFactor * 100).toFixed(1)}%</span></label>
              <label className="row check"><input type="checkbox" checked={s.verticalLimit} onChange={(e) => s.set({ verticalLimit: e.target.checked })} /><span>Limitar rotação vertical (evita virar de cabeça para baixo)</span></label>
              <p className="hint">Rotação horizontal é sempre ilimitada. O plano de corte próximo é proporcional à distância da câmera.</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const KEYS: [string, string][] = [
  ["Q W E R", "Navegar, mover, girar, escalar"],
  ["1 a 5", "Visões frontal, traseira, direita, esquerda, topo"],
  ["Shift + 1 a 5", "Modos: standard, holo, wire, x-ray, engenharia"],
  ["F / Home", "Enquadrar seleção / tudo"],
  ["Duplo clique", "Selecionar e enquadrar a peça"],
  ["Setas", "Mover a câmera lateralmente"],
  ["H  L  I", "Ocultar, travar, isolar a seleção"],
  ["X / Espaço", "Exploded view / pausar animação"],
  ["G  A", "Grade / auto-giro"],
  ["Ctrl+Z / Ctrl+Shift+Z", "Desfazer / refazer"],
  ["Esc", "Sair do isolamento, limpar seleção"],
];

export function ShortcutsDialog() {
  const open = useWorkstation((s) => s.shortcutsOpen);
  const set = useWorkstation((s) => s.set);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="modal-back" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => set({ shortcutsOpen: false })}>
          <motion.div role="dialog" aria-modal="true" aria-label="Atalhos" className="modal" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 12, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
            <div className="panel-h"><span>ATALHOS</span><button className="mini" onClick={() => set({ shortcutsOpen: false })}>FECHAR (ESC)</button></div>
            <dl className="kv keys">
              {KEYS.map(([k, d]) => (<div key={k} className="kv-row"><dt className="mono">{k}</dt><dd>{d}</dd></div>))}
            </dl>
            <p className="hint" style={{ padding: "0 16px 16px" }}>Mouse: esquerdo gira, direito ou Shift move, roda aproxima no ponto do cursor. Toque: um dedo gira, dois dedos movem e aproximam.</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ContextLostOverlay() {
  const lost = useWorkstation((s) => s.contextLost);
  if (!lost) return null;
  return (
    <div className="empty-state" role="alert">
      <div className="es-k">ERRO</div>
      <div className="es-title">Contexto WebGL perdido</div>
      <p className="es-text">A GPU interrompeu o contexto gráfico. A cena é restaurada automaticamente quando o navegador permitir.</p>
    </div>
  );
}
