# Тренировки и питание

PWA для iPhone: программа тренировок, режим тренировки, вес, питание, прогресс.
Спецификация — [docs/SPEC.md](docs/SPEC.md), правила работы — [CLAUDE.md](CLAUDE.md).

```sh
npm install
npm run dev        # разработка
npm test           # Vitest
npm run test:e2e   # Playwright, WebKit iPhone 13 (нужно: npx playwright install webkit)
npm run build      # сборка в dist/; BASE_PATH=/repo/ — для GitHub Pages
npm run icons      # перегенерировать иконки в public/icons
```

Деплой — GitHub Actions ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)) на каждый push в `main`.
