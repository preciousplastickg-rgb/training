import { expect, test } from '@playwright/test';

test('на демо-данных за 8 недель все графики отрисованы, прогноз даты цели есть', async ({ page }) => {
  await page.goto('./#/dev/seed');
  await page.getByRole('button', { name: 'Заполнить' }).click();
  await expect(page.getByText(/Готово:/)).toBeVisible();
  await page.goto('./#/today');
  await page.reload();
  await expect(page.getByText('прогноз', { exact: true })).toBeVisible();
  await expect(page.getByText(/^\d+ [а-я]+$/).first()).toBeVisible();

  await page.goto('./#/progress');
  await expect(page.getByRole('img', { name: 'Силуэт прогресса' })).toBeVisible();
  await expect(page.getByRole('img', { name: /График веса/ })).toBeVisible();
  await page.getByRole('tab', { name: 'Сила' }).click();
  await expect(page.getByRole('img', { name: 'Карта мышц спереди' })).toBeVisible();
  await expect(page.getByRole('img', { name: /^e1RM: / }).first()).toBeVisible();
  await page.getByRole('tab', { name: 'Питание' }).click();
  await expect(page.getByRole('img', { name: /Средние калории по неделям/ })).toBeVisible();
  await page.getByRole('tab', { name: 'Режим' }).click();
  await expect(page.getByRole('img', { name: 'Тепловая карта дисциплины' })).toBeVisible();
  await expect(page.getByText(/^\d+% тренировок$/)).toBeVisible();
  await expect(page.getByText(/^лучшая — \d+$/)).toBeVisible();
});

test('календарь тренировок: A/B по дням, бассейн, подробности дня', async ({ page }) => {
  await page.goto('./#/dev/seed');
  await page.getByRole('button', { name: 'Заполнить' }).click();
  await expect(page.getByText(/Готово:/)).toBeVisible();
  await page.goto('./#/workout');
  await page.reload();
  // «Эта неделя»: сегодня — пн 4 января, зал.
  await expect(page.getByRole('list', { name: 'Эта неделя' }).getByText('сегодня')).toBeVisible();
  await page.getByRole('button', { name: 'Календарь' }).click();
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
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^\d+ \S+ · Бассейн$/ }).first()).toBeVisible();
});

test('правка дня в календаре и удаление ошибочной тренировки из истории', async ({ page }) => {
  await page.goto('./#/dev/seed');
  await page.getByRole('button', { name: 'Заполнить' }).click();
  await expect(page.getByText(/Готово:/)).toBeVisible();
  await page.goto('./#/workout');
  await page.reload();
  await page.getByRole('button', { name: 'Календарь' }).click();
  // Вторник 5 января по расписанию — бассейн; делаем его залом.
  await page.getByRole('button', { name: /^Вторник, 5 января/ }).click();
  const day = page.getByRole('dialog', { name: 'Вторник, 5 января' });
  await day.getByRole('radio', { name: 'Зал' }).click();
  await expect(day.getByText('ПЛАН · ИЗМЕНЁН ВРУЧНУЮ')).toBeVisible();
  await expect(day.getByText(/^Тренировка [AB]/)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /^Вторник, 5 января: зал [AB] по плану/ })).toBeVisible();
  await page.keyboard.press('Escape');

  // История: тап по тренировке → подходы → удалить.
  const first = page.getByRole('button', { name: /^\d+ \S+ · Тренировка [AB]/ }).first();
  const title = (await first.textContent()) ?? '';
  await first.click();
  const sheet = page.getByRole('dialog', { name: /^Тренировка [AB]$/ });
  await expect(sheet.getByText(/подходов/)).toBeVisible();
  await sheet.getByRole('button', { name: 'Удалить тренировку' }).click();
  await sheet.getByRole('button', { name: 'Да, удалить' }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole('button', { name: /^\d+ \S+ · Тренировка [AB]/ }).first()).not.toHaveText(title);
});
