// Анимированный манекен — SPEC 6.7.2. Сплошная гладкая фигура с объёмом (src/domain/skin.ts);
// рабочие мышцы светятся под кожей (пластины из anatomy.ts — только как области свечения)
// и «загораются» в фазе усилия. Свой SVG, requestAnimationFrame, без библиотек.

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ANIMATION_BY_ID, type AngleGuide, type ExerciseAnimation, type Prop } from '../../data/animations';
import { frontFigure, handPoint, sidePlates, type Placed } from '../../domain/anatomy';
import { frontSkin, sideSkin, type SkinLayer, type SkinShape } from '../../domain/skin';
import { angleTo, cycleAt, dir, lerpJoints, SEG, sidePose, type CycleState, type Joints, type Phase, type Pose, type Pt, type SidePose } from '../../domain/pose';

const W = 200;
const H = 200;
const GROUND = 190;
const BAR_Y = 22;
const BENCH_KNEE = 46;

const kf = (a: ExerciseAnimation, name: string): Joints => a.keyframes.find((k) => k.name === name)?.joints ?? a.keyframes[0]!.joints;

// ---------- Геометрия ----------

const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const len = (p: Pt) => Math.hypot(p.x, p.y);
const mov = (p: Pt, d: Pt, l: number): Pt => ({ x: p.x + d.x * l, y: p.y + d.y * l });
const f1 = (n: number) => Math.round(n * 10) / 10;
const ptsAttr = (pts: Pt[]) => pts.map((p) => `${f1(p.x)},${f1(p.y)}`).join(' ');

/** Капсула с сужением от w1 к w2 и скруглёнными концами — для снарядов и опор. */
function capsule(p1: Pt, p2: Pt, w1: number, w2: number): string {
  const d = sub(p2, p1);
  const l = len(d) || 1;
  const u = { x: d.x / l, y: d.y / l };
  const n = { x: -u.y, y: u.x };
  const r1 = w1 / 2;
  const r2 = w2 / 2;
  const a = mov(p1, n, r1);
  const b = mov(p2, n, r2);
  const c = mov(p2, n, -r2);
  const e = mov(p1, n, -r1);
  return `M${f1(a.x)} ${f1(a.y)}L${f1(b.x)} ${f1(b.y)}A${f1(r2)} ${f1(r2)} 0 0 0 ${f1(c.x)} ${f1(c.y)}L${f1(e.x)} ${f1(e.y)}A${f1(r1)} ${f1(r1)} 0 0 0 ${f1(a.x)} ${f1(a.y)}Z`;
}

/** Нормаль «вперёд» для сегмента с абсолютным углом α (для ног и корпуса — α + 90). */
const frontOf = (alpha: number) => dir(alpha + 90);

// ---------- Размещение ----------

function translate<T extends Pose>(p: T, dx: number, dy: number): T {
  const out: Record<string, unknown> = { ...p };
  for (const [k, v] of Object.entries(p)) {
    if (v && typeof v === 'object' && 'x' in v && 'y' in v) out[k] = { x: (v as Pt).x + dx, y: (v as Pt).y + dy };
  }
  return out as unknown as T;
}

function points(p: Pose): Pt[] {
  return Object.values(p).filter((v): v is Pt => !!v && typeof v === 'object' && 'x' in v && 'y' in v);
}

interface Fit {
  dx: number;
  dy: number;
  /** Масштаб: в висе — вокруг перекладины, иначе вокруг точки на полу, чтобы длинная поза (ролик) влезла в кадр. */
  scale: number;
  pivotY: number;
}

