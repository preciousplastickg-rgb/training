import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_SETTINGS, twin3dOf } from '../../db/db';
import type { BodyEntry, Settings } from '../../db/types';
import { twinGoal, twinHistory, twinNow, twinStart, type TwinBody, type TwinMeta, type TwinWeek } from '../../domain/twin';
import { useBody, useSettings } from '../../hooks/useData';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { loadManifest, manifestSync, type TwinManifest } from '../../three/assets';
import { webglAvailable } from '../../three/support';

/** manifest.json (уже загруженный — сразу, иначе после загрузки; нет файла — null). */
export function useManifest(): TwinManifest | null {
  const [m, setM] = useState(manifestSync);
  useEffect(() => {
    if (m) return;
    let alive = true;
    loadManifest().then((x) => alive && setM(x)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [m]);
  return m;
}

/** Показывать ли 3D: включено в настройках и есть WebGL. */
export function useTwin3d(): { on: boolean; rotate: boolean; reduced: boolean } {
  const settings = useSettings() ?? DEFAULT_SETTINGS;
  const reduced = useReducedMotion();
  const t = twin3dOf(settings);
  const on = t.enabled && webglAvailable();
  return { on, rotate: on && t.todayRotation && !reduced, reduced };
}

const FALLBACK_META: TwinMeta = { bfStart: 24.5, bfGoal: 15 };

export function metaOf(m: TwinManifest | null): TwinMeta {
  return m ? { bfStart: m.twin.bfStart, bfGoal: m.twin.bfGoal } : FALLBACK_META;
}

export interface TwinBodies {
  start: TwinBody;
  now: TwinBody;
  goal: TwinBody;
  history: TwinWeek[];
}

/** «Старт · Сейчас · Цель» и история по неделям — из замеров (docs/TWIN-3D.md, 4). */
export function useTwinBodies(date: string): TwinBodies {
  const settings: Settings = useSettings() ?? DEFAULT_SETTINGS;
  const body: BodyEntry[] = useBody();
  const manifest = useManifest();
  const meta = metaOf(manifest);
  return useMemo(() => {
    const p = { heightCm: settings.heightCm, startDate: settings.startDate, startWeight: settings.startWeight };
    const now = twinNow(body, p, meta, date);
    return {
      start: twinStart(body, p, meta),
      now,
      goal: twinGoal(meta, now.shape),
      history: twinHistory(body, p, meta, date),
    };
  }, [body, settings.heightCm, settings.startDate, settings.startWeight, meta.bfStart, meta.bfGoal, date]);
}
