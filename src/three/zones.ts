// Мышцы приложения → зоны карты twin_id (docs/TWIN-3D.md, раздел 5). Без three.js: используется и в тестах.

import type { Exercise, Muscle } from '../db/types';

export type Zone =
  | 'pec' | 'front_delt' | 'side_delt' | 'rear_delt' | 'traps' | 'lats' | 'upper_back' | 'biceps' | 'triceps'
  | 'forearms' | 'abs' | 'obliques' | 'lower_back' | 'glutes' | 'quads' | 'adductors' | 'hamstrings' | 'calves';

export const ZONE_OF: Record<Muscle, Zone> = {
  chest: 'pec',
  front_delt: 'front_delt',
  side_delt: 'side_delt',
  rear_delt: 'rear_delt',
  lats: 'lats',
  upper_back: 'upper_back',
  traps: 'traps',
  biceps: 'biceps',
  triceps: 'triceps',
  forearms: 'forearms',
  abs: 'abs',
  obliques: 'obliques',
  lower_back: 'lower_back',
  glutes: 'glutes',
  quads: 'quads',
  adductors: 'adductors',
  hamstrings: 'hamstrings',
  calves: 'calves',
};

/** Зоны подсветки упражнения из каталога: основные и второстепенные (зона, которая уже основная, не повторяется). */
export function exerciseZones(ex: Pick<Exercise, 'muscles'>): { primary: Zone[]; secondary: Zone[] } {
  const primary = [...new Set(ex.muscles.primary.map((m) => ZONE_OF[m]))];
  const secondary = [...new Set(ex.muscles.secondary.map((m) => ZONE_OF[m]))].filter((z) => !primary.includes(z));
  return { primary, secondary };
}

/** Рабочая сторона одностороннего упражнения: +1 — левая (L), −1 — правая (R), 0 — обе. */
export function sideSign(side: 'L' | 'R' | undefined): number {
  return side === 'L' ? 1 : side === 'R' ? -1 : 0;
}
