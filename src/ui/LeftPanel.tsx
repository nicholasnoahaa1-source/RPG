"use client";

import { memo, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useWorkstation, type PartNode } from "@/store/workstation";
import { toggleHidden, toggleIsolate, toggleLocked } from "@/three/actions";

function matches(node: PartNode, q: string): boolean {
  if (node.name.toLowerCase().includes(q)) return true;
  return node.children.some((c) => matches(c, q));
}

const Row = memo(function Row({ node, depth, q, open, toggleOpen }: {
  node: PartNode; depth: number; q: string; open: Record<string, boolean>; toggleOpen: (id: string) => void;
}) {
  const selected = useWorkstation((s) => s.selectedId === node.id);
  const hovered = useWorkstation((s) => s.hoveredId === node.id);
  const hidden = useWorkstation((s) => !!s.hidden[node.id]);
  const locked = useWorkstation((s) => !!s.locked[node.id]);
  const isolated = useWorkstation((s) => s.isolatedId === node.id);
  const select = useWorkstation((s) => s.select);

  if (q && !matches(node, q)) return null;
  const hasKids = node.children.length > 0;
  const expanded = q ? true : (open[node.id] ?? depth < 2);

  return (
    <li role="treeitem" aria-expanded={hasKids ? expanded : undefined} aria-selected={selected}>
      <div
        className={`tree-row ${selected ? "sel" : ""} ${hovered ? "hov" : ""} ${hidden ? "dim" : ""}`}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        <button
          className="tree-caret"
          tabIndex={hasKids ? 0 : -1}
          aria-label={expanded ? "Recolher" : "Expandir"}
          onClick={() => hasKids && toggleOpen(node.id)}
          style={{ visibility: hasKids ? "visible" : "hidden" }}
        >
          {expanded ? "−" : "+"}
        </button>
        <button className="tree-name" onClick={() => select(node.id)} title={node.name}>
          <span className={`tree-kind ${node.kind}`} aria-hidden="true" />
          {node.name}
        </button>
        <span className="tree-ctl">
          <button className={`mini ${isolated ? "on" : ""}`} onClick={() => toggleIsolate(node.id)} aria-pressed={isolated} title="Isolar (I)">ISO</button>
          <button className={`mini ${locked ? "on" : ""}`} onClick={() => toggleLocked(node.id)} aria-pressed={locked} title="Travar (L)">LCK</button>
          <button className={`mini ${hidden ? "on" : ""}`} onClick={() => toggleHidden(node.id)} aria-pressed={hidden} title="Ocultar (H)">{hidden ? "OFF" : "VIS"}</button>
        </span>
      </div>
      {hasKids && expanded && (
        <ul role="group">
          {node.children.map((c) => (
            <Row key={c.id} node={c} depth={depth + 1} q={q} open={open} toggleOpen={toggleOpen} />
          ))}
        </ul>
      )}
    </li>
  );
});

export default function LeftPanel() {
  const tree = useWorkstation((s) => s.tree);
  const isolatedId = useWorkstation((s) => s.isolatedId);
  const model = useWorkstation((s) => s.model);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const reduce = useReducedMotion();
  const q = query.trim().toLowerCase();
  const toggleOpen = useMemo(() => (id: string) => setOpen((o) => ({ ...o, [id]: !(o[id] ?? true) })), []);

  return (
    <motion.aside
      className="panel panel-left"
      aria-label="Componentes"
      initial={reduce ? false : { x: -24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={reduce ? undefined : { x: -24, opacity: 0 }}
      transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <div className="panel-h">
        <span>COMPONENTES</span>
        <span className="mono dimtxt">{model ? `${model.meshes} MALHAS` : "0"}</span>
      </div>
      <div className="panel-search">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="BUSCAR PEÇA"
          aria-label="Buscar peça"
          disabled={!tree}
        />
      </div>
      <AnimatePresence>
        {isolatedId && (
          <motion.div className="notice" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <span>ISOLAMENTO ATIVO</span>
            <button className="mini on" onClick={() => toggleIsolate(null)}>SAIR (ESC)</button>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="panel-body">
        {tree ? (
          <ul role="tree" className="tree">
            <Row node={tree} depth={0} q={q} open={open} toggleOpen={toggleOpen} />
          </ul>
        ) : (
          <p className="empty">Nenhum modelo carregado. A árvore reflete a hierarquia real do arquivo GLB.</p>
        )}
      </div>
    </motion.aside>
  );
}
