// Хеш-маршрутизация: работает из любой подпапки (GitHub Pages) и офлайн без настройки сервера.
import { useEffect, useState } from 'react';

export const ROUTES = ['today', 'workout', 'nutrition', 'progress', 'settings'] as const;
export type Route = (typeof ROUTES)[number];

export function parseRoute(hash: string): Route {
  const name = hash.replace(/^#\/?/, '').split(/[/?]/)[0] ?? '';
  return (ROUTES as readonly string[]).includes(name) ? (name as Route) : 'today';
}

export function navigate(route: Route): void {
  const next = `#/${route}`;
  if (window.location.hash !== next) window.location.hash = next;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
