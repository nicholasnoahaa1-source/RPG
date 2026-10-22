import { Vector3 } from "three";

/**
 * Vetor de desmontagem de uma peça (em unidades do modelo, para intensidade 1):
 * radial a partir do centro do conjunto, proporcional à distância da peça ao centro.
 * Peças muito próximas do centro recebem um afastamento mínimo para não ficarem sobrepostas.
 */
export function explodeVector(partCenter: Vector3, modelCenter: Vector3, modelSize: number, index: number, spread = 1.5): Vector3 {
  const d = partCenter.clone().sub(modelCenter);
  const minLen = modelSize * 0.15;
  if (d.lengthSq() < 1e-12) {
    d.set(0, index % 2 === 0 ? 1 : -1, 0);
    return d.multiplyScalar(minLen * spread);
  }
  const len = d.length();
  return d.normalize().multiplyScalar(Math.max(len, minLen) * spread);
}

/** Deslocamento da peça para uma intensidade [0,1]. */
export function explodeOffset(vec: Vector3, amount: number, out = new Vector3()): Vector3 {
  return out.copy(vec).multiplyScalar(amount);
}

/** Interpolação exponencial independente de framerate (animação interruptível). */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return target + (current - target) * Math.exp(-lambda * dt);
}
