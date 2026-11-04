import { expect, test } from '@playwright/test';

test('оболочка: меню, переходы, «+», настройки', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Основное меню' });
  await expect(nav).toBeVisible();

  for (const [label, heading] of [
    ['Тренировка', 'Тренировка'],
    ['Питание', 'Питание'],
    ['Прогресс', 'Прогресс'],
  ] as const) {
    await nav.getByRole('button', { name: label }).click();
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  }

  await nav.getByRole('button', { name: 'Добавить запись' }).click();
  const sheet = page.getByRole('dialog', { name: 'Добавить' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('Еда')).toBeVisible();
  await expect(sheet.getByText('Вес')).toBeVisible();
  await expect(sheet.getByText('Бассейн')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();

  await nav.getByRole('button', { name: 'Сегодня' }).click();
  await page.getByRole('button', { name: 'Настройки' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Настройки' })).toBeVisible();
});

test('тема из настроек сохраняется после перезагрузки', async ({ page }) => {
  await page.goto('/#/settings');
  await page.getByRole('radio', { name: 'Тёмная' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('radio', { name: 'Тёмная' })).toHaveAttribute('aria-checked', 'true');
});

test('зоны нажатия в меню не меньше 44 × 44', async ({ page }) => {
  await page.goto('/');
  const buttons = page.getByRole('navigation', { name: 'Основное меню' }).getByRole('button');
  await expect(buttons).toHaveCount(5);
  for (const b of await buttons.all()) {
    const box = await b.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
});

test('PWA: манифест standalone и офлайн-запуск из кэша', async ({ page, context }) => {
  await page.goto('/');
  const manifest = await (await page.request.get('/manifest.webmanifest')).json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.lang).toBe('ru');

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // После установки SW перезагрузка должна идти через него.
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Основное меню' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Основное меню' }).getByRole('button', { name: 'Питание' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Питание' })).toBeVisible();
  await context.setOffline(false);
});
