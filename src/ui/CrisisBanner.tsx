import { useShallow } from 'zustand/react/shallow';
import { DAY_DURATION_SEC } from '../game/config';
import { TUNING, formatResources } from '../game/events';
import { cropsProtectionCost } from '../game/hazards';
import { canAfford } from '../game/rules';
import { useGame } from '../store/gameStore';
import { I } from './icons';
import { Icon, RichText } from './icons/Icon';

/** Actions rapides pendant l'approche et le passage d'un orage */
function StormActions() {
  const s = useGame(
    useShallow((st) => {
      const storm = st.game.storm!;
      return {
        // Secondes réelles avant l'arrivée (arrondi : peu de re-rendus)
        eta: Math.ceil(((storm.arriveT - st.game.day - st.game.dayProgress) * DAY_DURATION_SEC) / Math.max(0.5, st.speed)),
        shelter: storm.shelter,
        crops: storm.cropsProtected,
        resources: st.game.resources,
        hasFields: st.game.buildings.some((b) => b.type === 'field'),
      };
    }),
  );
  const shelter = useGame((st) => st.shelter);
  const protectCrops = useGame((st) => st.protectCrops);
  const cropsCost = cropsProtectionCost(useGame.getState().game);
  return (
    <div className="crisis storm">
      <div>
        <Icon id="storm" /> {s.eta > 0 ? `Un orage approche (${s.eta} s) !` : 'L\'orage frappe le village !'} Cliquez sur un bâtiment pour le renforcer (
        <RichText text={formatResources(TUNING.storm.reinforceCost)} />).
      </div>
      <div className="crisis-actions">
        <button disabled={s.shelter} onClick={shelter} title="Personne n'est blessé, mais la production ralentit aujourd'hui">
          <RichText text={s.shelter ? `${I.check} Villageois à l'abri` : `${I.house} Rentrer les villageois (prod. x${TUNING.storm.shelterProduction})`} />
        </button>
        {s.hasFields && (
          <button disabled={s.crops || !canAfford(s.resources, cropsCost)} onClick={protectCrops}>
            <RichText text={s.crops ? `${I.check} Récoltes protégées` : `${I.wheat} Protéger les récoltes (${formatResources(cropsCost)})`} />
          </button>
        )}
      </div>
    </div>
  );
}

/** Bandeau d'alerte au centre de l'écran : incendie, bandits, orage, crue */
export function CrisisBanner() {
  const fires = useGame((s) => s.game.buildings.filter((b) => b.fire && b.fire.extinguishEnd === undefined).length);
  const extinguishing = useGame((s) => s.game.buildings.filter((b) => b.fire?.extinguishEnd !== undefined).length);
  const bandits = useGame((s) => (s.game.raid ? s.game.raid.bandits.filter((b) => b.status === 'active').length : 0));
  const chased = useGame((s) =>
    s.game.raid ? s.game.raid.bandits.filter((b) => b.status === 'active' && b.chasedBy !== undefined).length : 0,
  );
  const fleeing = useGame((s) => (s.game.raid ? s.game.raid.bandits.filter((b) => b.status === 'active' && b.looted).length : 0));
  const storm = useGame((s) => !!s.game.storm);
  const flood = useGame(
    useShallow((s) => {
      const f = s.game.flood;
      if (!f || f.resolved || f.protected) return null;
      const left = f.threatened.filter((id) => !s.game.buildings.find((b) => b.id === id)?.reinforced).length;
      return { left };
    }),
  );
  if (!fires && !bandits && !extinguishing && !storm && !flood) return null;
  return (
    <div className="crisis-banner">
      {fires > 0 && (
        <div className="crisis fire">
          <Icon id="fire" /> {fires} {fires > 1 ? 'bâtiments en feu' : 'bâtiment en feu'} — cliquez dessus pour l'éteindre !
        </div>
      )}
      {extinguishing > 0 && <div className="crisis water"><Icon id="drop" /> Extinction en cours…</div>}
      {bandits > 0 && (
        <div className="crisis raid">
          <Icon id="dagger" /> {bandits} {bandits > 1 ? 'bandits' : 'bandit'}
          {fleeing > 0 ? ` (${fleeing} avec du butin)` : ''} — cliquez dessus pour envoyer les gardes !
          {chased > 0 && <span className="crisis-sub"> <Icon id="shield" /> {chased} poursuivi{chased > 1 ? 's' : ''}</span>}
        </div>
      )}
      {storm && <StormActions />}
      {flood && (
        <div className="crisis water flood">
          <Icon id="flood" /> La crue monte !{' '}
          <RichText
            text={
              flood.left > 0
                ? `${flood.left} bâtiment${flood.left > 1 ? 's' : ''} menacé${flood.left > 1 ? 's' : ''} (cercle bleu) : cliquez pour poser des sacs de sable (${formatResources(TUNING.flood.sandbagCost)}).`
                : 'Tous les bâtiments menacés sont protégés.'
            }
          />
        </div>
      )}
    </div>
  );
}
