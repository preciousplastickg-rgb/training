// Статика двойника в public/3d/ (npm run sync-3d, docs/TWIN-3D.md, 2) — без three.js: нужна и экранам без WebGL.

import type { ClipPhase } from '../domain/twin';

export type Vec3 = [number, number, number];

export interface ManifestExercise {
  file: string;
  stills: [string, string];
  camera: { position: Vec3; target: Vec3 };
  bounds: { min: Vec3; max: Vec3 };
  fit_points?: Vec3[];
  phases: ClipPhase[];
}

export interface TwinManifest {
  version: number;
  twin: { file: string; bfStart: number; bfGoal: number };
  exercises: Record<string, ManifestExercise>;
}

export interface MusclesMeta {
  zones: { id: number; name: string }[];
  highlight: {
    primary: { color: string; intensity: number };
    secondary: { color: string; intensity: number };
    phase?: { multipliers?: Record<string, number>; smoothing_ms?: number };
    side?: { other_side_factor?: number; blend_half_width_m?: number };
  };
  exercises: Record<string, { primary: string[]; secondary?: string[]; side?: 'L' | 'R' }>;
}

export const ASSET_BASE = `${import.meta.env.BASE_URL}3d/`;
export const DRACO_BASE = `${import.meta.env.BASE_URL}draco/`;
export const assetUrl = (file: string) => ASSET_BASE + file;

let manifestP: Promise<TwinManifest> | null = null;
let musclesP: Promise<MusclesMeta> | null = null;
let manifestNow: TwinManifest | null = null;

function getJson<T>(file: string): Promise<T> {
  return fetch(assetUrl(file)).then((r) => {
    if (!r.ok) throw new Error(`${file}: ${r.status}`);
    return r.json() as Promise<T>;
  });
}

/** manifest.json один раз за запуск; ошибка — повторить при следующем вызове. */
export function loadManifest(): Promise<TwinManifest> {
  manifestP ??= getJson<TwinManifest>('manifest.json').then((m) => (manifestNow = m)).catch((e) => {
    manifestP = null;
    throw e;
  });
  return manifestP;
}

export function loadMuscles(): Promise<MusclesMeta> {
  musclesP ??= getJson<MusclesMeta>('muscles.json').catch((e) => {
    musclesP = null;
    throw e;
  });
  return musclesP;
}

/** Уже загруженный манифест (синхронно), иначе null. */
export function manifestSync(): TwinManifest | null {
  return manifestNow;
}

/** Нижняя точка клипа — начало фазы `hold` (кадр 49 в exercise-anim), иначе конец `ecc`. */
export function bottomTime(phases: readonly ClipPhase[]): number {
  return phases.find((p) => p.kind === 'hold')?.t0 ?? phases.find((p) => p.kind === 'ecc')?.t1 ?? 0;
}
