// Области мышц для анимации упражнений (SPEC 6.7.2): светятся под гладкой кожей манекена
// (src/data/skin.ts). Раньше были отдельными пластинами с зазором, теперь — только подсветка.
//
// Вид сбоку — свои пластины. Каждая задана в системе своего сегмента: s — вдоль сегмента от
// проксимального сустава (px ≈ см), w — поперёк, «+» — передняя сторона тела.
// Вид спереди — полигоны карты мышц (src/data/muscleMap.ts) с поворотом рук вокруг суставов.

import type { Muscle } from '../db/types';
import type { MapSlug } from './muscleMap';

export type SideSegment = 'thigh' | 'shin' | 'foot' | 'pelvis' | 'torso' | 'neck' | 'upperArm' | 'forearm';

/** idle — мышца без подсветки, neutral — голова, кисти, стопы, надколенник (как голова и колени на карте). */
export type PlateTone = 'idle' | 'neutral';

export interface SidePlate {
  id: string;
  seg: SideSegment;
  tone: PlateTone;
  muscle?: Muscle;
  /** [s, w] — вершины. */
  pts: [number, number][];
}

/**
 * Утолщение поперёк сегмента: в реальных пропорциях фигура сбоку читается как палки,
 * иллюстрации к упражнениям всегда чуть утрируют мышцы. Голову и стопу не трогаем.
 */
export const SIDE_WIDTH: Record<SideSegment, number> = {
  thigh: 1.38, shin: 1.32, foot: 1, pelvis: 1.28, torso: 1.28, neck: 1.15, upperArm: 1.5, forearm: 1.38,
};

/** Круг вершинами — заполняет сустав под пластинами, чтобы при сгибании не было дырки. */
export function circlePlate(id: string, seg: SideSegment, s: number, w: number, r: number): SidePlate {
  const pts: [number, number][] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    pts.push([s + Math.cos(a) * r, w + Math.sin(a) * r]);
  }
  return { id, seg, tone: 'idle', pts };
}

/** Нога: бедро 48, голень 46; от сустава вниз. Порядок — снизу вверх по слоям. */
export const LEG_PLATES: SidePlate[] = [
  circlePlate('knee-fill', 'thigh', 48, 0, 5.4),
  circlePlate('ankle-fill', 'shin', 46, 0, 3.4),
  {
    id: 'foot', seg: 'foot', tone: 'neutral',
    pts: [[-3, 3], [-6, 0.5], [-6.5, -2.5], [-5, -4], [3, -4.2], [12, -4], [17.5, -3.4], [18.5, -1.8], [15, -0.6], [8, 0.8], [3, 2.6]],
  },
  { id: 'tibialis', seg: 'shin', tone: 'idle', pts: [[3.5, 0.2], [3, 4.3], [12, 4.2], [24, 3.5], [34, 2.9], [42, 2.6], [43.5, 0.2]] },
  { id: 'calf', seg: 'shin', tone: 'idle', muscle: 'calves', pts: [[3.5, -0.2], [3, -5], [8, -7.4], [14, -8.2], [21, -7], [27.5, -4.6], [24, -0.2]] },
  { id: 'soleus', seg: 'shin', tone: 'idle', muscle: 'calves', pts: [[24, -0.2], [27.5, -4.6], [34, -3.9], [41, -3], [43.5, -0.2]] },
  {
    id: 'hamstrings', seg: 'thigh', tone: 'idle', muscle: 'hamstrings',
    pts: [[9, -0.2], [9, -8], [18, -8.4], [28, -7.9], [37, -6.6], [44, -5.2], [47.5, -2.6], [47, -0.2]],
  },
  { id: 'quads', seg: 'thigh', tone: 'idle', muscle: 'quads', pts: [[3, 0.2], [4, 7.8], [12, 9.2], [24, 9.3], [34, 8.2], [41, 6.6], [44.5, 4.4], [44, 0.2]] },
  { id: 'kneecap', seg: 'thigh', tone: 'neutral', pts: [[43.5, 0.8], [43.5, 4.6], [46, 6.2], [49.5, 5.6], [51, 3.2], [49.5, 0.8]] },
];

/** Таз: от тазобедренного сустава, «вверх» — к корпусу. */
export const PELVIS_PLATES: SidePlate[] = [
  { id: 'hip-side', seg: 'pelvis', tone: 'idle', pts: [[-8, -2.2], [-4, -2.4], [4, -2.6], [11, -3.2], [11, 2.2], [4, 1.6], [-5, 2.2], [-8, 0]] },
  { id: 'hip-front', seg: 'pelvis', tone: 'idle', pts: [[-5, 2.4], [-4, 8.8], [2, 10], [8, 10.2], [11, 6], [11, 2.4], [4, 1.8]] },
  {
    id: 'glutes', seg: 'pelvis', tone: 'idle', muscle: 'glutes',
    pts: [[-11, -4], [-9, -10], [-4, -12.6], [3, -12.8], [9, -11], [12, -7.5], [11, -3.4], [4, -2.6], [-4, -2.4]],
  },
];

