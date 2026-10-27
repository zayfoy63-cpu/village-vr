import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { banditAt, guardAt } from '../game/realtime';
import type { GameMap, Point } from '../game/types';
import { useGame } from '../store/gameStore';
import { feedback } from '../vr/feedback';
import { useVR } from '../vr/store';
import { banditScreen } from './badgeAnchors';
import { GEO, TILE } from './shared';
import { useSmallShadows } from './quality';
import { PAL, TINT_BASE } from '../palette';

const MAX = 40;
const MAX_DOTS = 600;
/** Écart entre deux points du trajet pointillé (cases) */
const DOT_STEP = 0.45;
/** Durée (jours de jeu) de l'animation de chute d'un bandit attrapé */
const FALL = 0.05;
/** Durée (jours de jeu) de la gerbe dorée à la capture */
const BURST = 0.06;

const bodyMat = new THREE.MeshStandardMaterial({ color: PAL.brick, flatShading: true });
const hoodMat = new THREE.MeshStandardMaterial({ color: PAL.ink, flatShading: true });
const sackMat = new THREE.MeshStandardMaterial({ color: PAL.ochre, flatShading: true });
/** Corps des gardes : blanc, teinté par instance (bleu = garde, brun = villageois) */
const guardBodyMat = new THREE.MeshStandardMaterial({ color: TINT_BASE, flatShading: true });
const GUARD_COLOR = new THREE.Color(PAL.woad);
const VILLAGER_COLOR = new THREE.Color(PAL.wood);
const helmMat = new THREE.MeshStandardMaterial({ color: PAL.stone, flatShading: true, metalness: 0.4 });
const dotMat = new THREE.MeshBasicMaterial({ color: PAL.brick, transparent: true, opacity: 0.8, depthWrite: false });
const burstMat = new THREE.MeshBasicMaterial({ color: PAL.straw });
/** Zone de clic invisible, plus large que le personnage pour être facile à viser */
const hitMat = new THREE.MeshBasicMaterial({ visible: false });

/**
 * Bandits rouges qui courent du bord vers leur cible, volent, puis s'enfuient avec un sac.
 * Trajet en pointillés rouges. Clic sur un bandit : un garde (bleu) ou un villageois (brun) part l'intercepter.
 */
