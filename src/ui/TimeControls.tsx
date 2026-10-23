import { useEffect } from 'react';
import { useGame, type Speed } from '../store/gameStore';
import { I } from './icons';
import { Icon, RichText } from './icons/Icon';

const SPEEDS: { value: Speed; label: string; title: string }[] = [
  { value: 0, label: I.pause, title: 'Pause (Espace)' },
  { value: 0.5, label: `${I.slow} x0,5`, title: 'Ralenti : pour gérer les moments chauds' },
  { value: 1, label: `${I.play} x1`, title: 'Vitesse normale' },
  { value: 2, label: `${I.fast} x2`, title: 'Vitesse double' },
];

export function TimeControls() {
  const speed = useGame((s) => s.speed);
  const autoPaused = useGame((s) => s.resumeSpeed !== null && s.speed === 0);
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
      {autoPaused && <span className="auto-pause" title="Le jeu reprendra après votre décision"><Icon id="pause" /> Décision en attente</span>}
      {SPEEDS.map((s) => (
        <button key={s.value} className={speed === s.value ? 'active' : ''} onClick={() => setSpeed(s.value)} title={s.title}>
          <RichText text={s.label} />
        </button>
      ))}
    </div>
  );
}
