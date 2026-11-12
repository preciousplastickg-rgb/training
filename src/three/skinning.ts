// Скиннинг двойника — docs/TWIN-3D.md, 4.1 и раздел 2 «Скиннинг и морфы». Морфы — до скиннинга, скиннинг в два шага:
//
// 1. Пропорции по обхватам — линейно в позе связывания: v₁ = Σ wⱼ · Pⱼ · v, Pᵢ = Bᵢ · Sᵢ · Bᵢ⁻¹, где Bᵢ⁻¹ — обратная
//    матрица связывания кости (skeleton.boneInverses), Sᵢ — масштаб кожи поперёк кости (и вдоль у ключицы).
//    У костей без масштаба Pᵢ единичная. В шейдере — стандартные чанки three.js с матрицами Pᵢ в boneMatrices.
// 2. Поза — двойными кватернионами (DQS, Preserve Volume в Blender): v₂ = DQS(v₁). Пара (поворот r, двойная часть d)
//    на кость из bindMatrixInverse · bone.matrixWorld · boneInverse · bindMatrix, масштаб отбрасывается.
//
// В позе связывания шаг 2 единичный, поэтому пропорции — те же, что при прежнем линейном скиннинге. Эталон шага 2 —
// DQS_GLSL, updateDQ() и __viewerVerts в exercise-anim/viewer/main.js; шейдер — DQS_GLSL ниже, расчёт на CPU — skinVertex().

import * as THREE from 'three';
import type { TwinShape } from '../domain/twin';

/**
 * Пропорции двойника по обхватам (TWIN-3D 4.1): кости, кожу вокруг которых утолщает множитель части тела, и доля
 * множителя. Утолщение — поперёк кости (локальные x и z, кость идёт по y): суставы на месте, руки остаются на снарядах.
 */
export const SHAPE_BONES: Record<keyof TwinShape, readonly (readonly [string, number])[]> = {
  neck: [['neck01', 1], ['neck02', 1], ['neck03', 0.6]],
  shoulders: [
    ['shoulder01.L', 1], ['shoulder01.R', 1], ['upperarm01.L', 0.6], ['upperarm01.R', 0.6],
    ['clavicle.L', 0.5], ['clavicle.R', 0.5], ['spine01', 0.6],
  ],
  wrist: [['lowerarm02.L', 1], ['lowerarm02.R', 1], ['lowerarm01.L', 0.6], ['lowerarm01.R', 0.6], ['wrist.L', 0.6], ['wrist.R', 0.6]],
  waist: [['spine04', 1], ['spine03', 0.8], ['spine05', 0.6], ['spine02', 0.35]],
};

/**
 * Ширина плеч: ключица длиннее — плечевой сустав (дочерняя кость) дальше от грудины, кожа ключицы тянется вдоль
 * кости. Ключица (10 см) — меньше половины полуширины плеч (~23 см), поэтому её длина меняется вдвое сильнее
 * обхвата. Только в покое («Сегодня», «Прогресс», профиль): в «Как делать» руки должны оставаться на снарядах.
 */
export const SHAPE_CLAVICLES = [['clavicle.L', 'shoulder01.L'], ['clavicle.R', 'shoulder01.R']] as const;
export const CLAVICLE_GAIN = 2;

/** Во сколько раз длиннее ключица по плечам (`widen` — в покое; иначе 1). */
export function clavicleLength(shape: TwinShape, widen: boolean): number {
  return widen ? 1 + CLAVICLE_GAIN * (shape.shoulders - 1) : 1;
}

/** Масштаб кожи костей по пропорциям: индекс кости → (поперёк, вдоль, поперёк). Кости без масштаба не входят. */
export function shapeScales(shape: TwinShape, boneIndex: (name: string) => number, widen: boolean): Map<number, THREE.Vector3> {
  const out = new Map<number, THREE.Vector3>();
  const at = (i: number) => {
    let v = out.get(i);
    if (!v) out.set(i, (v = new THREE.Vector3(1, 1, 1)));
    return v;
  };
  for (const part of Object.keys(SHAPE_BONES) as (keyof TwinShape)[]) {
    const f = shape[part];
    if (f === 1) continue;
    for (const [name, gain] of SHAPE_BONES[part]) {
      const i = boneIndex(name);
      if (i < 0) continue;
      const k = 1 + gain * (f - 1);
      at(i).multiply(new THREE.Vector3(k, 1, k));
    }
  }
  const len = clavicleLength(shape, widen);
  if (len !== 1) {
    for (const [c] of SHAPE_CLAVICLES) {
      const i = boneIndex(c);
      if (i >= 0) at(i).y *= len;
    }
  }
  return out;
}

const _S = new THREE.Matrix4();

/** Pᵢ = Bᵢ · Sᵢ · Bᵢ⁻¹ (bind — Bᵢ, обратная — Bᵢ⁻¹). */
export function bindScale(bind: THREE.Matrix4, boneInverse: THREE.Matrix4, s: THREE.Vector3, out = new THREE.Matrix4()): THREE.Matrix4 {
  return out.multiplyMatrices(bind, _S.makeScale(s.x, s.y, s.z)).multiply(boneInverse);
}

// ---------- двойные кватернионы ----------

const _t = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();

/** Пара кватернионов жёсткой части матрицы: r — поворот, d = ½ (t, 0) · r. Масштаб отбрасывается. */
export function dqFromMatrix(m: THREE.Matrix4, r: THREE.Vector4, d: THREE.Vector4): void {
  m.decompose(_t, _q, _s);
  const tx = _t.x, ty = _t.y, tz = _t.z, qx = _q.x, qy = _q.y, qz = _q.z, qw = _q.w;
  r.set(qx, qy, qz, qw);
  d.set(0.5 * (tx * qw + ty * qz - tz * qy), 0.5 * (ty * qw + tz * qx - tx * qz), 0.5 * (tz * qw + tx * qy - ty * qx),
    -0.5 * (tx * qx + ty * qy + tz * qz));
}

