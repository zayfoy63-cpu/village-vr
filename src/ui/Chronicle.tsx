import { useState } from 'react';
import { createPortal } from 'react-dom';
import { MECHANICS } from '../game/mechanics';
import { useGame } from '../store/gameStore';

/** Bouton 📜 + livre de la Chronique : une page par mécanique découverte, sans jamais donner la solution */
export function ChronicleButton() {
  const [open, setOpen] = useState(false);
  const chronicle = useGame((s) => s.chronicle);
  const found = MECHANICS.filter((m) => chronicle[m.id]?.struck).length;
  return (
    <>
      <button onClick={() => setOpen(true)} title="Ce que le village a appris, de partie en partie">
        📜 Chronique {found}/{MECHANICS.length}
      </button>
      {open &&
        createPortal(
          <div className="overlay modal-overlay" onClick={() => setOpen(false)}>
            <div className="chronicle" onClick={(e) => e.stopPropagation()}>
              <h2>Chronique du village</h2>
              <div className="chronicle-count">
                Découvertes : {found} / {MECHANICS.length}
                {found > 0 && ` · pages complètes : ${MECHANICS.filter((m) => chronicle[m.id]?.solved).length}`}
              </div>
              <div className="chronicle-pages">
                {MECHANICS.map((m) => {
                  const page = chronicle[m.id];
                  if (!page?.struck)
                    return (
                      <div key={m.id} className="chronicle-page blank">
                        <span className="cp-icon">❔</span>
                        <div>
                          <strong>Page blanche</strong>
                          <p>Le village n'a pas encore vécu ce chapitre.</p>
                        </div>
                      </div>
                    );
                  return (
                    <div key={m.id} className={`chronicle-page ${page.solved ? 'solved' : ''}`}>
                      <span className="cp-icon">{m.icon}</span>
                      <div>
                        <strong>{m.title}</strong>
                        <p>{m.page}</p>
                        {page.solved ? <p className="cp-solved">{m.solvedPage}</p> : <p className="cp-missing">La suite de la page est restée blanche…</p>}
                        <em>Écrit au jour {page.day} d'une partie (seed {page.seed}).</em>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button className="primary" onClick={() => setOpen(false)}>
                Refermer le livre
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
