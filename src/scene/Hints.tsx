// Indices visuels discrets des mécaniques cachées (aucun texte) :
// rats près des réserves, escarbilles au-dessus des maisons entassées l'été, poussière des mines
// instables, éclaireur immobile au bord de la carte, loups et yeux qui brillent les nuits d'hiver.

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { seasonOf } from '../game/config';
import { center, dist } from '../game/mechanics/common';
import { isForest } from '../game/mechanics/deforestation';
import { FIRE, crowdedHouses, wellNear } from '../game/mechanics/fire';
import { MINE } from '../game/mechanics/mine';
import { wolvesAt } from '../game/mechanics/wolves';
import { nightLevel } from '../game/seasons';
import type { GameMap, Point } from '../game/types';
import { useGame } from '../store/gameStore';
import { GEO, TILE } from './shared';

const MAX_RATS = 16;
const MAX_SPARKS = 60;
const MAX_DUST = 24;
const MAX_WOLVES = 4;
const MAX_EYES = 6;

const ratMat = new THREE.MeshStandardMaterial({ color: '#6d6a66', flatShading: true });
const sparkMat = new THREE.MeshBasicMaterial({ color: '#ffb347' });
const dustMat = new THREE.MeshStandardMaterial({ color: '#a89c88', transparent: true, opacity: 0.6, depthWrite: false, flatShading: true });
const cloakMat = new THREE.MeshStandardMaterial({ color: '#2b2622', flatShading: true });
const chaserMat = new THREE.MeshStandardMaterial({ color: '#2f6fd0', flatShading: true });
const wolfMat = new THREE.MeshStandardMaterial({ color: '#5f6266', flatShading: true });
const eyeMat = new THREE.MeshBasicMaterial({ color: '#ffe066' });
const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

