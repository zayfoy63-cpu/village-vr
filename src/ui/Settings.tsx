import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useGame } from '../store/gameStore';

/** Bouton ⚙️ + panneau des paramètres */
export function SettingsButton() {
  const [open, setOpen] = useState(false);
  const settings = useGame((s) => s.settings);
  const setSettings = useGame((s) => s.setSettings);
  return (
    <>
      <button onClick={() => setOpen(true)} title="Paramètres">
        ⚙️ Paramètres
      </button>
      {open &&
        // Portail vers <body> : sinon le flou du panneau parent piège la fenêtre (position fixed)
        createPortal(
          <div className="overlay modal-overlay" onClick={() => setOpen(false)}>
            <div className="settings" onClick={(e) => e.stopPropagation()}>
              <h2>Paramètres</h2>
              <label className="setting-row">
                <input
                  type="checkbox"
                  checked={settings.autoPause}
                  onChange={(e) => setSettings({ autoPause: e.target.checked })}
                />
                <span>
                  <strong>Pause automatique sur les événements à choix</strong>
                  <em>
                    Le jeu s'arrête quand une décision est demandée et reprend dès qu'elle est prise. Désactivée : un
                    délai de quelques secondes s'applique, puis l'option par défaut est choisie.
                  </em>
                </span>
              </label>
              <label className="setting-row">
                <input type="checkbox" checked={settings.sound} onChange={(e) => setSettings({ sound: e.target.checked })} />
                <span>
                  <strong>Son d'alerte</strong>
                  <em>Un petit signal sonore quand des bandits, un orage, une crue ou un incendie commencent.</em>
                </span>
              </label>
              <button className="primary" onClick={() => setOpen(false)}>
                Fermer
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
