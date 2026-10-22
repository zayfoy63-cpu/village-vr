import { useEffect } from 'react';
import { BUILDABLE, BUILDING_BY_ID } from '../game/buildings';
import { RESOURCE_KEYS, RESOURCE_META } from '../game/config';
import { tileAt } from '../game/mapgen';
import { canAfford, canPlace } from '../game/rules';
import { useGame } from '../store/gameStore';

/** Barre de construction en bas de l'écran (clic ou touches 1 à 6, Échap pour annuler) */
export function BuildBar() {
  const resources = useGame((s) => s.game.resources);
  const selected = useGame((s) => s.selected);
  const select = useGame((s) => s.select);
  const fertile = useGame(
    (s) => s.selected === 'field' && !!s.hover && tileAt(s.game.map, s.hover.x, s.hover.z) === 'fertile',
  );
  const reason = useGame((s) =>
    s.hover && s.selected ? canPlace(s.game, s.selected, s.hover.x, s.hover.z).reason ?? null : null,
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return select(null);
      const def = BUILDABLE.find((b) => b.hotkey === e.key);
      if (def) select(useGame.getState().selected === def.id ? null : def.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [select]);

  return (
    <div className="buildbar-wrap">
      {selected && (
        <div className={`build-hint ${reason ? 'ko' : 'ok'}`}>
          {reason
            ? `⚠️ ${reason}`
            : `${BUILDING_BY_ID[selected].icon} ${BUILDING_BY_ID[selected].name}${fertile ? ' — 🌼 zone fertile, production x1,75 !' : ''} — clic pour construire · clic droit / Échap pour annuler`}
        </div>
      )}
      <div className="buildbar">
        {BUILDABLE.map((def) => {
          const affordable = canAfford(resources, def.cost);
          return (
            <button
              key={def.id}
              className={`build-btn ${selected === def.id ? 'active' : ''} ${affordable ? '' : 'poor'}`}
              onClick={() => select(selected === def.id ? null : def.id)}
              title={def.description}
            >
              <span className="build-key">{def.hotkey}</span>
              <span className="build-icon">{def.icon}</span>
              <span className="build-name">{def.name}</span>
              <span className="build-cost">
                {RESOURCE_KEYS.filter((k) => def.cost[k]).map((k) => (
                  <span key={k} className={resources[k] >= (def.cost[k] ?? 0) ? '' : 'missing'}>
                    {def.cost[k]}
                    {RESOURCE_META[k].icon}
                  </span>
                ))}
              </span>
              <span className="build-desc">{def.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
