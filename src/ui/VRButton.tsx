import { useEffect, useState } from 'react';
import { xrStore } from '../scene/xr';
import { Icon } from './icons/Icon';

/** Bouton « Réalité mixte » : actif uniquement si un casque WebXR (immersive-ar) est disponible */
export function VRButton() {
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    let alive = true;
    const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
    xr?.isSessionSupported('immersive-ar')
      .then((ok) => alive && setSupported(ok))
      .catch(() => alive && setSupported(false));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <button
      className="vr-btn"
      disabled={!supported}
      onClick={() => xrStore.enterAR()}
      title={supported ? 'Jouer sur votre table en réalité mixte' : 'Aucun casque détecté (Meta Quest 3 requis)'}
    >
      <Icon id="headset" /> Réalité mixte
    </button>
  );
}