/** Смещение фигуры: к полу (или к перекладине), по центру кадра. Одно на всё упражнение. */
function fitOffset(anim: ExerciseAnimation): Fit {
  if (anim.view === 'front') {
    const fig = frontFigure(anim, kf(anim, 'start'));
    const lowest = Math.max(...fig.plates.flatMap((pl) => pl.pts.map((q) => q.y)));
    return { dx: 0, dy: GROUND - lowest, scale: 1, pivotY: GROUND };
  }
  const ps = [sidePose(anim, kf(anim, 'start')), sidePose(anim, kf(anim, 'end'))];
  const all = ps.flatMap(points);
  const minX = Math.min(...all.map((q) => q.x));
  const maxX = Math.max(...all.map((q) => q.x));
  const dx = W / 2 - (minX + maxX) / 2;
  if (anim.rig === 'hanging') {
    const p0 = ps[0]!;
    const dy = BAR_Y + 3 - p0.wristR.y;
    const lowest = Math.max(...points(p0).map((q) => q.y)) + dy;
    return { dx, dy, scale: Math.min(1, (GROUND - 6 - BAR_Y) / (lowest - BAR_Y)), pivotY: BAR_Y };
  }
  // Обе крайние точки с привязкой к опоре: нижняя из них — на полу (брусья с anchor: wrist опускают тело в кадре end).
  const placed = [kf(anim, 'start'), kf(anim, 'end')].map((j) => placedSide(anim, j, { dx, dy: 0, scale: 1, pivotY: GROUND }));
  const pts = placed.flatMap(points);
  const maxY = Math.max(...pts.map((q) => q.y));
  const dy = GROUND - maxY - 4;
  // Поза длиннее или выше кадра (ролик с выкатом, жим стоя): уменьшаем вокруг середины пола, фигура остаётся на полу.
  const span = Math.max(...pts.map((q) => q.x)) - Math.min(...pts.map((q) => q.x)) + 44;
  const top = Math.min(...pts.map((q) => q.y)) + dy - 22;
  const scale = Math.min(1, (W - 8) / span, top < 0 ? (GROUND - 4) / (GROUND - 4 - top) : 1);
  return { dx, dy, scale, pivotY: GROUND };
}

type Anchor = NonNullable<ExerciseAnimation['anchor']>;

/** Неподвижная точка между кадрами: по умолчанию кисть в висе, пятка стоя, колено на коленях (база 0), иначе таз. */
function anchorOf(anim: ExerciseAnimation): Anchor {
  if (anim.anchor) return anim.anchor;
  if (anim.rig === 'hanging') return 'wrist';
  if (anim.rig === 'standing') return 'heel';
  if (anim.rig === 'kneeling' && anim.base === 0) return 'knee';
  return 'hip';
}

const anchorPoint = (p: SidePose, a: Anchor): Pt =>
  a === 'heel' ? p.heel : a === 'toe' ? p.toe : a === 'shoulder' ? p.shoulder : a === 'wrist' ? p.wristR : a === 'knee' ? p.knee : p.hip;

/** Колено по двум длинам и положениям таза и стопы; колено — вниз-вперёд. */
function ik2(hip: Pt, target: Pt, l1: number, l2: number): Pt {
  const d = sub(target, hip);
  const dist = Math.min(l1 + l2 - 0.01, Math.max(Math.abs(l1 - l2) + 0.01, len(d)));
  const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const u = { x: d.x / (len(d) || 1), y: d.y / (len(d) || 1) };
  const m = mov(hip, u, a);
  const n = { x: -u.y, y: u.x };
  const k1 = mov(m, n, h);
  const k2 = mov(m, n, -h);
  return k1.y > k2.y ? k1 : k2;
}

const alphaOf = (from: Pt, to: Pt) => (Math.atan2(to.x - from.x, -(to.y - from.y)) * 180) / Math.PI;

/** Вид сбоку: в каждом кадре — к своей опоре (кисти на перекладине, пятка на полу, плечи на скамье). */
function placedSide(anim: ExerciseAnimation, joints: Joints, base: Fit): SidePose {
  const raw = sidePose(anim, joints);
  const anchor = anchorOf(anim);
  const p0 = sidePose(anim, kf(anim, 'start'));
  const ref0 = anchorPoint(p0, anchor);
  const ref = anchorPoint(raw, anchor);
  const p = translate(raw, base.dx + ref0.x - ref.x, base.dy + ref0.y - ref.y);
  if (anim.rig === 'standing' || anim.rig === 'kneeling') {
    // Задняя стопа на скамье неподвижна (болгарские выпады): колено — обратной кинематикой.
    if (anim.props?.some((x) => x.kind === 'bench' && x.under === 'ankleB')) {
      // Скамья на высоте колена, в шаге позади передней стопы.
      const target = { x: p0.heel.x + base.dx - 74, y: GROUND - BENCH_KNEE - 5 };
      const knee = ik2(p.hip, target, SEG.thigh, SEG.shin);
      const aShinB = alphaOf(target, knee);
      p.kneeB = knee;
      p.ankleB = target;
      p.toeB = mov(target, dir(aShinB + 90), SEG.foot - SEG.heel);
      p.heelB = mov(target, dir(aShinB + 90), -SEG.heel);
      p.a.thighB = alphaOf(knee, p.hip);
      p.a.shinB = aShinB;
    }
  }
  return p;
}

