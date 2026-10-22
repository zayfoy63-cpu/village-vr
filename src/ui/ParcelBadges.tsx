import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ALL_PARCELS, canBuyParcel, isAdjacentToOwned, parcelContents } from '../game/parcels';
import { parcelScreen } from '../scene/badgeAnchors';
import { useGame } from '../store/gameStore';

/** Pastille d'une parcelle verrouillée : prix (ou cadenas si trop loin) et aperçu du contenu */
function Badge({ id, setRef }: { id: number; setRef: (id: number, el: HTMLButtonElement | null) => void }) {
  const info = useGame(
    useShallow((s) => {
      const check = canBuyParcel(s.game, id);
      const { counts, features } = parcelContents(s.game, id);
      return {
        adjacent: isAdjacentToOwned(s.game, id),
        ok: check.ok,
        price: check.price,
        minPop: check.minPopulation,
        popOk: s.game.population >= check.minPopulation,
        forest: counts.forest,
        rock: counts.rock,
        fertile: counts.fertile,
        water: counts.water,
        camp: features.some((f) => f.type === 'camp'),
        ruins: features.some((f) => f.type === 'ruins'),
      };
    }),
  );
  const inspectParcel = useGame((s) => s.inspectParcel);
  return (
    <button
      ref={(el) => setRef(id, el)}
      className={`parcel-badge ${info.adjacent ? '' : 'far'} ${info.ok ? 'can-buy' : ''}`}
      onClick={() => inspectParcel(id)}
      title={info.adjacent ? 'Voir la parcelle' : 'Trop loin : achetez d\'abord une parcelle voisine'}
    >
      <span className="pb-price">
        {info.adjacent ? `🪙 ${info.price}` : '🔒'}
        {info.adjacent && info.minPop > 0 && <span className={info.popOk ? '' : 'missing'}> · 👥 {info.minPop}</span>}
      </span>
      <span className="pb-content">
        {info.forest > 0 && <span>🌲{info.forest}</span>}
        {info.rock > 0 && <span>🪨{info.rock}</span>}
        {info.fertile > 0 && <span>🌼{info.fertile}</span>}
        {info.water > 0 && <span>🌊</span>}
        {info.camp && <span className="danger">⛺</span>}
        {info.ruins && <span>🏛️</span>}
      </span>
    </button>
  );
}

/**
 * Couche HTML des pastilles de parcelles. Les positions viennent de la scène (badgeAnchors) et sont
 * appliquées directement au DOM à chaque image, sans re-rendu React.
 */
export function ParcelBadges() {
  const owned = useGame((s) => s.game.parcels.owned);
  const refs = useRef(new Map<number, HTMLButtonElement>());
  const setRef = (id: number, el: HTMLButtonElement | null) => {
    if (el) refs.current.set(id, el);
    else refs.current.delete(id);
  };

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      refs.current.forEach((el, id) => {
        const p = parcelScreen.get(id);
        if (!p || !p.visible) {
          el.style.visibility = 'hidden';
          return;
        }
        el.style.visibility = 'visible';
        el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="parcel-badges">
      {ALL_PARCELS.filter((r) => !owned.includes(r.id)).map((r) => (
        <Badge key={r.id} id={r.id} setRef={setRef} />
      ))}
    </div>
  );
}
