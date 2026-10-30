import { difficultyOf } from '../game/difficulty';
import { baseScore, score } from '../game/rules';
import { useGame } from '../store/gameStore';
import { Icon, RichText } from './icons/Icon';

/** Écran récapitulatif de fin de partie */
export function GameOver() {
  const game = useGame((s) => (s.game.gameOver ? s.game : null));
  const openMenu = useGame((s) => s.openMenu);
  const menu = useGame((s) => s.menu);
  if (!game || menu) return null;
  const diff = difficultyOf(game);
  return (
    <div className="overlay">
      <div className="gameover">
        <h1>Le village est désert…</h1>
        <p>Le dernier habitant a quitté les lieux.</p>
        <div className="recap">
          <div>
            <span><Icon id="calendar" /></span>
            <strong>{game.day - 1}</strong>
            <em>jours survécus</em>
          </div>
          <div>
            <span><Icon id="people" /></span>
            <strong>{game.stats.maxPopulation}</strong>
            <em>population max</em>
          </div>
          <div>
            <span><Icon id="crane" /></span>
            <strong>{game.stats.buildingsBuilt}</strong>
            <em>bâtiments construits</em>
          </div>
          <div>
            <span><Icon id="dagger" /></span>
            <strong>{game.stats.banditsKilled}</strong>
            <em>bandits abattus</em>
          </div>
          <div>
            <span><Icon id="extinguisher" /></span>
            <strong>{game.stats.firesPutOut}</strong>
            <em>incendies éteints</em>
          </div>
          <div>
            <span><Icon id="star" /></span>
            <strong>{score(game)}</strong>
            <em>score ({baseScore(game)} × {String(diff.scoreMult).replace('.', ',')})</em>
          </div>
        </div>
        <p className="seed-note"><RichText text={diff.icon} /> {diff.name} · Seed : {game.seed}</p>
        <button className="primary" onClick={() => openMenu('new')}>
          Nouvelle partie
        </button>
      </div>
    </div>
  );
}
