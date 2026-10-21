"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Box3, Euler, Mesh, Vector3 } from "three";
import { useWorkstation } from "@/store/workstation";
import { registry } from "@/three/registry";
import { resetPart, setPartTransform, toggleHidden, toggleIsolate, toggleLocked } from "@/three/actions";

type V3 = [number, number, number];
const AXES = ["X", "Y", "Z"] as const;
const fmt = (n: number) => (Math.abs(n) < 1e-9 ? "0" : Number(n.toPrecision(6)).toString());

function Vec({ label, value, onCommit, disabled, step }: { label: string; value: V3; onCommit: (v: V3) => void; disabled: boolean; step: number }) {
  const [draft, setDraft] = useState<string[] | null>(null);
  const shown = draft ?? value.map(fmt);
  const commit = () => {
    if (!draft) return;
    const parsed = draft.map((d, i) => {
      const n = parseFloat(d.replace(",", "."));
      return Number.isFinite(n) ? n : value[i]!;
    }) as V3;
    setDraft(null);
    if (parsed.some((n, i) => n !== value[i])) onCommit(parsed);
  };
  return (
    <div className="vec">
      <span className="vec-l">{label}</span>
      {AXES.map((ax, i) => (
        <label key={ax} className="vec-f">
          <span className={`ax ax-${ax.toLowerCase()}`}>{ax}</span>
          <input
            className="mono"
            inputMode="decimal"
            value={shown[i]}
            disabled={disabled}
            step={step}
            aria-label={`${label} ${ax}`}
            onChange={(e) => setDraft(shown.map((s, j) => (j === i ? e.target.value : s)))}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setDraft(null);
            }}
          />
        </label>
      ))}
    </div>
  );
}

