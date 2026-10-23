import { useEffect, useState } from 'react';
import { TUNING } from '../game/events';
import { useGame } from '../store/gameStore';
import { RichText } from './icons/Icon';

type Kind = 'raid' | 'storm' | 'flood' | 'fire';

let audio: AudioContext | null = null;

/** Petit signal sonore synthétisé (aucun fichier audio) ; silencieux si l'audio est indisponible */
function beep(kind: Kind) {
  try {
    audio ??= new AudioContext();
    const ctx = audio;
    const notes = { raid: [523, 392], storm: [196, 147], flood: [330, 262], fire: [659, 659] }[kind];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const t = ctx.currentTime + i * 0.14;
      o.type = kind === 'storm' ? 'triangle' : 'square';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.14);
    });
  } catch {
    // audio indisponible
  }
}

/** Flash discret sur les bords de l'écran (et petit son) quand un événement en temps réel commence */
export function EventFlash() {
  const [flash, setFlash] = useState<{ kind: Kind; key: number } | null>(null);

  useEffect(
    () =>
      useGame.subscribe((s, prev) => {
        const g = s.game;
        const p = prev.game;
        if (g === p || g.map.seed !== p.map.seed) return;
        const fires = (x: typeof g) => x.buildings.filter((b) => b.fire).length;
        const kind: Kind | null =
          g.raid && !p.raid ? 'raid' : g.storm && !p.storm ? 'storm' : g.flood && !p.flood ? 'flood' : g.buildings !== p.buildings && fires(g) > 0 && fires(p) === 0 ? 'fire' : null;
        if (!kind) return;
        setFlash({ kind, key: Date.now() });
        if (s.settings.sound) beep(kind);
      }),
    [],
  );

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), TUNING.alert.flashMs);
    return () => clearTimeout(t);
  }, [flash]);

  if (!flash) return null;
  return <div key={flash.key} className={`event-flash ${flash.kind}`} style={{ animationDuration: `${TUNING.alert.flashMs}ms` }} />;
}

/** Message éphémère (action impossible…) */
export function Toast() {
  const toast = useGame((s) => s.toast);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!toast) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2200);
    return () => clearTimeout(t);
  }, [toast]);
  if (!toast || !visible) return null;
  return (
    <div key={toast.at} className="toast">
      <RichText text={toast.text} />
    </div>
  );
}
