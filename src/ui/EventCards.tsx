import { useEffect, useRef, useState } from 'react';
import { DAY_DURATION_SEC } from '../game/config';
import { TUNING, formatResources } from '../game/events';
import { canAfford } from '../game/rules';
import type { Notice } from '../game/types';
import { useGame } from '../store/gameStore';

const VISIBLE_MS = 9000;
const MAX_CARDS = 6;

const isOpenChoice = (n: Notice) => !!n.choice && !n.choice.resolved;
const isOpenThreat = (n: Notice) => !!n.threat && !n.threat.done;

function countdownLabel(arriveDay: number, day: number): string {
  const d = arriveDay - day;
  if (d <= 0) return 'Arrive aujourd\'hui';
  if (d === 1) return 'Arrive demain';
  return `Arrive dans ${d} jours`;
}

/**
 * Cartes d'événements, par priorité : choix en attente (avec délai), menaces annoncées
 * (compte à rebours), puis nouvelles récentes (qui disparaissent seules).
 */
export function EventCards() {
  const notices = useGame((s) => s.game.notices);
  const resources = useGame((s) => s.game.resources);
  const day = useGame((s) => s.game.day);
  // Temps de jeu arrondi : re-rendu ~2 fois par seconde, pas à chaque image
  const now = useGame((s) => Math.floor((s.game.day + s.game.dayProgress) * 40) / 40);
  const speed = useGame((s) => s.speed);
  const autoPaused = useGame((s) => s.resumeSpeed !== null && s.speed === 0);
  const choose = useGame((s) => s.choose);
  const [clock, setClock] = useState(() => Date.now());
  const seenAt = useRef(new Map<number, number>());
  const [dismissed, setDismissed] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    const t = setInterval(() => setClock(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const firstRender = useRef(true);
  // Heure d'apparition ; au chargement d'une sauvegarde, les vieilles nouvelles restent cachées
  for (const n of notices) {
    if (seenAt.current.has(n.id)) continue;
    const stale = firstRender.current && n.day < day && !isOpenChoice(n) && !isOpenThreat(n);
    seenAt.current.set(n.id, stale ? 0 : Date.now());
  }
  firstRender.current = false;

  const choices = notices.filter((n) => isOpenChoice(n) && !n.threat);
  // Les menaces sont listées dans "Menaces à venir" ; ici seulement celles qui attendent une préparation
  const threats = notices.filter((n) => isOpenThreat(n) && isOpenChoice(n));
  const recent = notices.filter(
    (n) =>
      !isOpenChoice(n) &&
      !isOpenThreat(n) &&
      !dismissed.has(n.id) &&
      clock - (seenAt.current.get(n.id) ?? 0) < VISIBLE_MS,
  );
  const visible = [...choices, ...threats.sort((a, b) => a.threat!.arriveDay - b.threat!.arriveDay), ...recent.reverse()].slice(
    0,
    MAX_CARDS,
  );

  const dismiss = (id: number) => setDismissed((d) => new Set(d).add(id));

  return (
    <div className="event-cards">
      {visible.map((n) => {
        const c = n.choice && !n.choice.resolved ? n.choice : null;
        const remaining = c ? Math.max(0, c.expiresT - now) : 0;
        const isPrepare = !!n.threat;
        return (
          <div key={n.id} className={`event-card ${n.kind} ${c ? 'has-choice' : ''}`}>
            <div className="event-head">
              <span className="event-icon">{n.icon}</span>
              <span className="event-title">{n.title}</span>
              {n.threat && !n.threat.done ? (
                <span className="event-countdown">⏳ {countdownLabel(n.threat.arriveDay, day)}</span>
              ) : (
                <span className="event-day">Jour {n.day}</span>
              )}
              {!c && !isOpenThreat(n) && (
                <button className="event-close" onClick={() => dismiss(n.id)} title="Fermer">
                  ×
                </button>
              )}
            </div>
            <div className="event-text">{n.text}</div>
            {c && (
              <div className="event-choice">
                {!isPrepare && (
                  <div className="choice-timer" title="Sans réponse, l'option par défaut s'applique">
                    <div
                      className="choice-timer-fill"
                      style={{ width: `${Math.min(100, (remaining / TUNING.choiceTimeout) * 100)}%` }}
                    />
                    <span>
                      {autoPaused
                        ? '⏸ Jeu en pause : prenez votre temps'
                        : speed === 0
                          ? '⏸ En pause'
                          : `${Math.ceil((remaining * DAY_DURATION_SEC) / speed)} s pour décider`}
                    </span>
                  </div>
                )}
                {c.options.map((o) => {
                  const affordable = !o.cost || canAfford(resources, o.cost);
                  return (
                    <button
                      key={o.id}
                      className={`choice-btn ${o.id === c.defaultId ? 'is-default' : ''}`}
                      disabled={!affordable}
                      onClick={() => choose(n.id, o.id)}
                    >
                      <span className="choice-label">
                        {o.label}
                        {o.cost && <span className={`choice-cost ${affordable ? '' : 'missing'}`}>{formatResources(o.cost)}</span>}
                      </span>
                      {o.detail && <span className="choice-detail">{o.detail}</span>}
                      {o.effects && o.effects.length > 0 && (
                        <span className="choice-effects">
                          {o.effects.map((e, i) => (
                            <span key={i} className={`fx ${e.tone}`}>
                              {e.icon} {e.text}
                            </span>
                          ))}
                        </span>
                      )}
                      {o.id === c.defaultId && <span className="choice-default">par défaut</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
