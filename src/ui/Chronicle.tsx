import { useState } from 'react';
import { createPortal } from 'react-dom';
import { MECHANICS } from '../game/mechanics';
import { useGame } from '../store/gameStore';
import { Icon, RichText } from './icons/Icon';

/** Bouton parchemin + livre de la Chronique : une page par mécanique découverte, sans jamais donner la solution */
export function ChronicleButton() {
  const [open, setOpen] = useState(false);
  const chronicle = useGame((s) => s.chronicle);
  const annals = useGame((s) => s.game.annals) ?? [];
  const found = MECHANICS.filter((m) => chronicle[m.id]?.struck).length;
  return (
    <>
      <button onClick={() => setOpen(true)} title="Ce que le village a appris, de partie en partie">
        <Icon id="scroll" /> Chronique {found}/{MECHANICS.length}
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
              <h3 className="annals-title">Annales de ce village</h3>
              {annals.length === 0 ? (
                <p className="annals-empty">Rien encore de digne d'être écrit. Les anciens disent que ça viendra bien assez tôt.</p>
              ) : (
                <ol className="annals">
                  {annals.map((a, i) => (
                    <li key={i}>
                      <span className="cp-icon"><RichText text={a.icon} /></span>
                      <div>
                        <strong>{a.name}</strong> <span className="annals-day">jour {a.day}</span>
                        <p>{a.line}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              <h3 className="annals-title">Ce que le village a appris</h3>
              <div className="chronicle-pages">
                {MECHANICS.map((m) => {
                  const page = chronicle[m.id];
                  if (!page?.struck)
                    return (
                      <div key={m.id} className="chronicle-page blank">
                        <span className="cp-icon"><Icon id="question" /></span>
                        <div>
                          <strong>Page blanche</strong>
                          <p>Le village n'a pas encore vécu ce chapitre.</p>
                        </div>
                      </div>
                    );
                  return (
                    <div key={m.id} className={`chronicle-page ${page.solved ? 'solved' : ''}`}>
                      <span className="cp-icon"><RichText text={m.icon} /></span>
                      <div>
                        <strong><RichText text={m.title} /></strong>
                        <p><RichText text={m.page} /></p>
                        {page.solved ? <p className="cp-solved"><RichText text={m.solvedPage} /></p> : <p className="cp-missing">La suite de la page est restée blanche…</p>}
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
