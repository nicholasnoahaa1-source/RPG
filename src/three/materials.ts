import { AdditiveBlending, Color, DoubleSide, MeshBasicMaterial, ShaderMaterial } from "three";

const vertex = /* glsl */ `
  varying vec3 vNormalV;
  varying vec3 vViewDir;
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormalV = normalize(normalMatrix * normal);
    vec4 mv = viewMatrix * world;
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uPower;
  uniform float uBase;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uScan;
  varying vec3 vNormalV;
  varying vec3 vViewDir;
  varying vec3 vWorld;
  void main() {
    float f = pow(1.0 - abs(dot(normalize(vNormalV), normalize(vViewDir))), uPower);
    float scan = 0.5 + 0.5 * sin(vWorld.y * 60.0 - uTime * 2.0);
    float line = mix(1.0, 0.55 + 0.45 * scan, uScan);
    float a = (uBase + f) * line * uOpacity;
    gl_FragColor = vec4(uColor * (0.6 + f), a);
  }
`;

export type HoloKind = "holographic" | "xray";

export function createHoloMaterial(kind: HoloKind): ShaderMaterial {
  const holo = kind === "holographic";
  return new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
    uniforms: {
      uColor: { value: new Color(holo ? "#46d2ff" : "#d6f6ff") },
      uPower: { value: holo ? 2.2 : 3.2 },
      uBase: { value: holo ? 0.16 : 0.05 },
      uOpacity: { value: 0 },
      uTime: { value: 0 },
      uScan: { value: holo ? 1 : 0 },
    },
  });
}

export function createWireMaterial(): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color: new Color("#46d2ff"),
    wireframe: true,
    transparent: true,
    opacity: 0.85,
  });
}
