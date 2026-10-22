import { useEffect } from 'react';
import { useGame, type Speed } from '../store/gameStore';

const SPEEDS: { value: Speed; label: string; title: string }[] = [
  { value: 0, label: '⏸', title: 'Pause (Espace)' },
  { value: 1, label: '▶ x1', title: 'Vitesse normale' },
  { value: 2, label: '⏩ x2', title: 'Vitesse double' },
];

export function TimeControls() {
  const speed = useGame((s) => s.speed);
  const setSpeed = useGame((s) => s.setSpeed);

  useEffect(() => {
    let last: Speed = 1;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      e.preventDefault();
      const cur = useGame.getState().speed;
      if (cur === 0) setSpeed(last);
      else {
        last = cur;
        setSpeed(0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setSpeed]);

  return (
    <div className="time-controls">
      {SPEEDS.map((s) => (
        <button key={s.value} className={speed === s.value ? 'active' : ''} onClick={() => setSpeed(s.value)} title={s.title}>
          {s.label}
        </button>
      ))}
    </div>
  );
}