/** Корпус: от тазобедренного сустава до плечевого (56) и чуть выше — основание шеи. */
export const TORSO_PLATES: SidePlate[] = [
  { id: 'lower-back', seg: 'torso', tone: 'idle', muscle: 'lower_back', pts: [[9, -3.8], [9, -9.6], [18, -9.3], [27, -9.6], [27, -3.9]] },
  { id: 'obliques', seg: 'torso', tone: 'idle', muscle: 'abs', pts: [[11, -3.6], [11, 4], [36, 4.4], [33, -0.8], [26, -3.8]] },
  { id: 'abs', seg: 'torso', tone: 'idle', muscle: 'abs', pts: [[11, 4.2], [11, 10.3], [20, 10], [28, 10.4], [35, 11.2], [36, 4.6]] },
  { id: 'lats', seg: 'torso', tone: 'idle', muscle: 'lats', pts: [[27, -3.7], [27, -9.7], [36, -10.4], [44, -10.8], [47, -8], [46, -2.6], [40, 0.6], [33, -0.6]] },
  { id: 'serratus', seg: 'torso', tone: 'idle', pts: [[33, -0.4], [40, 0.8], [46, -2.4], [47, 3.6], [42, 4.6], [36, 4.6]] },
  {
    id: 'chest', seg: 'torso', tone: 'idle', muscle: 'chest',
    pts: [[36.5, 4.8], [36, 11.4], [41, 12], [47, 12.2], [52, 10.6], [54.5, 7.6], [52, 4.4], [47, 3.8], [42, 4.8]],
  },
  {
    id: 'upper-back', seg: 'torso', tone: 'idle', muscle: 'upper_back',
    pts: [[47.2, -8.2], [44.5, -10.9], [50, -11], [56, -10], [61, -7.2], [63, -4.4], [60, -2.4], [54, -2.5], [48, -2.8]],
  },
  {
    id: 'shoulder-top', seg: 'torso', tone: 'idle',
    pts: [[52.2, 4.2], [54.8, 7.6], [58, 6.2], [61.5, 4.4], [63, 1.4], [63, -4.2], [60, -2.2], [54, -2.3], [48, -2.6], [47.3, 3.6]],
  },
];

/** Шея и голова: от плечевого сустава к голове, центр головы — 17. */
export const HEAD_PLATES: SidePlate[] = [
  { id: 'neck', seg: 'neck', tone: 'idle', pts: [[3, 4.4], [9.5, 4.2], [11.5, 3.6], [12, -3.4], [9, -4.6], [3, -5.2]] },
  {
    id: 'head', seg: 'neck', tone: 'neutral',
    pts: [
      [8.5, 3.8], [8.8, 6.8], [11.6, 8.9], [14.5, 9.6], [16.6, 10.7], [18.6, 9.7], [21.6, 9.6], [25, 7.6], [27.2, 3.6],
      [27.8, -0.8], [26.6, -5.6], [23.6, -8.8], [19.4, -10.2], [14.8, -9.4], [11.6, -6.8], [10.2, -3.6], [9.6, 0.4],
    ],
  },
];

