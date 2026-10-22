import { PARCELS, canBuyParcel, ownsParcel, parcelContents, parcelRect } from '../game/parcels';
import { formatResources } from '../game/events';
import { canAfford, defensePower } from '../game/rules';
import { campStrength } from '../game/simulation';
import { useGame } from '../store/gameStore';
import { CostLine } from './BuildBar';

/** Panneau d'une parcelle verrouillée : contenu, prix, condition, bouton Acheter */
export function ParcelPanel() {
  const id = useGame((s) => s.inspectedParcel);
  const owned = useGame((s) => s.game.parcels.owned);
  const gold = useGame((s) => s.game.resources.gold);
  useGame((s) => s.game.population);
  const close = useGame((s) => s.inspectParcel);
  const buy = useGame((s) => s.buyParcel);
  if (id === null || owned.includes(id)) return null;
  const game = useGame.getState().game;
  const r = parcelRect(id);
  const check = canBuyParcel(game, id);
  const { counts, features } = parcelContents(game, id);
  const camp = features.find((f) => f.type === 'camp');
  const ruins = features.find((f) => f.type === 'ruins');
  return (
    <div className="building-panel">
      <div className="bp-head">
        <span className="bp-icon">🗺️</span>
        <div className="bp-title">
          <strong>Parcelle à vendre</strong>
          <span className="bp-level">
            {r.x1 - r.x0} × {r.z1 - r.z0} cases · {counts.grass + counts.fertile} constructibles
          </span>
        </div>
        <button className="event-close" onClick={() => close(null)} title="Fermer (Échap)">
          ×
        </button>
      </div>
      <div className="parcel-content">
        {counts.forest > 0 && <span>🌲 {counts.forest} forêt</span>}
        {counts.rock > 0 && <span>🪨 {counts.rock} rochers</span>}
        {counts.fertile > 0 && <span>🌼 {counts.fertile} fertiles</span>}
        {counts.water > 0 && <span>🌊 rivière</span>}
        {counts.grass > 0 && <span>🌿 {counts.grass} herbe</span>}
      </div>
      {camp && (
        <div className="bp-alert fire">
          <span>
            ⛺ <b>Camp de bandits</b> : tant qu'il existe, les attaques sont plus fréquentes. À détruire une fois la parcelle
            achetée (butin ~{formatResources(camp.loot)}).
          </span>
        </div>
      )}
      {ruins && (
        <div className="bp-alert damaged">
          <span>🏛️ <b>Ruines</b> : bloquent 2 cases, mais cachent un trésor. À déblayer (risque d'éboulement).</span>
        </div>
      )}
      <div className="bp-row">
        <span>Prix</span>
        <strong className={gold >= check.price ? '' : 'warn'}>🪙 {check.price}</strong>
      </div>
      {check.minPopulation > 0 && (
        <div className="bp-row">
          <span>Habitants requis</span>
          <strong className={game.population >= check.minPopulation ? '' : 'warn'}>👥 {check.minPopulation}</strong>
        </div>
      )}
      <button className="primary bp-upgrade" disabled={!check.ok} onClick={() => buy(id)}>
        Acheter la parcelle
      </button>
      {!check.ok && <div className="bp-reason">{check.reason}</div>}
      <div className="bp-note">Chaque achat augmente le prix des suivants (x{PARCELS.priceGrowth}).</div>
    </div>
  );
}

/** Panneau d'un danger : camp de bandits (attaquer) ou ruines (déblayer) */
export function FeaturePanel() {
  const feature = useGame((s) => s.game.features.find((f) => f.id === s.inspectedFeature && !f.cleared) ?? null);
  const resources = useGame((s) => s.game.resources);
  useGame((s) => s.game.population);
  const close = useGame((s) => s.inspectFeature);
  const attack = useGame((s) => s.attackCamp);
  const clear = useGame((s) => s.clearRuins);
  if (!feature) return null;
  const game = useGame.getState().game;
  const owned = ownsParcel(game, feature.parcel);
  const isCamp = feature.type === 'camp';
  const enemy = campStrength(game, feature.strength);
  const power = Math.round((defensePower(game) * 2 + Math.min(game.population, 40) * 0.15) * 10) / 10;
  return (
    <div className="building-panel">
      <div className="bp-head">
        <span className="bp-icon">{isCamp ? '⛺' : '🏛️'}</span>
        <div className="bp-title">
          <strong>{isCamp ? 'Camp de bandits' : 'Ruines anciennes'}</strong>
          <span className="bp-level">{owned ? 'Sur vos terres' : 'Parcelle non achetée'}</span>
        </div>
        <button className="event-close" onClick={() => close(null)} title="Fermer (Échap)">
          ×
        </button>
      </div>
      {isCamp ? (
        <>
          <div className="bp-note">Tant que ce camp existe à côté ou sur vos terres, les bandits attaquent plus souvent.</div>
          <div className="bp-row">
            <span>Force du camp</span>
            <strong className="warn">⚔️ {enemy}</strong>
          </div>
          <div className="bp-row">
            <span>Votre force</span>
            <strong className={power >= enemy ? 'pos' : 'warn-soft'}>🛡️ {power}</strong>
          </div>
          <div className="bp-row">
            <span>Butin</span>
            <strong>{formatResources(feature.loot)}</strong>
          </div>
          <button className="primary bp-upgrade" disabled={!owned} onClick={() => attack(feature.id)}>
            ⚔️ Attaquer le camp
          </button>
          <div className="bp-reason locked">
            {owned ? 'Votre force = tours de garde x2 + habitants. En cas d\'échec : des morts.' : 'Achetez d\'abord la parcelle.'}
          </div>
        </>
      ) : (
        <>
          <div className="bp-row">
            <span>Trésor estimé</span>
            <strong className="pos">{formatResources(feature.loot)}</strong>
          </div>
          <div className="bp-row">
            <span>Déblaiement</span>
            <CostLine cost={PARCELS.ruins.clearCost} resources={resources} />
          </div>
          <button
            className="primary bp-upgrade"
            disabled={!owned || !canAfford(resources, PARCELS.ruins.clearCost)}
            onClick={() => clear(feature.id)}
          >
            ⛏️ Déblayer les ruines
          </button>
          <div className="bp-reason locked">
            {owned
              ? `Risque d'éboulement : ${Math.round(PARCELS.ruins.collapseChance * 100)} % de perdre un villageois.`
              : 'Achetez d\'abord la parcelle.'}
          </div>
        </>
      )}
    </div>
  );
}
