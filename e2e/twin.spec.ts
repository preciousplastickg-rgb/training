import { expect, test, type Page } from '@playwright/test';
import { skipOnboarding } from './helpers';

// Этап 5b «Двойник» — docs/TWIN-3D.md, раздел 9.

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

async function openPlanExercise(page: Page, name: RegExp) {
  await page.getByRole('navigation', { name: 'Основное меню' }).getByRole('button', { name: 'Тренировка' }).click();
  await page.getByRole('button', { name: /^Состав/ }).click();
  await page.getByRole('button', { name }).first().click();
  return page.getByRole('dialog');
}

/**
 * Есть WebGL — двойник обязан загрузиться (тело и клип через Draco), запасной вариант не засчитывается.
 * Нет WebGL — статичные кадры.
 */
async function twinOrStills(page: Page, sheet: ReturnType<Page['getByRole']>) {
  const gl = await page.evaluate(() => {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  });
  if (gl) await expect(sheet.locator('[data-twin="ready"]')).toBeVisible({ timeout: 20_000 });
  else await expect(sheet.getByTestId('twin-stills')).toBeVisible({ timeout: 20_000 });
  return gl;
}

test('упражнение без 3D показывает подсказки без ошибок', async ({ page }) => {
  const errors = collectErrors(page);
  await page.clock.install({ time: new Date('2027-01-04T09:00:00+06:00') });
  await skipOnboarding(page);
  const sheet = await openPlanExercise(page, /^Тяга гантелей лёжа на наклонной скамье/);
  await expect(sheet.getByRole('heading', { name: 'Тяга гантелей лёжа на наклонной скамье' })).toBeVisible();
  await expect(sheet.getByRole('tab', { name: '3D' })).toHaveCount(0);
  await expect(sheet.getByText('Ключевые моменты')).toBeVisible();
  await expect(sheet.getByText('Частые ошибки')).toBeVisible();
  expect(errors).toEqual([]);
});

test('жим лёжа: вкладки «3D · Мышцы · Техника», подсветка груди, дельты и трицепса', async ({ page }) => {
  const errors = collectErrors(page);
  await page.clock.install({ time: new Date('2026-11-09T09:00:00+06:00') });
  await skipOnboarding(page);
  const sheet = await openPlanExercise(page, /^Жим штанги лёжа/);
  await expect(sheet.getByRole('tab', { name: '3D' })).toHaveAttribute('aria-selected', 'true');
  const gl = await twinOrStills(page, sheet);
  if (gl) {
    // клип загружен и играет на двойнике
    await expect.poll(() => page.evaluate(() => (window as unknown as { __twin?: { exercise: string | null } }).__twin?.exercise), { timeout: 20_000 }).toBe('bench_press');
    await expect(sheet.getByRole('button', { name: 'Пауза' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: '0,5×' })).toBeVisible();
  }
  await sheet.getByRole('tab', { name: 'Мышцы' }).click();
  const list = sheet.locator('section').filter({ hasText: 'Основные' });
  await expect(list.getByText('Грудные')).toBeVisible();
  await expect(list.getByText('Передняя дельта')).toBeVisible();
  await expect(list.getByText('Трицепс')).toBeVisible();
  await sheet.getByRole('tab', { name: 'Техника' }).click();
  await expect(sheet.getByText('Ключевые моменты')).toBeVisible();
  // манекен подсвечивает мышцы цветами двойника
  const fig = sheet.getByRole('img', { name: 'Техника упражнения' });
  const palette = await fig.evaluate((el) => {
    const cs = getComputedStyle(el);
    return [cs.getPropertyValue('--m-primary').trim(), cs.getPropertyValue('--m-secondary').trim()];
  });
  expect(palette.map((c) => c.toLowerCase())).toEqual(['#d85a30', '#f0997b']);
  await sheet.getByRole('button', { name: 'Закрыть' }).last().click();
  expect(errors).toEqual([]);
});

test('«Сегодня»: карточка двойника, не больше 30 FPS', async ({ page }) => {
  // часы настоящие: FPS считается по реальным кадрам
  const errors = collectErrors(page);
  await skipOnboarding(page);
  const card = page.getByRole('button').filter({ has: page.getByRole('heading', { name: 'Тело' }) });
  await card.scrollIntoViewIfNeeded();
  await expect(card.getByText(/цель 15 % жира/i)).toBeVisible();
  if ((await card.locator('[data-twin]').count()) > 0) {
    await expect(card.locator('[data-twin="ready"]')).toBeVisible({ timeout: 20_000 });
    type Twin = { fps: number; kind: string; ready: boolean };
    await expect.poll(() => page.evaluate(() => (window as unknown as { __twin?: Twin }).__twin?.fps ?? 0), { timeout: 20_000 }).toBeGreaterThan(0);
    await page.waitForTimeout(1500);
    const twin = await page.evaluate(() => (window as unknown as { __twin?: Twin }).__twin);
    expect(twin?.kind).toBe('idle');
    expect(twin!.fps).toBeLessThanOrEqual(31);
  }
  expect(errors).toEqual([]);
});