export function Hints({ map }: { map: GameMap }) {
  const rats = useRef<THREE.InstancedMesh>(null);
  const sparks = useRef<THREE.InstancedMesh>(null);
  const dust = useRef<THREE.InstancedMesh>(null);
  const wolves = useRef<THREE.InstancedMesh>(null);
  const eyes = useRef<THREE.InstancedMesh>(null);
  const scout = useRef<THREE.Group>(null);
  const chaser = useRef<THREE.Group>(null);
  const hasScout = useGame((s) => !!s.game.mech.scout);
  const catchScout = useGame((s) => s.catchScout);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(), e: new THREE.Euler() }), []);
  const wx = (p: Point) => (p.x - map.width / 2) * TILE;
  const wz = (p: Point) => (p.z - map.height / 2) * TILE;

  useFrame(({ clock }) => {
    const g = useGame.getState().game;
    const t = clock.elapsedTime;
    const now = g.day + g.dayProgress;
    const night = nightLevel(g.day, g.dayProgress);
    const winter = seasonOf(g.day).id === 'winter';
    const put = (mesh: THREE.InstancedMesh, i: number, x: number, y: number, z: number, s: number, yaw = 0) => {
      tmp.q.setFromEuler(tmp.e.set(0, yaw, 0));
      mesh.setMatrixAt(i, tmp.m.compose(tmp.p.set(x, y, z), tmp.q, tmp.s.setScalar(s)));
    };

    // Rats : petites ombres grises qui filent au pied du château (les réserves)
    if (rats.current) {
      const castle = g.buildings.find((b) => b.type === 'castle');
      const n = castle ? Math.min(MAX_RATS, g.mech.rats * 3) : 0;
      if (castle) {
        const c = center(castle);
        for (let i = 0; i < n; i++) {
          const a = t * (0.9 + (i % 3) * 0.3) * (i % 2 ? 1 : -1) + i * 1.9;
          const r = 1.15 + (i % 4) * 0.07;
          const x = wx(c) + Math.cos(a) * r;
          const z = wz(c) + Math.sin(a) * r;
          rats.current.setMatrixAt(i, tmp.m.compose(tmp.p.set(x, 0.03, z), tmp.q.setFromEuler(tmp.e.set(0, -a, 0)), tmp.s.set(0.11, 0.06, 0.05)));
        }
      }
      rats.current.count = n;
      rats.current.instanceMatrix.needsUpdate = true;
    }

    // Escarbilles : l'été, au-dessus des habitations entassées sans puits
    if (sparks.current) {
      let n = 0;
      if (seasonOf(g.day).id === FIRE.hint.season) {
        for (const h of exposedHouses(g)) {
          if (n >= MAX_SPARKS) continue;
          const c = center(h);
          for (let k = 0; k < 3 && n < MAX_SPARKS; k++) {
            const life = (t * 0.5 + k / 3 + h.id * 0.31) % 1;
            put(sparks.current, n++, wx(c) + Math.sin(t * 3 + k + h.id) * 0.12, 0.65 + life * 0.7, wz(c) + Math.cos(t * 2 + k) * 0.1, 0.045 * (1 - life));
          }
        }
      }
      sparks.current.count = n;
      sparks.current.instanceMatrix.needsUpdate = true;
    }

    // Poussière : mines aux galeries instables
    if (dust.current) {
      let n = 0;
      for (const b of g.buildings) {
        if (b.type !== 'mine' || (b.instability ?? 0) < MINE.hint.tremorFrom) continue;
        const c = center(b);
        for (let k = 0; k < 4 && n < MAX_DUST; k++) {
          const life = (t * 0.35 + k / 4 + b.id * 0.17) % 1;
          put(dust.current, n++, wx(c) - 0.08 + Math.sin(k * 2.1) * 0.15 * life, 0.1 + life * 0.35, wz(c) + 0.15 + life * 0.1, 0.05 + 0.1 * life);
        }
      }
      dust.current.count = n;
      dust.current.instanceMatrix.needsUpdate = true;
    }

    // Éclaireur immobile + poursuivant
    const sc = g.mech.scout;
    if (scout.current) {
      scout.current.visible = !!sc;
      if (sc) scout.current.position.set(wx(sc), 0, wz(sc));
    }
    if (chaser.current) {
      const ch = sc?.chase;
      chaser.current.visible = !!ch && now >= ch.startT;
      if (ch && sc) {
        const k = Math.min(1, (now - ch.startT) / Math.max(1e-6, ch.meetT - ch.startT));
        const p = { x: ch.from.x + (sc.x - ch.from.x) * k, z: ch.from.z + (sc.z - ch.from.z) * k };
        chaser.current.position.set(wx(p), Math.abs(Math.sin(t * 16)) * 0.04, wz(p));
      }
    }

    // Loups : la meute (une silhouette grise par loup), yeux qui brillent la nuit
    if (wolves.current && eyes.current) {
      let n = 0;
      let e = 0;
      const w = g.mech.wolves;
      const p = wolvesAt(w, now);
      if (w && p) {
        const yaw = Math.atan2(w.to.x - w.from.x, w.to.z - w.from.z);
        for (let i = 0; i < Math.min(MAX_WOLVES, w.count); i++) {
          const ox = Math.sin(i * 2.4) * 0.3;
          const oz = Math.cos(i * 2.4) * 0.3;
          const bob = Math.abs(Math.sin(t * 14 + i)) * 0.03;
          wolves.current.setMatrixAt(n++, tmp.m.compose(tmp.p.set(wx(p) + ox, 0.09 + bob, wz(p) + oz), tmp.q.setFromEuler(tmp.e.set(0, yaw, 0)), tmp.s.set(0.14, 0.14, 0.34)));
          const fx = Math.sin(yaw) * 0.16;
          const fz = Math.cos(yaw) * 0.16;
          for (const side of [-1, 1]) put(eyes.current, e++, wx(p) + ox + fx + Math.cos(yaw) * side * 0.03, 0.16 + bob, wz(p) + oz + fz - Math.sin(yaw) * side * 0.03, 0.05);
        }
      }
      // Indice : des yeux à la lisière des bois les nuits d'hiver (avant même la première attaque)
      if (winter && night > 0.6 && g.day >= 20) {
        for (const spot of eyeSpots(g)) {
          if (e >= MAX_EYES * 2 + MAX_WOLVES * 2) break;
          if (Math.sin(t * 0.7 + spot.x * 3.1) < 0.2) continue;
          for (const side of [-1, 1]) put(eyes.current, e++, wx(spot) + side * 0.035, 0.18, wz(spot), 0.05);
        }
      }
      wolves.current.count = n;
      eyes.current.count = e;
      wolves.current.instanceMatrix.needsUpdate = true;
      eyes.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <instancedMesh ref={rats} args={[GEO.ball, ratMat, MAX_RATS]} frustumCulled={false} />
      <instancedMesh ref={sparks} args={[GEO.ball, sparkMat, MAX_SPARKS]} frustumCulled={false} />
      <instancedMesh ref={dust} args={[GEO.ball, dustMat, MAX_DUST]} frustumCulled={false} />
      <instancedMesh ref={wolves} args={[GEO.box, wolfMat, MAX_WOLVES]} castShadow frustumCulled={false} />
      <instancedMesh ref={eyes} args={[GEO.ball, eyeMat, MAX_EYES * 2 + MAX_WOLVES * 2]} frustumCulled={false} />
      {/* Éclaireur : silhouette encapuchonnée, immobile ; un clic envoie quelqu'un l'attraper */}
      <group ref={scout} visible={false}>
        <mesh geometry={GEO.cone6} material={cloakMat} position={[0, 0.16, 0]} scale={[0.17, 0.32, 0.17]} castShadow />
        <mesh geometry={GEO.ball} material={cloakMat} position={[0, 0.35, 0]} scale={0.12} castShadow />
        {hasScout && (
          <mesh
            geometry={GEO.cylinderLow}
            material={hitMat}
            position={[0, 0.25, 0]}
            scale={[0.6, 0.6, 0.6]}
            onClick={(e) => {
              e.stopPropagation();
              catchScout();
            }}
            onPointerOver={() => (document.body.style.cursor = 'crosshair')}
            onPointerOut={() => (document.body.style.cursor = '')}
          />
        )}
      </group>
      <group ref={chaser} visible={false}>
        <mesh geometry={GEO.cylinderLow} material={chaserMat} position={[0, 0.13, 0]} scale={[0.15, 0.26, 0.15]} />
        <mesh geometry={GEO.ball} material={chaserMat} position={[0, 0.32, 0]} scale={0.13} />
      </group>
    </group>
  );
}

/** Habitations entassées sans puits (recalculé seulement quand les bâtiments changent) */
let crowdCache: { ref: unknown; list: ReturnType<typeof crowdedHouses> } | null = null;
function exposedHouses(g: ReturnType<typeof useGame.getState>['game']) {
  if (crowdCache?.ref !== g.buildings) crowdCache = { ref: g.buildings, list: crowdedHouses(g).filter((h) => !wellNear(g, h)) };
  return crowdCache.list;
}

/** Lisières boisées les plus proches du château (où les yeux apparaissent) — calculé à la volée, peu coûteux */
let eyeCache: { key: string; spots: Point[] } | null = null;
function eyeSpots(g: ReturnType<typeof useGame.getState>['game']): Point[] {
  const key = `${g.map.seed}:${g.day}`;
  if (eyeCache?.key === key) return eyeCache.spots;
  const castle = g.buildings.find((b) => b.type === 'castle');
  const c = castle ? center(castle) : { x: g.map.width / 2, z: g.map.height / 2 };
  const list: Point[] = [];
  for (let z = 0; z < g.map.height; z++)
    for (let x = 0; x < g.map.width; x++) if (isForest(g, x, z)) list.push({ x: x + 0.5, z: z + 0.5 });
  list.sort((a, b) => dist(a, c) - dist(b, c));
  eyeCache = { key, spots: list.slice(2, 2 + MAX_EYES) };
  return eyeCache.spots;
}
