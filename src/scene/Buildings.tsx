import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import { BUILDING_BY_ID } from '../game/buildings';
import type { Building, GameMap } from '../game/types';
import { Fields } from './Fields';
import { MODELS } from './models';
import { tileToWorld } from './shared';

/** Petite animation d'apparition (rebond) à la construction */
function PopIn({ children, animate }: { children: React.ReactNode; animate: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const t = useRef(animate ? 0 : 1);
  useFrame((_, dt) => {
    if (t.current >= 1 || !ref.current) return;
    t.current = Math.min(1, t.current + dt * 2.5);
    const k = t.current;
    const s = 1 + Math.sin(k * Math.PI) * 0.25 * (1 - k) - (1 - k) * (1 - k);
    ref.current.scale.setScalar(Math.max(0.001, s));
  });
  return (
    <group ref={ref} scale={animate ? 0.001 : 1}>
      {children}
    </group>
  );
}

export function Buildings({ buildings, map }: { buildings: Building[]; map: GameMap }) {
  // Seuls les bâtiments construits après le montage s'animent (pas ceux d'une sauvegarde)
  const firstNewId = useRef(Math.max(0, ...buildings.map((b) => b.id)) + 1);
  const fields = buildings.filter((b) => b.type === 'field');
  return (
    <group>
      <Fields fields={fields} map={map} />
      {buildings.map((b) => {
        const Model = MODELS[b.type];
        if (!Model) return null;
        const pos = tileToWorld(b.x, b.z, map.width, map.height, BUILDING_BY_ID[b.type].size);
        return (
          <group key={b.id} position={pos}>
            <PopIn animate={b.id >= firstNewId.current}>
              <Model id={b.id} />
            </PopIn>
          </group>
        );
      })}
    </group>
  );
}
