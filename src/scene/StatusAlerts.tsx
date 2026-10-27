import { Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BUILDING_BY_ID } from '../game/buildings';
import { simulateProduction } from '../game/rules';
import type { Building, GameMap } from '../game/types';
import { useGame } from '../store/gameStore';
import { GEO, tileToWorld } from './shared';
import { PAL } from '../palette';

const inputMat = new THREE.MeshBasicMaterial({ color: PAL.brick });
const workersMat = new THREE.MeshBasicMaterial({ color: PAL.ochre });
const markMat = new THREE.MeshBasicMaterial({ color: PAL.ink });

/** Losange d'alerte "!" qui flotte et fait toujours face à la caméra */
function Alert({ position, kind }: { position: [number, number, number]; kind: 'input' | 'workers' }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = position[1] + Math.sin(clock.elapsedTime * 3 + position[0]) * 0.05;
  });
  return (
    <group ref={ref} position={position}>
      <Billboard>
        <mesh geometry={GEO.box} material={kind === 'input' ? inputMat : workersMat} rotation={[0, 0, Math.PI / 4]} scale={[0.2, 0.2, 0.02]} />
        <mesh geometry={GEO.box} material={markMat} position={[0, 0.025, 0.012]} scale={[0.028, 0.1, 0.01]} />
        <mesh geometry={GEO.box} material={markMat} position={[0, -0.06, 0.012]} scale={[0.028, 0.028, 0.01]} />
      </Billboard>
    </group>
  );
}

/**
 * Icônes d'alerte au-dessus des bâtiments à l'arrêt :
 * rouge = matière première manquante, orange = aucun travailleur.
 */
export function StatusAlerts({ buildings, map }: { buildings: Building[]; map: GameMap }) {
  // Recalcul seulement quand les stocks, la population ou les bâtiments changent (pas à chaque image)
  const resources = useGame((s) => s.game.resources);
  const population = useGame((s) => s.game.population);
  const alerts = useMemo(() => {
    const { status } = simulateProduction(useGame.getState().game);
    const out: { id: number; kind: 'input' | 'workers'; pos: [number, number, number] }[] = [];
    for (const b of buildings) {
      const st = status.get(b.id);
      if (!st?.blocked || b.fire) continue;
      const size = BUILDING_BY_ID[b.type].size;
      const [x, , z] = tileToWorld(b.x, b.z, map.width, map.height, size);
      out.push({ id: b.id, kind: st.blocked, pos: [x, b.type === 'field' ? 0.55 : 1.25, z] });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildings, resources, population, map]);
  return (
    <group>
      {alerts.map((a) => (
        <Alert key={a.id} position={a.pos} kind={a.kind} />
      ))}
    </group>
  );
}
