// Карта мышц с выносками (REDESIGN 3.2): одна карта 130 × 286, точка на мышце → линия → подпись справа.
// Вид — сзади, если хотя бы одна основная мышца есть на задней карте, иначе спереди.
// Центр группы — среднее точек её полигонов в правой половине карты (x > 50), в пикселях карты.

import { MUSCLE_SLUGS } from '../data/anatomy';
import { anteriorData, posteriorData, type MapSlug } from '../data/muscleMap';
import type { Muscle } from '../db/types';

export type MapView = 'front' | 'back';

export interface Callout {
  muscle: Muscle;
  role: 'primary' | 'secondary';
  /** Точка на мышце, px карты. */
  anchor: { x: number; y: number };
  /** Верх блока подписи, px; подписи идут сверху вниз с шагом ≥ gap. */
  labelY: number;
}

export interface CalloutLayout {
  view: MapView;
  callouts: Callout[];
  /** Мышцы, которых на выбранной стороне не видно (трицепс у жима, ягодицы у приседа) — перечислить текстом. */
  hidden: { muscle: Muscle; role: 'primary' | 'secondary' }[];
}

/** Масштаб карты: viewBox 100 × 220 → 130 × 286. */
export const MAP_PX = 1.3;
/** Высота блока подписи: название 20 + роль 16. */
export const LABEL_H = 36;

const slugsIn = (view: MapView): Set<MapSlug> => new Set((view === 'front' ? anteriorData : posteriorData).map((g) => g.muscle));
const FRONT_SLUGS = slugsIn('front');
const BACK_SLUGS = slugsIn('back');

const parse = (s: string): { x: number; y: number }[] => {
  const n = s.trim().split(/\s+/).map(Number);
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i + 1 < n.length; i += 2) out.push({ x: n[i]!, y: n[i + 1]! });
  return out;
};

export function visibleIn(view: MapView, muscle: Muscle): boolean {
  const set = view === 'front' ? FRONT_SLUGS : BACK_SLUGS;
  return MUSCLE_SLUGS[muscle].some((s) => set.has(s));
}

/**
 * Сторона карты: где видно больше рабочих мышц (основная — 2, помогающая — 1); при равенстве — спереди.
 * Правило ТЗ «сзади, если хоть одна основная сзади» прятало бы грудь у жима (трицепс сзади) и
 * квадрицепс у приседа (ягодицы сзади).
 */
export function mapViewFor(primary: readonly Muscle[], secondary: readonly Muscle[] = []): MapView {
  const score = (v: MapView) => primary.filter((m) => visibleIn(v, m)).length * 2 + secondary.filter((m) => visibleIn(v, m)).length;
  return score('back') > score('front') ? 'back' : 'front';
}

/** Центр группы на карте в px (× MAP_PX): среднее точек полигонов с x > 50. Нет на этой стороне — null. */
export function muscleCenter(view: MapView, muscle: Muscle, scale = MAP_PX): { x: number; y: number } | null {
  const data = view === 'front' ? anteriorData : posteriorData;
  const slugs = new Set(MUSCLE_SLUGS[muscle]);
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const g of data) {
    if (!slugs.has(g.muscle)) continue;
    for (const poly of g.svgPoints) {
      for (const p of parse(poly)) {
        if (p.x <= 50) continue;
        sx += p.x;
        sy += p.y;
        n++;
      }
    }
  }
  if (!n) return null;
  return { x: Math.round((sx / n) * scale * 10) / 10, y: Math.round((sy / n) * scale * 10) / 10 };
}

/**
 * Раскладка выносок: точки по мышцам, подписи сверху вниз по y точки, при наложении — сдвиг вниз
 * (шаг ≥ gap), последняя не ниже карты. Если снизу места нет — все блоки поднимаются.
 */
export function layoutCallouts(
  primary: readonly Muscle[],
  secondary: readonly Muscle[],
  opts: { gap?: number; height?: number; scale?: number } = {},
): CalloutLayout {
  const gap = opts.gap ?? 38;
  const height = opts.height ?? 220 * MAP_PX;
  const scale = opts.scale ?? MAP_PX;
  const view = mapViewFor(primary, secondary);
  const all: { muscle: Muscle; role: 'primary' | 'secondary' }[] = [
    ...primary.map((m) => ({ muscle: m, role: 'primary' as const })),
    ...secondary.filter((m) => !primary.includes(m)).map((m) => ({ muscle: m, role: 'secondary' as const })),
  ];
  const hidden: CalloutLayout['hidden'] = [];
  const placed: Callout[] = [];
  for (const it of all) {
    const c = muscleCenter(view, it.muscle, scale);
    if (!c) hidden.push(it);
    else placed.push({ ...it, anchor: c, labelY: c.y - LABEL_H / 2 });
  }
  placed.sort((a, b) => a.anchor.y - b.anchor.y);
  // Вниз: каждая подпись не выше предыдущей + gap.
  for (let i = 0; i < placed.length; i++) {
    const min = i === 0 ? 0 : placed[i - 1]!.labelY + gap;
    placed[i]!.labelY = Math.max(placed[i]!.labelY, min);
  }
  // Вверх: не ниже карты; при необходимости поджать предыдущие.
  for (let i = placed.length - 1; i >= 0; i--) {
    const max = i === placed.length - 1 ? height - LABEL_H : placed[i + 1]!.labelY - gap;
    placed[i]!.labelY = Math.max(0, Math.min(placed[i]!.labelY, max));
  }
  return { view, callouts: placed.map((c) => ({ ...c, labelY: Math.round(c.labelY) })), hidden };
}