/** Рука: плечо 28, предплечье 26; от сустава к кисти. Дельты — сверху, на стыке с корпусом. */
export const ARM_PLATES: SidePlate[] = [
  circlePlate('elbow-fill', 'forearm', 0, 0, 4),
  { id: 'extensors', seg: 'forearm', tone: 'idle', pts: [[-1.5, -0.4], [-3, -3.4], [1, -4.3], [8, -4], [16, -3], [25, -2.3], [25.5, -0.3]] },
  { id: 'flexors', seg: 'forearm', tone: 'idle', pts: [[-1.5, 0.4], [-1, 4], [4, 4.6], [10, 4], [17, 3], [25, 2.3], [25.5, 0.3]] },
  { id: 'hand', seg: 'forearm', tone: 'neutral', pts: [[24.5, 2.5], [28, 3], [32, 2.6], [35, 1.2], [35.5, -0.8], [33, -2.4], [28, -2.9], [24.5, -2.5]] },
  { id: 'triceps', seg: 'upperArm', tone: 'idle', muscle: 'triceps', pts: [[11, -0.8], [10, -5.6], [15, -6], [21, -5.4], [26, -4], [29, -2.4], [28.5, -0.7], [20, -0.6]] },
  { id: 'biceps', seg: 'upperArm', tone: 'idle', muscle: 'biceps', pts: [[13, 1], [12, 4.4], [16, 5], [21, 4.9], [25.5, 3.8], [28.5, 2.2], [28, 0.6], [20, 0.6]] },
  {
    id: 'delt-rear', seg: 'upperArm', tone: 'idle', muscle: 'rear_delt',
    pts: [[-5.5, -6], [-6.5, -2.3], [0, -2.4], [6, -2.4], [13, -2], [11.5, -4.4], [6, -6.4], [0, -6.9]],
  },
  {
    id: 'delt-front', seg: 'upperArm', tone: 'idle', muscle: 'front_delt',
    pts: [[-4.5, 2.2], [-3.5, 5], [1, 6.4], [6.5, 6.1], [11.5, 4.3], [14, 2.6], [7, 2.2], [1, 2.1]],
  },
  {
    id: 'delt-side', seg: 'upperArm', tone: 'idle', muscle: 'side_delt',
    pts: [[-6.5, -2.1], [-6.8, 0.4], [-4.5, 2.1], [1, 2], [7, 2.1], [14, 2.5], [16, 0.4], [13, -1.8], [6, -2.2], [0, -2.2]],
  },
];

// ---------- Вид спереди: карта мышц ----------

/** Наши мышцы → слаги карты. Трапеция подсвечивается вместе с верхом спины. */
export const MUSCLE_SLUGS: Record<Muscle, MapSlug[]> = {
  chest: ['chest'],
  front_delt: ['front-deltoids'],
  side_delt: ['front-deltoids', 'back-deltoids'],
  rear_delt: ['back-deltoids'],
  lats: ['upper-back'],
  upper_back: ['upper-back', 'trapezius', 'neck'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  abs: ['abs', 'obliques'],
  lower_back: ['lower-back'],
  glutes: ['gluteal'],
  quads: ['quadriceps'],
  hamstrings: ['hamstring'],
  calves: ['calves', 'left-soleus', 'right-soleus'],
  // Этап 5b: зоны 3D-двойника; на плоской карте — свои полигоны.
  traps: ['trapezius', 'neck'],
  forearms: ['forearm'],
  obliques: ['obliques'],
  adductors: ['adductor'],
};

export interface MapPt {
  x: number;
  y: number;
}

/** Суставы фигуры карты (viewBox 0 0 100 220). L — левая рука человека, на экране справа. */
export const MAP_SKELETON = {
  head: { x: 49.6, y: 12.6 },
  neck: { x: 50, y: 27 },
  pelvis: { x: 50, y: 100 },
  shoulderL: { x: 75, y: 44 },
  elbowL: { x: 80, y: 72 },
  wristL: { x: 96, y: 100 },
  hipL: { x: 61, y: 99 },
  kneeL: { x: 68, y: 149 },
  ankleL: { x: 74.5, y: 195 },
} as const;

/** Отведение рук на карте в покое: плечо 10°, предплечье 30° от вертикали. */
export const MAP_REST = { upperArm: 10, forearm: 30 };

export type MapPart = 'torso' | 'delt' | 'upperArm' | 'forearm' | 'thigh' | 'shin';

/** К какому сегменту относится полигон карты. Сторона — по x центра (больше 50 — левая). */
export const MAP_PARTS: Record<MapSlug, MapPart> = {
  chest: 'torso', obliques: 'torso', abs: 'torso', neck: 'torso', head: 'torso', trapezius: 'torso',
  'upper-back': 'torso', 'lower-back': 'torso', gluteal: 'torso', anterior: 'torso', posterior: 'torso',
  'front-deltoids': 'delt', 'back-deltoids': 'delt',
  biceps: 'upperArm', triceps: 'upperArm',
  forearm: 'forearm',
  abductors: 'thigh', adductor: 'thigh', quadriceps: 'thigh', hamstring: 'thigh',
  knees: 'shin', calves: 'shin', 'left-soleus': 'shin', 'right-soleus': 'shin',
};

/** Стопа под голенью карты (у карты стоп нет) — левая; правая зеркальна. */
export const MAP_FOOT_L: [number, number][] = [[68, 194], [77, 194], [79.5, 199], [78.5, 203.5], [72, 204.5], [66.5, 203], [66.5, 198]];
/** Кисть: вдоль предплечья от запястья (s) и поперёк (w), как у вида сбоку. */
export const MAP_HAND: [number, number][] = [[-1, 3], [4, 3.6], [8.5, 2.8], [11, 0.8], [10.5, -1.6], [7, -3.2], [2, -3.4], [-1, -2.8]];
