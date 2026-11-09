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

test('жим лёжа: «Как делать» — один экран: 3D с подсветкой, мышцы и техника без вкладок', async ({ page }) => {
  const errors = collectErrors(page);
  await page.clock.install({ time: new Date('2026-11-09T09:00:00+06:00') });
  await skipOnboarding(page);
  const sheet = await openPlanExercise(page, /^Жим штанги лёжа/);
  await expect(sheet.getByRole('tab')).toHaveCount(0);
  const gl = await twinOrStills(page, sheet);
  if (gl) {
    // клип загружен и играет на двойнике
    await expect.poll(() => page.evaluate(() => (window as unknown as { __twin?: { exercise: string | null } }).__twin?.exercise), { timeout: 20_000 }).toBe('bench_press');
    await expect(sheet.getByRole('button', { name: 'Пауза' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: '0,5×' })).toBeVisible();
    // 3D — сверху, мышцы и техника — под ним в той же прокрутке
    await expect(sheet.getByRole('img', { name: /3D-анимация/ })).toBeVisible();
    await expect(sheet.getByRole('img', { name: 'Техника упражнения' })).toHaveCount(0);
  }
  const list = sheet.locator('section').filter({ hasText: 'Основные' });
  await expect(list.getByText('Грудные')).toBeVisible();
  await expect(list.getByText('Передняя дельта')).toBeVisible();
  await expect(list.getByText('Трицепс')).toBeVisible();
  await sheet.getByText('Ключевые моменты').scrollIntoViewIfNeeded();
  await expect(sheet.getByText('Ключевые моменты')).toBeVisible();
  await expect(sheet.getByText('Частые ошибки')).toBeVisible();
  await expect(sheet.getByRole('link', { name: /Видео/ })).toBeVisible();
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

test('режим тренировки: «Как делать» сразу показывает 3D, отдельной кнопки «3D» нет', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-06T09:00:00+06:00') });
  await skipOnboarding(page);
  await page.goto('./#/workout');
  await page.getByRole('button', { name: /Пробная тренировка/ }).click();
  await expect(page.getByRole('heading', { name: 'Гоблет-присед' })).toBeVisible();
  await expect(page.getByRole('button', { name: '3D: гоблет-присед' })).toHaveCount(0);
  const btn = page.getByRole('button', { name: 'Как делать' });
  const box = await btn.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(56);
  await btn.click();
  const sheet = page.getByRole('dialog', { name: 'Гоблет-присед' });
  await expect(sheet.getByRole('tab')).toHaveCount(0);
  await twinOrStills(page, sheet);
  await expect(sheet.getByText('Ключевые моменты')).toBeAttached();
});

test('«Сегодня»: фигуру крутит палец, отпускание не открывает «Прогресс»', async ({ page }) => {
  const errors = collectErrors(page);
  await skipOnboarding(page);
  const card = page.getByRole('button').filter({ has: page.getByRole('heading', { name: 'Тело' }) });
  await card.scrollIntoViewIfNeeded();
  if ((await card.locator('[data-twin]').count()) === 0) test.skip(true, 'нет WebGL — силуэт без вращения');
  const view = card.locator('[data-twin="ready"]');
  await expect(view).toBeVisible({ timeout: 20_000 });
  type Twin = { yaw: number; fps: number };
  const twin = () => page.evaluate(() => (window as unknown as { __twin?: Twin }).__twin!);
  await expect.poll(async () => (await twin())?.fps ?? 0, { timeout: 20_000 }).toBeGreaterThan(0);
  const box = (await view.boundingBox())!;
  const y = box.y + box.height / 2;
  const x0 = box.x + box.width * 0.3;
  const quarter = box.width / 4;
  const before = (await twin()).yaw;
  await page.mouse.move(x0, y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(x0 + (quarter * i) / 10, y);
  // палец остановился — без броска
  await page.waitForTimeout(150);
  const after = (await twin()).yaw;
  await page.mouse.up();
  // четверть ширины — четверть оборота (плюс медленное вращение за время жеста)
  const turned = (((after - before) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  expect(turned).toBeGreaterThan(Math.PI / 2 - 0.2);
  expect(turned).toBeLessThan(Math.PI / 2 + 0.8);
  await page.waitForTimeout(300);
  await expect(page.getByRole('heading', { level: 1, name: 'Прогресс' })).toHaveCount(0);
  // а тап по карточке — как раньше
  await card.getByText(/цель 15 % жира/i).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Прогресс' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('без WebGL: силуэт на «Сегодня», в «Как делать» — манекен и подсказки, без ошибок', async ({ page }) => {
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
  await expect(sheet.getByRole('img', { name: 'Техника упражнения' })).toBeVisible();
  await expect(sheet.locator('[data-twin]')).toHaveCount(0);
  await expect(sheet.getByText('Ключевые моменты')).toBeAttached();
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
