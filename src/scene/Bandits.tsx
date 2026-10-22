import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { banditPosition } from '../game/hazards';
import type { GameMap } from '../game/types';
import { useGame } from '../store/gameStore';
import { GEO, TILE } from './shared';

const MAX = 40;
/** Durée (jours de jeu) de l'animation de chute d'un bandit abattu */
const FALL = 0.06;

const bodyMat = new THREE.MeshStandardMaterial({ color: '#c0392b', flatShading: true });
const hoodMat = new THREE.MeshStandardMaterial({ color: '#3a1d1a', flatShading: true });
const sackMat = new THREE.MeshStandardMaterial({ color: '#b08a4a', flatShading: true });
/** Zone de clic invisible, plus large que le personnage pour être facile à viser */
const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

/** Bandits rouges : entrent par un bord, marchent sur le château, repartent avec des sacs. Cliquables. */
export function Bandits({ map }: { map: GameMap }) {
  const active = useGame((s) => !!s.game.raid);
  const fight = useGame((s) => s.fight);
  const body = useRef<THREE.InstancedMesh>(null);
  const hood = useRef<THREE.InstancedMesh>(null);
  const sack = useRef<THREE.InstancedMesh>(null);
  const hit = useRef<THREE.InstancedMesh>(null);
  /** instanceId de la zone de clic → index du bandit */
  const hitIndex = useRef<number[]>([]);
  const tmp = useMemo(
    () => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(), e: new THREE.Euler() }),
    [],
  );
  // Le curseur ne doit pas rester en viseur quand l'attaque se termine
  useEffect(() => {
    if (!active) document.body.style.cursor = '';
  }, [active]);

  useFrame(({ clock }) => {
    const g = useGame.getState().game;
    const raid = g.raid;
    if (!raid || !body.current || !hood.current || !sack.current || !hit.current) return;
    const t = g.day + g.dayProgress;
    let bi = 0;
    let si = 0;
    let hi = 0;
    hitIndex.current.length = 0;
    raid.killedAt.forEach((killed, i) => {
      if (killed >= 0 && t - killed > FALL) return;
      const pos = banditPosition(raid, i, killed >= 0 ? killed : t);
      const wx = (pos.x - map.width / 2) * TILE;
      const wz = (pos.z - map.height / 2) * TILE;
      // Orientation vers la destination
      const dirX = (pos.leaving ? raid.from.x - raid.to.x : raid.to.x - raid.from.x);
      const dirZ = (pos.leaving ? raid.from.z - raid.to.z : raid.to.z - raid.from.z);
      const yaw = Math.atan2(dirX, dirZ);
      const fall = killed >= 0 ? Math.min(1, (t - killed) / FALL) : 0;
      const bob = killed < 0 ? Math.abs(Math.sin(clock.elapsedTime * 14 + i)) * 0.04 : 0;
      tmp.q.setFromEuler(tmp.e.set(fall * 1.4, yaw, 0));
      tmp.m.compose(tmp.p.set(wx, 0.13 + bob - fall * 0.08, wz), tmp.q, tmp.s.set(0.15, 0.26, 0.15));
      body.current!.setMatrixAt(bi, tmp.m);
      tmp.m.compose(tmp.p.set(wx, 0.32 + bob - fall * 0.25, wz + fall * 0.15), tmp.q, tmp.s.setScalar(0.13));
      hood.current!.setMatrixAt(bi++, tmp.m);
      if (killed < 0) {
        if (pos.leaving && raid.arrived) {
          tmp.m.compose(tmp.p.set(wx - Math.sin(yaw) * 0.1, 0.3 + bob, wz - Math.cos(yaw) * 0.1), tmp.q, tmp.s.setScalar(0.14));
          sack.current!.setMatrixAt(si++, tmp.m);
        }
        tmp.m.compose(tmp.p.set(wx, 0.25, wz), tmp.q.identity(), tmp.s.set(0.5, 0.6, 0.5));
        hit.current!.setMatrixAt(hi++, tmp.m);
        hitIndex.current.push(i);
      }
    });
    body.current.count = bi;
    hood.current.count = bi;
    sack.current.count = si;
    hit.current.count = hi;
    for (const mesh of [body.current, hood.current, sack.current, hit.current]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  });

  if (!active) return null;
  return (
    <group>
      <instancedMesh ref={body} args={[GEO.cylinderLow, bodyMat, MAX]} castShadow frustumCulled={false} />
      <instancedMesh ref={hood} args={[GEO.ball, hoodMat, MAX]} castShadow frustumCulled={false} />
      <instancedMesh ref={sack} args={[GEO.ball, sackMat, MAX]} frustumCulled={false} />
      <instancedMesh
        ref={hit}
        args={[GEO.cylinderLow, hitMat, MAX]}
        onClick={(e) => {
          e.stopPropagation();
          const index = e.instanceId !== undefined ? hitIndex.current[e.instanceId] : undefined;
          if (index !== undefined) fight(index);
        }}
        onPointerOver={() => (document.body.style.cursor = 'crosshair')}
        onPointerOut={() => (document.body.style.cursor = '')}
      />
    </group>
  );
}