export default function RightPanel() {
  const selectedId = useWorkstation((s) => s.selectedId);
  const model = useWorkstation((s) => s.model);
  const tick = useWorkstation((s) => s.transformTick);
  const locked = useWorkstation((s) => (s.selectedId ? !!s.locked[s.selectedId] : false));
  const hidden = useWorkstation((s) => (s.selectedId ? !!s.hidden[s.selectedId] : false));
  const isolated = useWorkstation((s) => s.isolatedId === s.selectedId && s.selectedId !== null);
  const reduce = useReducedMotion();

  const [, force] = useState(0);
  useEffect(() => registry.history.subscribe(() => force((n) => n + 1)), []);

  const rec = registry.get(selectedId);
  const info = useMemo(() => {
    if (!rec) return null;
    const o = rec.object;
    const box = new Box3().setFromObject(o);
    const size = box.getSize(new Vector3());
    const mesh = o as Mesh;
    let vertices = 0;
    let triangles = 0;
    let material = "";
    let matType = "";
    let color = "";
    if (mesh.isMesh) {
      const pos = mesh.geometry.getAttribute("position");
      vertices = pos?.count ?? 0;
      triangles = (mesh.geometry.getIndex()?.count ?? vertices) / 3;
      const m = Array.isArray(rec.originalMaterial ?? mesh.material) ? (rec.originalMaterial ?? mesh.material) : [rec.originalMaterial ?? mesh.material];
      const first = (m as unknown as { name?: string; type: string; color?: { getHexString(): string } }[])[0];
      material = first?.name || "(sem nome)";
      matType = first?.type ?? "";
      color = first?.color ? `#${first.color.getHexString()}` : "";
    }
    const extras = Object.keys(o.userData ?? {});
    return { size: size.toArray() as V3, vertices, triangles, material, matType, color, extras, parent: o.parent?.name || "(raiz)", children: o.children.length, isMesh: !!mesh.isMesh };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec, tick]);

  const euler = rec ? new Euler().setFromQuaternion(rec.baseQuat, "XYZ") : null;
  const rotDeg: V3 = euler ? [(euler.x * 180) / Math.PI, (euler.y * 180) / Math.PI, (euler.z * 180) / Math.PI] : [0, 0, 0];

  return (
    <motion.aside
      className="panel panel-right"
      aria-label="Propriedades"
      initial={reduce ? false : { x: 24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={reduce ? undefined : { x: 24, opacity: 0 }}
      transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <div className="panel-h">
        <span>PROPRIEDADES</span>
        {rec && <span className="mono dimtxt">{rec.id.slice(0, 8)}</span>}
      </div>
      <div className="panel-body">
        {!rec || !info ? (
          <div className="empty">
            {model ? (
              <>
                <p>Nenhuma peça selecionada.</p>
                <dl className="kv">
                  <dt>Peças</dt><dd className="mono">{model.parts}</dd>
                  <dt>Malhas</dt><dd className="mono">{model.meshes}</dd>
                  <dt>Vértices</dt><dd className="mono">{model.vertices.toLocaleString("pt-BR")}</dd>
                  <dt>Triângulos</dt><dd className="mono">{Math.round(model.triangles).toLocaleString("pt-BR")}</dd>
                  <dt>Dimensões</dt><dd className="mono">{model.size.map((n) => n.toFixed(3)).join(" × ")}</dd>
                </dl>
              </>
            ) : (
              <p>Carregue um modelo para ver as propriedades reais das peças.</p>
            )}
          </div>
        ) : (
          <>
            <h2 className="part-name">{rec.object.name || "(sem nome)"}</h2>
            <div className="part-tag">{info.isMesh ? "MALHA" : "GRUPO"}{locked ? " · TRAVADA" : ""}{hidden ? " · OCULTA" : ""}</div>

            <section>
              <h3>TRANSFORMAÇÃO LOCAL</h3>
              <Vec label="POS" value={rec.basePos.toArray() as V3} disabled={locked} step={0.01} onCommit={(v) => setPartTransform(rec.id, { position: v })} />
              <Vec label="ROT °" value={rotDeg} disabled={locked} step={1} onCommit={(v) => setPartTransform(rec.id, { rotationDeg: v })} />
              <Vec label="ESC" value={rec.baseScale.toArray() as V3} disabled={locked} step={0.01} onCommit={(v) => setPartTransform(rec.id, { scale: v })} />
            </section>

            <section>
              <h3>GEOMETRIA</h3>
              <dl className="kv">
                <dt>Dimensões</dt><dd className="mono">{info.size.map((n) => n.toFixed(4)).join(" × ")}</dd>
                {info.isMesh && (<><dt>Vértices</dt><dd className="mono">{info.vertices.toLocaleString("pt-BR")}</dd><dt>Triângulos</dt><dd className="mono">{Math.round(info.triangles).toLocaleString("pt-BR")}</dd></>)}
                <dt>Pai</dt><dd>{info.parent}</dd>
                <dt>Filhos</dt><dd className="mono">{info.children}</dd>
              </dl>
            </section>

            {info.isMesh && (
              <section>
                <h3>MATERIAL</h3>
                <dl className="kv">
                  <dt>Nome</dt><dd>{info.material}</dd>
                  <dt>Tipo</dt><dd className="mono">{info.matType}</dd>
                  {info.color && (<><dt>Cor base</dt><dd className="mono"><i className="swatch" style={{ background: info.color }} />{info.color}</dd></>)}
                </dl>
              </section>
            )}

            {info.extras.length > 0 && (
              <section>
                <h3>DADOS DO ARQUIVO (extras)</h3>
                <dl className="kv">
                  {info.extras.slice(0, 12).map((k) => (
                    <div key={k} className="kv-row"><dt>{k}</dt><dd className="mono">{String(JSON.stringify(rec.object.userData[k])).slice(0, 60)}</dd></div>
                  ))}
                </dl>
              </section>
            )}

            <section>
              <h3>AÇÕES</h3>
              <div className="btn-row">
                <button className="btn" onClick={() => useWorkstation.getState().camera({ kind: "frame-selection" })}>ENQUADRAR (F)</button>
                <button className={`btn ${isolated ? "on" : ""}`} onClick={() => toggleIsolate(rec.id)}>ISOLAR (I)</button>
                <button className={`btn ${hidden ? "on" : ""}`} onClick={() => toggleHidden(rec.id)}>OCULTAR (H)</button>
                <button className={`btn ${locked ? "on" : ""}`} onClick={() => toggleLocked(rec.id)}>TRAVAR (L)</button>
                <button className="btn" disabled={locked} onClick={() => resetPart(rec.id)}>RESET PEÇA</button>
              </div>
            </section>
          </>
        )}
      </div>
    </motion.aside>
  );
}