test('режим тренировки: «3D» открывает «Как делать» на вкладке «3D»', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-06T09:00:00+06:00') });
  await skipOnboarding(page);
  await page.goto('./#/workout');
  await page.getByRole('button', { name: /Пробная тренировка/ }).click();
  await expect(page.getByRole('heading', { name: 'Гоблет-присед' })).toBeVisible();
  const btn = page.getByRole('button', { name: '3D: гоблет-присед' });
  if ((await btn.count()) === 0) test.skip(true, 'нет WebGL — кнопки «3D» нет');
  const box = await btn.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(56);
  await btn.click();
  const sheet = page.getByRole('dialog', { name: 'Гоблет-присед' });
  await expect(sheet.getByRole('tab', { name: '3D' })).toHaveAttribute('aria-selected', 'true');
});

test('без WebGL: силуэт на «Сегодня», статичные кадры в «Как делать», без ошибок', async ({ page }) => {
  const errors = collectErrors(page);
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    // @ts-expect-error — подмена для проверки запасного варианта
    HTMLCanvasElement.prototype.getContext = function (type: string, ...rest: unknown[]) {
      if (/webgl/.test(type)) return null;
      return orig.call(this, type, ...rest);
    };
  });
  await page.clock.install({ time: new Date('2026-11-09T09:00:00+06:00') });
  await skipOnboarding(page);
  await expect(page.getByRole('img', { name: 'Силуэт прогресса' })).toBeVisible();
  await expect(page.locator('[data-twin]')).toHaveCount(0);
  const sheet = await openPlanExercise(page, /^Жим штанги лёжа/);
  await expect(sheet.getByRole('tab', { name: '3D' })).toBeVisible();
  const imgs = sheet.getByTestId('twin-stills').getByRole('img');
  await expect(imgs).toHaveCount(2);
  for (const img of await imgs.all()) {
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBe(640);
  }
  await sheet.getByRole('tab', { name: 'Техника' }).click();
  await expect(sheet.getByText('Ключевые моменты')).toBeVisible();
  expect(errors).toEqual([]);
});

test('офлайн: все файлы 3D и декодер Draco — из кэша, упражнение открывается без сети', async ({ page, context }) => {
  test.setTimeout(90_000);
  await page.clock.install({ time: new Date('2026-11-09T09:00:00+06:00') });
  await skipOnboarding(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  // Draco в precache — только wasm и обёртка; JS-фолбэка и копий из assets/ нет (TWIN-3D 3)
  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) urls.push(new URL(r.url).pathname);
    return urls;
  });
  expect(cached.filter((u) => /draco/i.test(u)).map((u) => u.slice(u.lastIndexOf('/') + 1)).sort()).toEqual(['draco_decoder.wasm', 'draco_wasm_wrapper.js']);
  const manifest = await page.evaluate(() => fetch('3d/manifest.json').then((r) => r.json()));
  const ids = Object.keys(manifest.exercises);
  expect(ids.length).toBeGreaterThanOrEqual(34);

  await context.setOffline(true);
  const files = [
    'manifest.json', 'muscles.json', manifest.twin.file, 'twin_id.webp', 'twin_idsoft.webp', 'twin_fibre.webp',
    ...ids.flatMap((id) => [manifest.exercises[id].file, ...manifest.exercises[id].stills]),
  ].map((f) => `3d/${f}`);
  files.push('draco/draco_decoder.wasm', 'draco/draco_wasm_wrapper.js');
  const missing = await page.evaluate(async (list) => {
    const bad: string[] = [];
    for (const f of list) {
      const r = await fetch(f).catch(() => null);
      if (!r || !r.ok || (await r.arrayBuffer()).byteLength === 0) bad.push(f);
    }
    return bad;
  }, files);
  expect(missing).toEqual([]);

  // без сети: перезапуск и упражнение с 3D
  await page.reload();
  const sheet = await openPlanExercise(page, /^Жим штанги лёжа/);
  const gl = await twinOrStills(page, sheet);
  if (gl) {
    await expect.poll(() => page.evaluate(() => (window as unknown as { __twin?: { exercise: string | null } }).__twin?.exercise), { timeout: 20_000 }).toBe('bench_press');
  }
  await context.setOffline(false);
});
