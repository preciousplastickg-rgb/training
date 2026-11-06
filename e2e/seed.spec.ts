import { expect, test } from '@playwright/test';

test('на демо-данных за 8 недель все графики отрисованы, прогноз даты цели есть', async ({ page }) => {
  await page.goto('./#/dev/seed');
  await page.getByRole('button', { name: 'Заполнить' }).click();
  await expect(page.getByText(/Готово:/)).toBeVisible();
  await page.goto('./#/today');
  await page.reload();
  await expect(page.getByText(/прогноз: \d+ \S+/)).toBeVisible();

  await page.goto('./#/progress');
  await expect(page.getByRole('img', { name: 'Силуэт прогресса' })).toBeVisible();
  await expect(page.getByRole('img', { name: /График веса/ })).toBeVisible();
  await page.getByRole('tab', { name: 'Сила' }).click();
  await expect(page.getByRole('img', { name: 'Карта мышц спереди' })).toBeVisible();
  await expect(page.getByRole('img', { name: /^e1RM: / }).first()).toBeVisible();
  await page.getByRole('tab', { name: 'Питание' }).click();
  await expect(page.getByRole('img', { name: /Средние калории по неделям/ })).toBeVisible();
  await page.getByRole('tab', { name: 'Дисциплина' }).click();
  await expect(page.getByRole('img', { name: 'Тепловая карта дисциплины' })).toBeVisible();
  await expect(page.getByText(/Выполнено \d+ из \d+ тренировок · серия \d+/)).toBeVisible();
});

test('календарь тренировок: A/B по дням, бассейн, подробности дня', async ({ page }) => {
  await page.goto('./#/dev/seed');
  await page.getByRole('button', { name: 'Заполнить' }).click();
  await expect(page.getByText(/Готово:/)).toBeVisible();
  await page.goto('./#/workout');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Январь 2027' })).toBeVisible();
  // «Сегодня» демо-данных — пн 4 января: зал по чередованию, дальше вт — бассейн.
  await expect(page.getByRole('button', { name: /^Понедельник, 4 января: зал [AB] по плану/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Вторник, 5 января: бассейн по плану/ })).toBeVisible();
  await page.getByRole('button', { name: 'Предыдущий месяц' }).click();
  await page.getByRole('button', { name: /^Среда, 30 декабря/ }).click();
  await expect(page.getByRole('dialog', { name: 'Среда, 30 декабря' }).getByText('СДЕЛАНО')).toBeVisible();
  await expect(page.getByRole('dialog').getByText(/разгрузка/).first()).toBeVisible();
  // История: бассейн рядом с залом.
  await page.keyboard.press('Escape');
  await expect(page.getByText(/· Бассейн/).first()).toBeVisible();
});
