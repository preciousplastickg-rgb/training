import { describe, expect, it } from 'vitest';
import { adjacentWeight, barWeightFor, increaseWeight, platesPerSide, reduceWeight, roundWeight, warmupSets } from './weights';

const PLATES = [2500, 2000, 1500, 1000, 500, 250, 125];

describe('округление весов', () => {
  it('штанга — 2,5 кг', () => {
    expect(roundWeight('barbell', 5400)).toBe(5500);
    expect(roundWeight('barbell', 5374)).toBe(5250);
    expect(roundWeight('barbell', 5260, 'up')).toBe(5500);
  });
  it('гантели — из ряда 2…32', () => {
    expect(roundWeight('dumbbell', 700, 'up')).toBe(800);
    expect(roundWeight('dumbbell', 100)).toBe(200);
  });
  it('блок — плита 5 кг', () => {
    expect(roundWeight('cable', 3600)).toBe(3500);
  });
  it('степпер', () => {
    expect(adjacentWeight('barbell', 6000, 1)).toBe(6250);
    expect(adjacentWeight('barbell', 6000, -1)).toBe(5750);
    expect(adjacentWeight('dumbbell', 1000, 1)).toBe(1200);
    expect(adjacentWeight('dumbbell', 200, -1)).toBe(200);
  });
  it('увеличение всегда больше, снижение при застое всегда меньше', () => {
    expect(increaseWeight('dumbbell', 1000, 100)).toBe(1200);
    expect(reduceWeight('dumbbell', 400, 0.9)).toBe(200);
  });
});

describe('разминка', () => {
  it('штанга 50 кг: гриф × 10, 25 × 6', () => {
    expect(warmupSets('barbell', 5000, 2000)).toEqual([{ weight: 2000, reps: 10 }, { weight: 2500, reps: 6 }]);
  });
  it('штанга 70 кг: + 75% × 3', () => {
    expect(warmupSets('barbell', 7000, 2000)).toEqual([
      { weight: 2000, reps: 10 }, { weight: 3500, reps: 6 }, { weight: 5250, reps: 3 },
    ]);
  });
  it('лёгкая штанга: без подходов тяжелее рабочего и легче грифа', () => {
    expect(warmupSets('barbell', 3000, 2000)).toEqual([{ weight: 2000, reps: 10 }]);
  });
  it('гантель 16 кг: 50% × 8', () => {
    expect(warmupSets('dumbbell', 1600, 2000)).toEqual([{ weight: 800, reps: 8 }]);
  });
});

describe('блины', () => {
  it('62,5 кг = гриф 20 + на сторону 20 + 1,25', () => {
    expect(platesPerSide(6250, 2000, PLATES)).toEqual({ perSide: [2000, 125], remainder: 0 });
  });
  it('100 кг = 25 + 15', () => {
    expect(platesPerSide(10000, 2000, PLATES)).toEqual({ perSide: [2500, 1500], remainder: 0 });
  });
  it('только гриф', () => {
    expect(platesPerSide(2000, 2000, PLATES)).toEqual({ perSide: [], remainder: 0 });
  });
  it('легче грифа — null; ненабираемый остаток', () => {
    expect(platesPerSide(1500, 2000, PLATES)).toBeNull();
    expect(platesPerSide(2100, 2000, PLATES)?.remainder).toBe(100);
  });
});

// SPEC 10, «Прогрессия»: блины для EZ-грифа; округление по оборудованию v2.
describe('программа v2: EZ-гриф и округление', () => {
  it('27,5 кг при ezBarWeight 10 кг: на сторону 5 + 2,5 + 1,25', () => {
    expect(platesPerSide(2750, 1000, PLATES)).toEqual({ perSide: [500, 250, 125], remainder: 0 });
    expect(barWeightFor({ id: 'ez_curl', equipment: 'barbell' }, { barWeight: 2000, ezBarWeight: 1000 })).toBe(1000);
    expect(barWeightFor({ id: 'bench_press', equipment: 'barbell' }, { barWeight: 2000, ezBarWeight: 1000 })).toBe(2000);
    expect(barWeightFor({ id: 'leg_press', equipment: 'machine' }, { barWeight: 2000, ezBarWeight: 1000 })).toBeNull();
  });
  it('противовес гравитрона — 5 кг, может быть 0; блин гиперэкстензии — 2,5 кг от 0', () => {
    const assist = { equipment: 'machine', unit: 'assist_kg' } as const;
    expect(roundWeight(assist, 2600)).toBe(2500);
    expect(adjacentWeight(assist, 500, -1)).toBe(0);
    expect(adjacentWeight(assist, 0, -1)).toBe(0);
    const plate = { equipment: 'bodyweight', unit: 'kg' } as const;
    expect(adjacentWeight(plate, 0, 1)).toBe(250);
    expect(adjacentWeight(plate, 250, -1)).toBe(0);
    expect(roundWeight('machine', 10500, 'up')).toBe(10500);
  });
  it('разминка только для веса в кг: у гравитрона и повторов её нет', () => {
    expect(warmupSets({ equipment: 'machine', unit: 'assist_kg' }, 3000, 2000)).toEqual([]);
    expect(warmupSets({ equipment: 'machine', unit: 'kg' }, 10000, 2000)).toEqual([{ weight: 5000, reps: 8 }, { weight: 7500, reps: 3 }]);
  });
});