/** Поза и пластины кадра. */
function figureAt(anim: ExerciseAnimation, joints: Joints, base: Fit): { pose: Pose; plates: Placed[]; skin: SkinShape[] } {
  if (anim.view === 'front') {
    const fig = frontFigure(anim, joints);
    const pose = translate(fig.pose, base.dx, base.dy);
    return {
      pose,
      plates: fig.plates.map((pl) => ({ ...pl, pts: pl.pts.map((q) => ({ x: q.x + base.dx, y: q.y + base.dy })) })),
      skin: frontSkin(pose),
    };
  }
  const pose = placedSide(anim, joints, base);
  return { pose, plates: sidePlates(pose), skin: sideSkin(pose) };
}

// ---------- Мышцы ----------

/** Подсветка: основные ярче и со свечением в фазе усилия, помогающие — ровно. */
function highlightOf(anim: ExerciseAnimation, state: CycleState, still: boolean) {
  const primary = still ? 0.9 : state.concentric ? 1 : state.phase === 'pause' ? 0.9 : state.phase === 'rest' ? 0.6 : 0.75;
  return (muscles: readonly string[]): { color: string; opacity: number; glow: boolean } | null => {
    if (muscles.some((m) => anim.highlight.primary.includes(m as never))) return { color: 'var(--m-primary)', opacity: primary, glow: still || primary >= 0.9 };
    if (muscles.some((m) => anim.highlight.secondary.includes(m as never))) return { color: 'var(--m-secondary)', opacity: 0.95, glow: false };
    return null;
  };
}

const LAYERS: SkinLayer[] = ['farArm', 'farLeg', 'body', 'nearArm'];

/** Слой пластины-мышцы: по префиксу (вид сбоку) или по части тела карты (вид спереди). */
function layerOf(pl: Placed): SkinLayer {
  if (pl.key.startsWith('armL-')) return 'farArm';
  if (pl.key.startsWith('legB-')) return 'farLeg';
  if (pl.key.startsWith('armR-')) return 'nearArm';
  if (/^(biceps|triceps|forearm|front-deltoids|back-deltoids)-/.test(pl.key)) return 'nearArm';
  return 'body';
}

const DARK = 'color-mix(in oklab, var(--body-a) 76%, black)';

/**
 * Тело: сплошная кожа с объёмом. Каждый слой — контур (под заливкой, чтобы швы между сегментами
 * одной цепочки скрылись), заливка с градиентом поперёк сегмента и мышцы, светящиеся под кожей
 * (размытые пластины, обрезанные по телу). Дальние конечности темнее, ближняя рука — с мягкой тенью.
 */
