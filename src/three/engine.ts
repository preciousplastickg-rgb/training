// 3D-двойник — docs/TWIN-3D.md, разделы 3, 5, 6. Одна сцена и один WebGLRenderer на всё приложение: канвас
// переносится между экранами (стек «хостов»: верхний показывает, при его закрытии канвас возвращается к предыдущему).
// Двойник загружается один раз; клип и снаряды упражнения — по требованию, при закрытии выгружаются (dispose).
// Шейдер подсветки, кадр по fit_points и сторона одностороннего упражнения — перенос exercise-anim/viewer/main.js.
// Импортируется только динамически (import('./engine')), чтобы three.js не замедлял старт приложения.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PHASE_GAIN, phaseAt, type TwinBody } from '../domain/twin';
import { assetUrl, bottomTime, DRACO_BASE, loadManifest, loadMuscles, type ManifestExercise, type MusclesMeta, type TwinManifest, type Vec3 } from './assets';
import { webglAvailable } from './support';
import { sideSign, type Zone } from './zones';

const FOV = 35;          // вертикальный угол, как у кадров exercise-anim
const FILL = 0.85;       // fit_points занимают 85 % ограничивающей стороны холста
const TAU = Math.PI * 2;
const AUTO_SPIN = 0.35;  // рад/с, ~20°/с — медленное вращение на «Сегодня»
const SPIN_TAU = 0.8;    // с: за сколько инерция после пальца сходит к медленному вращению
const MAX_SPIN = 12;     // рад/с: предел скорости после броска пальцем

export interface Figure {
  body: TwinBody;
  /** Поворот фигуры вокруг вертикали, градусы (0 — лицом к камере, 180 — спиной). */
  yaw?: number;
  /** Интенсивность зон 0..1 цветом основных мышц (недельная нагрузка), без подсветки — не задано. */
  zones?: Partial<Record<Zone, number>>;
}

export type ViewConfig =
  /** «Сегодня»: фигура в покое (клип idle), медленное вращение; пальцем — поворот вокруг вертикали. */
  | { kind: 'idle'; body: TwinBody; rotate: boolean; maxFps: number }
  /** Несколько неподвижных фигур рядом («Старт · Сейчас · Цель», нагрузка спереди и сзади): рендер по требованию. */
  | { kind: 'figures'; figures: Figure[] }
  /** «Как делать»: клип упражнения по кругу с подсветкой; still — нижняя точка без анимации («Мышцы»). */
  | {
      kind: 'exercise'; id: string; body: TwinBody; still: boolean; paused: boolean; speed: number;
      primary: Zone[]; secondary: Zone[]; side?: 'L' | 'R'; maxFps: number;
    };

export interface HostCallbacks {
  /** Контекст WebGL потерян — показать запасной вариант (статичные кадры). */
  onLost?: () => void;
  /** Клип упражнения не загрузился. */
  onError?: (e: unknown) => void;
}

export interface Handle {
  update(cfg: ViewConfig): void;
  release(): void;
  resetView(): void;
}

interface Host {
  el: HTMLElement;
  cfg: ViewConfig;
  cb: HostCallbacks;
  visible: boolean;
}

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const wrap = (a: number) => ((a % TAU) + TAU) % TAU;

// ---------- кадр по fit_points (TWIN-3D 2; эталон — fitView() в viewer/main.js) ----------

export interface ViewSpec {
  position: Vec3;
  target: Vec3;
  bounds?: { min: Vec3; max: Vec3 } | null;
  fit_points?: Vec3[] | null;
}

