/** Zoom nominal: fator = distância de referência (enquadramento 1×) / distância atual da câmera. */

export const ZOOM_MIN = 0.2;
export const ZOOM_MAX = 2000;

export function clampZoom(z: number, max: number = ZOOM_MAX): number {
  return Math.min(Math.max(z, ZOOM_MIN), Math.min(max, ZOOM_MAX));
}

export function distanceToZoom(distance: number, refDistance: number): number {
  return refDistance / Math.max(distance, Number.MIN_VALUE);
}

export function zoomToDistance(zoom: number, refDistance: number, max: number = ZOOM_MAX): number {
  return refDistance / clampZoom(zoom, max);
}

/** Slider linear [0,1] <-> zoom logarítmico entre ZOOM_MIN e max. */
export function sliderToZoom(t: number, max: number = ZOOM_MAX): number {
  const lo = Math.log(ZOOM_MIN);
  const hi = Math.log(Math.min(max, ZOOM_MAX));
  return Math.exp(lo + Math.min(Math.max(t, 0), 1) * (hi - lo));
}

export function zoomToSlider(zoom: number, max: number = ZOOM_MAX): number {
  const lo = Math.log(ZOOM_MIN);
  const hi = Math.log(Math.min(max, ZOOM_MAX));
  return (Math.log(clampZoom(zoom, max)) - lo) / (hi - lo);
}

/** Planos de clipping dinâmicos para preservar a precisão do depth buffer em zoom extremo. */
export function clipPlanes(distance: number, refDistance: number, nearFactor: number) {
  const near = Math.max(distance * nearFactor, 1e-6);
  const far = Math.max(distance * 500, refDistance * 60);
  return { near, far };
}

/**
 * Heurística de resolução geométrica: o modelo "perde detalhe" quando um triângulo
 * mediano passa a ocupar mais de 1/10 da altura visível da tela.
 */
export function exceedsGeometryDetail(
  distance: number,
  fovDeg: number,
  medianEdge: number,
  zoom: number,
  ratio = 10,
): boolean {
  if (!(medianEdge > 0) || zoom <= 1.5) return false;
  const visibleHeight = 2 * distance * Math.tan((fovDeg * Math.PI) / 360);
  return visibleHeight < medianEdge * ratio;
}

export function formatZoom(z: number): string {
  if (z >= 100) return `${Math.round(z)}×`;
  if (z >= 10) return `${z.toFixed(1)}×`;
  return `${z.toFixed(2)}×`;
}
