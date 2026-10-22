// Indices visuels discrets des mécaniques cachées (aucun texte) :
// rats près des réserves, escarbilles au-dessus des maisons entassées l'été, poussière des mines
// instables, éclaireur immobile au bord de la carte, loups et yeux qui brillent les nuits d'hiver.

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BUILDING_BY_ID } from '../game/buildings';
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

const MAX_RATS = 18;
const MAX_SPARKS = 90;
const MAX_DUST = 40;
const MAX_PEBBLES = 20;
const MAX_WOLVES = 4;
const MAX_EYES = 6;

const ratMat = new THREE.MeshStandardMaterial({ color: '#2f2c2a', flatShading: true });
const sparkMat = new THREE.MeshBasicMaterial({ color: '#ffc04d' });
const dustMat = new THREE.MeshStandardMaterial({ color: '#d2c3a4', transparent: true, opacity: 0.75, depthWrite: false, flatShading: true });
const pebbleMat = new THREE.MeshStandardMaterial({ color: '#5a554e', flatShading: true });
// Éclaireur : manteau clair (pour se détacher du cadre en bois sombre) et capuche sombre
const cloakMat = new THREE.MeshStandardMaterial({ color: '#c9c1ae', flatShading: true });
const hoodMat = new THREE.MeshStandardMaterial({ color: '#2b2622', flatShading: true });
const glintMat = new THREE.MeshBasicMaterial({ color: '#fff3b0' });
const chaserMat = new THREE.MeshStandardMaterial({ color: '#2f6fd0', flatShading: true });
const wolfMat = new THREE.MeshStandardMaterial({ color: '#5f6266', flatShading: true });
const eyeMat = new THREE.MeshBasicMaterial({ color: '#ffe066' });
const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

