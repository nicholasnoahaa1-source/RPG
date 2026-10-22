"use client";

import { useMemo, useState } from "react";
import type { Mesh } from "three";
import { useWorkstation } from "@/store/workstation";
import { registry } from "@/three/registry";
import { BOOL_LABEL, isEditableMesh, runBoolean, type BoolOp } from "@/three/editing";
import { vertexBridge, MAX_EDIT_VERTICES } from "@/three/VertexEditor";
import { closedInfo, weldPositions } from "@/lib/mesh";

export function VertexPanel() {
  const sel = useWorkstation((s) => s.vertexSel);
  const total = useWorkstation((s) => s.vertexTotal);
  return (
    <section>
      <h3>EDIÇÃO DE VÉRTICES</h3>
      <dl className="kv">
        <dt>Selecionados</dt><dd className="mono">{sel} / {total.toLocaleString("pt-BR")}</dd>
      </dl>
      <div className="btn-row" style={{ marginTop: 8 }}>
        <button className="btn" disabled={total === 0} onClick={() => vertexBridge.selectAll()}>SELECIONAR TUDO</button>
        <button className="btn" disabled={sel === 0} onClick={() => vertexBridge.clear()}>LIMPAR</button>
      </div>
      <p className="hint" style={{ marginTop: 8 }}>
        Clique em um ponto para selecionar, Shift soma ou remove. Arraste o gizmo para mover. Vértices na mesma posição se movem juntos.
        Limite de {MAX_EDIT_VERTICES.toLocaleString("pt-BR")} vértices únicos por malha. As edições entram no desfazer, mas não são salvas na sessão.
      </p>
    </section>
  );
}

type Closed = "closed" | "open" | "unknown";

function closedState(mesh: Mesh): Closed {
  const g = mesh.geometry;
  const pos = g.getAttribute("position");
  if (!pos || pos.count > 300000) return "unknown";
  const w = weldPositions(pos.array, pos.count);
  return closedInfo(g.getIndex()?.array ?? null, pos.count, w).closed ? "closed" : "open";
}

const CLOSED_TXT: Record<Closed, string> = { closed: "fechada", open: "ABERTA", unknown: "não verificada" };

export function BooleanPanel({ aId }: { aId: string }) {
  const tree = useWorkstation((s) => s.tree);
  const tick = useWorkstation((s) => s.transformTick);
  const [bId, setB] = useState("");
  const [op, setOp] = useState<BoolOp>("subtract");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const a = registry.get(aId);
  const candidates = useMemo(() => {
    void tree;
    return [...registry.parts.values()].filter((r) => r.id !== aId && (r.object as Mesh).isMesh && r.object.parent && r.object.visible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, aId]);
  const b = registry.get(bId);
  const bValid = !!b && candidates.some((c) => c.id === bId);

  const ca = useMemo(() => (a && isEditableMesh(a) ? closedState(a.object as Mesh) : "unknown"), [a, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const cb = useMemo(() => (bValid && b && isEditableMesh(b) ? closedState(b.object as Mesh) : "unknown"), [b, bValid, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!a || !isEditableMesh(a)) return null;
  const anyOpen = ca === "open" || (bValid && cb === "open");

  const apply = () => {
    setMsg(null);
    const r = runBoolean(aId, bId, op);
    if (r.ok) {
      setMsg({ ok: true, text: `${BOOL_LABEL[op]} aplicada: ${Math.round(r.triangles).toLocaleString("pt-BR")} triângulos. As peças originais foram substituídas (desfazer restaura).` });
      useWorkstation.getState().say(`${BOOL_LABEL[op]} APLICADA`);
      setB("");
    } else {
      setMsg({ ok: false, text: r.error });
    }
  };

  return (
    <section>
      <h3>BOOLEANA</h3>
      <label className="bool-row">
        <span className="vec-l">B</span>
        <select value={bValid ? bId : ""} onChange={(e) => { setB(e.target.value); setMsg(null); }} aria-label="Segunda peça da operação booleana">
          <option value="">Escolher peça B</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>{c.object.name || c.id.slice(0, 8)}</option>
          ))}
        </select>
      </label>
      <div className="btn-row" style={{ margin: "8px 0" }}>
        {(Object.keys(BOOL_LABEL) as BoolOp[]).map((o) => (
          <button key={o} className={`btn ${op === o ? "on" : ""}`} aria-pressed={op === o} onClick={() => setOp(o)}>
            {o === "subtract" ? "A − B" : BOOL_LABEL[o]}
          </button>
        ))}
      </div>
      <dl className="kv">
        <dt>Malha A</dt><dd className={ca === "open" ? "warn" : ""}>{CLOSED_TXT[ca]}</dd>
        {bValid && (<><dt>Malha B</dt><dd className={cb === "open" ? "warn" : ""}>{CLOSED_TXT[cb]}</dd></>)}
      </dl>
      {anyOpen && <p className="hint warn">Malha aberta: o resultado pode ter falhas ou faces faltando.</p>}
      <button className="btn solid" style={{ marginTop: 8 }} disabled={!bValid} onClick={apply}>APLICAR {BOOL_LABEL[op]}</button>
      {msg && <p className={`hint ${msg.ok ? "" : "warn"}`} role="status" style={{ marginTop: 8 }}>{msg.text}</p>}
      <p className="hint" style={{ marginTop: 8 }}>O resultado fica em espaço do mundo, com os materiais de A e B. A operação roda na hora e pode travar a tela em malhas muito densas.</p>
    </section>
  );
}
