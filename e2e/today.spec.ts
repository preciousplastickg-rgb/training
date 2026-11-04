import { expect, test } from '@playwright/test';

test('первый запуск: % жира и цель, затем «Сегодня», вес и бассейн', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-09T08:00:00+06:00') });
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Рост' })).toBeVisible();
  await page.getByRole('button', { name: 'Дальше' }).click();
  await page.getByRole('button', { name: 'Дальше' }).click();
  // талия 92, шея 38, рост 174,5 → ≈ 22 %
  await expect(page.getByText(/% жира ≈ 22,1/)).toBeVisible();
  await page.getByRole('button', { name: 'Дальше' }).click();
  await page.getByRole('button', { name: 'Готово' }).click();

  await expect(page.getByRole('heading', { name: 'Понедельник, 9 ноября' })).toBeVisible();
  await expect(page.getByText('Фаза 1 · неделя 1 из 4')).toBeVisible();
  // понедельник — зал, тренировка A
  await expect(page.getByRole('heading', { name: 'Тренировка A' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Начать' })).toBeVisible();
  // бассейн через «+»
  await page.getByRole('button', { name: 'Добавить запись' }).click();
  await page.getByRole('button', { name: /Бассейн/ }).click();
  await page.getByRole('dialog', { name: 'Бассейн' }).getByRole('button', { name: 'Записать' }).click();
  await expect(page.getByRole('dialog', { name: 'Бассейн' })).toBeHidden();
  // вес записан на первом шаге → «Записано»
  await expect(page.getByText(/^Записано/)).toBeVisible();
});
