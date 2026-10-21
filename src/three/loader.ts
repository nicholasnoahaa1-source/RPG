import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import type { Object3D } from "three";
import { useWorkstation } from "@/store/workstation";

let draco: DRACOLoader | null = null;

function makeLoader() {
  const loader = new GLTFLoader();
  if (!draco) {
    draco = new DRACOLoader();
    draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
  }
  loader.setDRACOLoader(draco);
  loader.setMeshoptDecoder(MeshoptDecoder);
  return loader;
}

export async function loadGltf(url: string, onProgress: (p: number) => void): Promise<Object3D> {
  const gltf = await makeLoader().loadAsync(url, (e) => {
    if (e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total);
  });
  return gltf.scene;
}

let currentObjectUrl: string | null = null;

/** Abre um arquivo local (GLB/glTF binário) escolhido pelo usuário. */
export function openFile(file: File) {
  const ok = /\.(glb|gltf)$/i.test(file.name);
  const st = useWorkstation.getState();
  if (!ok) {
    st.set({ loadState: "error", loadError: `Formato não suportado: ${file.name}. Use .glb ou .gltf autocontido.` });
    return;
  }
  if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
  currentObjectUrl = URL.createObjectURL(file);
  st.set({ source: { url: currentObjectUrl, name: file.name }, loadState: "loading", loadError: null, loadProgress: 0 });
}

export function openUrl(url: string, name: string) {
  useWorkstation.getState().set({ source: { url, name }, loadState: "loading", loadError: null, loadProgress: 0 });
}
