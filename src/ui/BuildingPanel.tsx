import { BUILDING_BY_ID, maxLevel } from '../game/buildings';
import { canUpgrade, effectLabel, nominalProduction, statsOf } from '../game/rules';
import { useGame } from '../store/gameStore';
import { CostLine } from './BuildBar';

/** Panneau d'un bâtiment existant : niveau, production actuelle / suivante, bouton Améliorer */
export function BuildingPanel() {
  const building = useGame((s) => s.game.buildings.find((b) => b.id === s.inspected) ?? null);
  const resources = useGame((s) => s.game.resources);
  // Re-rendu quand la population ou les déblocages changent (conditions d'amélioration)
  useGame((s) => s.game.population);
  useGame((s) => s.game.unlocked);
  const inspect = useGame((s) => s.inspect);
  const upgrade = useGame((s) => s.upgrade);
  if (!building) return null;

  const game = useGame.getState().game;
  const def = BUILDING_BY_ID[building.type];
  const stats = statsOf(building);
  const max = maxLevel(building.type);
  const check = canUpgrade(game, building);
  const current = effectLabel(stats, nominalProduction(game, building));
  const next = check.next ? effectLabel(check.next, nominalProduction(game, building, building.level + 1)) : null;

  return (
    <div className="building-panel">
      <div className="bp-head">
        <span className="bp-icon">{def.icon}</span>
        <div className="bp-title">
          <strong>{def.name}</strong>
          {max > 1 && (
            <span className="bp-level">
              Niveau {building.level}/{max} {'★'.repeat(building.level)}
              {'☆'.repeat(max - building.level)}
            </span>
          )}
        </div>
        <button className="event-close" onClick={() => inspect(null)} title="Fermer (Échap)">
          ×
        </button>
      </div>

      <div className="bp-row">
        <span>Actuellement</span>
        <strong>{current || def.description}</strong>
      </div>
      {stats.workers ? (
        <div className="bp-row">
          <span>Travailleurs</span>
          <strong className={building.workers < stats.workers ? 'warn' : ''}>
            {building.workers}/{stats.workers}
          </strong>
        </div>
      ) : null}
      {def.seasonal && <div className="bp-note">❄️ Ne produit rien en hiver.</div>}

      {max > 1 &&
        (check.next ? (
          <>
            <div className="bp-sep" />
            <div className="bp-row">
              <span>Niveau {building.level + 1}</span>
              <strong className="pos">{next}</strong>
            </div>
            <div className="bp-row">
              <span>Coût</span>
              <CostLine cost={check.next.cost} resources={resources} />
            </div>
            <button className="primary bp-upgrade" disabled={!check.ok} onClick={() => upgrade(building.id)}>
              ⬆️ Améliorer
            </button>
            {!check.ok && <div className={`bp-reason ${check.locked ? 'locked' : ''}`}>{check.reason}</div>}
          </>
        ) : (
          <div className="bp-note">🏆 Niveau maximum atteint.</div>
        ))}
    </div>
  );
}
