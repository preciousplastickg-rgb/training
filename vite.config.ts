/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';
import pkg from './package.json' with { type: 'json' };

// GitHub Pages отдаёт приложение из /<repo>/, локально — из /.
const base = process.env.BASE_PATH ?? '/';

// Сборка — хеш коммита и время: в настройках видно, какая версия стоит на телефоне.
function gitCommit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'dev';
  }
}
const built = new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Bishkek', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const build = `${gitCommit().slice(0, 7)} · ${built}`;

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(pkg.version), __APP_BUILD__: JSON.stringify(build) },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'Тренировки и питание',
        short_name: 'Тренировки',
        description: 'Личный тренер: программа, тренировки, вес и питание',
        lang: 'ru',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F2F0EB',
        theme_color: '#F2F0EB',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 3D-двойник (docs/TWIN-3D.md, 3; решение владельца 9 ноября 2026): весь public/3d/ (~4,3 МБ) и декодер Draco
        // в precache — после первой загрузки все упражнения открываются в авиарежиме.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}', '3d/**/*.{glb,webp,json,txt}', 'draco/*.{js,wasm}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // DRACOLoader из three r187 сам ссылается на декодер в node_modules (new URL(..., import.meta.url)) — Vite кладёт
        // копии в assets/. Приложение берёт декодер из public/draco/ (setDecoderPath), копии в precache не нужны.
        globIgnores: ['assets/draco_*'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['src/test/setup.ts'],
  },
});
