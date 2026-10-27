import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BUILDING_BY_ID } from '../game/buildings';
import { DISEASE } from '../game/mechanics/disease';
import { statsOf } from '../game/rules';
import type { Building, GameMap } from '../game/types';
import { useGame } from '../store/gameStore';
import { GEO, tileToWorld } from './shared';
import { useSmallShadows } from './quality';
import { PAL } from '../palette';
import { rnd, spread } from './handmade';
import { treadWear } from './wear';
import { villagerName } from '../game/names';
import { useVillagerHover, villagerPositions } from './villagerHover';
import type { ThreeEvent } from '@react-three/fiber';

const MAX_VILLAGERS = 150;
const WALK_SPEED = 0.55;
const SKIN = new THREE.Color(PAL.parchment);
const PALE = new THREE.Color(PAL.sage);
const TUNICS = [PAL.brick, PAL.woad, PAL.moss, PAL.ochre, PAL.umber, PAL.madder, PAL.wood, PAL.slate, PAL.sage, PAL.straw];

/** Allure propre à chaque villageois : taille, carrure, démarche, teinte de la tunique */
function looks(i: number) {
  return {
    height: 1 + spread(i, 1, 71, 0.16),
    width: 1 + spread(i, 2, 72, 0.18),
    head: 1 + spread(i, 3, 73, 0.1),
    /** Amplitude et rythme du zigzag : personne ne marche droit */
    sway: 0.03 + rnd(i, 4, 74) * 0.05,
    swayRate: 1.2 + rnd(i, 5, 75) * 1.6,
    lean: spread(i, 6, 76, 0.12),
    tunic: TUNICS[Math.floor(rnd(i, 7, 77) * TUNICS.length)],
    shade: spread(i, 8, 78, 0.06),
  };
}
const LOOKS = Array.from({ length: MAX_VILLAGERS }, (_, i) => looks(i));

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
  const smallShadows = useSmallShadows();
  const population = useGame((s) => s.game.population);
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
  const agents = useRef<Agent[]>([]);
  const headMat = useRef<THREE.MeshStandardMaterial>(null);
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
      for (let i = 0; i < MAX_VILLAGERS; i++) body.setColorAt(i, c.set(LOOKS[i].tunic).offsetHSL(0, 0, LOOKS[i].shade));
      if (body.instanceColor) body.instanceColor.needsUpdate = true;
    }
  }, [count, homes]);

  const tmp = useMemo(
    () => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(), d: new THREE.Vector3(), e: new THREE.Euler() }),
    [],
  );

  useFrame(({ clock }, rawDt) => {
    const body = bodyRef.current;
    const head = headRef.current;
    if (!body || !head) return;
    const { speed, game } = useGame.getState();
    const dt = Math.min(rawDt, 0.1) * speed;
    // Indices : froid (grelottent), fièvre qui couve (plus lents, plus pâles)
    const shiver = game.mech.cold > 0;
    const sick = Math.max(0, (game.mech.sickness - DISEASE.hint.paleFrom) / (1 - DISEASE.hint.paleFrom));
    const walk = WALK_SPEED * (1 - 0.45 * sick);
    if (headMat.current) headMat.current.color.copy(SKIN).lerp(PALE, sick * 0.85);
    const list = agents.current;
    const fallback = homes[0] ?? new THREE.Vector3();

    list.forEach((a, i) => {
      tmp.d.subVectors(a.target, a.pos);
      tmp.d.y = 0;
      const dist = tmp.d.length();
      let moving = false;
      const look = LOOKS[i];
      if (dist > 0.03) {
        tmp.d.normalize();
        // Petit zigzag : chacun flâne un peu de côté (chemins sinueux)
        const side = Math.sin(a.phase * 0.1 * look.swayRate) * look.sway * Math.min(1, dist);
        a.pos.addScaledVector(tmp.d, Math.min(dist, walk * dt));
        a.pos.x += -tmp.d.z * side * dt * 2;
        a.pos.z += tmp.d.x * side * dt * 2;
        moving = dt > 0;
        if (moving) treadWear(a.pos.x, a.pos.z, dt);
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
      const sx = shiver ? Math.sin(clock.elapsedTime * 55 + i * 1.7) * 0.012 : 0;
      const hh = 0.22 * look.height;
      tmp.q.setFromEuler(tmp.e.set(look.lean * 0.3, 0, look.lean));
      tmp.m.compose(tmp.p.set(a.pos.x + sx, hh / 2 + bob, a.pos.z), tmp.q, tmp.s.set(0.13 * look.width, hh, 0.13 * look.width));
      body.setMatrixAt(i, tmp.m);
      tmp.m.compose(tmp.p.set(a.pos.x + sx * 1.4 + look.lean * hh, hh + 0.06 * look.head + bob, a.pos.z), tmp.q, tmp.s.setScalar(0.11 * look.head));
      head.setMatrixAt(i, tmp.m);
    });
    villagerPositions.length = list.length;
    list.forEach((a, i) => (villagerPositions[i] = a.pos));
    body.count = list.length;
    head.count = list.length;
    body.instanceMatrix.needsUpdate = true;
    head.instanceMatrix.needsUpdate = true;
  });

  // Survol : le nom du villageois (infobulle PC, étiquette VR)
  const seed = map.seed;
  const hoverAt = (e: ThreeEvent<PointerEvent>) => {
    if (e.instanceId === undefined) return;
    useVillagerHover.getState().set({ i: e.instanceId, name: villagerName(e.instanceId, seed) }, e.nativeEvent.clientX, e.nativeEvent.clientY);
  };
  useLayoutEffect(() => {
    // Les villageois bougent : sphère englobante fixe (tout le plateau) pour que les rayons les trouvent
    const body = bodyRef.current;
    if (body) body.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Math.hypot(map.width, map.height));
    return () => useVillagerHover.getState().set(null);
  }, [map]);

  return (
    <group>
      <instancedMesh
        matrixAutoUpdate={false}
        ref={bodyRef}
        args={[GEO.cylinderLow, undefined, MAX_VILLAGERS]}
        castShadow={smallShadows}
        frustumCulled={false}
        onPointerOver={hoverAt}
        onPointerMove={hoverAt}
        onPointerOut={() => useVillagerHover.getState().set(null)}
      >
        <meshStandardMaterial flatShading />
      </instancedMesh>
      <instancedMesh matrixAutoUpdate={false} ref={headRef} args={[GEO.ball, undefined, MAX_VILLAGERS]} castShadow={smallShadows} frustumCulled={false}>
        <meshStandardMaterial ref={headMat} color={PAL.parchment} flatShading />
      </instancedMesh>
    </group>
  );
}
