import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import { BUILDING_BY_ID } from '../game/buildings';
import type { Building, GameMap } from '../game/types';
import { useGame } from '../store/gameStore';
import { Fields } from './Fields';
import { MODELS } from './models';
import { tileToWorld } from './shared';

/** Petite animation d'apparition (rebond) à la construction ou à l'amélioration */
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
  // Seuls les bâtiments construits ou améliorés après le montage s'animent (pas ceux d'une sauvegarde)
  const firstNewId = useRef(Math.max(0, ...buildings.map((b) => b.id)) + 1);
  const initialLevels = useRef(new Map(buildings.map((b) => [b.id, b.level])));
  const fields = buildings.filter((b) => b.type === 'field');
  return (
    <group>
      <Fields fields={fields} map={map} />
      {buildings.map((b) => {
        const Model = MODELS[b.type];
        if (!Model) return null;
        const pos = tileToWorld(b.x, b.z, map.width, map.height, BUILDING_BY_ID[b.type].size);
        const animate = b.id >= firstNewId.current || b.level > (initialLevels.current.get(b.id) ?? 1);
        return (
          <group
            key={b.id}
            position={pos}
            onClick={(e) => {
              // Sans bâtiment sélectionné à construire, un clic ouvre le panneau du bâtiment
              if (e.delta > 6 || useGame.getState().selected) return;
              e.stopPropagation();
              useGame.getState().inspect(b.id);
            }}
          >
            <PopIn key={b.level} animate={animate}>
              <Model id={b.id} level={b.level} />
            </PopIn>
          </group>
        );
      })}
    </group>
  );
}
