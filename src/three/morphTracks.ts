// Веса морфов из клипа — docs/TWIN-3D.md, раздел 2, «Скиннинг и морфы» (итерация 13 exercise-anim). Без three.js:
// чистые функции над массивами, движок превращает результат в NumberKeyframeTrack.
//
// Канал glTF `weights` даёт одну дорожку на все цели узла: на ключ — по значению на каждую цель, в порядке целей узла.
// - `twin.glb`, клип `idle`: дорожка на теле, значения для всех 12 целей (у `lean`/`muscle` — 0);
// - `ex/<id>.glb`: тела нет, дорожка на узле-носителе `body_morphs`, цели — только анимируемые в этом клипе.
// Движок разбивает её на дорожки по целям тела и берёт только анимируемые: `lean` и `muscle` задаёт пользователь
// (раздел 4), клип их не трогает никогда.

/** Цели, которые задаёт приложение по данным пользователя, а не клип. */
export const FIXED_TARGETS: readonly string[] = ['lean', 'muscle'];
/** Узел-носитель весов в файле упражнения. */
export const MORPH_CARRIER = 'body_morphs';

export type Interp = 'STEP' | 'LINEAR';

/** Дорожка весов узла: на ключ — `names.length` значений подряд. */
export interface WeightTrack {
  times: ArrayLike<number>;
  values: ArrayLike<number>;
  interpolation: Interp;
}

/** Дорожка одной цели морфа. */
export interface TargetTrack {
  target: string;
  times: Float32Array;
  values: Float32Array;
  interpolation: Interp;
}

/** Цели по индексам словаря (`morphTargetDictionary`), по порядку. */
export function targetNames(dictionary: Record<string, number>): string[] {
  return Object.entries(dictionary).sort((a, b) => a[1] - b[1]).map((e) => e[0]);
}

/** Анимируемые цели тела — все, кроме `lean` и `muscle`; список строится из словаря, имён в коде нет. */
export function animatedTargets(dictionary: Record<string, number>): string[] {
  return targetNames(dictionary).filter((n) => !FIXED_TARGETS.includes(n));
}

/** Дорожка весов узла с целями `names` → дорожки целей, только из `animated` (цели тела). */
export function splitWeights(track: WeightTrack, names: readonly string[], animated: readonly string[]): TargetTrack[] {
  const n = names.length;
  const keys = track.times.length;
  if (n === 0 || track.values.length !== keys * n) throw new Error(`дорожка весов: ${track.values.length} значений на ${keys} ключей и ${n} целей`);
  const out: TargetTrack[] = [];
  names.forEach((target, k) => {
    if (!animated.includes(target)) return;
    const values = new Float32Array(keys);
    for (let i = 0; i < keys; i++) values[i] = track.values[i * n + k]!;
    out.push({ target, times: Float32Array.from(track.times), values, interpolation: track.interpolation });
  });
  return out;
}

/**
 * Дорожки целей клипа упражнения: веса лежат на узле-носителе с целями `carrier`. Носителя нет (`null`) — у клипа
 * своих весов нет, его дорожки весов отбрасываются.
 */
export function carrierTracks(tracks: readonly WeightTrack[], carrier: readonly string[] | null, animated: readonly string[]): TargetTrack[] {
  if (!carrier) return [];
  return tracks.flatMap((t) => splitWeights(t, carrier, animated));
}

/** Значение дорожки цели в момент t (STEP — последний ключ не позже t, LINEAR — между ключами), как AnimationMixer. */
export function sampleTrack(tt: TargetTrack, t: number): number {
  const { times, values } = tt;
  const n = times.length;
  if (!n) return 0;
  if (t <= times[0]!) return values[0]!;
  if (t >= times[n - 1]!) return values[n - 1]!;
  let i = 1;
  while (times[i]! < t) i++;
  if (tt.interpolation === 'STEP') return times[i] === t ? values[i]! : values[i - 1]!;
  const a = times[i - 1]!, b = times[i]!;
  return values[i - 1]! + ((values[i]! - values[i - 1]!) * (t - a)) / (b - a);
}
