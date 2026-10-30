import { BUILDING_BY_ID, CHAINS, maxLevel } from '../game/buildings';
import { DAMAGED_FACTOR, RESOURCE_META } from '../game/config';
import {
  canAfford,
  canUpgrade,
  effectLabel,
  chainReport,
  nominalProduction,
  repairCost,
  simulateProduction,
  statsOf,
} from '../game/rules';
import type { Building } from '../game/types';
import { useGame } from '../store/gameStore';
import { CostLine } from './BuildBar';
import { I } from './icons';
import { Icon, RichText } from './icons/Icon';

/** Transformation et équipement : stock d'entrée, production en cours, raison exacte de l'arrêt, outils, marche / arrêt */
function ChainStatus({ building }: { building: Building }) {
  useGame((s) => s.game.resources);
  useGame((s) => s.game.population);
  const togglePause = useGame((s) => s.togglePause);
  const game = useGame.getState().game;
  const stats = statsOf(building);
  const run = simulateProduction(game).status.get(building.id);
  const report = chainReport(game, building, run);
  const equippable = CHAINS.tools.equips.includes(building.type);
  const producing = !!stats.produces;
  return (
    <>
      {report.inputs.length > 0 && (
        <div className="bp-row">
          <span>Stock d'entrée</span>
          <strong>
            {report.inputs.map((i) => (
              <span key={i.key} className={i.have < i.perDay ? 'warn' : ''}>
                <RichText text={`${RESOURCE_META[i.key].icon} ${i.have}`} /> <em>(besoin {i.perDay}/j)</em>{' '}
              </span>
            ))}
          </strong>
        </div>
      )}
      {producing && (
        <div className="bp-row">
          <span>Production en cours</span>
          <strong className={report.outputs.length ? 'pos' : 'warn'}>
            {report.outputs.length ? (
              <RichText text={report.outputs.map((o) => `+${o.perDay} ${RESOURCE_META[o.key].icon}/j`).join('  ')} />
            ) : (
              'Rien'
            )}
          </strong>
        </div>
      )}
      {report.stop ? (
        <div className={report.stop.kind === 'fire' || report.stop.kind === 'input' ? 'bp-alert fire' : 'bp-alert damaged'}>
          <span><Icon id={report.stop.kind === 'paused' ? 'pause' : report.stop.kind === 'capped' ? 'box' : report.stop.kind === 'workers' ? 'worker' : report.stop.kind === 'locked' ? 'lock' : 'forbidden'} /> {report.stop.text}</span>
        </div>
      ) : report.slow ? (
        <div className="bp-note warn">{report.slow}</div>
      ) : null}
      {equippable && building.workers > 0 && (
        <div className={`bp-note ${run?.equipped ? 'pos-note' : ''}`}>
          <RichText
            text={
              run?.equipped
                ? `${I.tools} Équipé d'outils : +${Math.round(CHAINS.tools.bonus * 100)} % de production.`
                : `${I.tools} Sans outils : une forge donnerait +${Math.round(CHAINS.tools.bonus * 100)} %.`
            }
          />
        </div>
      )}
      {stats.workers ? (
        <button className="bp-toggle" onClick={() => togglePause(building.id)}>
          <RichText text={building.paused ? `${I.play} Relancer le bâtiment` : `${I.pause} Mettre à l'arrêt`} />
        </button>
      ) : null}
    </>
  );
}

/** Panneau d'un bâtiment existant : niveau, production actuelle / suivante, bouton Améliorer */
export function BuildingPanel() {
  const building = useGame((s) => s.game.buildings.find((b) => b.id === s.inspected) ?? null);
  const resources = useGame((s) => s.game.resources);
  // Re-rendu quand la population ou les déblocages changent (conditions d'amélioration)
  useGame((s) => s.game.population);
  useGame((s) => s.game.unlocked);
  const inspect = useGame((s) => s.inspect);
  const upgrade = useGame((s) => s.upgrade);
  const repair = useGame((s) => s.repair);
  const extinguish = useGame((s) => s.extinguish);
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
        <span className="bp-icon"><RichText text={def.icon} /></span>
        <div className="bp-title">
          <strong>{def.name}</strong>
          {max > 1 && (
            <span className="bp-level">
              Niveau {building.level}/{max} <RichText text={I.star.repeat(building.level) + I.starEmpty.repeat(max - building.level)} />
            </span>
          )}
        </div>
        <button className="event-close" onClick={() => inspect(null)} title="Fermer (Échap)">
          ×
        </button>
      </div>

      {building.fire && (
        <div className="bp-alert fire">
          {building.fire.extinguishEnd !== undefined ? (
            <span><Icon id="drop" /> Extinction en cours…</span>
          ) : (
            <>
              <span><Icon id="fire" /> En feu ! Ne produit plus rien.</span>
              <button className="primary" onClick={() => extinguish(building.id)}>
                Éteindre
              </button>
            </>
          )}
        </div>
      )}
      {building.damaged && !building.fire && (
        <div className="bp-alert damaged">
          <span><Icon id="hammer" /> Endommagé : production x{DAMAGED_FACTOR}. Un nouveau dégât le détruira.</span>
          <div className="bp-row">
            <span>Réparation</span>
            <CostLine cost={repairCost(building)} resources={resources} />
          </div>
          <button
            className="primary"
            disabled={!canAfford(resources, repairCost(building))}
            onClick={() => repair(building.id)}
          >
            Réparer
          </button>
        </div>
      )}

      <div className="bp-row">
        <span>Actuellement</span>
        <strong><RichText text={current || def.description} /></strong>
      </div>
      {stats.workers ? (
        <div className="bp-row">
          <span>Travailleurs</span>
          <strong className={building.workers < stats.workers ? 'warn' : ''}>
            <Icon id="worker" /> {building.workers}/{stats.workers}
          </strong>
        </div>
      ) : null}
      <ChainStatus building={building} />

      {max > 1 &&
        (check.next ? (
          <>
            <div className="bp-sep" />
            <div className="bp-row">
              <span>Niveau {building.level + 1}</span>
              <strong className="pos"><RichText text={next} /></strong>
            </div>
            {check.next.workers ? (
              <div className="bp-row">
                <span>Travailleurs requis</span>
                <strong className={check.next.workers > (stats.workers ?? 0) ? 'warn-soft' : ''}>
                  <Icon id="worker" /> {check.next.workers}
                  {check.next.workers > (stats.workers ?? 0) ? ` (+${check.next.workers - (stats.workers ?? 0)})` : ''}
                </strong>
              </div>
            ) : null}
            <div className="bp-row">
              <span>Coût</span>
              <CostLine cost={check.next.cost} resources={resources} />
            </div>
            <button className="primary bp-upgrade" disabled={!check.ok || !!building.fire} onClick={() => upgrade(building.id)}>
              <Icon id="up" /> Améliorer
            </button>
            {!check.ok && <div className={`bp-reason ${check.locked ? 'locked' : ''}`}><RichText text={check.reason} /></div>}
          </>
        ) : (
          <div className="bp-note"><Icon id="trophy" /> Niveau maximum atteint.</div>
        ))}
    </div>
  );
}
