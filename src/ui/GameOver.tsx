import { score } from '../game/rules';
import { useGame } from '../store/gameStore';

/** Écran récapitulatif de fin de partie */
export function GameOver() {
  const game = useGame((s) => (s.game.gameOver ? s.game : null));
  const newGame = useGame((s) => s.newGame);
  if (!game) return null;
  return (
    <div className="overlay">
      <div className="gameover">
        <h1>Le village est désert…</h1>
        <p>Le dernier habitant a quitté les lieux.</p>
        <div className="recap">
          <div>
            <span>📅</span>
            <strong>{game.day - 1}</strong>
            <em>jours survécus</em>
          </div>
          <div>
            <span>👥</span>
            <strong>{game.stats.maxPopulation}</strong>
            <em>population max</em>
          </div>
          <div>
            <span>🏗️</span>
            <strong>{game.stats.buildingsBuilt}</strong>
            <em>bâtiments construits</em>
          </div>
          <div>
            <span>🗡️</span>
            <strong>{game.stats.banditsKilled}</strong>
            <em>bandits abattus</em>
          </div>
          <div>
            <span>🧯</span>
            <strong>{game.stats.firesPutOut}</strong>
            <em>incendies éteints</em>
          </div>
          <div>
            <span>⭐</span>
            <strong>{score(game)}</strong>
            <em>score</em>
          </div>
        </div>
        <p className="seed-note">Seed : {game.seed}</p>
        <button className="primary" onClick={() => newGame()}>
          Nouvelle partie
        </button>
      </div>
    </div>
  );
}
