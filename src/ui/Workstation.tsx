"use client";

import { useEffect } from "react";
import { AnimatePresence } from "motion/react";
import Scene from "@/three/Scene";
import { openFile, openUrl } from "@/three/loader";
import { registry } from "@/three/registry";
import { useWorkstation } from "@/store/workstation";
import TopBar from "./TopBar";
import LeftPanel from "./LeftPanel";
import RightPanel from "./RightPanel";
import BottomBar from "./BottomBar";
import Hotkeys from "./Hotkeys";
import Boot from "./Boot";
import { ContextLostOverlay, EmptyState, SettingsDialog, ShortcutsDialog } from "./Overlays";

if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_WS_DEBUG) {
  (window as unknown as Record<string, unknown>).__ws = { store: useWorkstation, registry };
}

const DEFAULT_MODEL = "/models/armor.glb";

export default function Workstation() {
  const leftOpen = useWorkstation((s) => s.leftOpen);
  const rightOpen = useWorkstation((s) => s.rightOpen);
  const boot = useWorkstation((s) => s.boot);
  const bootStep = useWorkstation((s) => s.bootStep);
  const hudReady = boot === "done" || bootStep >= 4;

  // histórico do motor -> estado da interface
  useEffect(() => {
    const sync = () => {
      const h = registry.history;
      useWorkstation.setState({ history: { canUndo: h.canUndo, canRedo: h.canRedo, undoLabel: h.undoLabel, redoLabel: h.redoLabel } });
    };
    return registry.history.subscribe(sync);
  }, []);

  // painéis recolhidos por padrão em telas estreitas
  useEffect(() => {
    if (window.matchMedia("(max-width: 900px)").matches) useWorkstation.setState({ leftOpen: false, rightOpen: false });
  }, []);

  // modelo padrão, se existir no projeto
  useEffect(() => {
    let cancelled = false;
    fetch(DEFAULT_MODEL, { method: "HEAD" })
      .then((r) => {
        const type = r.headers.get("content-type") ?? "";
        if (!cancelled && r.ok && !type.includes("text/html")) openUrl(DEFAULT_MODEL, "armor.glb");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // arrastar e soltar
  useEffect(() => {
    const over = (e: DragEvent) => e.preventDefault();
    const drop = (e: DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer?.files?.[0];
      if (f) openFile(f);
    };
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, []);

  return (
    <main className="ws">
      <Scene />
      <Hotkeys />
      <EmptyState />
      <ContextLostOverlay />
      {hudReady && (
        <>
          <TopBar />
          <AnimatePresence>{leftOpen && <LeftPanel key="l" />}</AnimatePresence>
          <AnimatePresence>{rightOpen && <RightPanel key="r" />}</AnimatePresence>
          <BottomBar />
        </>
      )}
      <SettingsDialog />
      <ShortcutsDialog />
      <Boot />
    </main>
  );
}
