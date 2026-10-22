import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BUILDING_BY_ID } from '../game/buildings';
import { statsOf } from '../game/rules';
import type { Building, GameMap } from '../game/types';
import { useGame } from '../store/gameStore';
import { GEO, tileToWorld } from './shared';

const MAX_VILLAGERS = 150;
const WALK_SPEED = 0.55;
const TUNICS = ['#b5523b', '#3f6fb5', '#6a8f3a', '#c48a2c', '#7a4f8f', '#a33c5a', '#4f7f86'];

interface Agent {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  wait: number;
  goingHome: boolean;
  phase: number;
}

/** Calcule pour chaque villageois un logement et (éventuellement) un lieu de travail */
function useSlots(buildings: Building[], map: GameMap) {
  return useMemo(() => {
    const center = (b: Building) =>
      new THREE.Vector3(...tileToWorld(b.x, b.z, map.width, map.height, BUILDING_BY_ID[b.type].size));
    const homes: THREE.Vector3[] = [];
    const works: THREE.Vector3[] = [];
    for (const b of buildings) {
      const def = BUILDING_BY_ID[b.type];
      const c = center(b);
      // Point de rendez-vous devant le bâtiment
      const front = c.clone().add(new THREE.Vector3(0, 0, def.size * 0.5 + 0.12));
      for (let i = 0; i < (statsOf(b).housing ?? 0); i++) homes.push(front);
      for (let i = 0; i < b.workers; i++) works.push(b.type === 'field' ? c : front);
    }
    return { homes, works };
  }, [buildings, map]);
}

function jitter(v: THREE.Vector3, r: number): THREE.Vector3 {
  return v.clone().add(new THREE.Vector3((Math.random() - 0.5) * r, 0, (Math.random() - 0.5) * r));
}

/** Petits villageois (corps cylindre + tête) qui vont et viennent entre maison et travail */
export function Villagers({ buildings, map }: { buildings: Building[]; map: GameMap }) {
  const population = useGame((s) => s.game.population);
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
  const agents = useRef<Agent[]>([]);
  const { homes, works } = useSlots(buildings, map);
  const count = Math.min(population, MAX_VILLAGERS);

  // Ajuste le nombre d'agents à la population
  useLayoutEffect(() => {
    const list = agents.current;
    while (list.length > count) list.pop();
    while (list.length < count) {
      const start = homes[list.length % Math.max(1, homes.length)] ?? new THREE.Vector3();
      list.push({ pos: jitter(start, 0.3), target: jitter(start, 0.3), wait: Math.random() * 2, goingHome: true, phase: Math.random() * 10 });
    }
    const body = bodyRef.current;
    if (body) {
      const c = new THREE.Color();
      for (let i = 0; i < MAX_VILLAGERS; i++) body.setColorAt(i, c.set(TUNICS[i % TUNICS.length]));
      if (body.instanceColor) body.instanceColor.needsUpdate = true;
    }
  }, [count, homes]);

  const tmp = useMemo(
    () => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(), d: new THREE.Vector3() }),
    [],
  );

  useFrame((_, rawDt) => {
    const body = bodyRef.current;
    const head = headRef.current;
    if (!body || !head) return;
    const speed = useGame.getState().speed;
    const dt = Math.min(rawDt, 0.1) * speed;
    const list = agents.current;
    const fallback = homes[0] ?? new THREE.Vector3();

    list.forEach((a, i) => {
      tmp.d.subVectors(a.target, a.pos);
      tmp.d.y = 0;
      const dist = tmp.d.length();
      let moving = false;
      if (dist > 0.03) {
        a.pos.addScaledVector(tmp.d.normalize(), Math.min(dist, WALK_SPEED * dt));
        moving = dt > 0;
      } else if ((a.wait -= dt) <= 0) {
        // Arrivé : on repart, vers le travail ou la maison
        a.goingHome = !a.goingHome;
        const home = homes[i % Math.max(1, homes.length)] ?? fallback;
        const work = works[i];
        const dest = a.goingHome ? home : work ?? jitter(fallback, 3);
        a.target = jitter(dest, work && !a.goingHome ? 0.5 : 0.3);
        a.wait = a.goingHome ? 1 + Math.random() * 2 : 3 + Math.random() * 4;
      }
      a.phase += dt * 12;
      const bob = moving ? Math.abs(Math.sin(a.phase)) * 0.03 : 0;
      tmp.m.compose(tmp.p.set(a.pos.x, 0.11 + bob, a.pos.z), tmp.q, tmp.s.set(0.13, 0.22, 0.13));
      body.setMatrixAt(i, tmp.m);
      tmp.m.compose(tmp.p.set(a.pos.x, 0.28 + bob, a.pos.z), tmp.q, tmp.s.setScalar(0.11));
      head.setMatrixAt(i, tmp.m);
    });
    body.count = list.length;
    head.count = list.length;
    body.instanceMatrix.needsUpdate = true;
    head.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={bodyRef} args={[GEO.cylinderLow, undefined, MAX_VILLAGERS]} castShadow frustumCulled={false}>
        <meshStandardMaterial flatShading />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[GEO.ball, undefined, MAX_VILLAGERS]} castShadow frustumCulled={false}>
        <meshStandardMaterial color="#f0c8a0" flatShading />
      </instancedMesh>
    </group>
  );
}
