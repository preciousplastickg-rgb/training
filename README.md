# Тренировки и питание

PWA для iPhone: программа тренировок с прогрессией, режим тренировки с таймером отдыха,
вес и замеры, дневник питания, прогресс (графики, силуэт, рекорды, дисциплина).
Работает офлайн, данные только на телефоне (IndexedDB), бэкап — JSON в «Файлы».

Спецификация — [docs/SPEC.md](docs/SPEC.md), правила работы — [CLAUDE.md](CLAUDE.md).

```sh
npm install
npm run dev        # разработка
npm run seed       # dev: открыть страницу демо-данных за 8 недель
npm test           # Vitest: вся логика src/domain, схема БД, бэкап
npm run test:e2e   # Playwright, WebKit iPhone 13 (нужно: npx playwright install webkit)
npm run build      # сборка в dist/; BASE_PATH=/repo/ — для GitHub Pages
npm run icons      # перегенерировать иконки в public/icons
```

Структура:

- `src/domain/` — чистые функции: что сегодня, прогрессия, разминка, блины, средний вес,
  % жира, прогноз, питание, корректировки, рекорды, дисциплина, поза манекена, силуэт.
- `src/data/` — seed: программа, 19 упражнений с подсказками, 150 продуктов, анимации, карта мышц.
- `src/db/` — Dexie (схема v1), операции, бэкап/импорт (zod).
- `src/screens/`, `src/components/` — интерфейс.
- `/#/dev/animations` — все позы манекена (start и end) для проверки глазами.

Деплой — GitHub Actions ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)) на каждый push в `main`.
