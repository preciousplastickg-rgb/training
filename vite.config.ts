/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';
import pkg from './package.json' with { type: 'json' };

/**
 * DRACOLoader из three r187 при загрузке модуля ссылается на декодеры в node_modules (`new URL('../libs/draco/…',
 * import.meta.url)`), и Vite копирует их в assets/ (JS-фолбэк 719 КБ, wasm 286 КБ, обёртки). Приложение берёт декодер
 * из public/draco/ (docs/TWIN-3D.md, 3), поэтому ссылки заменяются пустой строкой — копий в сборке нет.
 */
function noBundledDraco(): Plugin {
  return {
    name: 'no-bundled-draco',
    enforce: 'pre',
    transform(code, id) {
      if (!/[\\/]DRACOLoader\.js$/.test(id)) return null;
      const out = code.replace(/new URL\(\s*'\.\.\/libs\/draco\/[^']+',\s*import\.meta\.url\s*\)\.toString\(\)/g, "''");
      if (out === code) this.error('no-bundled-draco: ссылки на декодер в DRACOLoader не найдены — проверить версию three');
      return { code: out, map: null };
    },
  };
}

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
  // .glb — ассет: unit-тесты читают twin.glb и клипы через `?inline` (этап 5c); приложение берёт их из public/3d/
  assetsInclude: ['**/*.glb'],
  define: { __APP_VERSION__: JSON.stringify(pkg.version), __APP_BUILD__: JSON.stringify(build) },
  plugins: [
    noBundledDraco(),
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
        // в precache — после первой загрузки все упражнения открываются в авиарежиме. Draco — только wasm и его обёртка
        // (~0,25 МБ): JS-фолбэк не нужен, WebAssembly есть во всех поддерживаемых Safari.
        globPatterns: [
          '**/*.{js,css,html,svg,png,woff2,webmanifest}',
          '3d/**/*.{glb,webp,json,txt}',
          'draco/draco_wasm_wrapper.js',
          'draco/draco_decoder.wasm',
        ],
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
