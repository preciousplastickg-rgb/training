// Анимации манекена — SPEC 6.7.2. Углы в градусах.
//
// Соглашение (вид сбоку, человек смотрит вправо): абсолютный угол сегмента α отсчитывается от
// вертикали вверх по часовой стрелке. Ноги и корпус направлены «вверх» (от дистального сустава
// к проксимальному), руки — «вниз» (от плеча к кисти).
//   standing: α_голень = ankle; α_бедро = α_голень + knee; α_таз = α_бедро + hip
//   прочие:   α_таз = база стойки; α_бедро = α_таз − hip; α_голень = α_бедро − knee
//   α_корпус = α_таз + spine; α_плечо = α_корпус + 180 − shoulder; α_предплечье = α_плечо − elbow
// Проверка по прототипу: гоблет-присед end — голеностоп 30°, колено −115°, таз 125° → корпус 40°.
// Вид спереди: shoulderL/R — отведение от опущенной руки (±), elbow — сгибание в той же плоскости.
// Расширения к SPEC: hipB/kneeB — вторая нога (выпады, тяга в наклоне), direction — куда идёт
// движение start → end, props — снаряды и опоры.

import type { Muscle } from '../db/types';

export type Joint =
  | 'ankle' | 'knee' | 'hip' | 'spine' | 'neck' | 'shoulderL' | 'shoulderR' | 'elbowL' | 'elbowR' | 'hipB' | 'kneeB';

export interface AngleGuide {
  keyframe: string;
  segment: 'torso' | 'thigh' | 'shin' | 'upperArm' | 'forearm';
  /** 'along' — линия вдоль сегмента без дуги («спина прямая»). */
  reference: 'vertical' | 'horizontal' | 'along';
  value: number;
  label: string;
  text?: string;
  warn?: string;
}

export type Prop =
  | { kind: 'bench'; under: 'torso' | 'hips' | 'kneeB' | 'ankleB' | 'support' }
  | { kind: 'incline'; angle: number }
  | { kind: 'bar' }
  | { kind: 'pulley'; dx: number; y: number }
  | { kind: 'platform' }
  | { kind: 'kneePad' };

export interface ExerciseAnimation {
  exerciseId: string;
  view: 'side' | 'front';
  rig: 'standing' | 'seated' | 'lying' | 'hanging' | 'kneeling';
  equipment: 'dumbbell' | 'barbell' | 'cable' | 'none';
  keyframes: { name: 'start' | 'end' | string; joints: Partial<Record<Joint, number>> }[];
  tempo: { down: number; pause: number; up: number; rest: number };
  concentric: 'up' | 'down';
  highlight: { primary: Muscle[]; secondary: Muscle[] };
  angles: AngleGuide[];
  /** Физическое направление движения start → end. */
  direction: 'up' | 'down' | 'static';
  /** Базовый угол таза для стоек кроме standing. */
  base?: number;
  /** Как держать снаряд: goblet — гантель у груди, back — гриф на трапециях. */
  hold?: 'goblet' | 'back' | 'hands';
  /**
   * Кисти ведутся по ногам (румынская тяга): угол плеча в кадрах игнорируется, рука прямая и
   * направлена так, чтобы кисть лежала на линии бедра/голени — гантели скользят по бёдрам,
   * гриф не отходит от ног.
   */
  armPath?: 'legs';
  props?: Prop[];
  /** Удерживать время вместо повторов (планка). */
  hold_seconds?: string;
}

const T_SQUAT = { down: 2, pause: 0.5, up: 1, rest: 0.6 };
const T_RAISE = { down: 2, pause: 0.5, up: 1, rest: 0.6 };
const T_PULL_DOWN = { down: 1, pause: 0.5, up: 2, rest: 0.6 };

