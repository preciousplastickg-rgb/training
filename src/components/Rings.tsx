import { useEffect, useState } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface Ring {
  value: number;
  color: string;
  label: string;
}

/** Концентрические кольца: толщина 12 px, скруглённые концы, заполнение 400 мс (SPEC 9). */
export function Rings({ rings, size = 148, children }: { rings: Ring[]; size?: number; children?: React.ReactNode }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const stroke = 12;
  const gap = 4;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={rings.map((r) => r.label).join(', ')}>
        {rings.map((r, i) => {
          const radius = size / 2 - stroke / 2 - i * (stroke + gap);
          const c = 2 * Math.PI * radius;
          const v = Math.max(0, Math.min(1, r.value));
          return (
            <g key={i} transform={`rotate(-90 ${size / 2} ${size / 2})`}>
              <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--track)" strokeWidth={stroke} />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={r.color}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={shown ? c * (1 - v) : c}
                style={{ transition: reduced ? undefined : 'stroke-dashoffset 400ms ease-out' }}
                opacity={v === 0 ? 0 : 1}
              />
            </g>
          );
        })}
      </svg>
      {children && <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>}
    </div>
  );
}
