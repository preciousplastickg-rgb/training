import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import twinGlb from '../../public/3d/twin.glb?inline';
import { SHAPE_NEUTRAL } from '../domain/twin';
import { parseGlb, readFloats } from '../test/glb';
import { bindScale, dqApply, dqBlend, dqFromMatrix, shapeScales, skinVertex } from './skinning';

// Двухшаговый скиннинг двойника — docs/TWIN-3D.md, 4.1 и раздел 2 «Скиннинг и морфы» (этап 5c).

const twin = parseGlb(twinGlb);
const skin = twin.json.skins![0]!;
const boneNames = skin.joints.map((j) => twin.json.nodes[j]!.name!);
const ibm = readFloats(twin, skin.inverseBindMatrices!);
const boneInverses = boneNames.map((_, i) => new THREE.Matrix4().fromArray(ibm, i * 16));
const binds = boneInverses.map((m) => m.clone().invert());
const boneIndex = (n: string) => boneNames.indexOf(n);
const NB = boneNames.length;

/** Пары кватернионов костей в позе связывания: мировая матрица кости = Bᵢ, поза относительно связывания единичная. */
function bindPoseDq() {
  const R = Array.from({ length: NB }, () => new THREE.Vector4());
  const D = Array.from({ length: NB }, () => new THREE.Vector4());
  const M = new THREE.Matrix4();
  for (let i = 0; i < NB; i++) dqFromMatrix(M.multiplyMatrices(binds[i]!, boneInverses[i]!), R[i]!, D[i]!);
  return { R, D };
}

function matricesP(scales: Map<number, THREE.Vector3>): (THREE.Matrix4 | null)[] {
  return Array.from({ length: NB }, (_, i) => {
    const s = scales.get(i);
    return s ? bindScale(binds[i]!, boneInverses[i]!, s) : null;
  });
}

describe('двойные кватернионы', () => {
  it('поворот 90° вокруг Y + сдвиг (1, 2, 3): пара переводит точку так же, как матрица', () => {
    const m = new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(1, 2, 3);
    const r = new THREE.Vector4(), d = new THREE.Vector4();
    dqFromMatrix(m, r, d);
    for (const p of [new THREE.Vector3(0.3, -0.7, 1.1), new THREE.Vector3(0, 0, 0), new THREE.Vector3(-2, 5, 0.5)]) {
      const want = p.clone().applyMatrix4(m);
      const got = dqApply(r, d, p.clone());
      expect(got.distanceTo(want)).toBeLessThan(1e-6);
    }
  });

  it('две пары с противоположными знаками: смешивание — как с выровненными', () => {
    const r1 = new THREE.Vector4(), d1 = new THREE.Vector4(), r2 = new THREE.Vector4(), d2 = new THREE.Vector4();
    dqFromMatrix(new THREE.Matrix4().makeRotationX(0.4).setPosition(0.1, 0.2, 0), r1, d1);
    dqFromMatrix(new THREE.Matrix4().makeRotationZ(1.1).setPosition(-0.3, 0, 0.5), r2, d2);
    const idx = [0, 1, 0, 0], w = [0.6, 0.4, 0, 0];
    const blend = (R: THREE.Vector4[], D: THREE.Vector4[]) => {
      const r = new THREE.Vector4(), d = new THREE.Vector4();
      dqBlend(idx, w, R, D, r, d);
      return dqApply(r, d, new THREE.Vector3(0.5, 1, -0.25));
    };
    const aligned = blend([r1, r2], [d1, d2]);
    const flipped = blend([r1, r2.clone().negate()], [d1, d2.clone().negate()]);
    expect(flipped.distanceTo(aligned)).toBeLessThan(1e-9);
  });
});

describe('пропорции в два шага (TWIN-3D 4.1)', () => {
  it('shape.shoulders = 1,2, поза связывания: двухшаговый расчёт = Σ wⱼ · Pⱼ · v до 1e-6', () => {
    const scales = shapeScales({ ...SHAPE_NEUTRAL, shoulders: 1.2 }, boneIndex, true);
    expect(scales.size).toBeGreaterThan(0);
    const P = matricesP(scales);
    const { R, D } = bindPoseDq();
    const at = (n: string) => new THREE.Vector3().setFromMatrixPosition(binds[boneIndex(n)]!);
    const cases: { v: THREE.Vector3; bones: string[]; w: number[] }[] = [
      { v: at('shoulder01.L').add(new THREE.Vector3(0.03, 0.02, -0.01)), bones: ['shoulder01.L', 'upperarm01.L', 'clavicle.L', 'spine01'], w: [0.4, 0.3, 0.2, 0.1] },
      { v: at('upperarm01.R').add(new THREE.Vector3(-0.04, -0.05, 0.02)), bones: ['upperarm01.R', 'shoulder01.R', 'upperarm02.R', 'spine01'], w: [0.5, 0.25, 0.15, 0.1] },
      { v: at('clavicle.L').add(new THREE.Vector3(0.02, 0.01, 0.03)), bones: ['clavicle.L', 'neck01', 'spine01', 'shoulder01.L'], w: [0.55, 0.2, 0.15, 0.1] },
    ];
    for (const c of cases) {
      const idx = c.bones.map(boneIndex);
      expect(idx.every((i) => i >= 0)).toBe(true);
      const want = new THREE.Vector3();
      c.bones.forEach((_, k) => want.addScaledVector(c.v.clone().applyMatrix4(P[idx[k]!] ?? new THREE.Matrix4()), c.w[k]!));
      const got = skinVertex(c.v, idx, c.w, P, R, D, new THREE.Vector3());
      expect(got.distanceTo(want)).toBeLessThan(1e-6);
      expect(want.distanceTo(c.v)).toBeGreaterThan(1e-3);          // пропорции действительно сдвигают кожу
    }
  });

  it('shape = 1, 1, 1, 1: все Pᵢ единичные', () => {
    for (const widen of [true, false]) {
      const scales = shapeScales(SHAPE_NEUTRAL, boneIndex, widen);
      expect(scales.size).toBe(0);
      const I = new THREE.Matrix4();
      for (let i = 0; i < NB; i++) {
        const p = bindScale(binds[i]!, boneInverses[i]!, scales.get(i) ?? new THREE.Vector3(1, 1, 1));
        p.elements.forEach((e, k) => expect(Math.abs(e - I.elements[k]!)).toBeLessThan(1e-6));
      }
    }
  });
});
