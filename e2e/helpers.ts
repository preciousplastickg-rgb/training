import type { Page } from '@playwright/test';

/** Пройти первый запуск с настройками по умолчанию. */
export async function skipOnboarding(page: Page, path = './'): Promise<void> {
  await page.goto(path);
  const skip = page.getByRole('button', { name: 'Пропустить' });
  await skip.waitFor({ timeout: 10_000 });
  await skip.click();
  await page.getByRole('navigation', { name: 'Основное меню' }).waitFor();
}
