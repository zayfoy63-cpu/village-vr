// Monte les InstancedMesh du regroupement des pièces à la racine de la scène, et les met à jour
// juste avant chaque rendu (après le calcul des matrices, avant les ombres et le dessin).

import { useThree } from '@react-three/fiber';
import { useEffect, useSyncExternalStore } from 'react';
import { poolList, poolsVersion, subscribePools, syncPools } from './partPool';

export function PartPools() {
  const scene = useThree((s) => s.scene);
  useSyncExternalStore(subscribePools, poolsVersion);
  useEffect(() => {
    const prev = scene.onBeforeRender;
    scene.onBeforeRender = function (...args) {
      syncPools(scene);
      prev.apply(this, args);
    };
    return () => {
      scene.onBeforeRender = prev;
    };
  }, [scene]);
  return (
    <>
      {poolList().map((p) => (
        <primitive key={`${p.key}|${p.capacity}`} object={p.mesh} />
      ))}
    </>
  );
}
