import { describe, expect, it } from 'vitest';
import { MANUAL_TEXT, STALL_TEXT, suggest, type HistoryEntry, type ProgressionInput } from './progression';

const bench = { equipment: 'barbell', unit: 'kg' } as const;
const entry = (date: string, weight: number, reps: number[], extra: Partial<HistoryEntry> = {}): HistoryEntry => ({
  date, isDeload: false, isCalibration: false, sets: reps.map((r) => ({ weight, reps: r })), ...extra,
});
const base: ProgressionInput = {
  exercise: bench, sets: 3, normalSets: 3, repMin: 6, repMax: 10, step: 250,
  history: [], isDeload: false, isCalibration: false,
};

describe('двойная прогрессия', () => {
  it('первая сессия — вес вводит пользователь', () => {
    const s = suggest(base);
    expect(s.mode).toBe('manual');
    expect(s.weight).toBeNull();
    expect(s.reason).toBe(MANUAL_TEXT);
  });

  it('пробная тренировка — тоже ручной ввод, даже с историей', () => {
    const s = suggest({ ...base, isCalibration: true, history: [entry('2026-11-09', 6000, [8, 8, 8])] });
    expect(s.mode).toBe('manual');
  });

  it('10 / 10 / 10 → вес + шаг, цель repMin', () => {
    const s = suggest({ ...base, history: [entry('2026-11-09', 6000, [10, 10, 10])] });
    expect(s.mode).toBe('progress');
    expect(s.weight).toBe(6250);
    expect(s.targets).toEqual([6, 6, 6]);
    expect(s.reason).toBe('+2,5 кг: в прошлый раз 10 / 10 / 10');
  });

  it('не все подходы на максимуме → тот же вес, +1 повтор в самом слабом', () => {
    const s = suggest({ ...base, history: [entry('2026-11-09', 6000, [10, 9, 8])] });
    expect(s.mode).toBe('hold');
    expect(s.weight).toBe(6000);
    expect(s.targets).toEqual([10, 9, 9]);
    expect(s.reason).toBe('Цель +1 повтор: в прошлый раз 10 / 9 / 8');
  });

  it('недоделанные подходы не засчитываются как «все на максимуме»', () => {
    const s = suggest({ ...base, history: [entry('2026-11-09', 6000, [10, 10])] });
    expect(s.mode).toBe('hold');
    expect(s.targets).toEqual([10, 10, 7]);
  });

  it('3 сессии застоя → вес × 0,9, округлённый до 2,5 кг', () => {
    const s = suggest({
      ...base,
      history: [
        entry('2026-11-09', 6000, [8, 8, 7]),
        entry('2026-11-13', 6000, [8, 7, 7]),
        entry('2026-11-18', 6000, [8, 8, 7]),
      ],
    });
    expect(s.mode).toBe('stall');
    expect(s.weight).toBe(5500); // 54 → 55 (ближайшее кратное 2,5)
    expect(s.reason).toBe(STALL_TEXT);
  });

  it('рост суммы повторов — не застой', () => {
    const s = suggest({
      ...base,
      history: [entry('a', 6000, [8, 7, 7]), entry('b', 6000, [8, 8, 7]), entry('c', 6000, [9, 8, 7])],
    });
    expect(s.mode).toBe('hold');
  });

  it('разгрузка: вес × 0,8 от рабочего, подходы — как передано (2)', () => {
    const s = suggest({ ...base, sets: 2, isDeload: true, history: [entry('a', 6000, [10, 9, 9])] });
    expect(s.mode).toBe('deload');
    expect(s.weight).toBe(4750); // 48 → 47,5
    expect(s.targets).toHaveLength(2);
  });

  it('разгрузочная сессия не база для прогрессии', () => {
    const s = suggest({
      ...base,
      history: [entry('a', 6000, [9, 9, 9]), entry('b', 4750, [10, 10], { isDeload: true })],
    });
    expect(s.weight).toBe(6000);
    expect(s.mode).toBe('hold');
  });

  it('гантели округляются до ряда: 10 кг + 1 кг → 12 кг', () => {
    const s = suggest({
      ...base, exercise: { equipment: 'dumbbell', unit: 'kg' }, repMin: 12, repMax: 20, step: 100,
      history: [entry('a', 1000, [20, 20, 20])],
    });
    expect(s.weight).toBe(1200);
  });

  it('блок: застой 40 кг → 35 кг (плита 5 кг)', () => {
    const s = suggest({
      ...base, exercise: { equipment: 'cable', unit: 'kg' }, repMin: 8, repMax: 12, step: 500,
      history: [entry('a', 4000, [9, 9, 9]), entry('b', 4000, [9, 9, 8]), entry('c', 4000, [9, 9, 9])],
    });
    expect(s.weight).toBe(3500);
  });
});

