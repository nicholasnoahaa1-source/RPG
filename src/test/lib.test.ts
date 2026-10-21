import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { History } from "@/lib/history";
import { clipPlanes, clampZoom, distanceToZoom, exceedsGeometryDetail, sliderToZoom, zoomToDistance, zoomToSlider, ZOOM_MAX } from "@/lib/zoom";
import { damp, explodeOffset, explodeVector } from "@/lib/explode";

describe("zoom", () => {
  it("converte distância e zoom de forma reversível até 2000×", () => {
    const ref = 5;
    for (const z of [0.2, 1, 37, 2000]) expect(distanceToZoom(zoomToDistance(z, ref), ref)).toBeCloseTo(z, 6);
  });
  it("limita o zoom ao máximo configurado e a 2000×", () => {
    expect(clampZoom(1e9)).toBe(ZOOM_MAX);
    expect(clampZoom(1e9, 500)).toBe(500);
    expect(clampZoom(0.0001)).toBe(0.2);
  });
  it("slider logarítmico é reversível e cobre os extremos", () => {
    expect(sliderToZoom(0)).toBeCloseTo(0.2);
    expect(sliderToZoom(1)).toBeCloseTo(2000);
    expect(zoomToSlider(sliderToZoom(0.37))).toBeCloseTo(0.37, 6);
  });
  it("planos de corte acompanham a distância e mantêm near < far", () => {
    const close = clipPlanes(0.0025, 5, 0.02);
    expect(close.near).toBeLessThan(close.far);
    expect(close.near).toBeCloseTo(0.00005, 8);
    expect(close.far / close.near).toBeLessThan(1e7);
  });
  it("detecta zoom além do detalhe geométrico", () => {
    expect(exceedsGeometryDetail(0.001, 35, 0.05, 2000)).toBe(true);
    expect(exceedsGeometryDetail(5, 35, 0.05, 1)).toBe(false);
    expect(exceedsGeometryDetail(1, 35, 0, 50)).toBe(false);
    expect(exceedsGeometryDetail(0.5, 35, 1, 1)).toBe(false);
  });
});

describe("history", () => {
  it("desfaz e refaz na ordem correta e limpa o refazer ao novo comando", () => {
    const h = new History();
    let v = 0;
    const cmd = (to: number) => { const from = v; v = to; h.push({ label: `v${to}`, undo: () => { v = from; }, redo: () => { v = to; } }); };
    cmd(1); cmd(2);
    h.undo(); expect(v).toBe(1);
    h.undo(); expect(v).toBe(0);
    h.redo(); expect(v).toBe(1);
    cmd(5); expect(h.canRedo).toBe(false);
    h.undo(); expect(v).toBe(1);
  });
  it("respeita o limite de tamanho", () => {
    const h = new History(2);
    for (let i = 0; i < 5; i++) h.push({ label: String(i), undo() {}, redo() {} });
    h.undo(); h.undo();
    expect(h.canUndo).toBe(false);
  });
});

describe("explode", () => {
  it("vetor aponta para fora do centro e cresce com a distância", () => {
    const near = explodeVector(new Vector3(1, 0, 0), new Vector3(), 4, 0);
    const far = explodeVector(new Vector3(3, 0, 0), new Vector3(), 4, 0);
    expect(near.x).toBeGreaterThan(0);
    expect(far.length()).toBeGreaterThan(near.length());
  });
  it("peça no centro recebe afastamento mínimo determinístico", () => {
    const v = explodeVector(new Vector3(), new Vector3(), 4, 1);
    expect(v.y).toBeLessThan(0);
    expect(v.length()).toBeGreaterThan(0);
  });
  it("deslocamento é zero com intensidade zero (preserva posição original)", () => {
    expect(explodeOffset(new Vector3(1, 2, 3), 0).length()).toBe(0);
  });
  it("damp converge sem ultrapassar o alvo", () => {
    let x = 0;
    for (let i = 0; i < 200; i++) x = damp(x, 1, 6, 1 / 60);
    expect(x).toBeLessThanOrEqual(1);
    expect(x).toBeGreaterThan(0.999);
  });
});
