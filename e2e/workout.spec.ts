import { expect, test } from '@playwright/test';

test('подход 1 тапом, таймер от endsAt, восстановление после закрытия', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-06T09:00:00+06:00') });
  await page.goto('./#/workout');
  await page.getByRole('button', { name: /Пробная тренировка/ }).click();
  await expect(page.getByRole('heading', { name: 'Гоблет-присед' })).toBeVisible();

  // 1 тап: вес и повторы уже подставлены
  await page.getByRole('button', { name: 'Подход 1: записать' }).click();
  const timer = page.getByRole('timer');
  await expect(timer).toHaveText('2:30');

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
