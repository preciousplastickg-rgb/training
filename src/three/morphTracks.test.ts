import { describe, expect, it } from 'vitest';
import twinGlb from '../../public/3d/twin.glb?inline';
import dbRowGlb from '../../public/3d/ex/db_row.glb?inline';
import dbShoulderPressGlb from '../../public/3d/ex/db_shoulder_press.glb?inline';
import gobletSquatGlb from '../../public/3d/ex/goblet_squat.glb?inline';
import lateralRaiseGlb from '../../public/3d/ex/lateral_raise.glb?inline';
import { bodyTargets, carrierNames, parseGlb, weightChannels } from '../test/glb';
import { animatedTargets, carrierTracks, FIXED_TARGETS, sampleTrack, splitWeights, type TargetTrack } from './morphTracks';

// Веса морфов из клипов — docs/TWIN-3D.md, раздел 2 «Скиннинг и морфы» (этап 5c). Эталон весов fix_* —
// exercise-anim/renders/viewer_dqs_ref.json (exlib.corrective_weights в Blender).

const twin = parseGlb(twinGlb);
const names = bodyTargets(twin);
const dictionary = Object.fromEntries(names.map((n, i) => [n, i]));
const animated = animatedTargets(dictionary);

function exerciseTracks(dataUrl: string): TargetTrack[] {
  const g = parseGlb(dataUrl);
  return carrierTracks(weightChannels(g).map((c) => c.track), carrierNames(g), animated);
}

/** Вес каждой анимируемой цели в момент t; цели без дорожки — 0 (движок сбрасывает их при смене клипа). */
function weightsAt(tracks: TargetTrack[], t: number): Record<string, number> {
  return Object.fromEntries(animated.map((n) => {
    const tr = tracks.find((x) => x.target === n);
    return [n, tr ? sampleTrack(tr, t) : 0];
  }));
}

function expectWeights(got: Record<string, number>, want: Record<string, number>) {
  for (const n of animated) expect(Math.abs(got[n]! - (want[n] ?? 0)), n).toBeLessThanOrEqual(0.002);
}

describe('цели морфов twin.glb (этап 5c)', () => {
  it('12 целей по порядку; анимируемые — все, кроме lean и muscle', () => {
    expect(names).toEqual([
      'lean', 'muscle', 'hand_open_L', 'hand_open_R', 'fix_shoulder_up_L', 'fix_shoulder_up_R',
      'fix_chest_press_L', 'fix_chest_press_R', 'fix_elbow_flex_L', 'fix_elbow_flex_R', 'fix_hip_flex_L', 'fix_hip_flex_R',
    ]);
    expect(animated).toHaveLength(10);
    for (const f of FIXED_TARGETS) expect(animated).not.toContain(f);
  });
});

describe('дорожки весов (этап 5c)', () => {
  it('twin.glb, клип idle: 10 дорожек целей, ни одной для lean/muscle; hand_open_L/R = 0,5', () => {
    const ch = weightChannels(twin);
    expect(ch).toHaveLength(1);
    const tracks = splitWeights(ch[0]!.track, ch[0]!.names, animated);
    expect(tracks).toHaveLength(10);
    expect(tracks.map((t) => t.target)).not.toContain('lean');
    expect(tracks.map((t) => t.target)).not.toContain('muscle');
    for (const t of [0, 1.3, 3.9]) {
      const w = weightsAt(tracks, t);
      expect(w.hand_open_L).toBe(0.5);
      expect(w.hand_open_R).toBe(0.5);
    }
  });

  it('ex/db_row.glb: hand_open_L = 1 на всех ключах', () => {
    const tracks = exerciseTracks(dbRowGlb);
    const hand = tracks.find((t) => t.target === 'hand_open_L')!;
    expect(hand.values.length).toBeGreaterThan(1);
    expect([...hand.values].every((v) => v === 1)).toBe(true);
    expect(tracks.find((t) => t.target === 'hand_open_R')).toBeUndefined();
  });

  it('db_shoulder_press, t = 0,0: fix_shoulder_up_L/R = 1,0; fix_hip_flex_L/R = 0,1681; остальные 0', () => {
    expectWeights(weightsAt(exerciseTracks(dbShoulderPressGlb), 0), {
      fix_shoulder_up_L: 1, fix_shoulder_up_R: 1, fix_hip_flex_L: 0.1681, fix_hip_flex_R: 0.1681,
    });
  });

  it('goblet_squat, t = 2,0: fix_elbow_flex_L/R = 0,7859; fix_hip_flex_L/R = 1,0; остальные 0', () => {
    expectWeights(weightsAt(exerciseTracks(gobletSquatGlb), 2), {
      fix_elbow_flex_L: 0.7859, fix_elbow_flex_R: 0.7859, fix_hip_flex_L: 1, fix_hip_flex_R: 1,
    });
  });

  it('db_row, t = 2,0: fix_chest_press_L = 0,8261, _R = 0,6309; fix_hip_flex_L = 0,3228; остальные 0', () => {
    expectWeights(weightsAt(exerciseTracks(dbRowGlb), 2), {
      fix_chest_press_L: 0.8261, fix_chest_press_R: 0.6309, fix_hip_flex_L: 0.3228, hand_open_L: 1,
    });
  });

  it('клип без body_morphs: дорожек весов нет', () => {
    const g = parseGlb(lateralRaiseGlb);
    expect(carrierNames(g)).toBeNull();
    expect(exerciseTracks(lateralRaiseGlb)).toEqual([]);
    // дорожка весов без носителя отбрасывается
    const stray = { times: [0, 1], values: [0.3, 0.7], interpolation: 'LINEAR' as const };
    expect(carrierTracks([stray], null, animated)).toEqual([]);
  });

  it('LINEAR между ключами, STEP — последний ключ', () => {
    const lin: TargetTrack = { target: 'x', times: Float32Array.from([0, 1]), values: Float32Array.from([0, 1]), interpolation: 'LINEAR' };
    expect(sampleTrack(lin, 0.25)).toBeCloseTo(0.25);
    const step: TargetTrack = { ...lin, interpolation: 'STEP' };
    expect(sampleTrack(step, 0.25)).toBe(0);
    expect(sampleTrack(step, 1)).toBe(1);
  });
});
