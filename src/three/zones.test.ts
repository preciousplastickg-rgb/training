import { describe, expect, it } from 'vitest';
import { EXERCISE_BY_ID } from '../data/exercises';
import type { Muscle } from '../db/types';
import manifestJson from '../../public/3d/manifest.json';
import musclesJson from '../../public/3d/muscles.json';
import { exerciseZones, sideSign, ZONE_OF } from './zones';

// Контракт exercise-anim → public/3d/ (npm run sync-3d).
const muscles = musclesJson as unknown as {
  zones: { name: string }[];
  exercises: Record<string, { primary: string[]; secondary?: string[]; side?: 'L' | 'R' }>;
};
const manifest = manifestJson as unknown as { exercises: Record<string, unknown> };
const sorted = (a: readonly string[]) => [...a].sort();

describe('зоны 3D-двойника (TWIN-3D 5)', () => {
  it('bench_press по каталогу: основные [pec], второстепенные [front_delt, triceps] — как в muscles.json', () => {
    const z = exerciseZones(EXERCISE_BY_ID.bench_press!);
    expect(z.primary).toEqual(['pec']);
    expect(sorted(z.secondary)).toEqual(['front_delt', 'triceps']);
    expect(z.primary).toEqual(muscles.exercises.bench_press!.primary);
    expect(sorted(z.secondary)).toEqual(sorted(muscles.exercises.bench_press!.secondary ?? []));
  });

  it('у всех упражнений манифеста зоны каталога совпадают с muscles.json', () => {
    const ids = Object.keys(manifest.exercises);
    expect(ids.length).toBeGreaterThanOrEqual(34);
    const diff: string[] = [];
    for (const id of ids) {
      const ex = EXERCISE_BY_ID[id];
      expect(ex, `${id} нет в каталоге`).toBeDefined();
      const z = exerciseZones(ex!);
      const m = muscles.exercises[id];
      expect(m, `${id} нет в muscles.json`).toBeDefined();
      if (sorted(z.primary).join() !== sorted(m!.primary).join() || sorted(z.secondary).join() !== sorted(m!.secondary ?? []).join()) {
        diff.push(`${id}: ${z.primary}/${z.secondary} ≠ ${m!.primary}/${m!.secondary ?? []}`);
      }
    }
    expect(diff).toEqual([]);
  });

  it('каждая мышца приложения — зона карты twin_id', () => {
    const names = new Set(muscles.zones.map((z) => z.name));
    for (const m of Object.keys(ZONE_OF) as Muscle[]) expect(names.has(ZONE_OF[m]), m).toBe(true);
  });

  it('односторонние: db_row — правая, bulgarian_split_squat — левая', () => {
    expect(sideSign(muscles.exercises.db_row!.side)).toBe(-1);
    expect(sideSign(muscles.exercises.bulgarian_split_squat!.side)).toBe(1);
    expect(sideSign(muscles.exercises.bench_press!.side)).toBe(0);
  });
});