export function fitView(v: ViewSpec, aspect: number, fov = FOV, fill = FILL): { position: THREE.Vector3; target: THREE.Vector3 } {
  const pos = new THREE.Vector3(...v.position);
  const tgt = new THREE.Vector3(...v.target);
  const d = pos.clone().sub(tgt).normalize();
  let pts: THREE.Vector3[];
  let weak = false;
  if (v.fit_points && v.fit_points.length) pts = v.fit_points.map((p) => new THREE.Vector3(...p));
  else if (v.bounds) {
    const lo = v.bounds.min, hi = v.bounds.max;
    pts = [];
    for (let i = 0; i < 8; i++) pts.push(new THREE.Vector3(i & 1 ? hi[0] : lo[0], i & 2 ? hi[1] : lo[1], i & 4 ? hi[2] : lo[2]));
    weak = true;
  } else return { position: pos, target: tgt };
  const f = d.clone().negate();
  const r = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize();
  const u = new THREE.Vector3().crossVectors(r, f);
  const tv = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
  const th = tv * aspect;
  const lo = pts[0]!.clone(), hi = pts[0]!.clone();
  for (const p of pts) { lo.min(p); hi.max(p); }
  const T = new THREE.Vector3();
  for (const p of pts) T.add(p);
  T.multiplyScalar(1 / pts.length);
  let dist = 3 * hi.clone().sub(lo).length();
  const rel = new THREE.Vector3();
  for (let it = 0; it < 24; it++) {
    const C = T.clone().addScaledVector(d, dist);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const zc = T.clone().sub(C).dot(f);
    for (const p of pts) {
      rel.subVectors(p, C);
      const z = weak ? zc : rel.dot(f);
      const x = rel.dot(r) / (z * th), y = rel.dot(u) / (z * tv);
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    T.addScaledVector(r, ((x1 + x0) / 2) * th * zc).addScaledVector(u, ((y1 + y0) / 2) * tv * zc);
    dist *= Math.max((y1 - y0) / 2, (x1 - x0) / 2) / fill;
  }
  return { position: T.clone().addScaledVector(d, dist), target: T };
}

// ---------- движок ----------

class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly canvas: HTMLCanvasElement;
  private scene = new THREE.Scene();
  private stage = new THREE.Group();
  private camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 50);
  private controls: OrbitControls;
  private loader: GLTFLoader;
  private manifest!: TwinManifest;
  private meta!: MusclesMeta;
  private twin!: THREE.SkinnedMesh;
  private material!: THREE.MeshStandardMaterial;
  private normalSign = 1;
  private boneNames = new Set<string>();
  private iLean = 0;
  private iMuscle = 1;
  private mixer: THREE.AnimationMixer;
  private idleAction!: THREE.AnimationAction;
  private twinBox = new THREE.Box3();
  private zoneByName: Record<string, number> = {};
  private zoneW!: Float32Array;
  private zoneCol!: THREE.Color[];
  private uniforms!: Record<'uIdMap' | 'uIdSoft' | 'uFibre' | 'uZoneW' | 'uZoneCol' | 'uHighlight' | 'uSide' | 'uSideK' | 'uSideBlend', THREE.IUniform>;
  private primaryLevel = 1;
  private hosts: Host[] = [];
  private lost = false;
  private looping = false;
  private lastFrame = 0;
  private lastRender = 0;
  private dirty = true;
  private yaw = 0;
  /** Скорость вращения фигуры на «Сегодня», рад/с: после пальца — инерция, затем снова AUTO_SPIN (или 0, если выключено). */
  private spin = AUTO_SPIN;
  /** Палец на фигуре «Сегодня»: on — жест признан горизонтальным и крутит фигуру; v — скорость, рад/с. */
  private grab: { id: number; x: number; y: number; t: number; on: boolean; v: number } | null = null;
  private grabEnd = 0;
  private io: IntersectionObserver;
  private ro: ResizeObserver;
  private fpsFrames = 0;
  private fpsTime = 0;
  private fpsListeners = new Set<(fps: number) => void>();
  fps = 0;
  // упражнение на сцене
  private ex: { id: string; scene: THREE.Object3D; action: THREE.AnimationAction; entry: ManifestExercise } | null = null;
  private exLoading: string | null = null;
  private exSeq = 0;
  private view: ViewSpec | null = null;
  private lastTap = 0;

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
    this.canvas = renderer.domElement;
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;outline:none';
    this.canvas.setAttribute('aria-hidden', 'true');
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xcfcfcf, 1.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(2.0, 3.5, 2.5); this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.45); fill.position.set(-2.5, 1.5, -1.0); this.scene.add(fill);
    this.scene.add(this.stage);
    this.mixer = new THREE.AnimationMixer(this.stage);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enabled = false;
    this.controls.addEventListener('change', () => (this.dirty = true));
    // только wasm и обёртка из public/draco/ (TWIN-3D 3): без JS-фолбэка; нет WebAssembly — ошибка загрузки → статичные кадры
    const draco = new DRACOLoader()
      .setDecoderPath({ js: `${DRACO_BASE}draco_wasm_wrapper.js`, wasm: `${DRACO_BASE}draco_decoder.wasm` })
      .setDecoderConfig({ type: 'wasm' });
    this.loader = new GLTFLoader().setDRACOLoader(draco);
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
      this.stop();
      for (const h of this.hosts) h.cb.onLost?.();
    });
    // двойной тап — ракурс из манифеста (TWIN-3D 8); на iOS dblclick от касания ненадёжен
    let down = { x: 0, y: 0, t: 0 };
    this.canvas.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY, t: performance.now() }));
    this.canvas.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'mouse') return;
      const now = performance.now();
      const tap = now - down.t < 250 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 10;
      if (!tap) { this.lastTap = 0; return; }
      if (now - this.lastTap < 320) { this.resetView(); this.lastTap = 0; } else this.lastTap = now;
    });
    this.canvas.addEventListener('dblclick', () => this.resetView());
    this.listenSpin();
    this.io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        const h = this.hosts.find((x) => x.el === en.target);
        if (h) h.visible = en.isIntersecting;
      }
      this.schedule();
    });
    this.ro = new ResizeObserver(() => this.resize());
    document.addEventListener('visibilitychange', () => this.schedule());
  }

  async load(): Promise<void> {
    const [manifest, meta] = await Promise.all([loadManifest(), loadMuscles()]);
    this.manifest = manifest;
    this.meta = meta;
    const tex = new THREE.TextureLoader();
    const texture = (name: string, nearest: boolean) => tex.loadAsync(assetUrl(name)).then((t) => {
      t.flipY = false;
      t.colorSpace = THREE.NoColorSpace;
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      if (nearest) { t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; }
      return t;
    });
    const [gltf, idMap, idSoft, fibre] = await Promise.all([
      this.loader.loadAsync(assetUrl(manifest.twin.file)) as Promise<GLTF>,
      texture('twin_id.webp', true), texture('twin_idsoft.webp', true), texture('twin_fibre.webp', false),
    ]);
    let twin: THREE.SkinnedMesh | null = null;
    gltf.scene.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (m.isSkinnedMesh && m.morphTargetDictionary && 'lean' in m.morphTargetDictionary) twin = m;
    });
    if (!twin) throw new Error('twin.glb: нет тела с морфом lean');
    this.twin = twin;
    this.stage.add(gltf.scene);
    this.boneNames = new Set(this.twin.skeleton.bones.map((b) => b.name));
    this.twin.geometry.computeBoundingBox();
    this.twinBox.copy(this.twin.geometry.boundingBox!);
    this.material = this.twin.material as THREE.MeshStandardMaterial;
    this.normalSign = Math.sign(this.material.normalScale.y) || 1;
    this.iLean = this.twin.morphTargetDictionary!.lean!;
    this.iMuscle = this.twin.morphTargetDictionary!.muscle ?? 1;
    fibre.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
    this.installShader(idMap, idSoft, fibre);
    const idle = THREE.AnimationClip.findByName(gltf.animations, 'idle') ?? gltf.animations[0];
    this.idleAction = this.mixer.clipAction(idle!, this.stage);
    this.idleAction.setLoop(THREE.LoopRepeat, Infinity).play();
    // первая компиляция шейдера — сразу, чтобы первый кадр на экране не ждал её
    this.renderer.compile(this.scene, this.camera);
  }

  // ---------- подсветка (viewer/main.js: onBeforeCompile, декодирование карт из muscles.json) ----------
  private installShader(idMap: THREE.Texture, idSoft: THREE.Texture, fibre: THREE.Texture) {
    const meta = this.meta;
    const NZ = Math.max(...meta.zones.map((z) => z.id)) + 1;
    this.zoneByName = Object.fromEntries(meta.zones.map((z) => [z.name, z.id]));
    this.zoneW = new Float32Array(NZ);
    this.zoneCol = Array.from({ length: NZ }, () => new THREE.Color(0, 0, 0));
    this.uniforms = {
      uIdMap: { value: idMap }, uIdSoft: { value: idSoft }, uFibre: { value: fibre },
      uZoneW: { value: this.zoneW }, uZoneCol: { value: this.zoneCol }, uHighlight: { value: 0.0 },
      uSide: { value: 0.0 }, uSideK: { value: meta.highlight.side?.other_side_factor ?? 0.35 },
      uSideBlend: { value: meta.highlight.side?.blend_half_width_m ?? 0.02 },
    };
    const uniforms = this.uniforms;
    this.material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      // vSideX: латеральная координата до морфов и скиннинга (POSITION = поза связывания, +x — левая сторона спортсмена)
      shader.vertexShader = 'varying vec2 vZoneUv;\nvarying float vSideX;\n' + shader.vertexShader.replace(
        '#include <uv_vertex>', '#include <uv_vertex>\n\tvZoneUv = uv;\n\tvSideX = position.x;');
      shader.fragmentShader = `
uniform sampler2D uIdMap;
uniform sampler2D uIdSoft;
uniform sampler2D uFibre;
uniform float uZoneW[${NZ}];
uniform vec3 uZoneCol[${NZ}];
uniform float uHighlight;
uniform float uSide;
uniform float uSideK;
uniform float uSideBlend;
varying vec2 vZoneUv;
varying float vSideX;
int zoneId(float c) {
  if (c < 0.5 / 255.0) return 0;
  return clamp(int(floor((c * 255.0 - 20.0) / 12.0 + 0.5)), 0, ${NZ - 1});
}
` + shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
  if (uHighlight > 0.5) {
    vec3 skin = diffuseColor.rgb;
    vec4 sft = texture2D(uIdSoft, vZoneUv);
    int own = zoneId(texture2D(uIdMap, vZoneUv).r);
    int nb = zoneId(sft.g);
    float kSide = mix(1.0, mix(uSideK, 1.0, smoothstep(-uSideBlend, uSideBlend, uSide * vSideX)), abs(uSide));
    float wo = uZoneW[own] * kSide, wn = uZoneW[nb] * kSide;
    float t = 0.5 + 0.5 * sft.r;
    vec3 col = mix(mix(skin, uZoneCol[nb], wn), mix(skin, uZoneCol[own], wo), t);
    float hl = mix(step(0.001, wn), step(0.001, wo), t) * kSide;
    float s = texture2D(uFibre, vZoneUv).r;
    col *= mix(1.0, 0.85 + 0.15 * s, hl);
    diffuseColor.rgb = col;
  }`);
    };
    this.material.customProgramCacheKey = () => 'twin-zones-app-v1';
    this.material.needsUpdate = true;
  }

  private setZones(primary: readonly Zone[], secondary: readonly Zone[]) {
    const h = this.meta.highlight;
    this.zoneW.fill(0);
    for (const c of this.zoneCol) c.setRGB(0, 0, 0);
    for (const n of secondary) { const id = this.zoneByName[n]; if (id !== undefined) { this.zoneCol[id]!.set(h.secondary.color); this.zoneW[id] = h.secondary.intensity; } }
    for (const n of primary) { const id = this.zoneByName[n]; if (id !== undefined) { this.zoneCol[id]!.set(h.primary.color); this.zoneW[id] = h.primary.intensity; } }
  }

  private setZoneWeights(w: Partial<Record<Zone, number>>) {
    this.zoneW.fill(0);
    for (const c of this.zoneCol) c.setRGB(0, 0, 0);
    for (const [n, v] of Object.entries(w)) {
      const id = this.zoneByName[n];
      if (id === undefined || !v) continue;
      this.zoneCol[id]!.set(this.meta.highlight.primary.color);
      this.zoneW[id] = clamp(v, 0, 1);
    }
  }

  private applyBody(b: TwinBody) {
    const inf = this.twin.morphTargetInfluences!;
    inf[this.iLean] = b.lean;
    inf[this.iMuscle] = b.muscle;
    this.material.normalScale.set(b.definition, b.definition * this.normalSign);
  }

  // ---------- хосты ----------
  push(el: HTMLElement, cfg: ViewConfig, cb: HostCallbacks): Handle {
    const host: Host = { el, cfg, cb, visible: true };
    this.hosts.push(host);
    this.io.observe(el);
    this.activate();
    const handle: Handle = {
      update: (c) => {
        const prev = host.cfg;
        host.cfg = c;
        if (this.top() === host) this.configure(prev);
      },
      release: () => {
        const i = this.hosts.indexOf(host);
        if (i < 0) return;
        const wasTop = i === this.hosts.length - 1;
        this.hosts.splice(i, 1);
        this.io.unobserve(el);
        if (wasTop) {
          if (this.canvas.parentElement === el) el.removeChild(this.canvas);
          this.activate();
        }
      },
      resetView: () => this.resetView(),
    };
    if (this.lost) queueMicrotask(() => cb.onLost?.());
    return handle;
  }

  private top(): Host | undefined {
    return this.hosts[this.hosts.length - 1];
  }

  /** Канвас — в верхний хост, сцена — под его режим. Нет хостов — цикл стоит, упражнение выгружено. */
  private activate() {
    this.ro.disconnect();
    const h = this.top();
    if (!h) {
      this.unloadExercise();
      this.stop();
      return;
    }
    if (this.canvas.parentElement !== h.el) h.el.appendChild(this.canvas);
    this.ro.observe(h.el);
    this.configure(null);
    this.resize();
  }

  private configure(prev: ViewConfig | null) {
    const h = this.top();
    if (!h) return;
    const c = h.cfg;
    this.controls.enabled = c.kind === 'exercise';
    // «Как делать» — орбита во все стороны; «Сегодня» — горизонтальный жест крутит фигуру (listenSpin), вертикальный
    // прокручивает страницу; в «Прогрессе» жест по фигурам только прокручивает
    this.canvas.style.touchAction = c.kind === 'exercise' ? 'none' : 'pan-y';
    if (c.kind !== 'idle') this.grab = null;
    if (c.kind === 'exercise') {
      if (this.ex?.id !== c.id && this.exLoading !== c.id) void this.loadExercise(c.id, h);
      else if (this.ex?.id === c.id) this.applyExercise(c, prev?.kind !== 'exercise' || (prev.kind === 'exercise' && prev.still !== c.still));
      this.applyBody(c.body);
    } else {
      this.unloadExercise();
      this.idleAction.enabled = true;
      this.idleAction.paused = c.kind === 'figures';
      if (c.kind === 'figures') { this.idleAction.time = 0; this.mixer.update(0); }
      this.uniforms.uSide.value = 0;
      if (c.kind === 'idle') { this.applyBody(c.body); this.uniforms.uHighlight.value = 0; this.stage.rotation.y = this.yaw; }
      if (!prev || prev.kind !== c.kind) this.resetView();
    }
    this.dirty = true;
    this.schedule();
  }

  private async loadExercise(id: string, host: Host) {
    const seq = ++this.exSeq;
    this.exLoading = id;
    const entry = this.manifest.exercises[id];
    try {
      if (!entry) throw new Error(`нет 3D для ${id}`);
      const gltf = (await this.loader.loadAsync(assetUrl(entry.file))) as GLTF;
      if (seq !== this.exSeq) { disposeTree(gltf.scene); return; }
      const exScene = gltf.scene;
      // копия скелета в файле упражнения нужна только клипу: убираем, клип привязывается к костям двойника
      const doomed: THREE.Object3D[] = [];
      exScene.traverse((o) => {
        if (this.boneNames.has(o.name) && !this.boneNames.has(o.parent?.name ?? '')) {
          doomed.push(o.parent && o.parent !== exScene && !(o.parent as THREE.Mesh).isMesh ? o.parent : o);
        }
      });
      for (const o of doomed) o.removeFromParent();
      const clip = THREE.AnimationClip.findByName(gltf.animations, id) ?? gltf.animations[0];
      if (!clip) throw new Error(`${entry.file}: нет клипа`);
      this.unloadExercise();
      this.stage.add(exScene);
      const action = this.mixer.clipAction(clip, this.stage);
      action.setLoop(THREE.LoopRepeat, Infinity).reset().play();
      this.ex = { id, scene: exScene, action, entry };
      this.exLoading = null;
      const top = this.top();
      if (top && top.cfg.kind === 'exercise' && top.cfg.id === id) this.applyExercise(top.cfg, true);
      this.dirty = true;
      this.schedule();
    } catch (e) {
      if (seq === this.exSeq) this.exLoading = null;
      host.cb.onError?.(e);
    }
  }

  private applyExercise(c: Extract<ViewConfig, { kind: 'exercise' }>, reframe: boolean) {
    if (!this.ex) return;
    this.idleAction.enabled = false;
    this.idleAction.stop();
    this.stage.rotation.y = 0;
    this.setZones(c.primary, c.secondary);
    this.primaryLevel = this.meta.highlight.primary.intensity;
    this.uniforms.uHighlight.value = 1;
    this.uniforms.uSide.value = sideSign(c.side);
    const a = this.ex.action;
    if (c.still) {
      a.paused = false;
      a.time = bottomTime(this.ex.entry.phases);
      this.mixer.update(0);
      a.paused = true;
    } else {
      a.paused = c.paused;
      a.timeScale = c.speed;
    }
    if (reframe) {
      const e = this.ex.entry;
      this.view = { ...e.camera, bounds: e.bounds ?? null, fit_points: e.fit_points ?? null };
      this.resetView();
    }
    this.dirty = true;
  }

  private unloadExercise() {
    this.exSeq++;
    this.exLoading = null;
    if (!this.ex) return;
    this.ex.action.stop();
    this.mixer.uncacheAction(this.ex.action.getClip(), this.stage);
    this.mixer.uncacheClip(this.ex.action.getClip());
    this.stage.remove(this.ex.scene);
    disposeTree(this.ex.scene);
    this.ex = null;
    this.idleAction.enabled = true;
    this.idleAction.play();
  }

  // ---------- камера ----------
  resetView() {
    const h = this.top();
    if (!h) return;
    const w = Math.max(1, h.el.clientWidth), hh = Math.max(1, h.el.clientHeight);
    const c = h.cfg;
    if (c.kind === 'exercise' && this.view) {
      this.camera.aspect = w / hh;
      const fit = fitView(this.view, this.camera.aspect);
      this.camera.position.copy(fit.position);
      this.controls.target.copy(fit.target);
      const dist = fit.position.distanceTo(fit.target);
      this.controls.minDistance = dist * 0.5;
      this.controls.maxDistance = dist * 1.7;
      this.controls.update();
    } else {
      const n = c.kind === 'figures' ? Math.max(1, c.figures.length) : 1;
      this.camera.aspect = w / n / hh;
      const fit = fitView(this.figureView(c.kind === 'idle'), this.camera.aspect, FOV, c.kind === 'figures' ? 0.92 : 0.9);
      this.camera.position.copy(fit.position);
      this.camera.lookAt(fit.target);
    }
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  /** Фигура в покое лицом к камере; при вращении — описанный цилиндр, чтобы фигура не выходила за край. */
  private figureView(rotating: boolean): ViewSpec {
    const b = this.twinBox;
    const lo: Vec3 = [b.min.x, b.min.y, b.min.z], hi: Vec3 = [b.max.x, b.max.y, b.max.z];
    if (rotating) {
      const r = Math.max(Math.abs(lo[0]), Math.abs(hi[0]), Math.abs(lo[2]), Math.abs(hi[2]));
      lo[0] = lo[2] = -r; hi[0] = hi[2] = r;
    }
    const cy = (lo[1] + hi[1]) / 2;
    return { position: [0, cy, 3], target: [0, cy, 0], bounds: { min: lo, max: hi } };
  }

  private resize() {
    const h = this.top();
    if (!h) return;
    const w = Math.max(1, h.el.clientWidth), hh = Math.max(1, h.el.clientHeight);
    this.renderer.setSize(w, hh, false);
    this.resetView();
    this.schedule();
  }

  // ---------- цикл ----------
  private wantLoop(): boolean {
    const h = this.top();
    return !!h && !this.lost && h.visible && document.visibilityState === 'visible';
  }

  private schedule() {
    if (this.wantLoop()) {
      if (!this.looping) {
        this.looping = true;
        this.lastFrame = performance.now();
        this.renderer.setAnimationLoop((t) => this.frame(t));
      }
    } else this.stop();
  }

  private stop() {
    if (this.looping) this.renderer.setAnimationLoop(null);
    this.looping = false;
  }

  private frame(now: number) {
    const h = this.top();
    if (!h) return this.stop();
    const c = h.cfg;
    // «Сегодня» ≤ 30 FPS; пока палец крутит фигуру и пока она докручивается по инерции — до 60, чтобы шла за пальцем
    const spinning = c.kind === 'idle' && (!!this.grab?.on || Math.abs(this.spin - (c.rotate ? AUTO_SPIN : 0)) > 0.05);
    const maxFps = c.kind === 'figures' ? 0 : spinning ? 60 : c.maxFps;
    if (c.kind === 'figures' && !this.dirty) { this.lastFrame = now; return; }
    if (maxFps > 0 && now - this.lastRender < 1000 / maxFps - 2) return;
    const dt = Math.min((now - this.lastFrame) / 1000, 0.1);
    this.lastFrame = now;
    this.lastRender = now;
    if (c.kind === 'idle') {
      this.mixer.update(dt);
      if (!this.grab?.on) {
        // инерция после пальца сходит к медленному вращению, а если оно выключено — к остановке
        this.spin += ((c.rotate ? AUTO_SPIN : 0) - this.spin) * (1 - Math.exp(-dt / SPIN_TAU));
        this.yaw = wrap(this.yaw + this.spin * dt);
      }
      this.stage.rotation.y = this.yaw;
      this.renderOne();
    } else if (c.kind === 'exercise') {
      if (this.ex && !c.still && !c.paused) this.mixer.update(dt);
      this.controls.update();
      if (this.ex) {
        // фазы манифеста задают интенсивность основных зон, сглаживание 120 мс (TWIN-3D 5)
        const hl = this.meta.highlight;
        const kind = c.still ? null : phaseAt(this.ex.entry.phases, this.ex.action.time);
        const mult = (kind && (hl.phase?.multipliers?.[kind] ?? PHASE_GAIN[kind])) ?? 1;
        const target = hl.primary.intensity * (c.still ? 1 : mult);
        const tau = (hl.phase?.smoothing_ms ?? 120) / 1000;
        this.primaryLevel += (target - this.primaryLevel) * (1 - Math.exp(-dt / tau));
        for (const n of c.primary) { const id = this.zoneByName[n]; if (id !== undefined) this.zoneW[id] = this.primaryLevel; }
      }
      this.renderOne();
    } else {
      this.renderFigures(c.figures);
    }
    this.dirty = false;
    this.fpsFrames++;
    this.fpsTime += dt;
    if (this.fpsTime >= 0.5) {
      this.fps = this.fpsFrames / this.fpsTime;
      this.fpsFrames = 0;
      this.fpsTime = 0;
      for (const l of this.fpsListeners) l(this.fps);
    }
    (window as unknown as { __twin?: object }).__twin = { fps: this.fps, kind: c.kind, exercise: this.ex?.id ?? null, ready: true, yaw: this.yaw };
  }

  private renderOne() {
    const w = this.renderer.domElement.width, hh = this.renderer.domElement.height;
    this.renderer.setScissorTest(false);
    this.renderer.setViewport(0, 0, w / this.renderer.getPixelRatio(), hh / this.renderer.getPixelRatio());
    this.renderer.render(this.scene, this.camera);
  }

  private renderFigures(figs: Figure[]) {
    const pr = this.renderer.getPixelRatio();
    const W = this.renderer.domElement.width / pr, H = this.renderer.domElement.height / pr;
    const n = Math.max(1, figs.length);
    const cw = W / n;
    this.renderer.setScissorTest(true);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.clear();
    figs.forEach((f, i) => {
      this.applyBody(f.body);
      this.stage.rotation.y = THREE.MathUtils.degToRad(f.yaw ?? 0);
      if (f.zones) { this.setZoneWeights(f.zones); this.uniforms.uHighlight.value = 1; } else this.uniforms.uHighlight.value = 0;
      this.renderer.setViewport(i * cw, 0, cw, H);
      this.renderer.setScissor(i * cw, 0, cw, H);
      this.renderer.render(this.scene, this.camera);
    });
    this.renderer.setScissorTest(false);
  }

  /**
   * «Сегодня»: фигура крутится пальцем вокруг вертикали на 360°, свайп на ширину карточки — полный оборот. Жест признаётся,
   * когда палец ушёл по горизонтали дальше 6 px и больше, чем по вертикали; вертикальный жест браузер отдаёт прокрутке
   * (touch-action: pan-y) и присылает pointercancel. После отпускания — инерция, тап по карточке не срабатывает.
   */
  private listenSpin() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      if (this.top()?.cfg.kind !== 'idle' || (e.pointerType === 'mouse' && e.button !== 0)) return;
      this.grab = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), on: false, v: 0 };
    });
    c.addEventListener('pointermove', (e) => {
      const g = this.grab;
      if (!g || e.pointerId !== g.id) return;
      const dx = e.clientX - g.x;
      if (!g.on) {
        if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(e.clientY - g.y)) return;
        g.on = true;
        c.setPointerCapture(e.pointerId);
      }
      const now = performance.now();
      const da = (dx * TAU) / Math.max(200, c.clientWidth);
      this.yaw = wrap(this.yaw + da);
      g.v = 0.5 * g.v + 0.5 * (da / (Math.max(8, now - g.t) / 1000));
      g.x = e.clientX;
      g.y = e.clientY;
      g.t = now;
      this.dirty = true;
    });
    const release = (e: PointerEvent) => {
      const g = this.grab;
      if (!g || e.pointerId !== g.id) return;
      this.grab = null;
      if (!g.on) return;
      const now = performance.now();
      this.grabEnd = now;
      // палец остановился перед отпусканием — без броска
      this.spin = now - g.t > 80 ? 0 : clamp(g.v, -MAX_SPIN, MAX_SPIN);
    };
    c.addEventListener('pointerup', release);
    c.addEventListener('pointercancel', release);
    // отпускание после поворота — не тап: «Сегодня» не уходит в «Прогресс»
    c.addEventListener('click', (e) => {
      if (performance.now() - this.grabEnd < 400) {
        e.stopPropagation();
        e.preventDefault();
      }
    });
  }

  onFps(cb: (fps: number) => void): () => void {
    this.fpsListeners.add(cb);
    return () => this.fpsListeners.delete(cb);
  }
}

function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((mat) => {
      for (const v of Object.values(mat)) if (v && (v as THREE.Texture).isTexture) (v as THREE.Texture).dispose();
      mat.dispose();
    });
  });
}

let engineP: Promise<Engine> | null = null;

/** Движок один на приложение; нет WebGL или ассетов — ошибка (экран показывает запасной вариант). */
export function getEngine(): Promise<Engine> {
  engineP ??= (async () => {
    if (!webglAvailable()) throw new Error('WebGL недоступен');
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    const e = new Engine(renderer);
    await e.load();
    return e;
  })().catch((err) => {
    engineP = null;
    throw err;
  });
  return engineP;
}

export type { Engine };