describe('упражнения на время и повторы', () => {
  const plank: ProgressionInput = {
    ...base, exercise: { equipment: 'bodyweight', unit: 'seconds' }, repMin: 30, repMax: 60, step: 10,
  };
  it('после первой сессии цель — худший подход', () => {
    const s = suggest({ ...plank, history: [entry('a', 0, [45, 40, 35])] });
    expect(s.targets).toEqual([35, 35, 35]);
  });
  it('все подходы на цели → +10 с', () => {
    const s = suggest({ ...plank, history: [entry('a', 0, [45, 40, 35]), entry('b', 0, [40, 38, 35])] });
    expect(s.mode).toBe('progress');
    expect(s.targets).toEqual([45, 45, 45]);
    expect(s.reason).toBe('+10 с: в прошлый раз 40 / 38 / 35 с');
  });
  it('подъём ног: шаг +2 повтора', () => {
    const s = suggest({
      ...plank, exercise: { equipment: 'bodyweight', unit: 'reps' }, repMin: 10, repMax: 15, step: 2,
      history: [entry('a', 0, [12, 11, 10]), entry('b', 0, [10, 10, 10])],
    });
    expect(s.targets).toEqual([12, 12, 12]);
  });
});

// SPEC 10, «Прогрессия» — обязательные тесты программы v2.
describe('программа v2: гравитрон, жим ногами, EZ', () => {
  const assisted: ProgressionInput = {
    ...base, exercise: { id: 'pullup_assisted', equipment: 'machine', unit: 'assist_kg' }, repMin: 6, repMax: 10, step: 500,
  };
  it('pullup_assisted, противовес 30 кг, 10 / 10 / 10 при repMax 10 → следующий противовес 25 кг', () => {
    const s = suggest({ ...assisted, history: [entry('a', 3000, [10, 10, 10])] });
    expect(s.mode).toBe('progress');
    expect(s.weight).toBe(2500);
    expect(s.targets).toEqual([6, 6, 6]);
  });
  it('pullup_assisted, противовес 0, 10 / 10 / 10 → карточка «переключить на pullup»', () => {
    const s = suggest({ ...assisted, history: [entry('a', 0, [10, 10, 10])] });
    expect(s.mode).toBe('switch');
    expect(s.switchTo).toBe('pullup');
    expect(s.reason).toBe('Подтягиваешься сам — переключить на подтягивания?');
    const dip = suggest({ ...assisted, exercise: { id: 'dip_assisted', equipment: 'machine', unit: 'assist_kg' }, history: [entry('a', 0, [10, 10, 10])] });
    expect(dip).toMatchObject({ mode: 'switch', switchTo: 'dip' });
  });
  it('pullup_assisted, застой 3 сессии на 20 кг → противовес 25 кг', () => {
    const s = suggest({
      ...assisted,
      history: [entry('a', 2000, [8, 8, 7]), entry('b', 2000, [8, 7, 7]), entry('c', 2000, [8, 8, 7])],
    });
    expect(s.mode).toBe('stall');
    expect(s.weight).toBe(2500);
  });
  it('гравитрон: первая сессия — подбор противовеса; не все подходы на максимуме — тот же противовес, +1 повтор', () => {
    expect(suggest(assisted)).toMatchObject({ mode: 'manual', weight: null });
    const s = suggest({ ...assisted, history: [entry('a', 2000, [10, 9, 8])] });
    expect(s).toMatchObject({ mode: 'hold', weight: 2000, targets: [10, 9, 9] });
  });
  it('leg_press 100 кг, 15 / 15 / 15 при repMax 15 → 110 кг (шаг 10, округление 5)', () => {
    const s = suggest({ ...base, exercise: { equipment: 'machine', unit: 'kg' }, repMin: 10, repMax: 15, step: 1000, history: [entry('a', 10000, [15, 15, 15])] });
    expect(s.weight).toBe(11000);
  });
  it('ez_curl 25 кг, 12 / 12 / 12 при repMax 12 → 27,5 кг', () => {
    const s = suggest({ ...base, exercise: { equipment: 'barbell', unit: 'kg' }, repMin: 10, repMax: 12, step: 250, history: [entry('a', 2500, [12, 12, 12])] });
    expect(s.weight).toBe(2750);
  });
});
