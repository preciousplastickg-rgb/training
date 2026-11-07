import { expect, test } from '@playwright/test';

test('первый запуск: % жира и цель, затем «Сегодня», вес и бассейн', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-09T08:00:00+06:00') });
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Какой у тебя рост?' })).toBeVisible();
  await page.getByRole('button', { name: 'Дальше' }).click();
  await page.getByRole('button', { name: 'Дальше' }).click();
  // талия 92, шея 38, рост 175 → ≈ 22,1 %; цель — ориентир «≈ N кг»
  await expect(page.getByText('22,1%')).toBeVisible();
  await expect(page.getByText(/^≈ \d+ кг$/)).toBeVisible();
  await page.getByRole('button', { name: 'Дальше' }).click();
  await page.getByRole('button', { name: 'Готово' }).click();

  await expect(page.getByText('Понедельник, 9 ноября')).toBeVisible();
  await expect(page.getByText('Блок 1 · неделя 1 из 7 · фаза 1')).toBeVisible();
  // понедельник — зал, тренировка A
  await expect(page.getByRole('heading', { name: 'Тренировка A' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Начать тренировку' })).toBeVisible();
  // календарь недели — в карточке дня, открывается месячный; внизу — тело: силуэт, % жира, мышцы
  await expect(page.getByRole('list', { name: 'Эта неделя' }).getByRole('button', { name: /^Пн, 9 ноября, сегодня: зал по плану A$/ })).toBeVisible();
  await page.getByRole('button', { name: 'Календарь' }).click();
  await expect(page.getByRole('dialog', { name: 'Календарь' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('img', { name: 'Силуэт прогресса' })).toBeVisible();
  await expect(page.getByText('% жира', { exact: true })).toBeVisible();
  await expect(page.getByText('Мышцы', { exact: true })).toBeVisible();
  // бассейн через «+»
  await page.getByRole('button', { name: 'Добавить запись' }).click();
  await page.getByRole('button', { name: /Бассейн/ }).click();
  await page.getByRole('dialog', { name: 'Бассейн' }).getByRole('button', { name: 'Записать' }).click();
  await expect(page.getByRole('dialog', { name: 'Бассейн' })).toBeHidden();
  // вес записан на первом шаге → «Записано»
  await expect(page.getByLabel('Вес записан')).toBeVisible();
});
