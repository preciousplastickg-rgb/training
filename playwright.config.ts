import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const DEV_PORT = 5188;

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: 0,
  reporter: 'list',
  use: { baseURL: `http://localhost:${PORT}/` },
  projects: [
    { name: 'iphone-13', use: { ...devices['iPhone 13'] }, testIgnore: /seed\.spec/ },
    // Демо-данные (npm run seed) есть только в dev — проверка графиков на них идёт через dev-сервер.
    { name: 'seed-dev', use: { ...devices['iPhone 13'], baseURL: `http://localhost:${DEV_PORT}/` }, testMatch: /seed\.spec/ },
  ],
  webServer: [
    {
      command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
      url: `http://localhost:${PORT}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `npx vite --port ${DEV_PORT} --strictPort`,
      url: `http://localhost:${DEV_PORT}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
