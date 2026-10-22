/** Utilitários puros de topologia para edição de malhas. */

export interface Welded {
  /** índice de vértice original -> id de vértice único (posição soldada) */
  map: Uint32Array;
  /** id único -> índices de vértices originais naquela posição */
  members: number[][];
}

/** Agrupa vértices com a mesma posição (tolerância relativa ao tamanho da malha). */
export function weldPositions(pos: ArrayLike<number>, count: number): Welded {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < count; i++) {
    const x = pos[i * 3]!, y = pos[i * 3 + 1]!, z = pos[i * 3 + 2]!;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  const diag = Math.hypot(maxX - minX, maxY - minY, maxZ - minZ);
  const q = Math.max(diag * 1e-6, 1e-9);
  const keys = new Map<string, number>();
  const map = new Uint32Array(count);
  const members: number[][] = [];
  for (let i = 0; i < count; i++) {
    const key = `${Math.round(pos[i * 3]! / q)},${Math.round(pos[i * 3 + 1]! / q)},${Math.round(pos[i * 3 + 2]! / q)}`;
    let id = keys.get(key);
    if (id === undefined) {
      id = members.length;
      keys.set(key, id);
      members.push([]);
    }
    members[id]!.push(i);
    map[i] = id;
  }
  return { map, members };
}

export interface ClosedInfo {
  closed: boolean;
  openEdges: number;
  nonManifoldEdges: number;
}

/** Uma malha é fechada (estanque) quando toda aresta é compartilhada por exatamente 2 triângulos. */
export function closedInfo(index: ArrayLike<number> | null, vertexCount: number, welded: Welded): ClosedInfo {
  const n = welded.members.length;
  const edges = new Map<number, number>();
  const tris = (index ? index.length : vertexCount) / 3;
  const at = (k: number) => welded.map[index ? index[k]! : k]!;
  const add = (a: number, b: number) => {
    if (a === b) return;
    const key = a < b ? a * n + b : b * n + a;
    edges.set(key, (edges.get(key) ?? 0) + 1);
  };
  for (let t = 0; t < tris; t++) {
    const a = at(t * 3), b = at(t * 3 + 1), c = at(t * 3 + 2);
    add(a, b); add(b, c); add(c, a);
  }
  let open = 0, bad = 0;
  edges.forEach((c) => {
    if (c === 1) open++;
    else if (c > 2) bad++;
  });
  return { closed: open === 0 && bad === 0 && edges.size > 0, openEdges: open, nonManifoldEdges: bad };
}
