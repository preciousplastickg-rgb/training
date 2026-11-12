// Чтение .glb в unit-тестах без three.js и Draco: JSON и BIN напрямую (анимация и обратные матрицы связывания
// не сжаты). Файл приходит строкой data:…;base64 через импорт `?inline`, поэтому Node API не нужен.

import { MORPH_CARRIER, type Interp, type WeightTrack } from '../three/morphTracks';

interface GltfJson {
  nodes: { name?: string; mesh?: number; skin?: number }[];
  meshes: { name?: string; extras?: { targetNames?: string[] } }[];
  skins?: { joints: number[]; inverseBindMatrices?: number }[];
  accessors: { bufferView?: number; byteOffset?: number; componentType: number; count: number; type: string }[];
  bufferViews: { byteOffset?: number; byteLength: number }[];
  animations?: { name?: string; channels: { sampler: number; target: { node?: number; path: string } }[]; samplers: { input: number; output: number; interpolation?: string }[] }[];
}

export interface Glb {
  json: GltfJson;
  bin: DataView;
}

const SIZE: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

export function parseGlb(dataUrl: string): Glb {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  const dv = new DataView(bytes.buffer);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('не glb');
  const jsonLen = dv.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLen))) as GltfJson;
  const binOff = 20 + jsonLen;
  const binLen = dv.getUint32(binOff, true);
  return { json, bin: new DataView(bytes.buffer, binOff + 8, binLen) };
}

/** Аксессор float32 без сжатия. */
export function readFloats(g: Glb, accessor: number): Float32Array {
  const a = g.json.accessors[accessor]!;
  if (a.componentType !== 5126 || a.bufferView === undefined) throw new Error(`аксессор ${accessor}: не float32 или сжат`);
  const bv = g.json.bufferViews[a.bufferView]!;
  const n = a.count * SIZE[a.type]!;
  const off = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = g.bin.getFloat32(off + i * 4, true);
  return out;
}

export interface WeightChannel {
  node: string;
  names: string[];
  track: WeightTrack;
}

/** Каналы `weights` первого клипа: узел, имена целей его сетки, дорожка. */
export function weightChannels(g: Glb): WeightChannel[] {
  const an = g.json.animations?.[0];
  if (!an) return [];
  return an.channels.filter((c) => c.target.path === 'weights').map((c) => {
    const node = g.json.nodes[c.target.node!]!;
    const s = an.samplers[c.sampler]!;
    return {
      node: node.name ?? '',
      names: g.json.meshes[node.mesh!]?.extras?.targetNames ?? [],
      track: { times: readFloats(g, s.input), values: readFloats(g, s.output), interpolation: (s.interpolation ?? 'LINEAR') as Interp },
    };
  });
}

/** Цели носителя весов в файле упражнения; носителя нет — null. */
export function carrierNames(g: Glb): string[] | null {
  const node = g.json.nodes.find((n) => n.name === MORPH_CARRIER);
  return node ? (g.json.meshes[node.mesh!]?.extras?.targetNames ?? []) : null;
}

/** Цели сетки тела (узел со skin). */
export function bodyTargets(g: Glb): string[] {
  const node = g.json.nodes.find((n) => n.skin !== undefined)!;
  return g.json.meshes[node.mesh!]!.extras!.targetNames!;
}
