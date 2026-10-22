"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Box3, MathUtils, PerspectiveCamera, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useWorkstation, type CameraView } from "@/store/workstation";
import { clipPlanes, distanceToZoom, exceedsGeometryDetail, zoomToDistance, ZOOM_MIN } from "@/lib/zoom";
import { damp } from "@/lib/explode";
import { registry } from "./registry";
import { pendingCamera, persistNow } from "./session";

const VIEW_DIR: Record<CameraView, Vector3> = {
  front: new Vector3(0, 0, 1),
  back: new Vector3(0, 0, -1),
  right: new Vector3(1, 0, 0),
  left: new Vector3(-1, 0, 0),
  top: new Vector3(0, 1, 0.0001),
  iso: new Vector3(0.7, 0.45, 0.9),
};

interface Goal {
  pos: Vector3;
  target: Vector3;
}

const KEY_PAN = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

export default function CameraRig() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const goal = useRef<Goal | null>(null);
  const keys = useRef(new Set<string>());
  const lastZoomPush = useRef(0);
  const lastCmd = useRef(0);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const invalidate = useThree((s) => s.invalidate);

  const autoRotate = useWorkstation((s) => s.autoRotate);
  const rotateSpeed = useWorkstation((s) => s.rotateSpeed);
  const damping = useWorkstation((s) => s.damping);
  const verticalLimit = useWorkstation((s) => s.verticalLimit);
  const refDistance = useWorkstation((s) => s.refDistance);
  const maxZoom = useWorkstation((s) => s.maxZoom);
  const loadState = useWorkstation((s) => s.loadState);

  const modelCenter = () => {
    const root = registry.root;
    if (!root) return new Vector3(0, 0, 0);
    return new Box3().setFromObject(root).getCenter(new Vector3());
  };

  const frameBox = (box: Box3, dirFrom: Vector3) => {
    const c = box.getCenter(new Vector3());
    const size = box.getSize(new Vector3());
    const r = Math.max(size.x, size.y, size.z) || 1;
    const d = (r / 2 / Math.tan(MathUtils.degToRad(camera.fov) / 2)) * 1.35;
    return { pos: c.clone().add(dirFrom.clone().normalize().multiplyScalar(d)), target: c };
  };

  // primeiro enquadramento ao carregar o modelo (ou restaura a pose salva)
  useEffect(() => {
    if (loadState !== "ready") return;
    const ctl = controlsRef.current;
    if (!ctl) return;
    const saved = pendingCamera.value;
    pendingCamera.value = null;
    if (saved) {
      camera.position.fromArray(saved.pos);
      ctl.target.fromArray(saved.target);
    } else {
      const g = frameBox(new Box3().setFromObject(registry.root!), VIEW_DIR.iso);
      camera.position.copy(g.pos);
      ctl.target.copy(g.target);
    }
    ctl.update();
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadState]);

  // cancela animação de câmera quando o usuário toma o controle
  useEffect(() => {
    const ctl = controlsRef.current;
    if (!ctl) return;
    const cancel = () => {
      goal.current = null;
    };
    const save = () => {
      persistNow({ pos: camera.position.toArray() as [number, number, number], target: ctl.target.toArray() as [number, number, number] });
    };
    ctl.addEventListener("start", cancel);
    ctl.addEventListener("end", save);
    return () => {
      ctl.removeEventListener("start", cancel);
      ctl.removeEventListener("end", save);
    };
  }, [camera]);

  // teclado: pan com setas
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (KEY_PAN.has(e.key)) {
        keys.current.add(e.key);
        goal.current = null;
        invalidate();
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key);
    const blur = () => keys.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [invalidate]);

  // comandos de câmera vindos da interface
  const cmd = useWorkstation((s) => s.cameraCmd);
  useEffect(() => {
    const ctl = controlsRef.current;
    if (!ctl || cmd.seq === lastCmd.current) return;
    lastCmd.current = cmd.seq;
    const st = useWorkstation.getState();
    const dir = camera.position.clone().sub(ctl.target).normalize();
    if (cmd.kind === "frame-all" && registry.root) {
      goal.current = frameBox(new Box3().setFromObject(registry.root), dir);
    } else if (cmd.kind === "frame-selection") {
      const rec = registry.get(st.selectedId);
      if (rec) goal.current = frameBox(new Box3().setFromObject(rec.object), dir);
    } else if (cmd.kind === "view" && cmd.view) {
      const c = modelCenter();
      const dist = Math.max(camera.position.distanceTo(ctl.target), st.refDistance / st.maxZoom);
      goal.current = { pos: c.clone().add(VIEW_DIR[cmd.view].clone().normalize().multiplyScalar(dist)), target: c };
    } else if (cmd.kind === "zoom" && cmd.zoom) {
      const d = zoomToDistance(cmd.zoom, st.refDistance, st.maxZoom);
      goal.current = { pos: ctl.target.clone().add(dir.multiplyScalar(d)), target: ctl.target.clone() };
    }
    invalidate();
  }, [cmd, camera, invalidate]);

  const tmpDir = useRef(new Vector3());
  useFrame((state, dt) => {
    const ctl = controlsRef.current;
    if (!ctl) return;
    const st = useWorkstation.getState();
    const step = Math.min(dt, 0.1);

    if (goal.current) {
      const g = goal.current;
      const k = 1 - Math.exp(-8 * step);
      camera.position.lerp(g.pos, k);
      ctl.target.lerp(g.target, k);
      if (camera.position.distanceToSquared(g.pos) < 1e-10 && ctl.target.distanceToSquared(g.target) < 1e-10) {
        goal.current = null;
      }
      invalidate();
    }

    if (keys.current.size > 0) {
      const dist = camera.position.distanceTo(ctl.target);
      const speed = dist * 0.9 * step;
      camera.updateMatrixWorld();
      const right = tmpDir.current.setFromMatrixColumn(camera.matrix, 0);
      const up = new Vector3().setFromMatrixColumn(camera.matrix, 1);
      const move = new Vector3();
      if (keys.current.has("ArrowLeft")) move.addScaledVector(right, -speed);
      if (keys.current.has("ArrowRight")) move.addScaledVector(right, speed);
      if (keys.current.has("ArrowUp")) move.addScaledVector(up, speed);
      if (keys.current.has("ArrowDown")) move.addScaledVector(up, -speed);
      camera.position.add(move);
      ctl.target.add(move);
      invalidate();
    }

    const distance = camera.position.distanceTo(ctl.target);
    const ref = st.refDistance;
    ctl.minDistance = ref / st.maxZoom;
    ctl.maxDistance = ref / ZOOM_MIN;

    const { near, far } = clipPlanes(distance, ref, st.nearFactor);
    if (Math.abs(camera.near - near) > near * 0.01 || Math.abs(camera.far - far) > far * 0.01) {
      camera.near = near;
      camera.far = far;
      camera.updateProjectionMatrix();
    }

    const now = state.clock.elapsedTime;
    if (now - lastZoomPush.current > 0.1) {
      lastZoomPush.current = now;
      const zoom = distanceToZoom(distance, ref);
      const beyond = exceedsGeometryDetail(distance, camera.fov, st.model?.medianEdge ?? 0, zoom);
      if (Math.abs(zoom - st.zoom) > st.zoom * 0.004 || beyond !== st.beyondDetail) {
        useWorkstation.setState({ zoom, beyondDetail: beyond });
      }
    }
    // amortecimento/inércia suave no auto-rotate
    void damp;
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={damping}
      rotateSpeed={0.8}
      zoomSpeed={2.4}
      zoomToCursor
      screenSpacePanning
      autoRotate={autoRotate}
      autoRotateSpeed={2 * rotateSpeed}
      minPolarAngle={verticalLimit ? 0.05 : 0}
      maxPolarAngle={verticalLimit ? Math.PI - 0.05 : Math.PI}
      minDistance={refDistance / maxZoom}
      maxDistance={refDistance / ZOOM_MIN}
    />
  );
}
