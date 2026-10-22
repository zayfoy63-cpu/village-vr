import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { BUILDING_BY_ID } from '../game/buildings';
import { canPlace } from '../game/rules';
import { useGame } from '../store/gameStore';
import { MODELS } from './models';
import { GEO, tileToWorld } from './shared';

const OK = new THREE.MeshBasicMaterial({ color: '#4ade80', transparent: true, opacity: 0.45, depthWrite: false });
const KO = new THREE.MeshBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0.45, depthWrite: false });

/** Aperçu fantôme du bâtiment sélectionné sur la case survolée (vert = possible, rouge = impossible) */
export function Ghost() {
  const map = useGame((s) => s.game.map);
  const gameOver = useGame((s) => s.game.gameOver);
  const hover = useGame((s) => s.hover);
  const selected = useGame((s) => s.selected);
  // Sélecteur booléen : pas de re-rendu à chaque image
  const ok = useGame((s) => (s.hover && s.selected ? canPlace(s.game, s.selected, s.hover.x, s.hover.z).ok : false));
  const pulse = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (pulse.current) pulse.current.position.y = 0.02 + Math.sin(clock.elapsedTime * 4) * 0.02;
  });

  if (!hover || !selected || gameOver) return null;
  const def = BUILDING_BY_ID[selected];
  const pos = tileToWorld(hover.x, hover.z, map.width, map.height, def.size);
  const Model = MODELS[selected];

  return (
    <group position={pos}>
      <mesh geometry={GEO.box} material={ok ? OK : KO} position={[0, 0.02, 0]} scale={[def.size * 0.98, 0.04, def.size * 0.98]} />
      <group ref={pulse}>
        {Model ? (
          <group scale={0.95}>
            <Model id={0} level={1} />
          </group>
        ) : (
          <mesh geometry={GEO.box} material={OK} position={[0, 0.06, 0]} scale={[0.9, 0.08, 0.9]} />
        )}
        <mesh geometry={GEO.box} material={ok ? OK : KO} position={[0, 0.4, 0]} scale={[def.size * 0.95, 0.8, def.size * 0.95]} />
      </group>
    </group>
  );
}

const SELECT_MAT = new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.55, depthWrite: false });

/** Cadre doré autour du bâtiment inspecté */
export function Selection() {
  const map = useGame((s) => s.game.map);
  const target = useGame((s) => s.game.buildings.find((b) => b.id === s.inspected) ?? null);
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 4) * 0.03);
  });
  if (!target) return null;
  const size = BUILDING_BY_ID[target.type].size;
  const pos = tileToWorld(target.x, target.z, map.width, map.height, size);
  const w = size * 0.98;
  const t = 0.06;
  return (
    <group position={pos} ref={ref}>
      {[
        [0, w / 2 - t / 2, w, t],
        [0, -w / 2 + t / 2, w, t],
        [w / 2 - t / 2, 0, t, w],
        [-w / 2 + t / 2, 0, t, w],
      ].map(([x, z, sx, sz], i) => (
        <mesh key={i} geometry={GEO.box} material={SELECT_MAT} position={[x, 0.03, z]} scale={[sx, 0.04, sz]} />
      ))}
    </group>
  );
}