function Body({ skin, plates, hl, gid, symmetric }: { skin: SkinShape[]; plates: Placed[]; hl: ReturnType<typeof highlightOf>; gid: string; symmetric: boolean }) {
  const glow = plates.filter((pl) => pl.muscles.length > 0);
  return (
    <>
      <defs>
        {skin.map((sh) => {
          const { o, n, half } = sh.grad;
          return (
            <linearGradient
              key={sh.key}
              id={`${gid}-${sh.key}`}
              gradientUnits="userSpaceOnUse"
              x1={f1(o.x - n.x * half)}
              y1={f1(o.y - n.y * half)}
              x2={f1(o.x + n.x * half)}
              y2={f1(o.y + n.y * half)}
            >
              <stop offset="0" stopColor={symmetric ? 'var(--body-a)' : DARK} />
              <stop offset={symmetric ? '0.5' : '0.58'} stopColor="var(--body-b)" />
              <stop offset="1" stopColor="var(--body-a)" />
            </linearGradient>
          );
        })}
        {LAYERS.map((l) => (
          <clipPath key={l} id={`${gid}-clip-${l}`}>
            {skin.filter((sh) => l === 'nearArm' || sh.layer === l).map((sh) => <path key={sh.key} d={sh.d} />)}
          </clipPath>
        ))}
        <filter id={`${gid}-blur`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
        <filter id={`${gid}-core`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="0.6" />
        </filter>
      </defs>
      {LAYERS.map((layer) => {
        const shapes = skin.filter((sh) => sh.layer === layer);
        if (!shapes.length) return null;
        const far = layer === 'farArm' || layer === 'farLeg';
        return (
          <g key={layer} style={far ? { filter: 'brightness(0.78)' } : layer === 'nearArm' ? { filter: 'drop-shadow(0 0.6px 1.3px rgb(0 0 0 / 0.38))' } : undefined}>
            <g fill="none" stroke="var(--body-line)" strokeWidth={1} strokeLinejoin="round">
              {shapes.map((sh) => <path key={sh.key} d={sh.d} />)}
            </g>
            <g>
              {shapes.map((sh) => <path key={sh.key} d={sh.d} fill={`url(#${gid}-${sh.key})`} />)}
            </g>
            {/* Группы мышц видны формами (REDESIGN 3.1): чёткие области, обрезанные по телу; рабочие — цветом */}
            <g clipPath={`url(#${gid}-clip-${layer})`}>
              {glow.filter((pl) => layerOf(pl) === layer).map((pl) => {
                const h = hl(pl.muscles);
                return (
                  <polygon
                    key={'a' + pl.key}
                    points={ptsAttr(pl.pts)}
                    fill={h ? h.color : '#FFFFFF'}
                    fillOpacity={h ? 0.92 : 0.07}
                    stroke={h ? '#0E2A19' : 'var(--body-line)'}
                    strokeOpacity={h ? 0.55 : 0.9}
                    strokeWidth={0.7}
                    strokeLinejoin="round"
                    style={{ transition: 'fill 260ms ease-out, fill-opacity 260ms ease-out' }}
                  />
                );
              })}
            </g>
            {/* Мышцы под кожей: широкое мягкое свечение и более чёткое ядро, обрезанные по телу */}
            <g clipPath={`url(#${gid}-clip-${layer})`}>
              {(['blur', 'core'] as const).map((pass) => (
                <g key={pass} filter={`url(#${gid}-${pass})`}>
                  {glow.filter((pl) => layerOf(pl) === layer).map((pl) => {
                    const h = hl(pl.muscles);
                    if (!h) return null;
                    const k = pass === 'blur' ? 0.85 : h.glow ? 0.55 : 0.3;
                    return (
                      <polygon key={pl.key} points={ptsAttr(pl.pts)} fill={h.color} style={{ opacity: h.opacity * k, transition: 'opacity 260ms ease-out' }} />
                    );
                  })}
                </g>
              ))}
            </g>
          </g>
        );
      })}
    </>
  );
}

// ---------- Снаряды и опоры ----------

const INK = 'var(--ink)';

function Disc({ at, r }: { at: Pt; r: number }) {
  // Блин — кольцом с прозрачной серединой: тело под ним видно.
  return (
    <g>
      <circle cx={at.x} cy={at.y} r={r} fill={INK} fillOpacity={0.1} stroke={INK} strokeOpacity={0.72} strokeWidth={2.2} />
      <circle cx={at.x} cy={at.y} r={2.4} fill={INK} fillOpacity={0.72} />
    </g>
  );
}

function Equipment({ anim, p, start }: { anim: ExerciseAnimation; p: Pose; start: Pose }) {
  if (anim.hold === 'wheel' && p.view === 'side') {
    // Ролик для пресса: колесо в кистях.
    const h = handPoint(p.elbowR, p.wristR);
    return (
      <g>
        <circle cx={h.x} cy={h.y + 4} r={7} fill="var(--fig-bg)" stroke={INK} strokeOpacity={0.72} strokeWidth={2.2} />
        <circle cx={h.x} cy={h.y + 4} r={2} fill={INK} fillOpacity={0.72} />
      </g>
    );
  }
  if (anim.equipment === 'none') return null;
  if (p.view === 'front') {
    if (anim.equipment !== 'dumbbell') return null;
    return (
      <g fill={INK} opacity={0.8}>
        {[handPoint(p.elbowL, p.wristL), handPoint(p.elbowR, p.wristR)].map((h, i) => (
          <g key={i}>
            <rect x={h.x - 9} y={h.y - 1.6} width={18} height={3.2} rx={1.6} />
            <rect x={h.x - 11} y={h.y - 5} width={4.5} height={10} rx={1.5} />
            <rect x={h.x + 6.5} y={h.y - 5} width={4.5} height={10} rx={1.5} />
          </g>
        ))}
      </g>
    );
  }
  const hand = handPoint(p.elbowR, p.wristR);
  if (anim.equipment === 'dumbbell') {
    if (anim.hold === 'goblet') {
      const u = dir(p.a.torso);
      const c = mov(mov(hand, frontOf(p.a.torso), 2), u, -3);
      return <path d={capsule(mov(c, u, -8), mov(c, u, 8), 10, 10)} fill={INK} opacity={0.78} />;
    }
    const far = handPoint(p.elbowL, p.wristL);
    return (
      <g fill={INK}>
        <circle cx={far.x} cy={far.y} r={6} opacity={0.3} />
        <circle cx={hand.x} cy={hand.y} r={6} opacity={0.78} />
        <circle cx={hand.x} cy={hand.y} r={2} fill="var(--fig-bg)" />
      </g>
    );
  }
  if (anim.equipment === 'barbell') {
    const at =
      anim.hold === 'back' ? mov(mov(p.shoulder, frontOf(p.a.torso), -6), dir(p.a.torso), 2)
        : anim.hold === 'hips' ? mov(mov(p.hip, frontOf(p.a.torso), 9), dir(p.a.torso), 4)
          : hand;
    return <Disc at={at} r={15} />;
  }
  // cable: рукоять и трос к блоку
  const pulley = anim.props?.find((x): x is Extract<Prop, { kind: 'pulley' }> => x.kind === 'pulley');
  const s = start as SidePose;
  const top = { x: s.wristR.x + (pulley?.dx ?? 0), y: pulley?.y ?? 8 };
  return (
    <g>
      <line x1={top.x} y1={top.y} x2={hand.x} y2={hand.y} stroke="var(--muted)" strokeWidth={1} />
      <circle cx={top.x} cy={top.y} r={4.5} fill="var(--fig-bg)" stroke="var(--muted)" strokeWidth={1.6} />
      <rect x={hand.x - 7} y={hand.y - 1.8} width={14} height={3.6} rx={1.8} fill={INK} opacity={0.8} />
    </g>
  );
}

const PROP = { fill: 'var(--surface-2)', stroke: 'var(--m-outline)', strokeWidth: 0.8 };

function Props({ anim, p, start }: { anim: ExerciseAnimation; p: Pose; start: Pose }) {
  const out: React.ReactNode[] = [];
  if (anim.rig !== 'hanging' && !anim.noFloor) {
    out.push(<line key="floor" x1={8} y1={GROUND + 0.6} x2={W - 8} y2={GROUND + 0.6} stroke="var(--line)" strokeWidth={1.6} strokeLinecap="round" />);
  }
  for (const [i, prop] of (anim.props ?? []).entries()) {
    if (prop.kind === 'bar') {
      out.push(<line key={i} x1={30} y1={BAR_Y} x2={170} y2={BAR_Y} stroke="var(--muted)" strokeWidth={2.6} strokeLinecap="round" />);
    }
    if (p.view !== 'side' || start.view !== 'side') {
      if (prop.kind === 'bench' && p.view === 'front') {
        const y = p.pelvis.y + 12;
        out.push(<rect key={i} x={p.pelvis.x - 26} y={y} width={52} height={6} rx={3} {...PROP} />);
        out.push(<rect key={`${i}l`} x={p.pelvis.x - 3} y={y + 6} width={6} height={Math.max(0, GROUND - y - 6)} {...PROP} />);
      }
      continue;
    }
    if (prop.kind === 'handles') {
      // Брусья: рукояти на высоте кистей кадра start.
      const h = handPoint(start.elbowR, start.wristR);
      out.push(<line key={i} x1={h.x - 24} y1={h.y + 1.5} x2={h.x + 24} y2={h.y + 1.5} stroke="var(--muted)" strokeWidth={2.6} strokeLinecap="round" />);
    }
    if (prop.kind === 'armPad') {
      // Скамья Скотта: подушка под плечом (ближняя рука), ниже него по направлению к полу.
      const u = dir(p.a.upperArmR);
      const n1 = dir(p.a.upperArmR + 90);
      const n = n1.y >= 0 ? n1 : dir(p.a.upperArmR - 90);
      const a = mov(mov(p.shoulder, u, 2), n, 7);
      const b = mov(mov(p.elbowR, u, 12), n, 7);
      out.push(<path key={i} d={capsule(a, b, 7, 7)} {...PROP} />);
      out.push(<rect key={`${i}l`} x={b.x - 2.5} y={b.y} width={5} height={Math.max(0, GROUND - b.y)} {...PROP} />);
    }
    if (prop.kind === 'bench') {
      const s0 = prop.fixed ? start : p;
      let x1: number, x2: number, top: number;
      if (prop.under === 'torso') {
        // Голова может быть и слева (лёжа на спине), и справа (на животе): скамья от края до края.
        x1 = Math.min(s0.head.x, s0.shoulder.x, s0.hip.x) - 6;
        x2 = Math.max(s0.head.x, s0.shoulder.x, s0.hip.x) + 14;
        top = Math.max(s0.hip.y, s0.shoulder.y) + 11;
      } else if (prop.under === 'hips') {
        x1 = s0.hip.x - 16;
        x2 = s0.hip.x + 22;
        top = s0.hip.y + 11;
      } else if (prop.under === 'shoulders') {
        x1 = s0.shoulder.x - 30;
        x2 = s0.shoulder.x + 8;
        top = s0.shoulder.y + 9;
      } else if (prop.under === 'ankle') {
        x1 = start.ankle.x - 16;
        x2 = start.ankle.x + 12;
        top = start.ankle.y + 4;
      } else if (prop.under === 'support') {
        x1 = Math.min(p.kneeB?.x ?? p.knee.x, p.ankleB?.x ?? p.knee.x) - 6;
        x2 = p.wristL.x + 10;
        top = (p.kneeB?.y ?? p.knee.y) + 5;
      } else {
        const s = start;
        x1 = (s.ankleB?.x ?? s.ankle.x) - 16;
        x2 = (s.ankleB?.x ?? s.ankle.x) + 12;
        top = (s.ankleB?.y ?? s.ankle.y) + 4;
      }
      out.push(<rect key={i} x={x1} y={top} width={x2 - x1} height={6} rx={3} {...PROP} />);
      out.push(<rect key={`${i}a`} x={x1 + 4} y={top + 6} width={4} height={Math.max(0, GROUND - top - 6)} {...PROP} />);
      out.push(<rect key={`${i}b`} x={x2 - 8} y={top + 6} width={4} height={Math.max(0, GROUND - top - 6)} {...PROP} />);
    }
    if (prop.kind === 'incline') {
      // Спинка вдоль корпуса: сзади (лёжа на спине) или спереди (`front` — грудью на наклонной скамье).
      const s0 = prop.fixed ? start : p;
      const side = prop.front ? 13 : -13;
      const back = frontOf(s0.a.torso);
      const a = mov(mov(s0.hip, back, side), dir(s0.a.torso), -6);
      const b = mov(mov(s0.shoulder, back, side), dir(s0.a.torso), 10);
      out.push(<path key={i} d={capsule(a, b, 6, 6)} {...PROP} />);
      if (prop.seat !== false) {
        const seatEnd = mov(a, dir(s0.a.thigh + 180), 26);
        out.push(<path key={`${i}s`} d={capsule(a, seatEnd, 6, 6)} {...PROP} />);
      }
      out.push(<rect key={`${i}l`} x={a.x - 2.5} y={a.y} width={5} height={Math.max(0, GROUND - a.y)} {...PROP} />);
    }
    if (prop.kind === 'platform') {
      // Перпендикулярно голени, чуть ниже носка: при подъёме на носки пятка отрывается, носок остаётся на платформе.
      const n = dir(p.a.shin + 90);
      const o = mov(p.toe, dir(p.a.shin), -3);
      const a = mov(o, n, -24);
      const b = mov(o, n, 14);
      out.push(<path key={i} d={capsule(a, b, 5, 5)} {...PROP} />);
    }
    if (prop.kind === 'kneePad') {
      const k = mov(p.knee, { x: 0, y: prop.under ? 1 : -1 }, prop.under ? 9 : 13);
      out.push(<rect key={i} x={k.x - 9} y={k.y - 4} width={18} height={8} rx={4} {...PROP} />);
    }
  }
  return <>{out}</>;
}

// ---------- Подсказки углов ----------

function segmentOf(p: Pose, g: AngleGuide): { base: Pt; alpha: number } | null {
  if (p.view === 'side') {
    switch (g.segment) {
      case 'torso': return { base: p.hip, alpha: p.a.torso };
      case 'thigh': return { base: p.hip, alpha: p.a.thigh + 180 };
      case 'shin': return { base: p.ankle, alpha: p.a.shin };
      case 'upperArm': return { base: p.shoulder, alpha: p.a.upperArmR };
      case 'forearm': return { base: p.elbowR, alpha: p.a.forearmR };
    }
  }
  if (p.view === 'front') {
    switch (g.segment) {
      case 'torso': return { base: p.pelvis, alpha: 0 };
      case 'upperArm': return { base: p.shoulderL, alpha: alphaOf(p.shoulderL, p.elbowL) };
      case 'forearm': return { base: p.elbowL, alpha: alphaOf(p.elbowL, p.wristL) };
      default: return null;
    }
  }
  return null;
}

interface GuideGeom {
  n: number;
  /** Линия-отсчёт (пунктир) и луч вдоль сегмента. */
  ref?: [Pt, Pt];
  ray?: [Pt, Pt];
  /** Линия без угла: «спина прямая», «уровень плеч». */
  line?: [Pt, Pt];
  vertex?: Pt;
  arc?: string;
  wedge?: string;
  badge: Pt;
}

function guideGeom(p: Pose, g: AngleGuide, n: number, k: number): GuideGeom | null {
  const seg = segmentOf(p, g);
  if (!seg) return null;
  const u = dir(seg.alpha);
  if (g.reference === 'along') {
    const a = mov(seg.base, u, -12);
    const b = mov(seg.base, u, SEG.torso + 22);
    return { n, line: [a, b], badge: mov(b, dir(seg.alpha - 90), 9 * k) };
  }
  if (g.reference === 'horizontal' && g.value === 0 && !g.text) {
    const y = p.view === 'front' ? p.shoulderL.y : seg.base.y;
    return { n, line: [{ x: 12, y }, { x: W - 12, y }], badge: { x: W - 12, y: y - 10 * k } };
  }
  let refAlpha: number;
  if (g.reference === 'vertical') refAlpha = Math.abs((((seg.alpha % 360) + 360) % 360) - 180) < 90 ? 180 : 0;
  else refAlpha = u.x >= 0 ? 90 : 270;
  const refDir = dir(refAlpha);
  const R = 15;
  const a0 = mov(seg.base, refDir, R);
  const a1 = mov(seg.base, u, R);
  const cross = refDir.x * u.y - refDir.y * u.x;
  const sweep = cross > 0 ? 1 : 0;
  const measured = angleTo(seg.alpha, g.reference);
  const bis = { x: refDir.x + u.x, y: refDir.y + u.y };
  const bl = len(bis);
  const out = bl < 0.2 ? dir(refAlpha + 90) : { x: bis.x / bl, y: bis.y / bl };
  const arc = measured > 2 ? `M${f1(a0.x)} ${f1(a0.y)}A${R} ${R} 0 0 ${sweep} ${f1(a1.x)} ${f1(a1.y)}` : undefined;
  return {
    n,
    ref: [seg.base, mov(seg.base, refDir, 30)],
    ray: [seg.base, mov(seg.base, u, 30)],
    vertex: seg.base,
    arc,
    wedge: arc ? `M${f1(seg.base.x)} ${f1(seg.base.y)}L${arc.slice(1)}Z` : undefined,
    badge: mov(seg.base, out, R + 10 * k),
  };
}

/** Номера не налезают друг на друга и не выходят за край. */
function layoutBadges(geoms: GuideGeom[], k: number): void {
  const r = 8 * k;
  geoms.forEach((gm, i) => {
    gm.badge.x = Math.min(W - r - 2, Math.max(r + 2, gm.badge.x));
    gm.badge.y = Math.min(H - r - 2, Math.max(r + 2, gm.badge.y));
    for (let j = 0; j < i; j++) {
      const o = geoms[j]!.badge;
      if (Math.hypot(o.x - gm.badge.x, o.y - gm.badge.y) < 2.4 * r) gm.badge.y = o.y + (gm.badge.y >= o.y ? 2.4 * r : -2.4 * r);
    }
  });
}

function Guide({ gm, k }: { gm: GuideGeom; k: number }) {
  const col = 'var(--guide)';
  const dash = `${3 * k} ${2.5 * k}`;
  return (
    <g>
      {gm.wedge && <path d={gm.wedge} fill={col} opacity={0.16} />}
      {gm.ref && <line x1={gm.ref[0].x} y1={gm.ref[0].y} x2={gm.ref[1].x} y2={gm.ref[1].y} stroke={col} strokeWidth={1.1 * k} strokeDasharray={dash} strokeLinecap="round" />}
      {gm.ray && <line x1={gm.ray[0].x} y1={gm.ray[0].y} x2={gm.ray[1].x} y2={gm.ray[1].y} stroke={col} strokeWidth={1.4 * k} strokeLinecap="round" />}
      {gm.line && (
        <line x1={gm.line[0].x} y1={gm.line[0].y} x2={gm.line[1].x} y2={gm.line[1].y} stroke={col} strokeWidth={1.3 * k} strokeDasharray={dash} strokeLinecap="round" />
      )}
      {gm.arc && <path d={gm.arc} fill="none" stroke={col} strokeWidth={1.8 * k} strokeLinecap="round" />}
      {gm.vertex && <circle cx={gm.vertex.x} cy={gm.vertex.y} r={2 * k} fill={col} stroke="var(--fig-bg)" strokeWidth={0.8 * k} />}
      <circle cx={gm.badge.x} cy={gm.badge.y} r={8 * k} fill={col} stroke="var(--fig-bg)" strokeWidth={1.6 * k} />
      <text x={gm.badge.x} y={gm.badge.y} dy="0.36em" fontSize={10.5 * k} fontWeight={700} fill="var(--fig-bg)" textAnchor="middle">
        {gm.n}
      </text>
    </g>
  );
}

/** Видимость подсказок кадра: плавно появляются на подходе к крайней точке и держатся в паузе. */
function guideVisibility(keyframe: string, t: number): number {
  const x = keyframe === 'end' ? t : 1 - t;
  const v = Math.min(1, Math.max(0, (x - 0.78) / 0.17));
  return v * v * (3 - 2 * v);
}

// ---------- Компонент ----------

export type MannequinFrame = 'start' | 'end';

interface MannequinProps {
  exerciseId: string;
  /** Статичный кадр вместо анимации. */
  frame?: MannequinFrame;
  playing?: boolean;
  size?: number;
  showGuides?: boolean;
  /** Смена фазы цикла — для полосы темпа и списка углов. */
  onPhase?: (phase: Phase) => void;
}

export function Mannequin({ exerciseId, frame, playing = true, size = 220, showGuides = true, onPhase }: MannequinProps) {
  const anim = ANIMATION_BY_ID[exerciseId];
  const gid = useId().replace(/:/g, '');
  const [elapsed, setElapsed] = useState(0);
  const ref = useRef<SVGSVGElement>(null);
  const [visible, setVisible] = useState(true);
  // Уменьшение движения решает родитель: по умолчанию показывает статичный кадр, движение — по выбору.
  const animate = !frame && playing && anim?.direction !== 'static';

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setVisible(!!e?.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!animate || !visible) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      if (document.visibilityState === 'visible') setElapsed((e) => e + (now - last) / 1000);
      last = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [animate, visible]);

  const offset = useMemo<Fit>(() => (anim ? fitOffset(anim) : { dx: 0, dy: 0, scale: 1, pivotY: GROUND }), [anim]);
  const startPose = useMemo(() => (anim ? figureAt(anim, kf(anim, 'start'), offset).pose : null), [anim, offset]);

  const state: CycleState | null = !anim
    ? null
    : frame
      ? { t: frame === 'end' ? 1 : 0, phase: frame === 'end' ? 'pause' : 'rest', concentric: false }
      : cycleAt(anim, elapsed);
  const phase = state?.phase;
  useEffect(() => {
    if (phase && !frame) onPhase?.(phase);
  }, [phase, frame, onPhase]);

  if (!anim || !state || !startPose) return null;

  const joints = lerpJoints(kf(anim, 'start'), kf(anim, 'end'), state.t);
  const { pose, plates, skin } = figureAt(anim, joints, offset);
  const hl = highlightOf(anim, state, !!frame || anim.direction === 'static');
  // Размеры подсказок — в пикселях экрана, независимо от размера рисунка.
  const k = (W / size) * (offset.scale < 1 ? 1 / offset.scale : 1);
  const guides = showGuides ? anim.angles : [];
  // Статика (планка) — одна группа, всегда видна.
  const names = anim.direction === 'static' ? ['end'] : ['start', 'end'];
  const groups = names.map((name) => {
    const vis = anim.direction === 'static' ? 1 : frame ? (frame === name ? 1 : 0) : guideVisibility(name, state.t);
    const geoms = guides
      .map((g, i) => (g.keyframe === name || anim.direction === 'static' ? guideGeom(pose, g, i + 1, k) : null))
      .filter((x): x is GuideGeom => !!x);
    layoutBadges(geoms, k);
    return { name, vis, geoms };
  });

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${W} ${H}`}
      width={size}
      height={size}
      role="img"
      aria-label="Техника упражнения"
      style={{ '--fig-bg': 'var(--surface)' } as CSSProperties}
    >
      <g transform={offset.scale < 1 ? `translate(${W / 2} ${offset.pivotY}) scale(${offset.scale}) translate(${-W / 2} ${-offset.pivotY})` : undefined}>
        <Props anim={anim} p={pose} start={startPose} />
        <Body skin={skin} plates={plates} hl={hl} gid={gid} symmetric={anim.view === 'front'} />
        <Equipment anim={anim} p={pose} start={startPose} />
        {groups.map(
          ({ name, vis, geoms }) =>
            vis > 0.01 && (
              <g key={name} opacity={vis}>
                {geoms.map((gm) => (
                  <Guide key={gm.n} gm={gm} k={k} />
                ))}
              </g>
            ),
        )}
      </g>
    </svg>
  );
}