export const ANIMATIONS: ExerciseAnimation[] = [
  {
    exerciseId: 'goblet_squat', view: 'side', rig: 'standing', equipment: 'dumbbell', hold: 'goblet',
    keyframes: [
      { name: 'start', joints: { ankle: 0, knee: -2, hip: 2, shoulderR: 35, elbowR: 140, shoulderL: 35, elbowL: 140 } },
      { name: 'end', joints: { ankle: 30, knee: -115, hip: 125, shoulderR: 35, elbowR: 140, shoulderL: 35, elbowL: 140 } },
    ],
    tempo: T_SQUAT, concentric: 'up', direction: 'down',
    highlight: { primary: ['quads', 'glutes'], secondary: ['abs'] },
    angles: [
      { keyframe: 'end', segment: 'torso', reference: 'vertical', value: 40, label: 'Корпус' },
      { keyframe: 'end', segment: 'thigh', reference: 'horizontal', value: 5, label: 'Бедро', text: '≈ параллельно' },
      { keyframe: 'end', segment: 'shin', reference: 'vertical', value: 30, label: 'Голень' },
    ],
  },
  {
    exerciseId: 'barbell_squat', view: 'side', rig: 'standing', equipment: 'barbell', hold: 'back',
    keyframes: [
      { name: 'start', joints: { ankle: 0, knee: -2, hip: 4, shoulderL: -35, elbowL: 160, shoulderR: -35, elbowR: 160 } },
      { name: 'end', joints: { ankle: 30, knee: -110, hip: 125, shoulderL: -35, elbowL: 160, shoulderR: -35, elbowR: 160 } },
    ],
    tempo: T_SQUAT, concentric: 'up', direction: 'down',
    highlight: { primary: ['quads', 'glutes'], secondary: ['hamstrings', 'lower_back'] },
    angles: [
      { keyframe: 'end', segment: 'torso', reference: 'vertical', value: 45, label: 'Корпус' },
      { keyframe: 'end', segment: 'thigh', reference: 'horizontal', value: 0, label: 'Бедро', text: '≈ параллельно' },
      { keyframe: 'end', segment: 'shin', reference: 'vertical', value: 30, label: 'Голень' },
    ],
  },
  {
    exerciseId: 'bench_press', view: 'side', rig: 'lying', base: 270, equipment: 'barbell', hold: 'hands',
    props: [{ kind: 'bench', under: 'torso' }],
    keyframes: [
      { name: 'start', joints: { hip: -15, knee: -80, shoulderL: 90, elbowL: 0, shoulderR: 90, elbowR: 0 } },
      { name: 'end', joints: { hip: -15, knee: -80, shoulderL: -60, elbowL: 150, shoulderR: -60, elbowR: 150 } },
    ],
    tempo: T_SQUAT, concentric: 'up', direction: 'down',
    highlight: { primary: ['chest', 'triceps'], secondary: ['front_delt'] },
    angles: [
      { keyframe: 'end', segment: 'upperArm', reference: 'horizontal', value: 60, label: 'Плечо', text: '45–70° к корпусу' },
      { keyframe: 'end', segment: 'forearm', reference: 'vertical', value: 0, label: 'Предплечье', text: '≈ вертикально' },
    ],
  },
  {
    exerciseId: 'db_row', view: 'side', rig: 'kneeling', base: 85, equipment: 'dumbbell', hold: 'hands',
    props: [{ kind: 'bench', under: 'support' }],
    keyframes: [
      { name: 'start', joints: { hip: 85, knee: -5, hipB: 85, kneeB: -95, shoulderL: 85, elbowL: 0, shoulderR: 85, elbowR: 0 } },
      { name: 'end', joints: { hip: 85, knee: -5, hipB: 85, kneeB: -95, shoulderL: 85, elbowL: 0, shoulderR: -5, elbowR: 95 } },
    ],
    tempo: T_RAISE, concentric: 'up', direction: 'up',
    highlight: { primary: ['lats', 'upper_back'], secondary: ['biceps', 'rear_delt'] },
    angles: [
      { keyframe: 'end', segment: 'torso', reference: 'horizontal', value: 5, label: 'Корпус', text: '≈ параллельно полу' },
      { keyframe: 'end', segment: 'upperArm', reference: 'horizontal', value: 10, label: 'Плечо', text: 'локоть к бедру' },
    ],
  },
  {
    exerciseId: 'db_rdl', view: 'side', rig: 'standing', equipment: 'dumbbell', hold: 'hands', armPath: 'legs',
    keyframes: [
      { name: 'start', joints: { ankle: 0, knee: -4, hip: 4 } },
      { name: 'end', joints: { ankle: -3, knee: -20, hip: 93 } },
    ],
    tempo: T_SQUAT, concentric: 'up', direction: 'down',
    highlight: { primary: ['hamstrings', 'glutes'], secondary: ['lower_back'] },
    angles: [
      { keyframe: 'end', segment: 'torso', reference: 'vertical', value: 70, label: 'Корпус', text: '70–80°' },
      { keyframe: 'end', segment: 'thigh', reference: 'vertical', value: 20, label: 'Колено', text: '~15–20°' },
      { keyframe: 'end', segment: 'torso', reference: 'along', value: 0, label: 'Спина прямая' },
    ],
  },
  {
    exerciseId: 'barbell_rdl', view: 'side', rig: 'standing', equipment: 'barbell', hold: 'hands', armPath: 'legs',
    keyframes: [
      { name: 'start', joints: { ankle: 0, knee: -4, hip: 4 } },
      { name: 'end', joints: { ankle: -3, knee: -20, hip: 93 } },
    ],
    tempo: T_SQUAT, concentric: 'up', direction: 'down',
    highlight: { primary: ['hamstrings', 'glutes'], secondary: ['lower_back', 'upper_back'] },
    angles: [
      { keyframe: 'end', segment: 'torso', reference: 'vertical', value: 70, label: 'Корпус', text: '70–80°' },
      { keyframe: 'end', segment: 'thigh', reference: 'vertical', value: 20, label: 'Колено', text: '~15–20°' },
      { keyframe: 'end', segment: 'torso', reference: 'along', value: 0, label: 'Спина прямая' },
    ],
  },
  {
    exerciseId: 'lateral_raise', view: 'front', rig: 'standing', equipment: 'dumbbell', hold: 'hands',
    keyframes: [
      { name: 'start', joints: { shoulderL: 12, shoulderR: -12, elbowL: 12, elbowR: 12 } },
      { name: 'end', joints: { shoulderL: 80, shoulderR: -80, elbowL: 12, elbowR: 12 } },
    ],
    tempo: T_RAISE, concentric: 'up', direction: 'up',
    highlight: { primary: ['side_delt'], secondary: ['upper_back'] },
    angles: [
      { keyframe: 'end', segment: 'upperArm', reference: 'vertical', value: 85, label: 'Плечо', text: '~85° от корпуса' },
      { keyframe: 'end', segment: 'upperArm', reference: 'horizontal', value: 0, label: 'Уровень плеч', warn: 'Выше плеч не поднимать' },
    ],
  },
  {
    // Наклон 83,5°: предплечья и носки на одной линии пола (плечо остаётся над локтем).
    exerciseId: 'plank', view: 'side', rig: 'lying', base: 83.5, equipment: 'none',
    keyframes: [
      { name: 'start', joints: { hip: 0, knee: 0, shoulderL: 83.5, elbowL: 90, shoulderR: 83.5, elbowR: 90 } },
      { name: 'end', joints: { hip: 0, knee: 0, shoulderL: 83.5, elbowL: 90, shoulderR: 83.5, elbowR: 90 } },
    ],
    tempo: { down: 0, pause: 3, up: 0, rest: 0 }, concentric: 'up', direction: 'static', hold_seconds: 'Держи 30–60 с',
    highlight: { primary: ['abs'], secondary: ['glutes', 'front_delt'] },
    angles: [
      { keyframe: 'end', segment: 'torso', reference: 'along', value: 0, label: 'Прямая линия' },
      { keyframe: 'end', segment: 'upperArm', reference: 'vertical', value: 0, label: 'Плечо над локтем', text: '90°' },
    ],
  },
  {
    exerciseId: 'db_shoulder_press', view: 'front', rig: 'seated', equipment: 'dumbbell', hold: 'hands',
    props: [{ kind: 'bench', under: 'hips' }],
    keyframes: [
      { name: 'start', joints: { shoulderL: 88, shoulderR: -88, elbowL: 92, elbowR: 92, hip: 90, knee: -90 } },
      { name: 'end', joints: { shoulderL: 165, shoulderR: -165, elbowL: 10, elbowR: 10, hip: 90, knee: -90 } },
    ],
    tempo: { down: 2, pause: 0.4, up: 1, rest: 0.6 }, concentric: 'up', direction: 'up',
    highlight: { primary: ['front_delt', 'side_delt'], secondary: ['triceps'] },
    angles: [
      { keyframe: 'start', segment: 'torso', reference: 'vertical', value: 85, label: 'Спинка', text: '80–90°' },
      { keyframe: 'start', segment: 'forearm', reference: 'vertical', value: 0, label: 'Предплечья', text: '≈ вертикально' },
    ],
  },
  {
    exerciseId: 'lat_pulldown', view: 'side', rig: 'seated', base: 0, equipment: 'cable', hold: 'hands',
    props: [{ kind: 'bench', under: 'hips' }, { kind: 'kneePad' }, { kind: 'pulley', dx: 4, y: 6 }],
    keyframes: [
      { name: 'start', joints: { spine: -5, hip: 90, knee: -90, shoulderL: 172, elbowL: 0, shoulderR: 172, elbowR: 0 } },
      { name: 'end', joints: { spine: -15, hip: 90, knee: -90, shoulderL: -20, elbowL: 150, shoulderR: -20, elbowR: 150 } },
    ],
    tempo: T_PULL_DOWN, concentric: 'down', direction: 'down',
    highlight: { primary: ['lats'], secondary: ['biceps', 'upper_back'] },
    angles: [
      { keyframe: 'end', segment: 'torso', reference: 'vertical', value: 15, label: 'Отклон корпуса' },
      { keyframe: 'end', segment: 'upperArm', reference: 'vertical', value: 20, label: 'Локти', text: 'вниз-назад' },
    ],
  },
  {
    exerciseId: 'pullup', view: 'side', rig: 'hanging', base: 0, equipment: 'none', hold: 'hands',
    props: [{ kind: 'bar' }],
    keyframes: [
      { name: 'start', joints: { hip: 8, knee: -25, shoulderL: 178, elbowL: 0, shoulderR: 178, elbowR: 0 } },
      { name: 'end', joints: { hip: 10, knee: -30, shoulderL: 30, elbowL: 150, shoulderR: 30, elbowR: 150 } },
    ],
    tempo: T_RAISE, concentric: 'up', direction: 'up',
    highlight: { primary: ['lats'], secondary: ['biceps', 'upper_back'] },
    angles: [
      { keyframe: 'end', segment: 'forearm', reference: 'horizontal', value: 0, label: 'Подбородок выше перекладины' },
      { keyframe: 'end', segment: 'torso', reference: 'vertical', value: 5, label: 'Корпус', text: '≈ вертикально' },
    ],
  },
  {
    exerciseId: 'bulgarian_split_squat', view: 'side', rig: 'standing', equipment: 'dumbbell', hold: 'hands',
    props: [{ kind: 'bench', under: 'ankleB' }],
    keyframes: [
      { name: 'start', joints: { ankle: 4, knee: -18, hip: 18, hipB: -28, kneeB: -95, shoulderL: 4, shoulderR: 4 } },
      { name: 'end', joints: { ankle: 2, knee: -95, hip: 108, hipB: 4, kneeB: -120, shoulderL: 15, shoulderR: 15 } },
    ],
    tempo: T_SQUAT, concentric: 'up', direction: 'down',
    highlight: { primary: ['quads', 'glutes'], secondary: ['hamstrings'] },
    angles: [
      { keyframe: 'end', segment: 'shin', reference: 'vertical', value: 0, label: 'Голень', text: '≈ вертикально' },
      { keyframe: 'end', segment: 'torso', reference: 'vertical', value: 15, label: 'Корпус', text: '~15° вперёд' },
    ],
  },
  {
    exerciseId: 'leg_press', view: 'side', rig: 'seated', base: -50, equipment: 'none',
    props: [{ kind: 'incline', angle: -50 }, { kind: 'platform' }],
    keyframes: [
      { name: 'start', joints: { hip: 85, knee: -10, shoulderL: 40, elbowL: 20, shoulderR: 40, elbowR: 20 } },
      { name: 'end', joints: { hip: 122, knee: -92, shoulderL: 40, elbowL: 20, shoulderR: 40, elbowR: 20 } },
    ],
    tempo: T_SQUAT, concentric: 'up', direction: 'down',
    highlight: { primary: ['quads', 'glutes'], secondary: ['hamstrings'] },
    angles: [
      { keyframe: 'end', segment: 'shin', reference: 'along', value: 90, label: 'Колено ~90°' },
      { keyframe: 'end', segment: 'torso', reference: 'along', value: 0, label: 'Поясница прижата' },
    ],
  },
  {
    exerciseId: 'incline_db_press', view: 'side', rig: 'lying', base: 300, equipment: 'dumbbell', hold: 'hands',
    props: [{ kind: 'incline', angle: 300 }],
    keyframes: [
      { name: 'start', joints: { hip: 30, knee: -80, shoulderL: 120, elbowL: 0, shoulderR: 120, elbowR: 0 } },
      { name: 'end', joints: { hip: 30, knee: -80, shoulderL: -35, elbowL: 155, shoulderR: -35, elbowR: 155 } },
    ],
    tempo: T_SQUAT, concentric: 'up', direction: 'down',
    highlight: { primary: ['chest', 'front_delt'], secondary: ['triceps'] },
    angles: [
      { keyframe: 'end', segment: 'torso', reference: 'horizontal', value: 30, label: 'Скамья' },
      { keyframe: 'end', segment: 'forearm', reference: 'vertical', value: 0, label: 'Предплечья', text: '≈ вертикально' },
    ],
  },
  {
    exerciseId: 'db_bench_press', view: 'side', rig: 'lying', base: 270, equipment: 'dumbbell', hold: 'hands',
    props: [{ kind: 'bench', under: 'torso' }],
    keyframes: [
      { name: 'start', joints: { hip: -15, knee: -80, shoulderL: 90, elbowL: 0, shoulderR: 90, elbowR: 0 } },
      { name: 'end', joints: { hip: -15, knee: -80, shoulderL: -60, elbowL: 150, shoulderR: -60, elbowR: 150 } },
    ],
    tempo: T_SQUAT, concentric: 'up', direction: 'down',
    highlight: { primary: ['chest', 'triceps'], secondary: ['front_delt'] },
    angles: [
      { keyframe: 'end', segment: 'upperArm', reference: 'horizontal', value: 60, label: 'Плечо', text: '45–70° к корпусу' },
      { keyframe: 'end', segment: 'forearm', reference: 'vertical', value: 0, label: 'Предплечья', text: '≈ вертикально' },
    ],
  },
  {
    exerciseId: 'biceps_curl', view: 'side', rig: 'standing', equipment: 'dumbbell', hold: 'hands',
    keyframes: [
      { name: 'start', joints: { ankle: 0, knee: -3, hip: 3, shoulderL: 2, elbowL: 5, shoulderR: 2, elbowR: 5 } },
      { name: 'end', joints: { ankle: 0, knee: -3, hip: 3, shoulderL: 8, elbowL: 135, shoulderR: 8, elbowR: 135 } },
    ],
    tempo: T_RAISE, concentric: 'up', direction: 'up',
    highlight: { primary: ['biceps'], secondary: [] },
    angles: [{ keyframe: 'end', segment: 'upperArm', reference: 'vertical', value: 5, label: 'Плечо', text: '≈ вертикально' }],
  },
  {
    exerciseId: 'triceps_pushdown', view: 'side', rig: 'standing', equipment: 'cable', hold: 'hands',
    props: [{ kind: 'pulley', dx: 14, y: 6 }],
    keyframes: [
      { name: 'start', joints: { ankle: 0, knee: -8, hip: 18, shoulderL: 8, elbowL: 95, shoulderR: 8, elbowR: 95 } },
      { name: 'end', joints: { ankle: 0, knee: -8, hip: 18, shoulderL: 12, elbowL: 5, shoulderR: 12, elbowR: 5 } },
    ],
    tempo: T_PULL_DOWN, concentric: 'down', direction: 'down',
    highlight: { primary: ['triceps'], secondary: [] },
    angles: [
      { keyframe: 'end', segment: 'upperArm', reference: 'vertical', value: 5, label: 'Плечо', text: '≈ вертикально' },
      { keyframe: 'start', segment: 'forearm', reference: 'horizontal', value: 0, label: 'Вверху', text: 'локоть ~90°' },
    ],
  },
  {
    exerciseId: 'hanging_leg_raise', view: 'side', rig: 'hanging', base: 0, equipment: 'none', hold: 'hands',
    props: [{ kind: 'bar' }],
    keyframes: [
      { name: 'start', joints: { hip: 4, knee: -4, spine: 0, shoulderL: 178, shoulderR: 178 } },
      { name: 'end', joints: { hip: 92, knee: -75, spine: -8, shoulderL: 170, shoulderR: 170 } },
    ],
    tempo: T_RAISE, concentric: 'up', direction: 'up',
    highlight: { primary: ['abs'], secondary: [] },
    angles: [
      { keyframe: 'end', segment: 'thigh', reference: 'horizontal', value: 0, label: 'Бедро', text: '≈ параллельно полу' },
      { keyframe: 'end', segment: 'torso', reference: 'along', value: 0, label: 'Таз подкручен' },
    ],
  },
  {
    exerciseId: 'cable_crunch', view: 'side', rig: 'kneeling', base: 0, equipment: 'cable', hold: 'hands',
    props: [{ kind: 'pulley', dx: 10, y: 6 }],
    keyframes: [
      { name: 'start', joints: { hip: 0, knee: -90, hipB: 0, kneeB: -90, spine: 20, shoulderL: 160, elbowL: 150, shoulderR: 160, elbowR: 150 } },
      { name: 'end', joints: { hip: -10, knee: -90, hipB: -10, kneeB: -90, spine: 80, shoulderL: 160, elbowL: 150, shoulderR: 160, elbowR: 150 } },
    ],
    tempo: T_PULL_DOWN, concentric: 'down', direction: 'down',
    highlight: { primary: ['abs'], secondary: [] },
    angles: [{ keyframe: 'end', segment: 'thigh', reference: 'vertical', value: 0, label: 'Бёдра', text: '≈ вертикально' }],
  },
];

export const ANIMATION_BY_ID: Record<string, ExerciseAnimation> = Object.fromEntries(ANIMATIONS.map((a) => [a.exerciseId, a]));
