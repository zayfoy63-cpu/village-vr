import { useEffect, useState } from 'react';
import { xrStore } from '../scene/xr';

/** Bouton "Entrer en VR" : actif uniquement si un casque WebXR est disponible */
export function VRButton() {
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    let alive = true;
    const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
    xr?.isSessionSupported('immersive-vr')
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
      onClick={() => xrStore.enterVR()}
      title={supported ? 'Passer en réalité virtuelle' : 'Aucun casque VR détecté (Meta Quest 3 requis)'}
    >
      🥽 Entrer en VR
    </button>
  );
}
