import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import { BUILDING_BY_ID } from '../game/buildings';
import type { Building, GameMap } from '../game/types';
import { reinforceCost } from '../game/hazards';
import { MINE } from '../game/mechanics/mine';
import { useGame } from '../store/gameStore';
import { Fields } from './Fields';
import { UpgradeBurst } from './UpgradeBurst';
import { MODELS } from './models';
import { Part } from './models/Part';
import { tileToWorld } from './shared';

/** Gravats et planches cassées autour d'un bâtiment endommagé */
function Rubble({ id }: { id: number }) {
  const r = (k: number) => ((id * 9301 + k * 49297) % 233280) / 233280;
  return (
    <group>
      {[0, 1, 2, 3].map((k) => (
        <Part
          key={k}
          g="rock"
          m="stoneDark"
          p={[(r(k) - 0.5) * 0.8, 0.03, 0.3 + r(k + 7) * 0.12]}
          s={0.06 + r(k + 3) * 0.06}
          shadow={false}
        />
      ))}
      <Part g="box" m="timber" p={[-0.25, 0.04, 0.38]} s={[0.3, 0.025, 0.04]} r={[0, 0.6, 0.15]} shadow={false} />
      <Part g="box" m="plank" p={[0.22, 0.03, 0.36]} s={[0.22, 0.02, 0.05]} r={[0, -0.4, -0.1]} shadow={false} />
    </group>
  );
}

/** Mine aux galeries instables : petites secousses par à-coups (indice discret) */
function Tremor({ id, children }: { id: number; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const b = useGame.getState().game.buildings.find((x) => x.id === id);
    const k = (b?.instability ?? 0) >= MINE.hint.tremorFrom ? b!.instability! : 0;
    const t = clock.elapsedTime;
    // Secousses brèves toutes les quelques secondes, plus fréquentes quand ça empire
    const burst = k > 0 && Math.sin(t * (0.8 + k)) > 0.85 ? 1 : 0;
    g.position.x = burst * Math.sin(t * 60) * 0.012 * (1 + k);
    g.position.z = burst * Math.cos(t * 53) * 0.01 * (1 + k);
  });
  return <group ref={ref}>{children}</group>;
}

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
            onPointerOver={() => {
              if ((b.fire && b.fire.extinguishEnd === undefined) || reinforceCost(useGame.getState().game, b.id))
                document.body.style.cursor = 'pointer';
            }}
            onPointerOut={() => (document.body.style.cursor = '')}
            onClick={(e) => {
              if (e.delta > 6) return;
              const state = useGame.getState();
              // Priorité : éteindre un incendie, puis renforcer ; sinon, sans construction en cours, ouvrir le panneau
              if (b.fire && b.fire.extinguishEnd === undefined) {
                e.stopPropagation();
                state.extinguish(b.id);
                return;
              }
              // Orage ou crue en approche : un clic renforce le bâtiment (contre du bois)
              if (reinforceCost(state.game, b.id)) {
                e.stopPropagation();
                state.reinforce(b.id);
                return;
              }
              if (state.selected) return;
              e.stopPropagation();
              state.inspect(b.id);
            }}
          >
            <PopIn key={b.level} animate={animate}>
              {/* Endommagé : légèrement affaissé et entouré de gravats */}
              <group rotation={b.damaged ? [0.05, 0, -0.07] : [0, 0, 0]} scale={b.damaged ? [1, 0.93, 1] : 1}>
                {b.type === 'mine' ? (
                  <Tremor id={b.id}>
                    <Model id={b.id} level={b.level} />
                  </Tremor>
                ) : (
                  <Model id={b.id} level={b.level} />
                )}
              </group>
              {b.damaged && <Rubble id={b.id} />}
            </PopIn>
            {/* Étincelles + poussière à l'amélioration, poussière à la construction */}
            {animate && (
              <UpgradeBurst
                key={`burst-${b.level}`}
                kind={b.id >= firstNewId.current && b.level === 1 ? 'build' : 'upgrade'}
                size={BUILDING_BY_ID[b.type].size}
              />
            )}
          </group>
        );
      })}
    </group>
  );
}
