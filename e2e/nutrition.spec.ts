import { expect, test } from '@playwright/test';
import { skipOnboarding } from './helpers';

test('продукт за 3 тапа, итоги сходятся с ручным расчётом, свайп удаляет', async ({ page }) => {
  // воскресенье — день отдыха, норма 2050 ккал (в день зала 2300)
  await page.clock.install({ time: new Date('2026-11-08T09:00:00+06:00') });
  await skipOnboarding(page, './#/nutrition');
  await page.goto('./#/nutrition');

  // тап 1: «Добавить» у завтрака; поиск — ввод текста; тап 2: продукт; тап 3: «Добавить»
  await page.getByRole('button', { name: 'Завтрак: добавить' }).click();
  await page.getByRole('textbox', { name: 'Поиск продукта' }).fill('грудка');
  await page.getByRole('button', { name: /^Куриная грудка, сырая/ }).click();
  await page.getByRole('button', { name: 'Добавить в завтрак' }).click();

  // яйцо: пресет «1 шт» = 55 г
  await page.getByRole('button', { name: 'Завтрак: добавить' }).click();
  await page.getByRole('textbox', { name: 'Поиск продукта' }).fill('яйцо');
  await page.getByRole('button', { name: /^Яйцо куриное/ }).click();
  await page.getByRole('button', { name: 'Добавить в завтрак' }).click();

  // 100 г грудки = 110 ккал, 23 г белка; 55 г яйца = 85 ккал, 6,9 г белка → 195 ккал, белок 29,9 → 30
  await expect(page.getByRole('img', { name: 'Белок 30 из 155 г' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Калории 195 из 2050' })).toBeVisible();

  // быстрая запись: напиток на 100 мл, порция в мл → продукт в базе. 500 мл × 40 ккал/100 мл = 200 ккал, белок 12,5 г
  await page.getByRole('button', { name: 'Обед: добавить' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^Быстро/ }).click();
  await page.getByRole('textbox', { name: 'Название' }).fill('Айран домашний');
  await page.getByRole('radio', { name: /миллилитры/ }).click();
  await expect(page.getByText('На 100 мл — как на этикетке')).toBeVisible();
  await page.getByRole('textbox', { name: 'Калории' }).fill('40');
  await page.getByRole('textbox', { name: 'Белок' }).fill('2,5');
  await page.getByRole('button', { name: '500 мл' }).click();
  await page.getByRole('button', { name: 'Добавить в обед' }).click();
  await expect(page.getByRole('img', { name: /Калории 395 из 2050/ })).toBeVisible();
  await expect(page.getByText('500 мл')).toBeVisible();

  // удалить с возвратом
  const row = page.getByText('Айран домашний').locator('xpath=ancestor::div[1]');
  await row.dispatchEvent('pointerdown', { clientX: 300, clientY: 400, pointerId: 1, isPrimary: true });
  await row.dispatchEvent('pointermove', { clientX: 240, clientY: 400, pointerId: 1, isPrimary: true });
  await row.dispatchEvent('pointermove', { clientX: 180, clientY: 400, pointerId: 1, isPrimary: true });
  await row.dispatchEvent('pointerup', { clientX: 180, clientY: 400, pointerId: 1, isPrimary: true });
  await page.getByRole('button', { name: 'Удалить запись' }).last().click();
  await expect(page.getByText('Запись удалена')).toBeVisible();
  await page.getByRole('button', { name: 'Вернуть' }).click();
  await expect(page.getByRole('img', { name: /Калории 395 из 2050/ })).toBeVisible();

  // продукт из быстрой записи — в базе: находится поиском, на 100 мл
  await page.getByRole('button', { name: 'Ужин: добавить' }).click();
  await page.getByRole('textbox', { name: 'Поиск продукта' }).fill('айран дом');
  await expect(page.getByRole('button', { name: /^Айран домашний/ })).toContainText('на 100 мл');
});
