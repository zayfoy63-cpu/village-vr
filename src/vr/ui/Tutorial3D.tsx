// Première prise en main (≈30 s, sans texte) : des mains fantômes translucides rejouent chaque geste sur le
// plateau : attraper un bâtiment, le poser, tapoter, tourner le plateau. On reproduit le geste pour passer
// au suivant ; « Passer » ignore tout. En mode manettes, c'est une manette fantôme qui joue les gestes.

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { canPlace } from '../../game/rules';
import { useGame } from '../../store/gameStore';
import { VR_CONFIG } from '../config';
import { feedback } from '../feedback';
import { BOX, boxCenter } from '../layout';
import { useVR } from '../store';
import { Button3D, FacePlayer } from './kit';

const ghostMat = new THREE.MeshBasicMaterial({ color: '#8fe3ff', transparent: true, opacity: 0.5, depthWrite: false });
const tileMat = new THREE.MeshBasicMaterial({ color: '#7ee081', transparent: true, opacity: 0.45, depthWrite: false });
const ringMat = new THREE.MeshBasicMaterial({ color: '#8fe3ff', transparent: true, opacity: 0.7, depthWrite: false });

const ease = (t: number) => t * t * (3 - 2 * t);
const lerp3 = (a: THREE.Vector3, b: THREE.Vector3, k: number, out: THREE.Vector3) => out.lerpVectors(a, b, k);

/** Main fantôme : paume, quatre doigts, pouce. `pinch` rapproche l'index et le pouce. */
function GhostHand({ group, thumb, index, right }: { group: React.RefObject<THREE.Group | null>; thumb: React.RefObject<THREE.Mesh | null>; index: React.RefObject<THREE.Mesh | null>; right: boolean }) {
  const s = right ? 1 : -1;
  return (
    <group ref={group} visible={false}>
      <mesh material={ghostMat} position={[0, 0, 0.01]}>
        <boxGeometry args={[0.07, 0.016, 0.075]} />
      </mesh>
      {[-0.026, -0.009, 0.009, 0.026].map((x, i) => (
        <mesh key={x} material={ghostMat} position={[x, 0, -0.045 - (i === 1 || i === 2 ? 0.008 : 0)]} rotation={[Math.PI / 2, 0, 0]} ref={i === 2 ? index : undefined}>
          <capsuleGeometry args={[0.0075, 0.05, 3, 6]} />
        </mesh>
      ))}
      <mesh material={ghostMat} ref={thumb} position={[s * 0.045, 0, -0.01]} rotation={[Math.PI / 2, 0, -s * 0.8]}>
        <capsuleGeometry args={[0.009, 0.04, 3, 6]} />
      </mesh>
    </group>
  );
}

/** Une cible : case de pose conseillée (valide) près du château */
function suggestTile(): { x: number; z: number } {
  const g = useGame.getState().game;
  const c = g.buildings.find((b) => b.type === 'castle');
  const cx = c?.x ?? 10;
  const cz = c?.z ?? 6;
  for (let r = 3; r < 8; r++)
    for (const [dx, dz] of [[r, 0], [-r, 0], [0, r], [0, -r], [r, 1], [-r, 1]]) {
      const x = cx + dx;
      const z = cz + dz;
      if (canPlace({ ...g, resources: { ...g.resources, wood: 99, stone: 99, gold: 99 } }, 'hut', x, z).ok) return { x, z };
    }
  return { x: cx + 3, z: cz };
}

