import { expect, test } from '@playwright/test';
import { skipOnboarding } from './helpers';

// В тесте нет системного окна «Поделиться» — проверяем запасной путь: загрузку файла.
const noShare = () => Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });

test('экспорт → удалить приложение → поставить → импорт: всё на месте', async ({ browser }) => {
  // «Старый телефон»: данные + экспорт
  const ctxA = await browser.newContext({ ...test.info().project.use });
  await ctxA.addInitScript(noShare);
  const a = await ctxA.newPage();
  await skipOnboarding(a);
  await a.getByRole('button', { name: 'Записать вес' }).click();
  await a.goto('./#/nutrition');
  await a.getByRole('button', { name: 'Ужин: добавить' }).click();
  await a.getByRole('textbox', { name: 'Поиск продукта' }).fill('плов');
  await a.getByRole('button', { name: /^Плов/ }).click();
  await a.getByRole('button', { name: 'Добавить в ужин' }).click();
  await expect(a.getByRole('img', { name: /Калории 735 из/ })).toBeVisible(); // порция 350 г × 210

  await a.goto('./#/settings');
  const [download] = await Promise.all([a.waitForEvent('download'), a.getByRole('button', { name: /Экспорт данных/ }).click()]);
  expect(download.suggestedFilename()).toMatch(/^fitness-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const file = test.info().outputPath('backup.json');
  await download.saveAs(file);
  await ctxA.close();

  // «Новая установка»: пустое приложение, импорт
  const ctxB = await browser.newContext({ ...test.info().project.use });
  await ctxB.addInitScript(noShare);
  const b = await ctxB.newPage();
  await skipOnboarding(b);
  await b.goto('./#/settings');
  await b.locator('input[type=file][accept*=json]').setInputFiles(file);
  await expect(b.getByText(/1 записей еды/)).toBeVisible();
  await Promise.all([b.waitForEvent('download'), b.getByRole('button', { name: 'Заменить всё' }).click()]);
  await b.waitForLoadState('load');
  await b.goto('./#/nutrition');
  await expect(b.getByRole('img', { name: /Калории 735 из/ })).toBeVisible();
  await b.goto('./#/today');
  await expect(b.getByText(/^записано/)).toBeVisible();
  await ctxB.close();
});
