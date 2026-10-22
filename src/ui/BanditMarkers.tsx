import { useEffect, useRef } from 'react';
import { banditScreen } from '../scene/badgeAnchors';
import { useGame } from '../store/gameStore';

const MAX = 40;
/** Marge entre le bord de l'écran et les marqueurs (px) */
const MARGIN = 18;

/**
 * Petits marqueurs rouges au bord de l'écran pour les bandits hors champ, orientés vers eux.
 * Positions lues dans badgeAnchors (calculées par la scène) et appliquées au DOM sans re-rendu React.
 */
export function BanditMarkers() {
  const active = useGame((s) => !!s.game.raid);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const loop = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      let i = 0;
      banditScreen.forEach((p) => {
        if (p.visible || i >= MAX) return;
        const el = refs.current[i++];
        if (!el) return;
        // Ramène le point sur le bord de l'écran, dans la direction du bandit depuis le centre
        const dx = p.x - w / 2;
        const dy = p.y - h / 2;
        const k = Math.min((w / 2 - MARGIN) / Math.max(1, Math.abs(dx)), (h / 2 - MARGIN) / Math.max(1, Math.abs(dy)));
        el.style.display = 'block';
        el.style.transform = `translate(${w / 2 + dx * k}px, ${h / 2 + dy * k}px) translate(-50%, -50%) rotate(${Math.atan2(dy, dx)}rad)`;
      });
      for (; i < MAX; i++) if (refs.current[i]) refs.current[i]!.style.display = 'none';
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  if (!active) return null;
  return (
    <div className="bandit-markers">
      {Array.from({ length: MAX }, (_, i) => (
        <div key={i} ref={(el) => {
            refs.current[i] = el;
          }} className="bandit-marker" />
      ))}
    </div>
  );
}
