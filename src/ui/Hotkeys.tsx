"use client";

import { useEffect } from "react";
import { useWorkstation, type CameraView, type ViewMode } from "@/store/workstation";
import { cameraView, redo, setInteraction, setViewMode, toggleExplode, toggleHidden, toggleIsolate, toggleLocked, undo } from "@/three/actions";

const VIEWS: CameraView[] = ["front", "back", "right", "left", "top"];
const MODES: ViewMode[] = ["standard", "holographic", "wireframe", "xray", "engineering"];

/** Campos de texto bloqueiam atalhos; sliders e checkboxes não. */
function isTyping(t: HTMLElement | null): boolean {
  if (!t) return false;
  if (t.isContentEditable || t.tagName === "TEXTAREA" || t.tagName === "SELECT") return true;
  if (t.tagName === "INPUT") return !["range", "checkbox", "button"].includes((t as HTMLInputElement).type);
  return false;
}

export default function Hotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (isTyping(t)) return;
      if (t && (t as HTMLInputElement).type === "range" && ["home", "end", "pageup", "pagedown"].includes(e.key.toLowerCase())) return;
      const st = useWorkstation.getState();
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();

      if (mod && k === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
        return;
      }
      if (mod && k === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (mod || e.altKey) return;

      const digit = /^Digit([1-5])$/.exec(e.code);
      if (digit) {
        const i = Number(digit[1]) - 1;
        if (e.shiftKey) setViewMode(MODES[i]!);
        else cameraView(VIEWS[i]!);
        return;
      }
      switch (k) {
        case "q": setInteraction("navigate"); break;
        case "w": setInteraction("translate"); break;
        case "e": setInteraction("rotate"); break;
        case "r": setInteraction("scale"); break;
        case "t": setInteraction("vertex"); break;
        case "f": st.camera({ kind: st.selectedId ? "frame-selection" : "frame-all" }); break;
        case "home": st.camera({ kind: "frame-all" }); break;
        case "h": if (st.selectedId) toggleHidden(st.selectedId); break;
        case "l": if (st.selectedId) toggleLocked(st.selectedId); break;
        case "i": toggleIsolate(st.selectedId); break;
        case "x": toggleExplode(); break;
        case "g": st.set({ showGrid: !st.showGrid }); break;
        case "a": st.set({ autoRotate: !st.autoRotate }); break;
        case " ": e.preventDefault(); st.set({ explodePlaying: !st.explodePlaying }); break;
        case "?": st.set({ shortcutsOpen: !st.shortcutsOpen }); break;
        case "escape":
          if (st.shortcutsOpen || st.settingsOpen) st.set({ shortcutsOpen: false, settingsOpen: false });
          else if (st.isolatedId) st.isolate(null);
          else st.select(null);
          break;
        default: return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return null;
}
