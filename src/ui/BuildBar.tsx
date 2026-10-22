import { useEffect } from 'react';
import { BUILDABLE, BUILDING_BY_ID, buildCost } from '../game/buildings';
import { RESOURCE_KEYS, RESOURCE_META } from '../game/config';
import { tileAt } from '../game/mapgen';
import { canAfford, canPlace, conditionLabel, effectLabel, isUnlocked } from '../game/rules';
import type { Resources } from '../game/types';
import { useGame } from '../store/gameStore';

export function CostLine({ cost, resources }: { cost: Partial<Resources>; resources: Resources }) {
  return (
    <span className="build-cost">
      {RESOURCE_KEYS.filter((k) => cost[k]).map((k) => (
        <span key={k} className={resources[k] >= (cost[k] ?? 0) ? '' : 'missing'}>
          {cost[k]}
          {RESOURCE_META[k].icon}
        </span>
      ))}
    </span>
  );
}

/** Barre de construction en bas de l'écran (clic ou touches 1 à 9, Échap pour annuler) */
export function BuildBar() {
  const resources = useGame((s) => s.game.resources);
  const unlocked = useGame((s) => s.game.unlocked);
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
      const state = useGame.getState();
      if (e.key === 'Escape') {
        state.select(null);
        state.inspect(null);
        return;
      }
      const def = BUILDABLE.find((b) => b.hotkey === e.key);
      if (def && isUnlocked(state.game, def.id)) state.select(state.selected === def.id ? null : def.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // `unlocked` est lu pour re-rendre la barre quand un déblocage arrive
  const game = { ...useGame.getState().game, unlocked };

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
          const cost = buildCost(def.id);
          const open = isUnlocked(game, def.id);
          const affordable = canAfford(resources, cost);
          const lvl = def.levels[0];
          return (
            <button
              key={def.id}
              className={`build-btn ${selected === def.id ? 'active' : ''} ${affordable ? '' : 'poor'} ${open ? '' : 'locked'}`}
              disabled={!open}
              onClick={() => select(selected === def.id ? null : def.id)}
            >
              <span className="build-key">{def.hotkey}</span>
              <span className="build-icon">{open ? def.icon : '🔒'}</span>
              <span className="build-name">{def.name}</span>
              <CostLine cost={cost} resources={resources} />
              {open ? (
                <span className="build-effect">{effectLabel(lvl)}</span>
              ) : (
                <span className="build-lock">{conditionLabel(lvl.unlock)}</span>
              )}
              <span className="build-desc">
                {def.description}
                {def.levels.length > 1 && ` Améliorable jusqu'au niveau ${def.levels.length}.`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
