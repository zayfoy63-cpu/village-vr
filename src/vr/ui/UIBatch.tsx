// Monte le maillage unique de l'interface 3D à la racine de la scène et le met à jour juste avant
// chaque rendu (après le calcul des matrices : les panneaux suivent le plateau sans décalage).

import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { syncUI, uiMesh } from './uiBatch';

export function UIBatch() {
  const scene = useThree((s) => s.scene);
  const mesh = uiMesh();
  useEffect(() => {
    const prev = scene.onBeforeRender;
    scene.onBeforeRender = function (...args) {
      syncUI(scene, args[2]);
      prev.apply(this, args);
    };
    return () => {
      scene.onBeforeRender = prev;
    };
  }, [scene]);
  return <primitive object={mesh} />;
}
