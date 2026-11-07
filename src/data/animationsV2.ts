// Анимации 49 упражнений программы v2 — SPEC 6.7.2. Соглашение об углах — в animations.ts.
// Вид сбоку: человек смотрит вправо; абсолютный угол 0 — вверх, 90 — вперёд.

import type { ExerciseAnimation } from './animations';

const T_SQUAT = { down: 2, pause: 0.5, up: 1, rest: 0.6 };
const T_RAISE = { down: 2, pause: 0.5, up: 1, rest: 0.6 };
const T_PULL_DOWN = { down: 1, pause: 0.5, up: 2, rest: 0.6 };
const T_PRESS = { down: 2, pause: 0.4, up: 1, rest: 0.6 };

/** Стоя: ноги почти прямые. */
const STAND = { ankle: 0, knee: -3, hip: 3 };
/** Сидя: бёдра вперёд, голени вертикально. */
const SEAT = { hip: 90, knee: -90 };
/** Грудью на наклонной спинке (база 45–60): ноги на полу позади. */
const PRONE_LEGS = (base: number) => ({ hip: base - 10, knee: -20 });

export const ANIMATIONS_V2: ExerciseAnimation[] = [
  // ---------- Тренировка A ----------
  {
    exerciseId: 'chest_supported_db_row', view: 'side', rig: 'lying', base: 55, equipment: 'dumbbell', hold: 'hands',
    props: [{ kind: 'incline', angle: 55, front: true, seat: false }],
    keyframes: [
      { name: 'start', joints: { ...PRONE_LEGS(55), shoulderL: 55, elbowL: 0, shoulderR: 55, elbowR: 0 } },
      { name: 'end', joints: { ...PRONE_LEGS(55), shoulderL: 0, elbowL: 55, shoulderR: 0, elbowR: 55 } },
    ],
    tempo: T_RAISE, concentric: 'up', direction: 'up',
    highlight: { primary: ['upper_back', 'lats'], secondary: ['rear_delt', 'biceps'] },
    angles: [
      { keyframe: 'end', segment: 'torso', reference: 'horizontal', value: 35, label: 'Грудь на скамье', text: 'скамья 30–45°' },
      { keyframe: 'end', segment: 'upperArm', reference: 'vertical', value: 55, label: 'Локти', text: 'назад, к поясу' },
    ],
  },
  {
    exerciseId: 'tbar_row_chest', view: 'side', rig: 'lying', base: 55, equipment: 'none',
    props: [{ kind: 'incline', angle: 55, front: true, seat: false }],
    keyframes: [
      { name: 'start', joints: { ...PRONE_LEGS(55), shoulderL: 55, elbowL: 0, shoulderR: 55, elbowR: 0 } },
      { name: 'end', joints: { ...PRONE_LEGS(55), shoulderL: 0, elbowL: 55, shoulderR: 0, elbowR: 55 } },
    ],
    tempo: T_RAISE, concentric: 'up', direction: 'up',
    highlight: { primary: ['upper_back', 'lats'], secondary: ['rear_delt', 'biceps'] },
    angles: [
      { keyframe: 'end', segment: 'torso', reference: 'along', value: 0, label: 'Грудь на подушке, ступни упёрты' },
      { keyframe: 'end', segment: 'upperArm', reference: 'vertical', value: 55, label: 'Локти', text: 'под 45° к корпусу, лопатки сведены' },
    ],
  },
  {
    exerciseId: 'hip_thrust', view: 'side', rig: 'lying', base: 270, equipment: 'barbell', hold: 'hips', anchor: 'shoulder',
    props: [{ kind: 'bench', under: 'shoulders', fixed: true }],
    keyframes: [
      { name: 'start', joints: { spine: 35, hip: 30, knee: -120, shoulderL: 0, elbowL: 0, shoulderR: 0, elbowR: 0 } },
      { name: 'end', joints: { spine: 0, hip: 0, knee: -90, shoulderL: 0, elbowL: 0, shoulderR: 0, elbowR: 0 } },
    ],
    tempo: T_RAISE, concentric: 'up', direction: 'up',
    highlight: { primary: ['glutes'], secondary: ['hamstrings'] },
    angles: [
      { keyframe: 'end', segment: 'shin', reference: 'vertical', value: 0, label: 'Голени', text: '≈ вертикально' },
      { keyframe: 'end', segment: 'torso', reference: 'along', value: 0, label: 'Корпус — прямая линия, рёбра вниз' },
    ],
  },
  {
    exerciseId: 'back_extension', view: 'side', rig: 'lying', base: 45, equipment: 'dumbbell', hold: 'goblet',
    props: [{ kind: 'bench', under: 'hips', fixed: true }],
    keyframes: [
      { name: 'start', joints: { spine: 0, hip: 0, knee: 0, shoulderL: 30, elbowL: 140, shoulderR: 30, elbowR: 140 } },
      { name: 'end', joints: { spine: 90, hip: 0, knee: 0, shoulderL: 30, elbowL: 140, shoulderR: 30, elbowR: 140 } },
    ],
    tempo: T_SQUAT, concentric: 'up', direction: 'down',
    highlight: { primary: ['lower_back', 'glutes'], secondary: ['hamstrings'] },
    angles: [
      { keyframe: 'start', segment: 'torso', reference: 'along', value: 0, label: 'Прямая линия тела, не выше' },
      { keyframe: 'end', segment: 'torso', reference: 'horizontal', value: 45, label: 'Корпус', text: 'вниз до растяжения, спина ровная' },
    ],
  },
  {
    exerciseId: 'cable_lateral_raise', view: 'front', rig: 'standing', equipment: 'cable', hold: 'hands',
    keyframes: [
      { name: 'start', joints: { shoulderL: 12, shoulderR: -10, elbowL: 10, elbowR: 10 } },
      { name: 'end', joints: { shoulderL: 80, shoulderR: -10, elbowL: 10, elbowR: 10 } },
    ],
    tempo: T_RAISE, concentric: 'up', direction: 'up',
    highlight: { primary: ['side_delt'], secondary: ['upper_back'] },
    angles: [
      { keyframe: 'end', segment: 'upperArm', reference: 'vertical', value: 80, label: 'Рука', text: 'до уровня плеча, ведёт локоть' },
      { keyframe: 'end', segment: 'upperArm', reference: 'horizontal', value: 0, label: 'Уровень плеч', warn: 'Выше плеча не поднимать' },
    ],
  },
  {
    exerciseId: 'seated_db_lateral_raise', view: 'front', rig: 'seated', equipment: 'dumbbell', hold: 'hands',
    props: [{ kind: 'bench', under: 'hips' }],
    keyframes: [
      { name: 'start', joints: { shoulderL: 12, shoulderR: -12, elbowL: 12, elbowR: 12, ...SEAT } },
      { name: 'end', joints: { shoulderL: 80, shoulderR: -80, elbowL: 12, elbowR: 12, ...SEAT } },
    ],
    tempo: T_RAISE, concentric: 'up', direction: 'up',
    highlight: { primary: ['side_delt'], secondary: [] },
    angles: [
      { keyframe: 'end', segment: 'upperArm', reference: 'vertical', value: 80, label: 'Плечо', text: 'до уровня плеч' },
      { keyframe: 'end', segment: 'upperArm', reference: 'horizontal', value: 0, label: 'Уровень плеч', warn: 'Плечи не тянуть к ушам' },
    ],
  },
  {
    exerciseId: 'face_pull', view: 'side', rig: 'standing', equipment: 'cable', hold: 'hands',
    props: [{ kind: 'pulley', dx: 40, y: 24 }],
    keyframes: [
      { name: 'start', joints: { ankle: 3, knee: -10, hip: 10, shoulderL: 100, elbowL: 5, shoulderR: 100, elbowR: 5 } },
      { name: 'end', joints: { ankle: 3, knee: -10, hip: 10, shoulderL: 95, elbowL: 110, shoulderR: 95, elbowR: 110 } },
    ],
    tempo: T_RAISE, concentric: 'up', direction: 'up',
    highlight: { primary: ['rear_delt', 'upper_back'], secondary: ['side_delt'] },
    angles: [
      { keyframe: 'end', segment: 'upperArm', reference: 'horizontal', value: 0, label: 'Локти', text: 'на уровне плеч, выше кистей' },
      { keyframe: 'end', segment: 'torso', reference: 'vertical', value: 3, label: 'Корпус', text: 'без отклонения назад' },
    ],
  },
  {
    exerciseId: 'reverse_pec_deck', view: 'side', rig: 'seated', base: 0, equipment: 'none',
    props: [{ kind: 'bench', under: 'hips' }, { kind: 'incline', angle: 0, front: true, seat: false }],
    keyframes: [
      { name: 'start', joints: { ...SEAT, shoulderL: 90, elbowL: 10, shoulderR: 90, elbowR: 10 } },
      { name: 'end', joints: { ...SEAT, shoulderL: -80, elbowL: 10, shoulderR: -80, elbowR: 10 } },
    ],
    tempo: T_RAISE, concentric: 'up', direction: 'up',
    highlight: { primary: ['rear_delt'], secondary: ['upper_back'] },
    angles: [
      { keyframe: 'end', segment: 'upperArm', reference: 'horizontal', value: 10, label: 'Руки', text: 'назад по дуге, почти прямые' },
      { keyframe: 'end', segment: 'torso', reference: 'along', value: 0, label: 'Грудь на спинке' },
    ],
  },
  {
    exerciseId: 'hammer_curl', view: 'side', rig: 'standing', equipment: 'dumbbell', hold: 'hands',
    keyframes: [
      { name: 'start', joints: { ...STAND, shoulderL: 2, elbowL: 5, shoulderR: 2, elbowR: 5 } },
      { name: 'end', joints: { ...STAND, shoulderL: 6, elbowL: 135, shoulderR: 6, elbowR: 135 } },
    ],
    tempo: T_RAISE, concentric: 'up', direction: 'up',
    highlight: { primary: ['biceps'], secondary: [] },
    angles: [{ keyframe: 'end', segment: 'upperArm', reference: 'vertical', value: 5, label: 'Плечо', text: '≈ вертикально, локти прижаты' }],
  },
  {
    exerciseId: 'ez_curl', view: 'side', rig: 'standing', equipment: 'barbell', hold: 'hands',
    keyframes: [
      { name: 'start', joints: { ...STAND, shoulderL: 2, elbowL: 5, shoulderR: 2, elbowR: 5 } },
      { name: 'end', joints: { ...STAND, shoulderL: 6, elbowL: 135, shoulderR: 6, elbowR: 135 } },
    ],
    tempo: T_RAISE, concentric: 'up', direction: 'up',
    highlight: { primary: ['biceps'], secondary: [] },
    angles: [{ keyframe: 'end', segment: 'upperArm', reference: 'vertical', value: 5, label: 'Плечо', text: '≈ вертикально, локти у корпуса' }],
  },
  {
    exerciseId: 'preacher_curl', view: 'side', rig: 'seated', base: 0, equipment: 'barbell', hold: 'hands',
    props: [{ kind: 'bench', under: 'hips' }, { kind: 'armPad' }],
    keyframes: [
      { name: 'start', joints: { ...SEAT, shoulderL: 45, elbowL: 10, shoulderR: 45, elbowR: 10 } },
      { name: 'end', joints: { ...SEAT, shoulderL: 45, elbowL: 120, shoulderR: 45, elbowR: 120 } },
    ],
    tempo: T_RAISE, concentric: 'up', direction: 'up',
    highlight: { primary: ['biceps'], secondary: [] },
    angles: [
      { keyframe: 'end', segment: 'forearm', reference: 'vertical', value: 15, label: 'Предплечья', text: 'до вертикали' },
      { keyframe: 'start', segment: 'upperArm', reference: 'vertical', value: 45, label: 'Плечо', text: 'на подушке, без сброса внизу' },
    ],
  },
  {
    exerciseId: 'overhead_cable_extension', view: 'side', rig: 'standing', equipment: 'cable', hold: 'hands',
    props: [{ kind: 'pulley', dx: -60, y: 150 }],
    keyframes: [
      { name: 'start', joints: { ankle: 5, knee: -10, hip: 20, shoulderL: 170, elbowL: 130, shoulderR: 170, elbowR: 130 } },
      { name: 'end', joints: { ankle: 5, knee: -10, hip: 20, shoulderL: 170, elbowL: 10, shoulderR: 170, elbowR: 10 } },
    ],
    tempo: T_RAISE, concentric: 'up', direction: 'up',
    highlight: { primary: ['triceps'], secondary: [] },
    angles: [
      { keyframe: 'end', segment: 'upperArm', reference: 'vertical', value: 25, label: 'Локти', text: 'смотрят вперёд, не двигаются' },
      { keyframe: 'end', segment: 'torso', reference: 'along', value: 0, label: 'Без прогиба в пояснице' },
    ],
  },
  {
    exerciseId: 'overhead_db_extension', view: 'side', rig: 'seated', base: 0, equipment: 'dumbbell', hold: 'hands',
    props: [{ kind: 'bench', under: 'hips' }, { kind: 'incline', angle: 0, seat: false }],
    keyframes: [
      { name: 'start', joints: { ...SEAT, shoulderL: 175, elbowL: 130, shoulderR: 175, elbowR: 130 } },
      { name: 'end', joints: { ...SEAT, shoulderL: 175, elbowL: 5, shoulderR: 175, elbowR: 5 } },
    ],
    tempo: T_RAISE, concentric: 'up', direction: 'up',
    highlight: { primary: ['triceps'], secondary: [] },
    angles: [
      { keyframe: 'end', segment: 'upperArm', reference: 'vertical', value: 5, label: 'Локти', text: 'близко к голове' },
      { keyframe: 'start', segment: 'forearm', reference: 'vertical', value: 55, label: 'Внизу', text: 'глубокое растяжение за головой' },
    ],
  },
  {
    exerciseId: 'standing_calf_raise', view: 'side', rig: 'standing', equipment: 'none', anchor: 'toe',
    props: [{ kind: 'platform' }],
    keyframes: [
      { name: 'start', joints: { ankle: 0, knee: -2, hip: 2, foot: 0, shoulderL: 40, elbowL: 100, shoulderR: 40, elbowR: 100 } },
      { name: 'end', joints: { ankle: 0, knee: -2, hip: 2, foot: 28, shoulderL: 40, elbowL: 100, shoulderR: 40, elbowR: 100 } },
    ],
    tempo: { down: 2, pause: 1, up: 1, rest: 0.6 }, concentric: 'up', direction: 'up',
    highlight: { primary: ['calves'], secondary: [] },
    angles: [
      { keyframe: 'end', segment: 'shin', reference: 'vertical', value: 0, label: 'Колени', text: 'прямые, не заблокированы' },
      { keyframe: 'start', segment: 'torso', reference: 'along', value: 0, label: 'Внизу пятки ниже платформы, пауза 1 с' },
    ],
  },
  {
    exerciseId: 'leg_press_calf_raise', view: 'side', rig: 'seated', base: -50, equipment: 'none',
    props: [{ kind: 'incline', angle: -50 }, { kind: 'platform' }],
    keyframes: [
      { name: 'start', joints: { hip: 70, knee: -15, foot: -12, shoulderL: 40, elbowL: 20, shoulderR: 40, elbowR: 20 } },
      { name: 'end', joints: { hip: 70, knee: -15, foot: 30, shoulderL: 40, elbowL: 20, shoulderR: 40, elbowR: 20 } },
    ],
    tempo: { down: 2, pause: 1, up: 1, rest: 0.6 }, concentric: 'up', direction: 'up',
    highlight: { primary: ['calves'], secondary: [] },
    angles: [
      { keyframe: 'end', segment: 'shin', reference: 'along', value: 0, label: 'Колени почти прямые весь подход' },
      { keyframe: 'start', segment: 'torso', reference: 'along', value: 0, label: 'Пауза 1 с внизу, носки на краю' },
    ],
  },
  {
    exerciseId: 'ab_wheel', view: 'side', rig: 'kneeling', base: 0, equipment: 'none', hold: 'wheel',
    keyframes: [
      { name: 'start', joints: { hip: -35, knee: -55, spine: 70, shoulderL: 70, elbowL: 0, shoulderR: 70, elbowR: 0 } },
      { name: 'end', joints: { hip: -55, knee: -35, spine: 82, shoulderL: 140, elbowL: 0, shoulderR: 140, elbowR: 0 } },
    ],
    tempo: T_SQUAT, concentric: 'up', direction: 'down',
    highlight: { primary: ['abs'], secondary: ['lats'] },
    angles: [
      { keyframe: 'end', segment: 'torso', reference: 'along', value: 0, label: 'Поясница не прогибается' },
      { keyframe: 'end', segment: 'thigh', reference: 'vertical', value: 60, label: 'Бёдра', text: 'уходят вперёд за роликом' },
    ],
  },
  {
    // Как планка: опора на одно предплечье, вторая рука вверх — силуэт боковой планки в профиль.
    exerciseId: 'side_plank', view: 'side', rig: 'lying', base: 83.5, equipment: 'none',
    keyframes: [
      { name: 'start', joints: { hip: 0, knee: 0, shoulderL: 263.5, elbowL: 0, shoulderR: 83.5, elbowR: 90 } },
      { name: 'end', joints: { hip: 0, knee: 0, shoulderL: 263.5, elbowL: 0, shoulderR: 83.5, elbowR: 90 } },
    ],
    tempo: { down: 0, pause: 3, up: 0, rest: 0 }, concentric: 'up', direction: 'static', hold_seconds: 'Держи 30–45 с на сторону',
    highlight: { primary: ['abs'], secondary: ['glutes'] },
    angles: [
      { keyframe: 'end', segment: 'torso', reference: 'along', value: 0, label: 'Прямая линия от головы до стоп' },
      { keyframe: 'end', segment: 'upperArm', reference: 'vertical', value: 0, label: 'Локоть под плечом' },
    ],
  },

  // ---------- Тренировка B ----------
  {
    exerciseId: 'barbell_ohp', view: 'side', rig: 'standing', equipment: 'barbell', hold: 'hands',
    keyframes: [
      { name: 'start', joints: { ...STAND, shoulderL: 30, elbowL: 140, shoulderR: 30, elbowR: 140 } },
      { name: 'end', joints: { ...STAND, shoulderL: 175, elbowL: 0, shoulderR: 175, elbowR: 0 } },
    ],
    tempo: T_PRESS, concentric: 'up', direction: 'up',
    highlight: { primary: ['front_delt', 'side_delt'], secondary: ['triceps', 'upper_back'] },
    angles: [
      { keyframe: 'end', segment: 'upperArm', reference: 'vertical', value: 5, label: 'Руки', text: 'гриф над серединой стопы' },
      { keyframe: 'start', segment: 'forearm', reference: 'vertical', value: 10, label: 'Предплечья', text: '≈ вертикально, локти чуть впереди' },
    ],
  },
  {
    exerciseId: 'machine_shoulder_press', view: 'front', rig: 'seated', equipment: 'none',
    props: [{ kind: 'bench', under: 'hips' }],
    keyframes: [
      { name: 'start', joints: { shoulderL: 88, shoulderR: -88, elbowL: 92, elbowR: 92, ...SEAT } },
      { name: 'end', joints: { shoulderL: 165, shoulderR: -165, elbowL: 10, elbowR: 10, ...SEAT } },
    ],
    tempo: T_PRESS, concentric: 'up', direction: 'up',
    highlight: { primary: ['front_delt', 'side_delt'], secondary: ['triceps'] },
    angles: [
      { keyframe: 'start', segment: 'forearm', reference: 'vertical', value: 0, label: 'Предплечья', text: '≈ вертикально, рукояти у подбородка' },
      { keyframe: 'end', segment: 'forearm', reference: 'vertical', value: 5, label: 'Вверху', text: 'локти не блокировать' },
    ],
  },
  {
    exerciseId: 'close_grip_pulldown', view: 'side', rig: 'seated', base: 0, equipment: 'cable', hold: 'hands',
    props: [{ kind: 'bench', under: 'hips' }, { kind: 'kneePad' }, { kind: 'pulley', dx: 4, y: 6 }],
    keyframes: [
      { name: 'start', joints: { spine: -5, ...SEAT, shoulderL: 172, elbowL: 0, shoulderR: 172, elbowR: 0 } },
      { name: 'end', joints: { spine: -15, ...SEAT, shoulderL: -10, elbowL: 150, shoulderR: -10, elbowR: 150 } },
    ],
    tempo: T_PULL_DOWN, concentric: 'down', direction: 'down',
    highlight: { primary: ['lats'], secondary: ['biceps', 'upper_back'] },
    angles: [
      { keyframe: 'end', segment: 'torso', reference: 'vertical', value: 15, label: 'Наклон назад', text: '10–15°' },
      { keyframe: 'end', segment: 'upperArm', reference: 'vertical', value: 10, label: 'Локти', text: 'вниз к рёбрам' },
    ],
  },
  {
    exerciseId: 'pullup_assisted', view: 'side', rig: 'hanging', base: 0, equipment: 'none', hold: 'hands',
    props: [{ kind: 'bar' }, { kind: 'kneePad', under: true }],
    keyframes: [
      { name: 'start', joints: { hip: 100, knee: -90, shoulderL: 178, elbowL: 0, shoulderR: 178, elbowR: 0 } },
      { name: 'end', joints: { hip: 100, knee: -90, shoulderL: 30, elbowL: 150, shoulderR: 30, elbowR: 150 } },
    ],
    tempo: T_RAISE, concentric: 'up', direction: 'up',
    highlight: { primary: ['lats'], secondary: ['biceps', 'upper_back'] },
    angles: [
      { keyframe: 'end', segment: 'forearm', reference: 'horizontal', value: 0, label: 'Подбородок над перекладиной' },
      { keyframe: 'start', segment: 'upperArm', reference: 'vertical', value: 2, label: 'Внизу', text: 'руки прямые, сначала опусти лопатки' },
    ],
  },
  {
    exerciseId: 'reverse_lunge', view: 'side', rig: 'standing', equipment: 'dumbbell', hold: 'hands',
    keyframes: [
      { name: 'start', joints: { ...STAND, hipB: 0, kneeB: -3, shoulderL: 2, elbowL: 0, shoulderR: 2, elbowR: 0 } },
      { name: 'end', joints: { ankle: 10, knee: -95, hip: 95, hipB: -30, kneeB: -45, shoulderL: 10, elbowL: 0, shoulderR: 10, elbowR: 0 } },
    ],
    tempo: T_SQUAT, concentric: 'up', direction: 'down',
    highlight: { primary: ['quads', 'glutes'], secondary: ['hamstrings'] },
    angles: [
      { keyframe: 'end', segment: 'shin', reference: 'vertical', value: 10, label: 'Голень передней ноги', text: '≈ вертикально' },
      { keyframe: 'end', segment: 'torso', reference: 'vertical', value: 10, label: 'Корпус', text: 'почти вертикально' },
    ],
  },
  {
    exerciseId: 'db_step_up', view: 'side', rig: 'standing', equipment: 'dumbbell', hold: 'hands',
    props: [{ kind: 'bench', under: 'ankle', fixed: true }],
    keyframes: [
      { name: 'start', joints: { ankle: 0, knee: -90, hip: 105, hipB: 15, kneeB: -5, shoulderL: 15, elbowL: 0, shoulderR: 15, elbowR: 0 } },
      { name: 'end', joints: { ankle: 0, knee: -5, hip: 5, hipB: -15, kneeB: -25, shoulderL: 0, elbowL: 0, shoulderR: 0, elbowR: 0 } },
    ],
    tempo: T_RAISE, concentric: 'up', direction: 'up',
    highlight: { primary: ['quads', 'glutes'], secondary: ['hamstrings'] },
    angles: [
      { keyframe: 'start', segment: 'shin', reference: 'vertical', value: 0, label: 'Голень', text: 'вся стопа на скамье' },
      { keyframe: 'end', segment: 'torso', reference: 'vertical', value: 0, label: 'Корпус', text: 'встаёшь передней ногой, без толчка задней' },
    ],
  },
  {
    exerciseId: 'incline_barbell_press', view: 'side', rig: 'lying', base: 300, equipment: 'barbell', hold: 'hands',
    props: [{ kind: 'incline', angle: 300 }],
    keyframes: [
      { name: 'start', joints: { hip: 30, knee: -80, shoulderL: 120, elbowL: 0, shoulderR: 120, elbowR: 0 } },
      { name: 'end', joints: { hip: 30, knee: -80, shoulderL: -35, elbowL: 155, shoulderR: -35, elbowR: 155 } },
    ],
    tempo: T_SQUAT, concentric: 'up', direction: 'down',
    highlight: { primary: ['chest'], secondary: ['front_delt', 'triceps'] },
    angles: [
      { keyframe: 'end', segment: 'torso', reference: 'horizontal', value: 30, label: 'Скамья' },
      { keyframe: 'end', segment: 'upperArm', reference: 'horizontal', value: 55, label: 'Плечо', text: '45–60° к корпусу' },
    ],
  },
  {
    exerciseId: 'seated_cable_row', view: 'side', rig: 'seated', base: 0, equipment: 'cable', hold: 'hands',
    props: [{ kind: 'bench', under: 'hips' }, { kind: 'platform' }, { kind: 'pulley', dx: 70, y: 140 }],
    keyframes: [
      { name: 'start', joints: { spine: 10, hip: 70, knee: -30, shoulderL: 90, elbowL: 0, shoulderR: 90, elbowR: 0 } },
      { name: 'end', joints: { spine: -5, hip: 70, knee: -30, shoulderL: -20, elbowL: 100, shoulderR: -20, elbowR: 100 } },
    ],
    tempo: T_RAISE, concentric: 'up', direction: 'up',
    highlight: { primary: ['upper_back', 'lats'], secondary: ['biceps', 'rear_delt'] },
    angles: [
      { keyframe: 'end', segment: 'torso', reference: 'vertical', value: 5, label: 'Корпус', text: 'вертикально, грудь вперёд' },
      { keyframe: 'end', segment: 'upperArm', reference: 'vertical', value: 15, label: 'Локти', text: 'назад вдоль корпуса' },
    ],
  },
  {
    exerciseId: 'single_arm_cable_row', view: 'side', rig: 'seated', base: 0, equipment: 'cable', hold: 'hands',
    props: [{ kind: 'bench', under: 'hips' }, { kind: 'platform' }, { kind: 'pulley', dx: 70, y: 140 }],
    keyframes: [
      { name: 'start', joints: { spine: 10, hip: 70, knee: -30, shoulderL: 60, elbowL: 10, shoulderR: 90, elbowR: 0 } },
      { name: 'end', joints: { spine: -5, hip: 70, knee: -30, shoulderL: 60, elbowL: 10, shoulderR: -20, elbowR: 100 } },
    ],
    tempo: T_RAISE, concentric: 'up', direction: 'up',
    highlight: { primary: ['lats'], secondary: ['upper_back', 'biceps'] },
    angles: [
      { keyframe: 'end', segment: 'upperArm', reference: 'vertical', value: 15, label: 'Локоть', text: 'назад вдоль корпуса' },
      { keyframe: 'end', segment: 'torso', reference: 'vertical', value: 5, label: 'Корпус', text: 'без скручивания' },
    ],
  },
  {
    exerciseId: 'wide_cable_row', view: 'side', rig: 'seated', base: 0, equipment: 'cable', hold: 'hands',
    props: [{ kind: 'bench', under: 'hips' }, { kind: 'platform' }, { kind: 'pulley', dx: 70, y: 140 }],
    keyframes: [
      { name: 'start', joints: { spine: 10, hip: 70, knee: -30, shoulderL: 90, elbowL: 0, shoulderR: 90, elbowR: 0 } },
      { name: 'end', joints: { spine: -5, hip: 70, knee: -30, shoulderL: -10, elbowL: 110, shoulderR: -10, elbowR: 110 } },
    ],
    tempo: T_RAISE, concentric: 'up', direction: 'up',
    highlight: { primary: ['upper_back', 'rear_delt'], secondary: ['lats', 'biceps'] },
    angles: [
      { keyframe: 'end', segment: 'upperArm', reference: 'vertical', value: 25, label: 'Локти', text: 'в стороны под 60–70°' },
      { keyframe: 'end', segment: 'torso', reference: 'vertical', value: 5, label: 'Корпус', text: 'без отклонения назад' },
    ],
  },
  {
    exerciseId: 'machine_lateral_raise', view: 'front', rig: 'seated', equipment: 'none',
    props: [{ kind: 'bench', under: 'hips' }],
    keyframes: [
      { name: 'start', joints: { shoulderL: 15, shoulderR: -15, elbowL: 45, elbowR: 45, ...SEAT } },
      { name: 'end', joints: { shoulderL: 85, shoulderR: -85, elbowL: 45, elbowR: 45, ...SEAT } },
    ],
    tempo: T_RAISE, concentric: 'up', direction: 'up',
    highlight: { primary: ['side_delt'], secondary: [] },
    angles: [
      { keyframe: 'end', segment: 'upperArm', reference: 'vertical', value: 85, label: 'Плечо', text: 'ведёшь локтями до уровня плеч' },
      { keyframe: 'end', segment: 'upperArm', reference: 'horizontal', value: 0, label: 'Уровень плеч', warn: 'Плечи не тянуть к ушам' },
    ],
  },
  {
    exerciseId: 'bent_over_rear_delt_raise', view: 'side', rig: 'standing', equipment: 'dumbbell', hold: 'hands',
    keyframes: [
      { name: 'start', joints: { ankle: 5, knee: -15, hip: 85, shoulderL: 75, elbowL: 15, shoulderR: 75, elbowR: 15 } },
      { name: 'end', joints: { ankle: 5, knee: -15, hip: 85, shoulderL: 0, elbowL: 15, shoulderR: 0, elbowR: 15 } },
    ],
    tempo: T_RAISE, concentric: 'up', direction: 'up',
    highlight: { primary: ['rear_delt'], secondary: ['upper_back'] },
    angles: [
      { keyframe: 'end', segment: 'torso', reference: 'horizontal', value: 15, label: 'Корпус', text: '≈ параллельно полу, спина ровная' },
      { keyframe: 'end', segment: 'upperArm', reference: 'horizontal', value: 15, label: 'Руки', text: 'до уровня спины, слегка согнуты' },
    ],
  },
  {
    exerciseId: 'rope_hammer_curl', view: 'side', rig: 'standing', equipment: 'cable', hold: 'hands',
    props: [{ kind: 'pulley', dx: 16, y: 184 }],
    keyframes: [
      { name: 'start', joints: { ...STAND, shoulderL: 2, elbowL: 5, shoulderR: 2, elbowR: 5 } },
      { name: 'end', joints: { ...STAND, shoulderL: 6, elbowL: 135, shoulderR: 6, elbowR: 135 } },
    ],
    tempo: T_RAISE, concentric: 'up', direction: 'up',
    highlight: { primary: ['biceps'], secondary: [] },
    angles: [{ keyframe: 'end', segment: 'upperArm', reference: 'vertical', value: 5, label: 'Плечо', text: '≈ вертикально, локти у корпуса' }],
  },
  {
    exerciseId: 'incline_db_curl', view: 'side', rig: 'lying', base: 320, equipment: 'dumbbell', hold: 'hands',
    props: [{ kind: 'incline', angle: 320 }],
    keyframes: [
      { name: 'start', joints: { hip: 30, knee: -70, shoulderL: 320, elbowL: 0, shoulderR: 320, elbowR: 0 } },
      { name: 'end', joints: { hip: 30, knee: -70, shoulderL: 320, elbowL: 130, shoulderR: 320, elbowR: 130 } },
    ],
    tempo: T_RAISE, concentric: 'up', direction: 'up',
    highlight: { primary: ['biceps'], secondary: [] },
    angles: [
      { keyframe: 'start', segment: 'upperArm', reference: 'vertical', value: 0, label: 'Руки', text: 'висят вертикально' },
      { keyframe: 'end', segment: 'torso', reference: 'along', value: 0, label: 'Плечи на спинке 45–60°' },
    ],
  },
  {
    exerciseId: 'straight_bar_pushdown', view: 'side', rig: 'standing', equipment: 'cable', hold: 'hands',
    props: [{ kind: 'pulley', dx: 14, y: 6 }],
    keyframes: [
      { name: 'start', joints: { ankle: 0, knee: -8, hip: 18, shoulderL: 8, elbowL: 95, shoulderR: 8, elbowR: 95 } },
      { name: 'end', joints: { ankle: 0, knee: -8, hip: 18, shoulderL: 12, elbowL: 5, shoulderR: 12, elbowR: 5 } },
    ],
    tempo: T_PULL_DOWN, concentric: 'down', direction: 'down',
    highlight: { primary: ['triceps'], secondary: [] },
    angles: [
      { keyframe: 'end', segment: 'upperArm', reference: 'vertical', value: 5, label: 'Плечо', text: '≈ вертикально, локти у боков' },
      { keyframe: 'start', segment: 'forearm', reference: 'horizontal', value: 0, label: 'Вверху', text: 'локоть ~90°' },
    ],
  },
  {
    exerciseId: 'captains_chair_knee_raise', view: 'side', rig: 'seated', base: 0, equipment: 'none',
    props: [{ kind: 'incline', angle: 0, seat: false, fixed: true }],
    keyframes: [
      { name: 'start', joints: { hip: 0, knee: 0, shoulderL: 0, elbowL: 90, shoulderR: 0, elbowR: 90 } },
      { name: 'end', joints: { hip: 110, knee: -110, shoulderL: 0, elbowL: 90, shoulderR: 0, elbowR: 90 } },
    ],
    tempo: T_RAISE, concentric: 'up', direction: 'up',
    highlight: { primary: ['abs'], secondary: [] },
    angles: [
      { keyframe: 'end', segment: 'thigh', reference: 'horizontal', value: 20, label: 'Бёдра', text: 'выше параллели, таз подкручен' },
      { keyframe: 'end', segment: 'torso', reference: 'along', value: 0, label: 'Спина прижата к спинке' },
    ],
  },

  // ---------- Тренировка C ----------
  {
    exerciseId: 'hack_squat', view: 'side', rig: 'standing', equipment: 'none',
    props: [{ kind: 'incline', angle: -20, seat: false, fixed: true }],
    keyframes: [
      { name: 'start', joints: { ankle: 0, knee: -5, hip: -15, shoulderL: 30, elbowL: 120, shoulderR: 30, elbowR: 120 } },
      { name: 'end', joints: { ankle: 25, knee: -100, hip: 55, shoulderL: 30, elbowL: 120, shoulderR: 30, elbowR: 120 } },
    ],
    tempo: T_SQUAT, concentric: 'up', direction: 'down',
    highlight: { primary: ['quads'], secondary: ['glutes'] },
    angles: [
      { keyframe: 'end', segment: 'thigh', reference: 'horizontal', value: 5, label: 'Бедро', text: '≈ параллельно или ниже' },
      { keyframe: 'end', segment: 'torso', reference: 'along', value: 0, label: 'Таз и спина на спинке' },
    ],
  },
  {
    exerciseId: 'smith_squat', view: 'side', rig: 'standing', equipment: 'barbell', hold: 'back',
    keyframes: [
      { name: 'start', joints: { ankle: 0, knee: -5, hip: 5, shoulderL: -35, elbowL: 160, shoulderR: -35, elbowR: 160 } },
      { name: 'end', joints: { ankle: -5, knee: -100, hip: 105, shoulderL: -35, elbowL: 160, shoulderR: -35, elbowR: 160 } },
    ],
    tempo: T_SQUAT, concentric: 'up', direction: 'down',
    highlight: { primary: ['quads', 'glutes'], secondary: ['hamstrings'] },
    angles: [
      { keyframe: 'end', segment: 'torso', reference: 'vertical', value: 0, label: 'Корпус', text: '≈ вертикально, ступни впереди грифа' },
      { keyframe: 'end', segment: 'thigh', reference: 'horizontal', value: 5, label: 'Бедро', text: '≈ параллельно' },
    ],
  },
  {
    exerciseId: 'machine_chest_press', view: 'side', rig: 'seated', base: 0, equipment: 'none',
    props: [{ kind: 'bench', under: 'hips' }, { kind: 'incline', angle: 0, seat: false }],
    keyframes: [
      { name: 'start', joints: { ...SEAT, shoulderL: -20, elbowL: 110, shoulderR: -20, elbowR: 110 } },
      { name: 'end', joints: { ...SEAT, shoulderL: 90, elbowL: 0, shoulderR: 90, elbowR: 0 } },
    ],
    tempo: T_PRESS, concentric: 'up', direction: 'up',
    highlight: { primary: ['chest'], secondary: ['triceps', 'front_delt'] },
    angles: [
      { keyframe: 'start', segment: 'upperArm', reference: 'vertical', value: 20, label: 'Локти', text: 'назад, лопатки сведены' },
      { keyframe: 'end', segment: 'forearm', reference: 'horizontal', value: 0, label: 'Руки', text: 'вперёд, локти не блокировать' },
    ],
  },
  {
    exerciseId: 'dip', view: 'side', rig: 'seated', base: 10, equipment: 'none', anchor: 'wrist', noFloor: true,
    props: [{ kind: 'handles' }],
    keyframes: [
      { name: 'start', joints: { spine: 0, hip: 0, knee: -60, shoulderL: 0, elbowL: 0, shoulderR: 0, elbowR: 0 } },
      { name: 'end', joints: { spine: 15, hip: 0, knee: -60, shoulderL: -65, elbowL: 90, shoulderR: -65, elbowR: 90 } },
    ],
    tempo: T_SQUAT, concentric: 'up', direction: 'down',
    highlight: { primary: ['chest', 'triceps'], secondary: ['front_delt'] },
    angles: [
      { keyframe: 'end', segment: 'forearm', reference: 'vertical', value: 0, label: 'Предплечья', text: '≈ вертикально' },
      { keyframe: 'end', segment: 'upperArm', reference: 'horizontal', value: 0, label: 'Плечо', text: 'локоть ~90°, не глубже' },
    ],
  },
  {
    exerciseId: 'dip_assisted', view: 'side', rig: 'seated', base: 10, equipment: 'none', anchor: 'wrist', noFloor: true,
    props: [{ kind: 'handles' }, { kind: 'kneePad', under: true }],
    keyframes: [
      { name: 'start', joints: { spine: 0, hip: 100, knee: -90, shoulderL: 0, elbowL: 0, shoulderR: 0, elbowR: 0 } },
      { name: 'end', joints: { spine: 15, hip: 100, knee: -90, shoulderL: -65, elbowL: 90, shoulderR: -65, elbowR: 90 } },
    ],
    tempo: T_SQUAT, concentric: 'up', direction: 'down',
    highlight: { primary: ['chest', 'triceps'], secondary: ['front_delt'] },
    angles: [
      { keyframe: 'end', segment: 'forearm', reference: 'vertical', value: 0, label: 'Предплечья', text: '≈ вертикально' },
      { keyframe: 'end', segment: 'upperArm', reference: 'horizontal', value: 0, label: 'Плечо', text: 'локоть ~90°, без толчка коленями' },
    ],
  },
  {
    exerciseId: 'chinup_assisted', view: 'side', rig: 'hanging', base: 0, equipment: 'none', hold: 'hands',
    props: [{ kind: 'bar' }, { kind: 'kneePad', under: true }],
    keyframes: [
      { name: 'start', joints: { hip: 100, knee: -90, shoulderL: 178, elbowL: 0, shoulderR: 178, elbowR: 0 } },
      { name: 'end', joints: { hip: 100, knee: -90, shoulderL: 35, elbowL: 150, shoulderR: 35, elbowR: 150 } },
    ],
    tempo: T_RAISE, concentric: 'up', direction: 'up',
    highlight: { primary: ['lats', 'biceps'], secondary: ['upper_back'] },
    angles: [
      { keyframe: 'end', segment: 'forearm', reference: 'horizontal', value: 0, label: 'Грудь к перекладине' },
      { keyframe: 'start', segment: 'upperArm', reference: 'vertical', value: 2, label: 'Внизу', text: 'руки прямые, хват снизу' },
    ],
  },
  {
    exerciseId: 'neutral_pulldown', view: 'side', rig: 'seated', base: 0, equipment: 'cable', hold: 'hands',
    props: [{ kind: 'bench', under: 'hips' }, { kind: 'kneePad' }, { kind: 'pulley', dx: 4, y: 6 }],
    keyframes: [
      { name: 'start', joints: { spine: -5, ...SEAT, shoulderL: 172, elbowL: 0, shoulderR: 172, elbowR: 0 } },
      { name: 'end', joints: { spine: -15, ...SEAT, shoulderL: -15, elbowL: 150, shoulderR: -15, elbowR: 150 } },
    ],
    tempo: T_PULL_DOWN, concentric: 'down', direction: 'down',
    highlight: { primary: ['lats'], secondary: ['biceps', 'upper_back'] },
    angles: [
      { keyframe: 'end', segment: 'torso', reference: 'vertical', value: 15, label: 'Отклон корпуса' },
      { keyframe: 'end', segment: 'upperArm', reference: 'vertical', value: 15, label: 'Локти', text: 'к рёбрам' },
    ],
  },
  {
    exerciseId: 'lying_leg_curl', view: 'side', rig: 'lying', base: 90, equipment: 'none',
    props: [{ kind: 'bench', under: 'torso', fixed: true }],
    keyframes: [
      { name: 'start', joints: { hip: 0, knee: 0, shoulderL: 100, elbowL: 60, shoulderR: 100, elbowR: 60 } },
      { name: 'end', joints: { hip: 0, knee: -110, shoulderL: 100, elbowL: 60, shoulderR: 100, elbowR: 60 } },
    ],
    tempo: T_RAISE, concentric: 'up', direction: 'up',
    highlight: { primary: ['hamstrings'], secondary: ['calves'] },
    angles: [
      { keyframe: 'end', segment: 'shin', reference: 'vertical', value: 20, label: 'Голень', text: 'к ягодицам, таз прижат' },
      { keyframe: 'start', segment: 'thigh', reference: 'along', value: 0, label: 'Колени за краем скамьи' },
    ],
  },
  {
    exerciseId: 'seated_leg_curl', view: 'side', rig: 'seated', base: 0, equipment: 'none',
    props: [{ kind: 'bench', under: 'hips' }, { kind: 'incline', angle: 0, seat: false }],
    keyframes: [
      { name: 'start', joints: { hip: 90, knee: -10, shoulderL: 0, elbowL: 30, shoulderR: 0, elbowR: 30 } },
      { name: 'end', joints: { hip: 90, knee: -100, shoulderL: 0, elbowL: 30, shoulderR: 0, elbowR: 30 } },
    ],
    tempo: T_PULL_DOWN, concentric: 'down', direction: 'down',
    highlight: { primary: ['hamstrings'], secondary: ['calves'] },
    angles: [
      { keyframe: 'end', segment: 'shin', reference: 'vertical', value: 10, label: 'Голень', text: 'до упора вниз, пауза 1 с' },
      { keyframe: 'start', segment: 'thigh', reference: 'along', value: 0, label: 'Бёдра прижаты валиком' },
    ],
  },
  {
    exerciseId: 'leg_extension', view: 'side', rig: 'seated', base: 0, equipment: 'none',
    props: [{ kind: 'bench', under: 'hips' }, { kind: 'incline', angle: 0, seat: false }],
    keyframes: [
      { name: 'start', joints: { ...SEAT, shoulderL: 0, elbowL: 30, shoulderR: 0, elbowR: 30 } },
      { name: 'end', joints: { hip: 90, knee: -5, shoulderL: 0, elbowL: 30, shoulderR: 0, elbowR: 30 } },
    ],
    tempo: T_RAISE, concentric: 'up', direction: 'up',
    highlight: { primary: ['quads'], secondary: [] },
    angles: [
      { keyframe: 'end', segment: 'shin', reference: 'horizontal', value: 5, label: 'Голень', text: 'до прямых ног, пауза 1 с' },
      { keyframe: 'end', segment: 'thigh', reference: 'along', value: 0, label: 'Колено напротив оси, таз на сиденье' },
    ],
  },
  {
    exerciseId: 'prone_rear_delt_raise', view: 'side', rig: 'lying', base: 60, equipment: 'dumbbell', hold: 'hands',
    props: [{ kind: 'incline', angle: 60, front: true, seat: false }],
    keyframes: [
      { name: 'start', joints: { ...PRONE_LEGS(60), shoulderL: 60, elbowL: 10, shoulderR: 60, elbowR: 10 } },
      { name: 'end', joints: { ...PRONE_LEGS(60), shoulderL: -30, elbowL: 10, shoulderR: -30, elbowR: 10 } },
    ],
    tempo: T_RAISE, concentric: 'up', direction: 'up',
    highlight: { primary: ['rear_delt'], secondary: ['upper_back'] },
    angles: [
      { keyframe: 'end', segment: 'upperArm', reference: 'horizontal', value: 0, label: 'Руки', text: 'до уровня плеч, почти прямые' },
      { keyframe: 'end', segment: 'torso', reference: 'along', value: 0, label: 'Грудь на спинке 30°' },
    ],
  },
  {
    exerciseId: 'cable_rear_delt_fly', view: 'side', rig: 'standing', equipment: 'cable', hold: 'hands',
    props: [{ kind: 'pulley', dx: 40, y: 30 }],
    keyframes: [
      { name: 'start', joints: { ankle: 3, knee: -10, hip: 10, shoulderL: 95, elbowL: 10, shoulderR: 95, elbowR: 10 } },
      { name: 'end', joints: { ankle: 3, knee: -10, hip: 10, shoulderL: -75, elbowL: 10, shoulderR: -75, elbowR: 10 } },
    ],
    tempo: T_RAISE, concentric: 'up', direction: 'up',
    highlight: { primary: ['rear_delt'], secondary: ['upper_back'] },
    angles: [
      { keyframe: 'end', segment: 'upperArm', reference: 'horizontal', value: 10, label: 'Руки', text: 'назад и в стороны, почти прямые' },
      { keyframe: 'end', segment: 'torso', reference: 'vertical', value: 3, label: 'Корпус', text: 'неподвижен' },
    ],
  },
  {
    exerciseId: 'spider_curl', view: 'side', rig: 'lying', base: 45, equipment: 'dumbbell', hold: 'hands',
    props: [{ kind: 'incline', angle: 45, front: true, seat: false }],
    keyframes: [
      { name: 'start', joints: { ...PRONE_LEGS(45), shoulderL: 45, elbowL: 0, shoulderR: 45, elbowR: 0 } },
      { name: 'end', joints: { ...PRONE_LEGS(45), shoulderL: 45, elbowL: 130, shoulderR: 45, elbowR: 130 } },
    ],
    tempo: T_RAISE, concentric: 'up', direction: 'up',
    highlight: { primary: ['biceps'], secondary: [] },
    angles: [
      { keyframe: 'start', segment: 'upperArm', reference: 'vertical', value: 0, label: 'Руки', text: 'висят вертикально' },
      { keyframe: 'end', segment: 'torso', reference: 'along', value: 0, label: 'Плечи неподвижны, грудь на скамье 45°' },
    ],
  },
  {
    exerciseId: 'ez_skullcrusher', view: 'side', rig: 'lying', base: 270, equipment: 'barbell', hold: 'hands',
    props: [{ kind: 'bench', under: 'torso' }],
    keyframes: [
      { name: 'start', joints: { hip: -15, knee: -80, shoulderL: 90, elbowL: 0, shoulderR: 90, elbowR: 0 } },
      { name: 'end', joints: { hip: -15, knee: -80, shoulderL: 95, elbowL: 110, shoulderR: 95, elbowR: 110 } },
    ],
    tempo: T_SQUAT, concentric: 'up', direction: 'down',
    highlight: { primary: ['triceps'], secondary: [] },
    angles: [
      { keyframe: 'start', segment: 'upperArm', reference: 'vertical', value: 0, label: 'Руки', text: '≈ вертикально над плечами' },
      { keyframe: 'end', segment: 'upperArm', reference: 'vertical', value: 5, label: 'Локти', text: 'смотрят в потолок, не разъезжаются' },
    ],
  },
  {
    exerciseId: 'reverse_grip_pushdown', view: 'side', rig: 'standing', equipment: 'cable', hold: 'hands',
    props: [{ kind: 'pulley', dx: 14, y: 6 }],
    keyframes: [
      { name: 'start', joints: { ankle: 0, knee: -8, hip: 18, shoulderL: 0, elbowL: 10, shoulderR: 8, elbowR: 95 } },
      { name: 'end', joints: { ankle: 0, knee: -8, hip: 18, shoulderL: 0, elbowL: 10, shoulderR: 12, elbowR: 5 } },
    ],
    tempo: T_PULL_DOWN, concentric: 'down', direction: 'down',
    highlight: { primary: ['triceps'], secondary: [] },
    angles: [
      { keyframe: 'end', segment: 'upperArm', reference: 'vertical', value: 5, label: 'Плечо', text: 'локоть прижат к боку' },
      { keyframe: 'start', segment: 'forearm', reference: 'horizontal', value: 0, label: 'Вверху', text: 'локоть ~90°' },
    ],
  },
  {
    exerciseId: 'seated_calf_raise', view: 'side', rig: 'seated', base: 0, equipment: 'none', anchor: 'toe',
    props: [{ kind: 'bench', under: 'hips', fixed: true }, { kind: 'kneePad' }, { kind: 'platform' }],
    keyframes: [
      { name: 'start', joints: { ...SEAT, foot: 0, shoulderL: 20, elbowL: 90, shoulderR: 20, elbowR: 90 } },
      { name: 'end', joints: { ...SEAT, foot: 30, shoulderL: 20, elbowL: 90, shoulderR: 20, elbowR: 90 } },
    ],
    tempo: { down: 2, pause: 1, up: 1, rest: 0.6 }, concentric: 'up', direction: 'up',
    highlight: { primary: ['calves'], secondary: [] },
    angles: [
      { keyframe: 'end', segment: 'shin', reference: 'vertical', value: 0, label: 'Голени', text: 'вертикально, пятки вверх до упора' },
      { keyframe: 'start', segment: 'thigh', reference: 'along', value: 0, label: 'Валик на бёдрах у колен, пауза внизу' },
    ],
  },
];
