// Проверка WebGL без three.js — экраны решают, показывать двойника или запасной вариант (TWIN-3D 6).

let cached: boolean | null = null;

export function webglAvailable(): boolean {
  if (cached !== null) return cached;
  try {
    const c = document.createElement('canvas');
    cached = !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    cached = false;
  }
  return cached;
}