export function Hints({ map }: { map: GameMap }) {
  const rats = useRef<THREE.InstancedMesh>(null);
  const sparks = useRef<THREE.InstancedMesh>(null);
  const dust = useRef<THREE.InstancedMesh>(null);
  const pebbles = useRef<THREE.InstancedMesh>(null);
  const scoutBody = useRef<THREE.Group>(null);
  const glint = useRef<THREE.Mesh>(null);
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

    // Rats : des ombres sombres qui filent par à-coups le long des murs du château et des greniers
    if (rats.current) {
      const nests = g.buildings.filter((b) => b.type === 'castle' || b.type === 'granary');
      const n = nests.length && g.mech.rats > 0 ? Math.min(MAX_RATS, 5 + g.mech.rats * 3) : 0;
      for (let i = 0; i < n; i++) {
        const nest = nests[i % nests.length];
        const c = center(nest);
        const size = BUILDING_BY_ID[nest.type].size;
        // Course par à-coups : la vitesse varie fortement (ils s'arrêtent, repartent)
        const burst = 0.35 + 0.65 * Math.max(0, Math.sin(t * 1.7 + i * 2.3));
        const dir = i % 2 ? 1 : -1;
        const a = (t * 1.6 * burst + i * 1.9) * dir;
        const r = size * 0.5 + 0.42 + (i % 3) * 0.1;
        const x = wx(c) + Math.cos(a) * r;
        const z = wz(c) + Math.sin(a) * r;
        const hop = Math.abs(Math.sin(t * 22 + i)) * 0.012;
        // Corps allongé tourné dans le sens de la course
        const yaw = -a + (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
        rats.current.setMatrixAt(i, tmp.m.compose(tmp.p.set(x, 0.05 + hop, z), tmp.q.setFromEuler(tmp.e.set(0, yaw, 0)), tmp.s.set(0.14, 0.13, 0.3)));
      }
      rats.current.count = n;
      rats.current.instanceMatrix.needsUpdate = true;
    }

    // Escarbilles : l'été, des braises montent des habitations entassées sans puits
    if (sparks.current) {
      let n = 0;
      if (seasonOf(g.day).id === FIRE.hint.season) {
        for (const h of exposedHouses(g)) {
          if (n >= MAX_SPARKS) break;
          const c = center(h);
          for (let k = 0; k < 8 && n < MAX_SPARKS; k++) {
            const life = (t * 0.5 + k / 8 + h.id * 0.31) % 1;
            // Elles montent en dérivant, brillent puis s'éteignent
            put(sparks.current, n++, wx(c) + Math.sin(t * 2.6 + k * 1.3 + h.id) * 0.16, 0.6 + life * 0.9, wz(c) + Math.cos(t * 2.1 + k) * 0.12, 0.13 * Math.sin(life * Math.PI));
          }
        }
      }
      sparks.current.count = n;
      sparks.current.instanceMatrix.needsUpdate = true;
    }

    // Poussière et gravats : mines aux galeries instables (plus c'est instable, plus il y en a)
    if (dust.current && pebbles.current) {
      let n = 0;
      let pb = 0;
      for (const b of g.buildings) {
        const inst = b.instability ?? 0;
        if (b.type !== 'mine' || inst < MINE.hint.tremorFrom) continue;
        const c = center(b);
        const puffs = 5 + Math.round(inst * 4);
        for (let k = 0; k < puffs && n < MAX_DUST; k++) {
          const life = (t * 0.4 + k / puffs + b.id * 0.17) % 1;
          put(dust.current, n++, wx(c) - 0.05 + Math.sin(k * 2.1 + t) * 0.16 * life, 0.12 + life * 0.55, wz(c) + 0.12 + life * 0.18, (0.14 + 0.26 * life) * (1 - 0.4 * life));
        }
        // Petits cailloux qui tombent de la voûte, par à-coups
        for (let k = 0; k < 3 && pb < MAX_PEBBLES; k++) {
          const cycle = (t * 0.9 + k * 0.37 + b.id) % 1.6;
          if (cycle > 0.5) continue;
          put(pebbles.current, pb++, wx(c) - 0.1 + k * 0.1, 0.36 - cycle * 0.7, wz(c) + 0.2, 0.035);
        }
      }
      dust.current.count = n;
      pebbles.current.count = pb;
      dust.current.instanceMatrix.needsUpdate = true;
      pebbles.current.instanceMatrix.needsUpdate = true;
    }

    // Éclaireur immobile + poursuivant
    const sc = g.mech.scout;
    if (scout.current) {
      scout.current.visible = !!sc;
      if (sc) {
        scout.current.position.set(wx(sc), 0, wz(sc));
        // Immobile, mais il respire et tourne lentement la tête vers le village ; un éclat de lunette de temps en temps
        const toward = Math.atan2(-wx(sc), -wz(sc));
        if (scoutBody.current) {
          scoutBody.current.rotation.y = toward + Math.sin(t * 0.5) * 0.25;
          scoutBody.current.scale.y = 1 + Math.sin(t * 1.6) * 0.02;
        }
        if (glint.current) glint.current.visible = Math.sin(t * 1.3) > 0.88;
      }
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
      <instancedMesh ref={pebbles} args={[GEO.rock, pebbleMat, MAX_PEBBLES]} frustumCulled={false} />
      <instancedMesh ref={wolves} args={[GEO.box, wolfMat, MAX_WOLVES]} castShadow frustumCulled={false} />
      <instancedMesh ref={eyes} args={[GEO.ball, eyeMat, MAX_EYES * 2 + MAX_WOLVES * 2]} frustumCulled={false} />
      {/* Éclaireur : silhouette encapuchonnée, immobile ; un clic envoie quelqu'un l'attraper */}
      <group ref={scout} visible={false}>
        <group ref={scoutBody}>
          <mesh geometry={GEO.cone6} material={cloakMat} position={[0, 0.34, 0]} scale={[0.38, 0.68, 0.38]} castShadow />
          <mesh geometry={GEO.ball} material={hoodMat} position={[0, 0.74, 0]} scale={0.26} castShadow />
          <mesh ref={glint} geometry={GEO.ball} material={glintMat} position={[0, 0.64, 0.2]} scale={0.06} visible={false} />
        </group>
        {hasScout && (
          <mesh
            geometry={GEO.cylinderLow}
            material={hitMat}
            position={[0, 0.25, 0]}
            scale={[0.8, 0.9, 0.8]}
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
