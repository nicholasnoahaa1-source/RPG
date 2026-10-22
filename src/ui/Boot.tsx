"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useWorkstation } from "@/store/workstation";
import { setViewMode, userTouchedMode } from "@/three/actions";

const STEPS = [
  { at: 250, text: "NÚCLEO GRÁFICO WEBGL", state: "ONLINE" },
  { at: 650, text: "GRADE HOLOGRÁFICA", state: "ATIVA" },
  { at: 1050, text: "MODELO", state: "" },
  { at: 1450, text: "HUD", state: "ONLINE" },
  { at: 1850, text: "CONTROLES", state: "LIBERADOS" },
];

/** Sequência de inicialização. Qualquer tecla, clique ou toque encerra a sequência. */
export default function Boot() {
  const boot = useWorkstation((s) => s.boot);
  const step = useWorkstation((s) => s.bootStep);
  const loadState = useWorkstation((s) => s.loadState);
  const set = useWorkstation((s) => s.set);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduced(rm);
    if (rm) {
      set({ boot: "done", bootStep: STEPS.length });
      return;
    }
    set({ boot: "running", bootStep: 0 });
    userTouchedMode.value = false;
    setViewMode("holographic", false);
    const timers = STEPS.map((s, i) => window.setTimeout(() => useWorkstation.getState().set({ bootStep: i + 1 }), s.at));
    timers.push(window.setTimeout(() => finish(), 2300));
    const finish = () => {
      timers.forEach(clearTimeout);
      const cur = useWorkstation.getState();
      cur.set({ boot: "done", bootStep: STEPS.length, status: cur.model ? "MODELO PRONTO" : cur.status });
      if (!userTouchedMode.value && cur.viewMode === "holographic") setViewMode("standard", false);
    };
    const skip = () => finish();
    window.addEventListener("keydown", skip, { once: true });
    window.addEventListener("pointerdown", skip, { once: true });
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const modelState = loadState === "ready" ? "CARREGADO" : loadState === "loading" ? "CARREGANDO" : loadState === "error" ? "ERRO" : "AUSENTE";
  return (
    <AnimatePresence>
      {boot === "running" && !reduced && (
        <motion.div className="boot" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} aria-hidden="true">
          <motion.div className="boot-line" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1.6, ease: "easeInOut" }} />
          <ol className="boot-log mono">
            {STEPS.map((s, i) =>
              step > i ? (
                <motion.li key={s.text} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
                  <span>{s.text}</span>
                  <span className="boot-dots" />
                  <b>{s.text === "MODELO" ? modelState : s.state}</b>
                </motion.li>
              ) : null,
            )}
          </ol>
          <div className="boot-skip mono">QUALQUER TECLA PARA PULAR</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
