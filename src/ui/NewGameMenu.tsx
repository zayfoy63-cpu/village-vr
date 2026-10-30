import { useEffect, useState } from 'react';
import { DIFFICULTIES, type DifficultyId } from '../game/config';
import { useGame } from '../store/gameStore';
import { RichText } from './icons/Icon';

/** Choix de la difficulté au lancement d'une nouvelle partie (premier lancement, « Nouvelle partie », fin de partie) */
export function NewGameMenu() {
  const menu = useGame((s) => s.menu);
  const inProgress = useGame((s) => !s.game.gameOver);
  const remembered = useGame((s) => s.settings.difficulty);
  const newGame = useGame((s) => s.newGame);
  const closeMenu = useGame((s) => s.closeMenu);
  const [picked, setPicked] = useState<DifficultyId>(remembered);
  useEffect(() => {
    if (menu) setPicked(remembered);
  }, [menu, remembered]);
  if (!menu) return null;
  const cancelable = menu === 'new' && inProgress;
  return (
    <div className="overlay">
      <div className="newgame">
        <h1>Nouvelle partie</h1>
        <p>{cancelable ? 'La partie en cours sera abandonnée. Choisissez la difficulté de la suivante.' : 'Choisissez la difficulté de votre village.'}</p>
        <div className="difficulty-list" role="radiogroup" aria-label="Difficulté">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              role="radio"
              aria-checked={picked === d.id}
              className={`difficulty ${picked === d.id ? 'active' : ''}`}
              onClick={() => setPicked(d.id)}
            >
              <span className="difficulty-icon"><RichText text={d.icon} /></span>
              <strong>{d.name}</strong>
              <em>{d.blurb}</em>
              <small>
                {d.graceDays > 0 ? `Répit : ${d.graceDays} j` : 'Aucun répit'} · score ×{String(d.scoreMult).replace('.', ',')}
              </small>
            </button>
          ))}
        </div>
        <div className="newgame-actions">
          {cancelable && <button onClick={closeMenu}>Annuler</button>}
          <button className="primary" onClick={() => newGame(undefined, picked)}>
            Commencer
          </button>
        </div>
      </div>
    </div>
  );
}
