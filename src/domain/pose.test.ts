import { describe, expect, it } from 'vitest';
import { ANIMATIONS, ANIMATION_BY_ID } from '../data/animations';
import { EXERCISES } from '../data/exercises';
import { angleTo, armAlongLegs, cycleAt, easeInOut, sidePose, tempoText } from './pose';
import { handPoint } from './anatomy';

const end = (id: string) => ANIMATION_BY_ID[id]!.keyframes.find((k) => k.name === 'end')!.joints;

describe('манекен', () => {
  it('анимация есть для каждого из 68 упражнений', () => {
    expect(EXERCISES).toHaveLength(68);
    for (const e of EXERCISES) expect(ANIMATION_BY_ID[e.id], e.id).toBeDefined();
    expect(ANIMATIONS).toHaveLength(68);
  });
  it('эталон: гоблет-присед end — корпус 40°, бедро ≈ горизонтально, голень 30°', () => {
    const p = sidePose(ANIMATION_BY_ID.goblet_squat!, end('goblet_squat'));
    expect(p.a.torso).toBe(40);
    expect(angleTo(p.a.thigh, 'horizontal')).toBe(5);
    expect(angleTo(p.a.shin, 'vertical')).toBe(30);
  });
  it('эталон: махи end — плечо ±80°', () => {
    const j = end('lateral_raise');
    expect(j.shoulderL).toBe(80);
    expect(j.shoulderR).toBe(-80);
  });
  it('стопа на полу в стойке: присед не отрывает пятку', () => {
    const p = sidePose(ANIMATION_BY_ID.goblet_squat!, end('goblet_squat'));
    expect(p.heel.y).toBeCloseTo(p.toe.y);
  });
  it('у каждого не больше 3 подсказок углов, кадры существуют', () => {
    for (const a of ANIMATIONS) {
      expect(a.angles.length).toBeLessThanOrEqual(3);
      const names = a.keyframes.map((k) => k.name);
      for (const g of a.angles) expect(names).toContain(g.keyframe);
    }
  });
  it('цикл: присед — вниз 2 с (уступающая), пауза, вверх 1 с (концентрическая)', () => {
    const a = ANIMATION_BY_ID.goblet_squat!;
    expect(cycleAt(a, 1)).toMatchObject({ phase: 'toEnd', concentric: false, t: 0.5 });
    expect(cycleAt(a, 2.2).phase).toBe('pause');
    expect(cycleAt(a, 2.75)).toMatchObject({ phase: 'toStart', concentric: true });
    expect(tempoText(a)).toBe('Вниз 2 с · пауза · вверх 1 с');
    expect(tempoText(ANIMATION_BY_ID.lateral_raise!)).toBe('Вверх 1 с · пауза · вниз 2 с');
  });
  it('easing на краях и в середине', () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 3);
    expect(easeInOut(0.2)).toBeLessThan(0.2);
  });
});

describe('румынская тяга: кисти ведутся по ногам', () => {
  const thighFront = (p: ReturnType<typeof sidePose>, y: number) => {
    // Точка оси бедра на высоте y и её сдвиг вперёд.
    const t = (y - p.hip.y) / (p.knee.y - p.hip.y);
    return p.hip.x + (p.knee.x - p.hip.x) * t;
  };
  it('гантели: в наклоне кисть на бедре, а не впереди него', () => {
    const a = ANIMATION_BY_ID.db_rdl!;
    const p = sidePose(a, end('db_rdl'));
    const hand = handPoint(p.elbowR, p.wristR);
    expect(hand.y).toBeGreaterThan(p.hip.y + 10);
    expect(hand.y).toBeLessThan(p.ankle.y);
    const axisX = thighFront(p, Math.min(hand.y, p.knee.y));
    expect(Math.abs(hand.x - axisX)).toBeLessThan(9);
    expect(p.a.upperArmL).toBe(p.a.upperArmR);
    expect(p.a.forearmR).toBe(p.a.upperArmR);
  });
  it('стоя рука висит почти вертикально', () => {
    const p = sidePose(ANIMATION_BY_ID.db_rdl!, ANIMATION_BY_ID.db_rdl!.keyframes[0]!.joints);
    expect(Math.abs(angleTo(p.a.upperArmR, 'vertical'))).toBeLessThan(6);
  });
  it('штанга: гриф перед ногами, не внутри бедра', () => {
    const p = sidePose(ANIMATION_BY_ID.barbell_rdl!, end('barbell_rdl'));
    const hand = handPoint(p.elbowR, p.wristR);
    const axisX = thighFront(p, Math.min(hand.y, p.knee.y));
    expect(hand.x - axisX).toBeGreaterThan(8);
    expect(hand.x - axisX).toBeLessThan(20);
  });
  it('armAlongLegs: если не достаёт — направление на ближайшую точку', () => {
    const a = armAlongLegs({ x: 100, y: 0 }, [{ x: 0, y: 0 }, { x: 0, y: 50 }], 0, 30);
    expect(a).toBeCloseTo(-90, 0);
  });
});
