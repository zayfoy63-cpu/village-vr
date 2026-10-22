import { useEffect, useState } from 'react';
import { BUILD_TABS, BUILDING_BY_ID, buildCost, buildingsInTab, type BuildTab } from '../game/buildings';
import { RESOURCE_KEYS, RESOURCE_META } from '../game/config';
import { tileAt } from '../game/mapgen';
import { canAfford, canPlace, conditionLabel, effectLabel, isUnlocked, workersLabel } from '../game/rules';
import type { Resources } from '../game/types';
import { useGame } from '../store/gameStore';

const TAB_KEY = 'village-vr-build-tab';

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

function loadTab(): BuildTab {
  try {
    const t = localStorage.getItem(TAB_KEY);
    if (BUILD_TABS.some((x) => x.id === t)) return t as BuildTab;
  } catch {
    // stockage indisponible : onglet par défaut
  }
  return BUILD_TABS[0].id;
}

/**
 * Barre de construction : onglets par catégorie + cartes compactes qui passent à la ligne
 * (jamais de défilement). Touches 1 à 6 = bâtiment de l'onglet actif, Tab = onglet suivant.
 */
export function BuildBar() {
  const resources = useGame((s) => s.game.resources);
  const unlocked = useGame((s) => s.game.unlocked);
  const selected = useGame((s) => s.selected);
  const select = useGame((s) => s.select);
  const [tab, setTabState] = useState<BuildTab>(loadTab);
  const fertile = useGame(
    (s) => s.selected === 'field' && !!s.hover && tileAt(s.game.map, s.hover.x, s.hover.z) === 'fertile',
  );
  const reason = useGame((s) =>
    s.hover && s.selected ? canPlace(s.game, s.selected, s.hover.x, s.hover.z).reason ?? null : null,
  );

  const setTab = (t: BuildTab) => {
    setTabState(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {
      // ignoré
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const state = useGame.getState();
      if (e.key === 'Escape') {
        state.select(null);
        state.inspect(null);
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const i = BUILD_TABS.findIndex((t) => t.id === tab);
        const n = BUILD_TABS.length;
        setTab(BUILD_TABS[(i + (e.shiftKey ? n - 1 : 1)) % n].id);
        return;
      }
      const index = Number(e.key) - 1;
      if (!Number.isInteger(index) || index < 0 || index > 5) return;
      const def = buildingsInTab(tab)[index];
      if (def && isUnlocked(state.game, def.id)) state.select(state.selected === def.id ? null : def.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tab]);

  // `unlocked` est lu pour re-rendre la barre quand un déblocage arrive
  const game = { ...useGame.getState().game, unlocked };

  return (
    <div className="buildbar-wrap">
      {selected && (
        <div className={`build-hint ${reason ? 'ko' : 'ok'}`}>
          {reason
            ? `⚠️ ${reason}`
            : `${BUILDING_BY_ID[selected].icon} ${BUILDING_BY_ID[selected].name}${fertile ? ' — 🌼 zone fertile x1,75 !' : ''} — clic pour construire · Échap pour annuler`}
        </div>
      )}
      <div className="build-tabs" role="tablist">
        {BUILD_TABS.map((t) => {
          const hasSelected = !!selected && BUILDING_BY_ID[selected].tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={`build-tab ${tab === t.id ? 'active' : ''} ${hasSelected ? 'has-selected' : ''}`}
              onClick={() => setTab(t.id)}
              title="Tab : onglet suivant"
            >
              <span>{t.icon}</span>
              <span className="build-tab-label">{t.label}</span>
            </button>
          );
        })}
      </div>
      <div className="buildbar" role="tabpanel">
        {buildingsInTab(tab).map((def, i) => {
          const cost = buildCost(def.id);
          const open = isUnlocked(game, def.id);
          const affordable = canAfford(resources, cost);
          const lvl = def.levels[0];
          return (
            <button
              key={def.id}
              className={`build-btn ${selected === def.id ? 'active' : ''} ${affordable ? '' : 'poor'} ${open ? '' : 'locked'}`}
              aria-disabled={!open}
              onClick={() => open && select(selected === def.id ? null : def.id)}
              title={`${def.description}${def.levels.length > 1 ? ` Améliorable jusqu'au niveau ${def.levels.length}.` : ''}`}
            >
              <span className="build-key">{i + 1}</span>
              <span className="build-icon">{open ? def.icon : '🔒'}</span>
              <span className="build-name">{def.name}</span>
              <CostLine cost={cost} resources={resources} />
              {open ? (
                <>
                  <span className="build-effect">{effectLabel(lvl)}</span>
                  {lvl.workers ? <span className="build-workers">{workersLabel(lvl)}</span> : null}
                </>
              ) : (
                <span className="build-lock">{conditionLabel(lvl.unlock)}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
