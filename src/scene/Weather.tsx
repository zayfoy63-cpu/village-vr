import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { seasonOf } from '../game/config';
import { BUILDING_BY_ID } from '../game/buildings';
import { tileAt } from '../game/mapgen';
import { TUNING } from '../game/events';
import { floodLevel, stormCenter } from '../game/realtime';
import { hasModifier } from '../game/rules';
import type { GameMap } from '../game/types';
import { useGame } from '../store/gameStore';
import { VR_CONFIG } from '../vr/config';
import { useVR } from '../vr/store';
import { GEO, TILE, tileToWorld } from './shared';

const floodMat = new THREE.MeshStandardMaterial({
  color: '#3f8fd0',
  transparent: true,
  opacity: 0.75,
  roughness: 0.25,
  flatShading: true,
  depthWrite: false,
});

/** Crue : l'eau monte progressivement sur les cases qui bordent la rivière, puis redescend (1 draw call) */
export function Flood({ map }: { map: GameMap }) {
  const active = useGame((s) => !!s.game.flood);
  const ref = useRef<THREE.InstancedMesh>(null);
  const tiles = useMemo(() => {
    const out: { p: [number, number, number]; ring: number }[] = [];
    for (let z = 0; z < map.height; z++)
      for (let x = 0; x < map.width; x++) {
        if (tileAt(map, x, z) === 'water') continue;
        // Distance à l'eau (1 = au bord, 2 = deuxième rangée) : l'eau gagne d'abord le bord
        let ring = 0;
        for (let r = 1; r <= 2 && !ring; r++)
          for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (tileAt(map, x + dx, z + dz) === 'water') ring = r;
        if (ring) out.push({ p: tileToWorld(x, z, map.width, map.height), ring });
      }
    return out;
  }, [map]);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3() }), []);

  useFrame(({ clock }) => {
    const mesh = ref.current;
    const g = useGame.getState().game;
    if (!mesh || !g.flood) return;
    const k = floodLevel(g.flood, g.day + g.dayProgress) * (g.flood.protected ? 0.5 : 1);
    let n = 0;
    for (const { p, ring } of tiles) {
      // Le bord est inondé dès le début, la deuxième rangée seulement près du pic
      const level = Math.max(0, Math.min(1, k * 2.2 - (ring - 1) * 1.2)) * 0.14;
      if (level < 0.002) continue;
      const wave = Math.sin(clock.elapsedTime * 2 + p[0] + p[2]) * 0.01;
      mesh.setMatrixAt(n++, tmp.m.compose(tmp.p.set(p[0], level / 2 + wave, p[2]), tmp.q, tmp.s.set(1.001, level, 1.001)));
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (!active) return null;
  return <instancedMesh ref={ref} args={[GEO.box, floodMat, Math.max(1, tiles.length)]} frustumCulled={false} />;
}

const cloudMat = new THREE.MeshStandardMaterial({
  color: '#5d6478',
  emissive: new THREE.Color('#1c2233'),
  flatShading: true,
  roughness: 1,
});
const shadowMat = new THREE.MeshBasicMaterial({ color: '#0b0d18', transparent: true, opacity: 0.32, depthWrite: false });
const rainMat = new THREE.MeshBasicMaterial({ color: '#a9c4e8', transparent: true, opacity: 0.55, depthWrite: false });
const boltMat = new THREE.MeshBasicMaterial({ color: '#fff6b0' });
const shadowGeo = new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2);
const MAX_RAIN = 220;
const CLOUD_PUFFS = 11;
/** Durée d'affichage d'un éclair (jours de jeu) */
const BOLT = 0.012;

/** Orage : gros nuage sombre qui traverse la carte, ombre au sol (zone touchée), pluie et éclairs */
export function Storm({ map }: { map: GameMap }) {
  const active = useGame((s) => !!s.game.storm);
  const cloud = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const rain = useRef<THREE.InstancedMesh>(null);
  const bolts = useRef<THREE.InstancedMesh>(null);
  const flash = useRef<THREE.PointLight>(null);
  const puffs = useMemo(
    () =>
      Array.from({ length: CLOUD_PUFFS }, (_, i) => {
        const a = i * 2.39996;
        const r = i === 0 ? 0 : 0.35 + ((i * 37) % 10) / 16;
        return { x: Math.cos(a) * r, z: Math.sin(a) * r, y: ((i * 13) % 5) / 12, s: 1.1 - r * 0.35 };
      }),
    [],
  );
  const drops = useMemo(
    () =>
      Array.from({ length: MAX_RAIN }, (_, i) => ({
        a: ((i * 2654435761) % 1000) / 1000 * Math.PI * 2,
        r: Math.sqrt(((i * 7919) % 1000) / 1000),
        phase: ((i * 3571) % 1000) / 1000,
      })),
    [],
  );
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3() }), []);

  useFrame(({ clock }) => {
    const g = useGame.getState().game;
    const storm = g.storm;
    if (!storm || !cloud.current || !shadow.current || !rain.current || !bolts.current || !flash.current) return;
    const t = g.day + g.dayProgress;
    const c = stormCenter(storm, t);
    const x = (c.x - map.width / 2) * TILE;
    const z = (c.z - map.height / 2) * TILE;
    const R = storm.radius * TILE;
    cloud.current.position.set(x, 3.4 + Math.sin(clock.elapsedTime * 0.7) * 0.1, z);
    // Le nuage grossit pendant qu'il se forme au bord de la carte
    const form = Math.min(1, 0.35 + 0.65 * Math.max(0, 1 - (storm.startT - t) / TUNING.storm.warningTime) * 1.5);
    cloud.current.scale.setScalar(R * form);
    shadow.current.position.set(x, 0.035, z);
    shadow.current.scale.setScalar(R * form);
    // Pluie légère : traits obliques sous le nuage
    const H = 3.2;
    const time = clock.elapsedTime;
    const nRain = useVR.getState().active ? Math.min(MAX_RAIN, VR_CONFIG.perf.rainDrops) : MAX_RAIN;
    for (let i = 0; i < nRain; i++) {
      const d = drops[i];
      const y = H - ((time * 9 + d.phase * H) % H);
      tmp.q.setFromAxisAngle(tmp.p.set(storm.dir.z, 0, -storm.dir.x), 0.25);
      tmp.m.compose(tmp.p.set(x + Math.cos(d.a) * d.r * R * 0.95, y, z + Math.sin(d.a) * d.r * R * 0.95), tmp.q, tmp.s.set(0.015, 0.3, 0.015));
      rain.current.setMatrixAt(i, tmp.m);
    }
    rain.current.count = nRain;
    rain.current.instanceMatrix.needsUpdate = true;
    // Éclairs récents : colonne lumineuse en zigzag + flash
    let n = 0;
    let lit = 0;
    for (const s of storm.strikes) {
      const age = t - s.t;
      if (age < 0 || age > BOLT) continue;
      const bx = (s.x - map.width / 2) * TILE;
      const bz = (s.z - map.height / 2) * TILE;
      for (let k = 0; k < 4; k++) {
        const jx = ((k * 37 + s.t * 1000) % 7) / 20 - 0.15;
        tmp.q.setFromAxisAngle(tmp.p.set(0, 0, 1), jx);
        tmp.m.compose(tmp.p.set(bx + jx, 0.5 + k * 1, bz), tmp.q, tmp.s.set(0.06, 1.05, 0.06));
        bolts.current.setMatrixAt(n++, tmp.m);
      }
      lit = Math.max(lit, 1 - age / BOLT);
      flash.current.position.set(bx, 3, bz);
    }
    bolts.current.count = n;
    bolts.current.instanceMatrix.needsUpdate = true;
    // Pas d'éclair lumineux en réalité mixte (aucune lumière qui clignote)
    flash.current.intensity = useVR.getState().active ? 0 : lit * 80;
  });

  if (!active) return null;
  return (
    <group>
      <group ref={cloud}>
        {puffs.map((p, i) => (
          <mesh key={i} geometry={GEO.ball} material={cloudMat} position={[p.x, p.y, p.z]} scale={[p.s * 1.1, p.s * 0.55, p.s * 1.1]} />
        ))}
      </group>
      <mesh ref={shadow} geometry={shadowGeo} material={shadowMat} renderOrder={1} />
      <instancedMesh ref={rain} args={[GEO.box, rainMat, MAX_RAIN]} frustumCulled={false} />
      <instancedMesh ref={bolts} args={[GEO.box, boltMat, 24]} frustumCulled={false} />
      <pointLight ref={flash} intensity={0} color="#dfe8ff" distance={14} />
    </group>
  );
}

