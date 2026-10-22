import { useGame } from '../store/gameStore';

/** Bandeau d'alerte au centre de l'écran pendant un incendie ou une attaque */
export function CrisisBanner() {
  const fires = useGame((s) => s.game.buildings.filter((b) => b.fire && b.fire.extinguishEnd === undefined).length);
  const extinguishing = useGame((s) => s.game.buildings.filter((b) => b.fire?.extinguishEnd !== undefined).length);
  const bandits = useGame((s) => (s.game.raid ? s.game.raid.killedAt.filter((k) => k < 0).length : 0));
  const looting = useGame((s) => !!s.game.raid?.arrived);
  if (!fires && !bandits && !extinguishing) return null;
  return (
    <div className="crisis-banner">
      {fires > 0 && (
        <div className="crisis fire">
          🔥 {fires} {fires > 1 ? 'bâtiments en feu' : 'bâtiment en feu'} — cliquez dessus pour l'éteindre !
        </div>
      )}
      {extinguishing > 0 && <div className="crisis water">💧 Extinction en cours…</div>}
      {bandits > 0 && (
        <div className="crisis raid">
          🗡️ {bandits} {bandits > 1 ? 'bandits' : 'bandit'}{' '}
          {looting ? 's\'enfuient avec le butin — rattrapez-les !' : 'marchent sur le château — cliquez sur eux !'}
        </div>
      )}
    </div>
  );
}
