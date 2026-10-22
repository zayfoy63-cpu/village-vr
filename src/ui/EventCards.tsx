import { useEffect, useRef, useState } from 'react';
import { RESOURCE_KEYS, RESOURCE_META } from '../game/config';
import { canAfford } from '../game/rules';
import type { Notice, Resources } from '../game/types';
import { useGame } from '../store/gameStore';

const VISIBLE_MS = 9000;
const MAX_CARDS = 5;

function fmt(r: Partial<Resources>) {
  return RESOURCE_KEYS.filter((k) => r[k]).map((k) => `${r[k]} ${RESOURCE_META[k].icon}`).join(' + ');
}

/** Cartes de notification des événements (disparaissent seules, sauf les offres du marchand) */
export function EventCards() {
  const notices = useGame((s) => s.game.notices);
  const resources = useGame((s) => s.game.resources);
  const trade = useGame((s) => s.trade);
  const [now, setNow] = useState(() => Date.now());
  // Heure d'apparition à l'écran de chaque notification (côté UI uniquement)
  const seenAt = useRef(new Map<number, number>());
  const [dismissed, setDismissed] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const day = useGame((s) => s.game.day);
  const firstRender = useRef(true);
  // Enregistre l'heure d'apparition ; au chargement d'une sauvegarde, les vieilles notifications restent cachées
  for (const n of notices) {
    if (seenAt.current.has(n.id)) continue;
    const stale = firstRender.current && n.day < day && !n.trade;
    seenAt.current.set(n.id, stale ? 0 : Date.now());
  }
  firstRender.current = false;

  const visible = notices
    .filter((n: Notice) => {
      if (dismissed.has(n.id)) return false;
      if (n.trade) return !n.trade.resolved;
      const t = seenAt.current.get(n.id) ?? 0;
      return now - t < VISIBLE_MS;
    })
    .slice(-MAX_CARDS)
    .reverse();

  const dismiss = (id: number) => setDismissed((d) => new Set(d).add(id));

  return (
    <div className="event-cards">
      {visible.map((n) => (
        <div key={n.id} className={`event-card ${n.kind}`}>
          <div className="event-head">
            <span className="event-icon">{n.icon}</span>
            <span className="event-title">{n.title}</span>
            <span className="event-day">Jour {n.day}</span>
            {!n.trade && (
              <button className="event-close" onClick={() => dismiss(n.id)} title="Fermer">
                ×
              </button>
            )}
          </div>
          <div className="event-text">{n.text}</div>
          {n.trade && (
            <div className="event-trade">
              {n.trade.options.map((o, i) => (
                <button key={i} disabled={!canAfford(resources, o.give)} onClick={() => trade(n.id, i)}>
                  <strong>{o.label}</strong>
                  <span>
                    {fmt(o.give)} → {fmt(o.get)}
                  </span>
                </button>
              ))}
              <button className="refuse" onClick={() => trade(n.id, null)}>
                Refuser
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
