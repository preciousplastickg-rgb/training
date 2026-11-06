import { expect, test } from '@playwright/test';
import { skipOnboarding } from './helpers';

test('подход 1 тапом, таймер от endsAt, восстановление после закрытия', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-06T09:00:00+06:00') });
  await skipOnboarding(page);
  await page.goto('./#/workout');
  await page.getByRole('button', { name: /Пробная тренировка/ }).click();
  await expect(page.getByRole('heading', { name: 'Гоблет-присед' })).toBeVisible();

  // 1 тап: вес и повторы уже подставлены
  await page.getByRole('button', { name: 'Подход 1: записать' }).click();
  const timer = page.getByRole('timer');
  await expect(timer).toHaveText('2:30');
  // Панель отдыха не закрывает карточку: следующий подход можно записать прямо во время отсчёта
  await expect(page.getByRole('button', { name: 'Подход 2: записать' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Вес, подход 2: больше' })).toBeVisible();

  // «2 минуты в фоне»: время идёт, остаток считается от сохранённого endsAt
  await page.clock.fastForward('02:00');
  await expect(timer).toHaveText('0:30');

  // закрыть и открыть приложение — тренировка и таймер на месте
  await page.reload();
  await expect(page.getByRole('timer')).toHaveText(/0:[23]\d/);
  await page.getByRole('button', { name: 'Пропустить' }).click();
  await expect(page.getByRole('button', { name: 'Подход 1: отменить запись' })).toBeVisible();
  await expect(page.getByText('1 из 18')).toBeVisible();
});

test('«Как делать»: фигура, режимы «Движение / Верх / Низ», углы постоянно списком', async ({ page }) => {
  await skipOnboarding(page);
  await page.getByRole('navigation', { name: 'Основное меню' }).getByRole('button', { name: 'Тренировка' }).click();
  await page.getByRole('button', { name: /^Гоблет-присед/ }).first().click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('img', { name: 'Техника упражнения' })).toBeVisible();
  await expect(sheet.getByRole('tab', { name: 'Движение' })).toHaveAttribute('aria-selected', 'true');
  // Список углов виден всегда, а не только в крайней точке анимации.
  await expect(sheet.getByText('В нижней точке')).toBeVisible();
  await expect(sheet.getByText('Корпус')).toBeVisible();
  await sheet.getByRole('tab', { name: 'Низ' }).click();
  // Стоп-кадр: на фигуре номера подсказок.
  await expect(sheet.getByRole('img', { name: 'Техника упражнения' }).getByText('1', { exact: true })).toBeVisible();
  await expect(sheet.getByText('Основные')).toBeVisible();
});