const plankMat = new THREE.MeshStandardMaterial({ color: '#8a5a33', flatShading: true });
const ringMat = new THREE.MeshBasicMaterial({ color: '#5fb4ff', transparent: true, opacity: 0.7, depthWrite: false });
const ringGeo = new THREE.RingGeometry(0.42, 0.5, 20).rotateX(-Math.PI / 2);

/**
 * Bâtiments renforcés (planches / sacs de sable aux coins) et bâtiments menacés par la crue
 * (anneau bleu pulsant tant qu'ils ne sont pas protégés).
 */
export function Reinforcements({ map }: { map: GameMap }) {
  const show = useGame((s) => !!s.game.storm || !!s.game.flood);
  const planks = useRef<THREE.InstancedMesh>(null);
  const rings = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3() }), []);

  useFrame(({ clock }) => {
    const g = useGame.getState().game;
    if (!planks.current || !rings.current) return;
    let n = 0;
    let r = 0;
    const threatened = g.flood && !g.flood.resolved && !g.flood.protected ? g.flood.threatened : [];
    for (const b of g.buildings) {
      const size = BUILDING_BY_ID[b.type].size;
      const [x, , z] = tileToWorld(b.x, b.z, map.width, map.height, size);
      const h = size * 0.5;
      if (b.reinforced && n < 400) {
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          tmp.q.setFromAxisAngle(tmp.p.set(sz, 0, -sx).normalize(), 0.35);
          tmp.m.compose(tmp.p.set(x + sx * h * 0.92, 0.18, z + sz * h * 0.92), tmp.q, tmp.s.set(0.08, 0.4, 0.22));
          planks.current.setMatrixAt(n++, tmp.m);
        }
      } else if (threatened.includes(b.id) && r < 100) {
        const k = 1 + Math.sin(clock.elapsedTime * 5) * 0.08;
        tmp.m.compose(tmp.p.set(x, 0.06, z), tmp.q.identity(), tmp.s.set(size * 1.4 * k, 1, size * 1.4 * k));
        rings.current.setMatrixAt(r++, tmp.m);
      }
    }
    planks.current.count = n;
    rings.current.count = r;
    planks.current.instanceMatrix.needsUpdate = true;
    rings.current.instanceMatrix.needsUpdate = true;
  });

  if (!show) return null;
  return (
    <group>
      <instancedMesh ref={planks} args={[GEO.box, plankMat, 400]} castShadow frustumCulled={false} />
      <instancedMesh ref={rings} args={[ringGeo, ringMat, 100]} frustumCulled={false} renderOrder={1} />
    </group>
  );
}

const snowMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
const MAX_FLAKES = 450;

/** Flocons en hiver ; beaucoup plus pendant un hiver rude (1 draw call) */
export function Snowfall({ map }: { map: GameMap }) {
  const winter = useGame((s) => seasonOf(s.game.day).id === 'winter');
  const harsh = useGame((s) => hasModifier(s.game, 'harshWinter'));
  const ref = useRef<THREE.InstancedMesh>(null);
  const flakes = useMemo(
    () =>
      Array.from({ length: MAX_FLAKES }, (_, i) => ({
        x: ((i * 7919) % 1000) / 1000 - 0.5,
        z: ((i * 104729) % 1000) / 1000 - 0.5,
        phase: ((i * 3571) % 1000) / 1000,
        speed: 0.6 + ((i * 31) % 100) / 200,
      })),
    [],
  );
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3() }), []);
  const vr = useVR((s) => s.active);
  const cap = vr ? VR_CONFIG.perf.snowFlakes : MAX_FLAKES;
  const count = harsh ? cap : winter ? Math.min(cap, 140) : 0;

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    const H = 7;
    for (let i = 0; i < count; i++) {
      const f = flakes[i];
      const y = H - ((t * f.speed * (harsh ? 1.6 : 1) + f.phase * H) % H);
      const drift = Math.sin(t * 0.8 + f.phase * 10) * 0.3 + (harsh ? (H - y) * 0.25 : 0);
      tmp.p.set(f.x * map.width + drift, y, f.z * map.height);
      mesh.setMatrixAt(i, tmp.m.compose(tmp.p, tmp.q, tmp.s.setScalar(harsh ? 0.05 : 0.04)));
    }
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (!count) return null;
  return <instancedMesh ref={ref} args={[GEO.box, snowMat, MAX_FLAKES]} frustumCulled={false} />;
}

const MAX_SHOWER = 320;
const showerMat = new THREE.MeshBasicMaterial({ color: '#b8cbe0', transparent: true, opacity: 0.4, depthWrite: false });

/** Jour de pluie (saisons) : fine pluie sur toute la carte, sans nuage d'orage (1 draw call) */
export function Rain({ map }: { map: GameMap }) {
  const raining = useGame((s) => s.game.mech.rain && !s.game.storm && seasonOf(s.game.day).id !== 'winter');
  const ref = useRef<THREE.InstancedMesh>(null);
  const drops = useMemo(
    () =>
      Array.from({ length: MAX_SHOWER }, (_, i) => ({
        x: ((i * 7919) % 1000) / 1000 - 0.5,
        z: ((i * 104729) % 1000) / 1000 - 0.5,
        phase: ((i * 3571) % 1000) / 1000,
      })),
    [],
  );
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.12, 0, 0.12)), p: new THREE.Vector3(), s: new THREE.Vector3(0.012, 0.22, 0.012) }), []);

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const H = 6;
    const t = clock.elapsedTime;
    const nShower = useVR.getState().active ? Math.min(MAX_SHOWER, VR_CONFIG.perf.rainDrops) : MAX_SHOWER;
    mesh.count = nShower;
    for (let i = 0; i < nShower; i++) {
      const d = drops[i];
      const y = H - ((t * 6 + d.phase * H) % H);
      mesh.setMatrixAt(i, tmp.m.compose(tmp.p.set(d.x * (map.width + 2), y, d.z * (map.height + 2)), tmp.q, tmp.s));
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (!raining) return null;
  return <instancedMesh ref={ref} args={[GEO.box, showerMat, MAX_SHOWER]} frustumCulled={false} />;
}