/**
 * Смесь пар 4 костей: знак каждой выравнивается по накопленной сумме (как add_weighted_dq_dq в Blender и шейдер),
 * результат нормируется. outR, outD — смесь.
 */
export function dqBlend(idx: ArrayLike<number>, w: ArrayLike<number>, R: readonly THREE.Vector4[], D: readonly THREE.Vector4[],
  outR: THREE.Vector4, outD: THREE.Vector4): void {
  outR.copy(R[idx[0]!]!).multiplyScalar(w[0]!);
  outD.copy(D[idx[0]!]!).multiplyScalar(w[0]!);
  for (let k = 1; k < 4; k++) {
    const r = R[idx[k]!]!, d = D[idx[k]!]!;
    const s = outR.dot(r) < 0 ? -w[k]! : w[k]!;
    outR.addScaledVector(r, s);
    outD.addScaledVector(d, s);
  }
  const L = outR.length();
  outR.multiplyScalar(1 / L);
  outD.multiplyScalar(1 / L);
}

/** Поворот вектора кватернионом r (нормали): v + 2 r.xyz × (r.xyz × v + r.w v). */
export function dqRotate(r: THREE.Vector4, v: THREE.Vector3): THREE.Vector3 {
  const x = v.x, y = v.y, z = v.z;
  const cx = r.y * z - r.z * y + r.w * x, cy = r.z * x - r.x * z + r.w * y, cz = r.x * y - r.y * x + r.w * z;
  return v.set(x + 2 * (r.y * cz - r.z * cy), y + 2 * (r.z * cx - r.x * cz), z + 2 * (r.x * cy - r.y * cx));
}

/** Точка парой: поворот + сдвиг 2 (r.w d.xyz − d.w r.xyz + r.xyz × d.xyz). */
export function dqApply(r: THREE.Vector4, d: THREE.Vector4, v: THREE.Vector3): THREE.Vector3 {
  dqRotate(r, v);
  return v.set(
    v.x + 2 * (r.w * d.x - d.w * r.x + (r.y * d.z - r.z * d.y)),
    v.y + 2 * (r.w * d.y - d.w * r.y + (r.z * d.x - r.x * d.z)),
    v.z + 2 * (r.w * d.z - d.w * r.z + (r.x * d.y - r.y * d.x)),
  );
}

const _v1 = new THREE.Vector3(), _acc = new THREE.Vector3(), _bR = new THREE.Vector4(), _bD = new THREE.Vector4();

/**
 * Два шага на CPU — та же математика, что в шейдере: v (после морфов, пространство сетки) → Σ wⱼ · Pⱼ · v → DQS.
 * P — матрицы шага 1 в пространстве сетки (null — единичная); R, D — пары костей. Результат — в out.
 */
export function skinVertex(v: THREE.Vector3, idx: ArrayLike<number>, w: ArrayLike<number>, P: readonly (THREE.Matrix4 | null)[],
  R: readonly THREE.Vector4[], D: readonly THREE.Vector4[], out: THREE.Vector3): THREE.Vector3 {
  _acc.set(0, 0, 0);
  for (let k = 0; k < 4; k++) {
    if (!w[k]) continue;
    const m = P[idx[k]!];
    _v1.copy(v);
    if (m) _v1.applyMatrix4(m);
    _acc.addScaledVector(_v1, w[k]!);
  }
  dqBlend(idx, w, R, D, _bR, _bD);
  return dqApply(_bR, _bD, out.copy(_acc));
}

/**
 * Шаг 2 в вершинном шейдере (подмешивается после стандартных чанков three.js, которые выполняют шаг 1):
 * head — объявления, base — после skinbase_vertex, normal — после skinnormal_vertex, position — после skinning_vertex.
 */
export function dqsGlsl(bones: number) {
  return {
    head: `uniform vec4 uDqR[${bones}];
uniform vec4 uDqD[${bones}];
vec3 dqRot(vec4 r, vec3 v) { return v + 2.0 * cross(r.xyz, cross(r.xyz, v) + r.w * v); }
`,
    base: `#ifdef USE_SKINNING
  ivec4 dqI = ivec4(skinIndex);
  vec4 bR = skinWeight.x * uDqR[dqI.x], bD = skinWeight.x * uDqD[dqI.x];
  float dqS = dot(bR, uDqR[dqI.y]) < 0.0 ? -1.0 : 1.0; bR += dqS * skinWeight.y * uDqR[dqI.y]; bD += dqS * skinWeight.y * uDqD[dqI.y];
  dqS = dot(bR, uDqR[dqI.z]) < 0.0 ? -1.0 : 1.0; bR += dqS * skinWeight.z * uDqR[dqI.z]; bD += dqS * skinWeight.z * uDqD[dqI.z];
  dqS = dot(bR, uDqR[dqI.w]) < 0.0 ? -1.0 : 1.0; bR += dqS * skinWeight.w * uDqR[dqI.w]; bD += dqS * skinWeight.w * uDqD[dqI.w];
  float dqL = length(bR); bR /= dqL; bD /= dqL;
  vec3 bT = 2.0 * (bR.w * bD.xyz - bD.w * bR.xyz + cross(bR.xyz, bD.xyz));
#endif`,
    normal: `#ifdef USE_SKINNING
  objectNormal = dqRot(bR, objectNormal);
  #ifdef USE_TANGENT
  objectTangent = dqRot(bR, objectTangent);
  #endif
#endif`,
    position: `#ifdef USE_SKINNING
  transformed = dqRot(bR, transformed) + bT;
#endif`,
  };
}
