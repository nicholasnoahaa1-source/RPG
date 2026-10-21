import type { Material, Mesh, Object3D, Texture } from "three";

const TEX_KEYS = [
  "map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap", "bumpMap",
  "displacementMap", "alphaMap", "envMap", "lightMap", "clearcoatMap", "clearcoatNormalMap",
  "clearcoatRoughnessMap", "sheenColorMap", "sheenRoughnessMap", "transmissionMap",
  "thicknessMap", "specularIntensityMap", "specularColorMap", "iridescenceMap",
] as const;

function disposeMaterial(m: Material) {
  const rec = m as unknown as Record<string, Texture | undefined>;
  for (const k of TEX_KEYS) rec[k]?.dispose?.();
  m.dispose();
}

/** Libera geometrias, materiais e texturas de uma árvore descartada. */
export function disposeTree(root: Object3D, originals?: Map<string, Material | Material[]>) {
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const orig = originals?.get(mesh.uuid);
    const mats = orig ?? mesh.material;
    (Array.isArray(mats) ? mats : [mats]).forEach((m) => m && disposeMaterial(m));
  });
}