export function Bandits({ map }: { map: GameMap }) {
  const smallShadows = useSmallShadows();
  const active = useGame((s) => !!s.game.raid);
  const chase = useGame((s) => s.chase);
  const seize = useGame((s) => s.seize);
  const body = useRef<THREE.InstancedMesh>(null);
  const hood = useRef<THREE.InstancedMesh>(null);
  const sack = useRef<THREE.InstancedMesh>(null);
  const guards = useRef<THREE.InstancedMesh>(null);
  const helms = useRef<THREE.InstancedMesh>(null);
  const dots = useRef<THREE.InstancedMesh>(null);
  const burst = useRef<THREE.InstancedMesh>(null);
  const hit = useRef<THREE.InstancedMesh>(null);
  /** instanceId de la zone de clic → id du bandit */
  const hitIds = useRef<number[]>([]);
  const tmp = useMemo(
    () => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(), e: new THREE.Euler(), v: new THREE.Vector3() }),
    [],
  );
  const wx = (p: Point) => (p.x - map.width / 2) * TILE;
  const wz = (p: Point) => (p.z - map.height / 2) * TILE;

  // Le curseur ne doit pas rester en viseur quand l'attaque se termine
  useEffect(() => {
    if (!active) {
      document.body.style.cursor = '';
      banditScreen.clear();
    }
  }, [active]);

  useFrame(({ clock, camera, size }) => {
    const g = useGame.getState().game;
    const raid = g.raid;
    const meshes = [body.current, hood.current, sack.current, guards.current, helms.current, dots.current, burst.current, hit.current];
    if (!raid || meshes.some((m) => !m)) return;
    const t = g.day + g.dayProgress;
    const time = clock.elapsedTime;
    let bi = 0;
    let si = 0;
    let hi = 0;
    let di = 0;
    let ki = 0;
    hitIds.current.length = 0;
    banditScreen.clear();

    /** Points rouges le long d'un segment (animés pour montrer le sens de la course) */
    const dotted = (a: Point, b: Point) => {
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const n = Math.floor(len / DOT_STEP);
      const shift = (time * 1.5) % 1;
      for (let k = 0; k < n && di < MAX_DOTS; k++) {
        const f = ((k + shift) * DOT_STEP) / len;
        if (f > 1) break;
        tmp.m.compose(tmp.p.set(wx(a) + (wx(b) - wx(a)) * f, 0.05, wz(a) + (wz(b) - wz(a)) * f), tmp.q.identity(), tmp.s.set(0.07, 0.02, 0.07));
        dots.current!.setMatrixAt(di++, tmp.m);
      }
    };

    for (const b of raid.bandits) {
      const { p, phase } = banditAt(b, t);
      if (phase === 'escaped' || phase === 'waiting') continue;
      const caughtFor = phase === 'caught' && b.endT !== undefined ? t - b.endT : -1;
      if (caughtFor > FALL + BURST) continue;
      const x = wx(p);
      const z = wz(p);
      // Trajet restant
      if (phase === 'run') {
        dotted(p, b.target);
        dotted(b.target, b.exit);
      } else if (phase === 'steal') dotted(b.target, b.exit);
      else if (phase === 'flee') dotted(p, b.exit);
      // Orientation vers la destination
      const dest = phase === 'run' ? b.target : b.exit;
      const yaw = Math.atan2(dest.x - p.x, dest.z - p.z);
      const fall = caughtFor >= 0 ? Math.min(1, caughtFor / FALL) : 0;
      const running = phase === 'run' || phase === 'flee';
      const bob = running ? Math.abs(Math.sin(time * 16 + b.id)) * 0.05 : 0;
      // Vol : le bandit se penche et fouille (petit balancement)
      const rummage = phase === 'steal' ? Math.sin(time * 10 + b.id) * 0.35 : 0;
      tmp.q.setFromEuler(tmp.e.set(fall * 1.4 + (phase === 'steal' ? 0.5 : 0), yaw + rummage, 0));
      tmp.m.compose(tmp.p.set(x, 0.13 + bob - fall * 0.08, z), tmp.q, tmp.s.set(0.15, 0.26, 0.15));
      body.current!.setMatrixAt(bi, tmp.m);
      tmp.m.compose(tmp.p.set(x + Math.sin(yaw) * fall * 0.15, 0.32 + bob - fall * 0.25, z + Math.cos(yaw) * fall * 0.15), tmp.q, tmp.s.setScalar(0.13));
      hood.current!.setMatrixAt(bi++, tmp.m);
      // Sac sur le dos une fois le vol commencé (il tombe au sol à la capture)
      if (phase === 'flee' || phase === 'steal' || (phase === 'caught' && b.looted)) {
        const grow = phase === 'steal' ? Math.min(1, (t - b.arriveT) / Math.max(1e-6, b.stealEndT - b.arriveT)) : 1;
        const back = phase === 'caught' ? -0.25 : -0.11;
        tmp.m.compose(
          tmp.p.set(x + Math.sin(yaw) * back, phase === 'caught' ? 0.07 : 0.3 + bob, z + Math.cos(yaw) * back),
          tmp.q,
          tmp.s.setScalar(0.06 + 0.1 * grow),
        );
        sack.current!.setMatrixAt(si++, tmp.m);
      }
      // Gerbe dorée : butin récupéré + récompense
      if (caughtFor >= 0) {
        const k = Math.min(1, caughtFor / (FALL + BURST));
        for (let j = 0; j < 8; j++) {
          const a = (j / 8) * Math.PI * 2;
          tmp.m.compose(
            tmp.p.set(x + Math.cos(a) * k * 0.6, 0.2 + Math.sin(k * Math.PI) * 0.5, z + Math.sin(a) * k * 0.6),
            tmp.q.identity(),
            tmp.s.setScalar(0.07 * (1 - k)),
          );
          burst.current!.setMatrixAt(ki++, tmp.m);
        }
      }
      if (b.status === 'active') {
        tmp.m.compose(tmp.p.set(x, 0.25, z), tmp.q.identity(), tmp.s.set(0.6, 0.6, 0.6));
        hit.current!.setMatrixAt(hi++, tmp.m);
        hitIds.current.push(b.id);
        // Position écran pour les marqueurs hors champ
        tmp.v.set(x, 0.3, z).project(camera);
        const behind = tmp.v.z > 1;
        banditScreen.set(b.id, {
          x: ((behind ? -tmp.v.x : tmp.v.x) + 1) / 2 * size.width,
          y: ((1 - (behind ? -tmp.v.y : tmp.v.y)) / 2) * size.height,
          visible: !behind && Math.abs(tmp.v.x) < 0.95 && Math.abs(tmp.v.y) < 0.95,
        });
      }
    }

    // Gardes (bleus, casque) et villageois (bruns) qui courent intercepter puis reviennent
    let gi = 0;
    let hm = 0;
    for (const gd of raid.guards) {
      if (gd.done || t < gd.startT) continue;
      const p = guardAt(gd, t);
      const dest = t < gd.meetT ? gd.meet : gd.from;
      const yaw = Math.atan2(dest.x - p.x, dest.z - p.z);
      const bob = Math.abs(Math.sin(time * 18 + gd.id)) * 0.05;
      if (t < gd.meetT) dotted(p, gd.meet);
      tmp.q.setFromEuler(tmp.e.set(0, yaw, 0));
      tmp.m.compose(tmp.p.set(wx(p), 0.13 + bob, wz(p)), tmp.q, tmp.s.set(0.15, 0.26, 0.15));
      guards.current!.setMatrixAt(gi, tmp.m);
      guards.current!.setColorAt(gi++, gd.villager ? VILLAGER_COLOR : GUARD_COLOR);
      tmp.m.compose(tmp.p.set(wx(p), 0.32 + bob, wz(p)), tmp.q, tmp.s.setScalar(0.13));
      helms.current!.setMatrixAt(hm++, tmp.m);
    }

    body.current!.count = bi;
    hood.current!.count = bi;
    sack.current!.count = si;
    guards.current!.count = gi;
    helms.current!.count = hm;
    dots.current!.count = di;
    burst.current!.count = ki;
    hit.current!.count = hi;
    for (const mesh of meshes) mesh!.instanceMatrix.needsUpdate = true;
    if (guards.current!.instanceColor) guards.current!.instanceColor.needsUpdate = true;
    hit.current!.computeBoundingSphere();
  });

  if (!active) return null;
  return (
    <group>
      <instancedMesh matrixAutoUpdate={false} ref={body} args={[GEO.cylinderLow, bodyMat, MAX]} castShadow={smallShadows} frustumCulled={false} />
      <instancedMesh matrixAutoUpdate={false} ref={hood} args={[GEO.ball, hoodMat, MAX]} castShadow={smallShadows} frustumCulled={false} />
      <instancedMesh matrixAutoUpdate={false} ref={sack} args={[GEO.ball, sackMat, MAX]} frustumCulled={false} />
      <instancedMesh matrixAutoUpdate={false} ref={guards} args={[GEO.cylinderLow, guardBodyMat, MAX]} castShadow={smallShadows} frustumCulled={false} />
      <instancedMesh matrixAutoUpdate={false} ref={helms} args={[GEO.ball, helmMat, MAX]} frustumCulled={false} />
      <instancedMesh matrixAutoUpdate={false} ref={dots} args={[GEO.cylinderLow, dotMat, MAX_DOTS]} frustumCulled={false} renderOrder={1} />
      <instancedMesh matrixAutoUpdate={false} ref={burst} args={[GEO.ball, burstMat, MAX * 8]} frustumCulled={false} />
      <instancedMesh
        ref={hit}
        args={[GEO.cylinderLow, hitMat, MAX]}
        onPointerDown={(e) => {
          // VR : saisir le bandit entre deux doigts (pincement proche) ou à la main (grip) le capture sur-le-champ
          const type = (e as unknown as { pointerType?: string }).pointerType;
          if (type !== 'grab' || !useVR.getState().active) return;
          e.stopPropagation();
          const id = e.instanceId !== undefined ? hitIds.current[e.instanceId] : undefined;
          if (id !== undefined && seize(id)) feedback('grab', e);
        }}
        onClick={(e) => {
          e.stopPropagation();
          const id = e.instanceId !== undefined ? hitIds.current[e.instanceId] : undefined;
          if (id !== undefined) chase(id);
        }}
        onPointerOver={() => (document.body.style.cursor = 'crosshair')}
        onPointerOut={() => (document.body.style.cursor = '')}
      />
    </group>
  );
}
