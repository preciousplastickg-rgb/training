import { describe, expect, it } from 'vitest';
import { ARM_PLATES, LEG_PLATES, MAP_SKELETON, PELVIS_PLATES, TORSO_PLATES } from '../data/anatomy';
import { ANIMATION_BY_ID, ANIMATIONS } from '../data/animations';
import { frontFigure, MAP_SCALE, sidePlates, type Placed } from './anatomy';
import { sidePose, type Pt } from './pose';

const kf = (id: string, name: string) => ANIMATION_BY_ID[id]!.keyframes.find((k) => k.name === name)!.joints;
const center = (pl: Placed): Pt => ({
  x: pl.pts.reduce((a, p) => a + p.x, 0) / pl.pts.length,
  y: pl.pts.reduce((a, p) => a + p.y, 0) / pl.pts.length,
});
const find = (plates: Placed[], key: string) => plates.find((p) => p.key === key)!;

describe('анатомическая фигура сбоку', () => {
  const stand = sidePose(ANIMATION_BY_ID.goblet_squat!, kf('goblet_squat', 'start'));
  const plates = sidePlates(stand);

  it('каждая подсвечиваемая мышца программы есть среди пластин', () => {
    const muscles = new Set([...LEG_PLATES, ...PELVIS_PLATES, ...TORSO_PLATES, ...ARM_PLATES].map((p) => p.muscle).filter(Boolean));
    for (const a of ANIMATIONS) {
      if (a.view !== 'side') continue;
      for (const m of [...a.highlight.primary, ...a.highlight.secondary]) expect(muscles, `${a.exerciseId}: ${m}`).toContain(m);
    }
  });

  it('стоя: квадрицепс спереди бедра, бицепс бедра сзади, ягодицы за тазом, голова над плечом', () => {
    const quads = center(find(plates, 'leg-quads'));
    const ham = center(find(plates, 'leg-hamstrings'));
    expect(quads.y).toBeGreaterThan(stand.hip.y);
    expect(quads.y).toBeLessThan(stand.knee.y);
    expect(quads.x).toBeGreaterThan(stand.hip.x); // человек смотрит вправо
    expect(ham.x).toBeLessThan(stand.hip.x);
    expect(center(find(plates, 'glutes')).x).toBeLessThan(stand.hip.x - 5);
    expect(center(find(plates, 'head')).y).toBeLessThan(stand.shoulder.y);
    expect(center(find(plates, 'chest')).x).toBeGreaterThan(stand.shoulder.x);
  });

  it('стопа стоит подошвой на 4 px ниже голеностопа', () => {
    const foot = find(plates, 'leg-foot');
    expect(Math.max(...foot.pts.map((p) => p.y)) - stand.ankle.y).toBeCloseTo(4.2, 1);
  });

  it('в приседе квадрицепс смотрит вверх, бедро почти горизонтально', () => {
    const deep = sidePose(ANIMATION_BY_ID.goblet_squat!, kf('goblet_squat', 'end'));
    const q = center(find(sidePlates(deep), 'leg-quads'));
    const h = center(find(sidePlates(deep), 'leg-hamstrings'));
    expect(q.y).toBeLessThan(h.y);
  });

  it('дальняя рука и вторая нога помечены как дальние', () => {
    const row = sidePlates(sidePose(ANIMATION_BY_ID.db_row!, kf('db_row', 'start')));
    expect(row.filter((p) => p.key.startsWith('armL-')).every((p) => p.far)).toBe(true);
    expect(row.filter((p) => p.key.startsWith('legB-')).length).toBeGreaterThan(0);
    expect(row.filter((p) => p.key.startsWith('armR-')).every((p) => !p.far)).toBe(true);
  });
});

describe('анатомическая фигура спереди (карта мышц)', () => {
  const w = (p: Pt) => ({ x: 100 + (p.x - 50) * MAP_SCALE, y: p.y * MAP_SCALE });

  it('в позе покоя карты руки не двигаются', () => {
    const f = frontFigure({ rig: 'standing' }, { shoulderL: 10, shoulderR: -10, elbowL: 20, elbowR: 20 });
    expect(f.pose.wristL.x).toBeCloseTo(w(MAP_SKELETON.wristL).x, 5);
    expect(f.pose.wristL.y).toBeCloseTo(w(MAP_SKELETON.wristL).y, 5);
    expect(f.pose.wristR.x).toBeCloseTo(100 - (w(MAP_SKELETON.wristL).x - 100), 5);
  });

  it('махи: в верхней точке кисти на уровне плеч и разведены в стороны', () => {
    const f = frontFigure({ rig: 'standing' }, kf('lateral_raise', 'end'));
    expect(Math.abs(f.pose.wristL.y - f.pose.shoulderL.y)).toBeLessThan(14);
    expect(f.pose.wristL.x).toBeGreaterThan(f.pose.shoulderL.x + 40);
    expect(f.pose.wristR.x).toBeLessThan(f.pose.shoulderR.x - 40);
  });

  it('жим сидя: внизу предплечья вертикальны, вверху кисти над головой; бёдра укорочены', () => {
    const lo = frontFigure({ rig: 'seated' }, kf('db_shoulder_press', 'start'));
    expect(Math.abs(lo.pose.wristL.x - lo.pose.elbowL.x)).toBeLessThan(3);
    expect(lo.pose.wristL.y).toBeLessThan(lo.pose.elbowL.y);
    const hi = frontFigure({ rig: 'seated' }, kf('db_shoulder_press', 'end'));
    expect(hi.pose.wristL.y).toBeLessThan(hi.pose.head.y);
    expect(hi.pose.kneeL.y - hi.pose.hipL.y).toBeLessThan((MAP_SKELETON.kneeL.y - MAP_SKELETON.hipL.y) * MAP_SCALE * 0.5);
  });
});

describe('опора', () => {
  it('планка: предплечья и носки на одной высоте — фигура лежит на полу, а не висит', () => {
    const a = ANIMATION_BY_ID.plank!;
    const plates = sidePlates(sidePose(a, kf('plank', 'end')));
    const low = (prefix: string) => Math.max(...plates.filter((p) => p.key.startsWith(prefix)).flatMap((p) => p.pts.map((q) => q.y)));
    expect(Math.abs(low('armR-extensors') - low('leg-foot'))).toBeLessThan(2.5);
  });
});
