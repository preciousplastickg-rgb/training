import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Шрифты (REDESIGN 1.2): Unbounded — заголовки и крупные цифры, Manrope — остальной текст.
// Подмножества cyrillic + latin; файлы попадают в precache — работают без сети.
import '@fontsource/unbounded/cyrillic-500.css';
import '@fontsource/unbounded/latin-500.css';
import '@fontsource/unbounded/cyrillic-600.css';
import '@fontsource/unbounded/latin-600.css';
import '@fontsource/unbounded/cyrillic-700.css';
import '@fontsource/unbounded/latin-700.css';
import '@fontsource/manrope/cyrillic-400.css';
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/cyrillic-500.css';
import '@fontsource/manrope/latin-500.css';
import '@fontsource/manrope/cyrillic-600.css';
import '@fontsource/manrope/latin-600.css';
import '@fontsource/manrope/cyrillic-700.css';
import '@fontsource/manrope/latin-700.css';
import '@fontsource/manrope/cyrillic-800.css';
import '@fontsource/manrope/latin-800.css';
import './styles/index.css';
import { App } from './app/App';
import { installViewportFix } from './app/viewport';

installViewportFix();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