export function Tutorial3D() {
  const step = useVR((s) => s.tutorialStep);
  const done = useVR((s) => s.prefs.tutorialDone);
  const phase = useVR((s) => s.phase);
  const input = useVR((s) => s.input);
  const dominant = useVR((s) => s.prefs.dominant);
  const scale = useVR((s) => s.board.scale);
  const hand = useRef<THREE.Group>(null);
  const thumb = useRef<THREE.Mesh>(null);
  const index = useRef<THREE.Mesh>(null);
  const tile = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const baseline = useRef({ built: 0, yaw: 0, scale: 0 });
  const target = useMemo(suggestTile, []);
  const p = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), out: new THREE.Vector3() }), []);

  // Au démarrage de chaque étape : mémoriser l'état pour reconnaître le geste du joueur
  useEffect(() => {
    const vr = useVR.getState();
    baseline.current = { built: useGame.getState().game.stats.buildingsBuilt, yaw: vr.board.yaw, scale: vr.board.scale };
  }, [step, done, phase]);

  const active = !done && phase === 'playing' && !useGame.getState().game.gameOver;
  const id = VR_CONFIG.help.steps[Math.min(step, VR_CONFIG.help.steps.length - 1)];

  // Points de passage (repère de l'interface, mètres)
  const geo = useMemo(() => {
    const c = boxCenter(dominant, scale);
    const mini = new THREE.Vector3(c.x - 0.105, BOX.h + 0.07, c.z - 0.06);
    const tileP = new THREE.Vector3((target.x + 0.5 - 10) * scale, 0.033 + 0.03, (target.z + 0.5 - 7) * scale);
    const g = useGame.getState().game;
    const b = g.buildings.find((x) => x.type !== 'castle' && x.type !== 'mill') ?? g.buildings.find((x) => x.type === 'castle')!;
    const tapP = new THREE.Vector3((b.x + 0.5 - 10) * scale, 0.033 + 0.09, (b.z + 0.5 - 7) * scale);
    const rimA = new THREE.Vector3(10 * scale + 0.03, 0.06, 7 * scale * 0.2);
    const rimB = new THREE.Vector3(10 * scale + 0.03, 0.06, 7 * scale * 1.0 + 0.05);
    return { mini, tileP, tapP, rimA, rimB };
  }, [dominant, scale, target, step]);

  useFrame(({ clock }) => {
    const vr = useVR.getState();
    const g = useGame.getState();
    if (!active) return;
    // Reconnaissance du geste
    let ok = false;
    if (id === 'grab') ok = vr.held !== null;
    else if (id === 'drop') ok = g.game.stats.buildingsBuilt > baseline.current.built;
    else if (id === 'tap') ok = g.inspected !== null;
    else if (id === 'rotate') ok = Math.abs(vr.board.yaw - baseline.current.yaw) > 0.3 || Math.abs(vr.board.scale / baseline.current.scale - 1) > 0.1;
    if (ok) {
      feedback('drop');
      vr.advanceTutorial();
      return;
    }
    // Animation de la main fantôme
    const cycle = VR_CONFIG.help.ghostCycle;
    const t = (clock.elapsedTime % cycle) / cycle;
    const h = hand.current;
    if (!h) return;
    let pinch = 0;
    let poke = 0;
    const pos = p.out;
    if (id === 'grab') {
      // Approche de la miniature, pincement, léger soulèvement
      lerp3(p.a.copy(geo.mini).add(p.b.set(0.06, 0.12, 0.1)), geo.mini, ease(Math.min(1, t / 0.4)), pos);
      pinch = ease(Math.min(1, Math.max(0, (t - 0.35) / 0.15)));
      if (t > 0.55) pos.y += ease((t - 0.55) / 0.3) * 0.06;
    } else if (id === 'drop') {
      // La miniature voyage vers la case, puis le pincement s'ouvre
      lerp3(geo.mini, geo.tileP, ease(Math.min(1, t / 0.7)), pos);
      pos.y += Math.sin(Math.min(1, t / 0.7) * Math.PI) * 0.1 + 0.03;
      pinch = t < 0.78 ? 1 : 1 - ease((t - 0.78) / 0.15);
    } else if (id === 'tap') {
      // Un doigt tendu qui tapote le bâtiment
      pos.copy(geo.tapP);
      poke = Math.abs(Math.sin(t * Math.PI * 2 * 1.5));
      pos.y += 0.04 - poke * 0.04;
    } else {
      // Pincement sur le bord, glissé le long du bord
      lerp3(geo.rimA, geo.rimB, ease(t < 0.5 ? t * 2 : 2 - t * 2), pos);
      pinch = 1;
    }
    h.position.copy(pos);
    h.rotation.set(0, id === 'rotate' ? -Math.PI / 2 : 0, 0);
    h.visible = true;
    if (thumb.current && index.current) {
      thumb.current.rotation.z = (right() ? -1 : 1) * (0.8 - pinch * 0.6);
      index.current.rotation.x = Math.PI / 2 + pinch * 0.35 - poke * 0.5;
    }
    if (tile.current) {
      tile.current.visible = id === 'drop' && t > 0.55;
      tile.current.position.set(geo.tileP.x, 0.036, geo.tileP.z);
    }
    if (ring.current) {
      ring.current.visible = id === 'tap' && poke > 0.85;
      ring.current.position.set(geo.tapP.x, geo.tapP.y - 0.02, geo.tapP.z);
      ring.current.scale.setScalar(1 + (poke - 0.85) * 6);
    }
  });
  const right = () => dominant === 'right';

  if (!active) return null;
  return (
    <group>
      <GhostHand group={hand} thumb={thumb} index={index} right={right()} />
      <mesh ref={tile} material={tileMat} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <planeGeometry args={[scale * 0.95, scale * 0.95]} />
      </mesh>
      <mesh ref={ring} material={ringMat} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.02, 0.026, 20]} />
      </mesh>
      {input === 'controller' && null}
      {/* Seul texte : « Passer » (les points indiquent la progression) */}
      <FacePlayer position={[0, 0.02, 7 * scale + 0.32]} tilt={0.8}>
        <group>
          <Button3D width={0.16} height={0.06} icon="⏭" label="Passer" onActivate={() => useVR.getState().skipTutorial()} />
          {VR_CONFIG.help.steps.map((s, i) => (
            <mesh key={s} position={[(i - 1.5) * 0.03, 0.05, 0]}>
              <circleGeometry args={[0.008, 10]} />
              <meshBasicMaterial color={i === step ? '#ffd166' : i < step ? '#7ee081' : '#8a7d6a'} />
            </mesh>
          ))}
        </group>
      </FacePlayer>
    </group>
  );
}
