// Objets posés sur la table, autour du plateau : sablier (pause / vitesse), bouton Annuler, message,
// livre de la Chronique, engrenage des paramètres, fin de partie, avertissement « mains perdues ».

import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { MECHANICS } from '../../game/mechanics';
import { score } from '../../game/rules';
import { useGame, type Speed } from '../../store/gameStore';
import { VR_CONFIG } from '../config';
import { feedback } from '../feedback';
import { boardHalf } from '../layout';
import { samplePointer } from '../pointers';
import { useVR } from '../store';
import { Button3D, FacePlayer, Label, Panel, THEME } from './kit';

const glass = new THREE.MeshStandardMaterial({ color: '#cfe9ff', transparent: true, opacity: 0.38, roughness: 0.1 });
const sand = new THREE.MeshStandardMaterial({ color: '#f0c457', roughness: 0.9 });
const frameMat = new THREE.MeshStandardMaterial({ color: '#7a4f2b', roughness: 0.8, flatShading: true });

const SPEEDS: { v: Speed; icon: string; label: string }[] = [
  { v: 0.5, icon: '🐢', label: '×½' },
  { v: 1, icon: '▶️', label: '×1' },
  { v: 2, icon: '⏩', label: '×2' },
];

/**
 * Sablier : le tapoter met en pause / relance ; l'attraper et le soulever (le retourner) change de vitesse.
 * Trois petites icônes au pied indiquent la vitesse en cours.
 */
export function Hourglass({ x, z }: { x: number; z: number }) {
  const speed = useGame((s) => s.speed);
  const setSpeed = useGame((s) => s.setSpeed);
  const flip = useRef(0);
  const grip = useRef<{ id: number; y0: number | null; done: boolean } | null>(null);
  const lastFlip = useRef(0);
  const turn = useRef<THREE.Group>(null);
  const sandTop = useRef<THREE.Mesh>(null);
  const last = useRef<Speed>(1);
  if (speed > 0) last.current = speed;

  const cycle = () => {
    const order: Speed[] = [0.5, 1, 2];
    const cur = speed === 0 ? last.current : speed;
    const next = order[(order.indexOf(cur) + 1) % order.length];
    setSpeed(next);
    flip.current = 1;
    feedback('drop');
  };

  useFrame((state, dt) => {
    // Geste : attraper le sablier et le soulever (le retourner) fait défiler les vitesses
    const gr = grip.current;
    if (gr) {
      const s = samplePointer(state, gr.id);
      if (!s || !s.down) grip.current = null;
      else {
        const y = s.type === 'mouse' ? state.pointer.y * 0.5 : s.origin.y;
        gr.y0 ??= y;
        if (!gr.done && y - gr.y0 > 0.07) {
          gr.done = true;
          lastFlip.current = performance.now();
          cycle();
        }
      }
    }
    const { clock } = state;
    const g = turn.current;
    if (!g) return;
    // Retournement : demi-tour animé à chaque changement de vitesse
    flip.current = Math.max(0, flip.current - dt * 1.6);
    g.rotation.z = (1 - flip.current) * Math.PI * 0 + Math.sin(flip.current * Math.PI) * Math.PI * (flip.current > 0 ? 1 : 0);
    // Le sable coule quand le temps passe (et s'arrête en pause)
    if (sandTop.current) {
      const k = speed === 0 ? 0.5 : 0.5 + 0.35 * Math.sin(clock.elapsedTime * 0.3 * speed);
      sandTop.current.scale.set(1, Math.max(0.05, k), 1);
    }
  });

  return (
    <group position={[x, 0, z]}>
      <group ref={turn} position={[0, 0.075, 0]}>
        {[0.075, -0.075].map((y) => (
          <mesh key={y} material={frameMat} position={[0, y, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.012, 10]} />
          </mesh>
        ))}
        <mesh material={glass} position={[0, 0.035, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.03, 0.065, 10]} />
        </mesh>
        <mesh material={glass} position={[0, -0.035, 0]}>
          <coneGeometry args={[0.03, 0.065, 10]} />
        </mesh>
        <mesh ref={sandTop} material={sand} position={[0, 0.04, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.02, 0.04, 8]} />
        </mesh>
        <mesh material={sand} position={[0, -0.06, 0]}>
          <coneGeometry args={[0.024, 0.03, 8]} />
        </mesh>
      </group>
      {/* Zone de toucher agrandie : tapoter = pause / reprise */}
      <mesh
        position={[0, 0.075, 0]}
        onClick={(e) => {
          e.stopPropagation();
          // Un retournement (soulever) ne compte pas comme un tap
          if (performance.now() - lastFlip.current < 600) return;
          setSpeed(speed === 0 ? last.current : 0);
          feedback('click', e);
        }}
        onPointerOver={(e) => feedback('hover', e)}
        onPointerDown={(e) => {
          grip.current = { id: e.pointerId, y0: null, done: false };
        }}
      >
        <cylinderGeometry args={[0.055, 0.055, 0.17, 10]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <FacePlayer position={[0, 0.19, 0]} tilt={0.3}>
        <Label text={speed === 0 ? '⏸ Pause' : SPEEDS.find((s) => s.v === speed)?.label ?? ''} size={0.03} color={speed === 0 ? THEME.warn : THEME.text} />
      </FacePlayer>
      <FacePlayer position={[0, 0.0, 0.1]} tilt={0.9}>
        <group>
          {SPEEDS.map((s, i) => (
            <Button3D key={s.v} width={0.06} height={0.06} icon={s.icon} active={speed === s.v} position={[(i - 1) * 0.066, 0.03, 0]} onActivate={() => { setSpeed(s.v); flip.current = 1; }} />
          ))}
        </group>
      </FacePlayer>
    </group>
  );
}

/** Bouton « Annuler » : toujours là quand une action récente peut être défaite (30 s) */
export function UndoButton({ x, z }: { x: number; z: number }) {
  const undo = useGame((s) => s.undo);
  const undoLast = useGame((s) => s.undoLast);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!undo) return;
    const t = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(t);
  }, [undo]);
  if (!undo) return null;
  const left = VR_CONFIG.moves.undoSeconds - (Date.now() - undo.at) / 1000;
  if (left <= 0) return null;
  const what = undo.kind === 'demolish' ? 'Remis dans la boîte' : undo.kind === 'move' ? 'Déplacé' : 'Posé';
  return (
    <FacePlayer position={[x, 0.01, z]} tilt={0.8}>
      <Button3D width={0.2} height={0.08} icon="↩️" label="Annuler" sub={`${what} · ${Math.ceil(left)} s`} onActivate={() => undoLast()} />
    </FacePlayer>
  );
}

/** Message court (action impossible, remboursement…) au-dessus du présentoir */
export function Toast3D({ z }: { z: number }) {
  const toast = useGame((s) => s.toast);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!toast) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2600);
    return () => clearTimeout(t);
  }, [toast]);
  if (!toast || !visible) return null;
  return (
    <FacePlayer position={[0, 0.2, z]} tilt={0.2}>
      <Panel width={0.5} height={0.07} border={THEME.warn}>
        <Label text={toast.text} size={0.026} maxWidth={0.46} />
      </Panel>
    </FacePlayer>
  );
}

/** Livre de la Chronique et engrenage des paramètres, posés à gauche du présentoir */
export function MenuObjects({ x, z }: { x: number; z: number }) {
  const found = useGame((s) => MECHANICS.filter((m) => s.chronicle[m.id]?.struck).length);
  const panel = useVR((s) => s.panel);
  const setPanel = useVR((s) => s.setPanel);
  return (
    <FacePlayer position={[x, 0.01, z]} tilt={0.8}>
      <group>
        <Button3D width={0.13} height={0.1} icon="📜" label={`${found}/${MECHANICS.length}`} active={panel === 'chronicle'} position={[0, 0.05, 0]} onActivate={() => setPanel(panel === 'chronicle' ? null : 'chronicle')} />
        <Button3D width={0.1} height={0.1} icon="⚙️" active={panel === 'settings'} position={[0.12, 0.05, 0]} onActivate={() => setPanel(panel === 'settings' ? null : 'settings')} />
      </group>
    </FacePlayer>
  );
}

/** Chronique : pages découvertes (jamais la solution), quatre par page */
export function Chronicle3D({ z }: { z: number }) {
  const panel = useVR((s) => s.panel);
  const setPanel = useVR((s) => s.setPanel);
  const chronicle = useGame((s) => s.chronicle);
  const [page, setPage] = useState(0);
  if (panel !== 'chronicle') return null;
  const per = 3;
  const pages = Math.ceil(MECHANICS.length / per);
  const items = MECHANICS.slice(page * per, page * per + per);
  const found = MECHANICS.filter((m) => chronicle[m.id]?.struck).length;
  const w = 0.62;
  const h = 0.52;
  return (
    <FacePlayer position={[0, 0.004, z]} tilt={0.8}>
      <group position={[0, h / 2, 0]}>
        <Panel width={w} height={h}>
          <Label text="📜 Chronique du village" size={0.036} position={[0, h / 2 - 0.04, 0]} />
          <Label text={`Découvertes : ${found} / ${MECHANICS.length}`} size={0.024} color={THEME.dim} position={[0, h / 2 - 0.08, 0]} />
          {items.map((m, i) => {
            const p = chronicle[m.id];
            const y = h / 2 - 0.17 - i * 0.115;
            return (
              <group key={m.id} position={[0, y, 0]}>
                <Label text={p?.struck ? m.icon : '❔'} size={0.04} position={[-w / 2 + 0.05, 0.01, 0]} />
                {p?.struck ? (
                  <>
                    <Label text={m.title} size={0.026} align="left" position={[-w / 2 + 0.1, 0.035, 0]} />
                    <Label text={m.page + (p.solved ? ` ${m.solvedPage}` : '')} size={0.018} weight={600} align="left" color={p.solved ? THEME.good : THEME.text} maxWidth={w - 0.16} position={[-w / 2 + 0.1, -0.015, 0]} />
                  </>
                ) : (
                  <Label text="Page blanche" size={0.024} color={THEME.dim} align="left" position={[-w / 2 + 0.1, 0.01, 0]} />
                )}
              </group>
            );
          })}
          <Button3D width={0.1} height={0.06} icon="◀" disabled={page === 0} position={[-0.12, -h / 2 + 0.04, 0.004]} onActivate={() => setPage((p) => Math.max(0, p - 1))} />
          <Label text={`${page + 1}/${pages}`} size={0.024} position={[0, -h / 2 + 0.04, 0]} />
          <Button3D width={0.1} height={0.06} icon="▶" disabled={page >= pages - 1} position={[0.12, -h / 2 + 0.04, 0.004]} onActivate={() => setPage((p) => Math.min(pages - 1, p + 1))} />
          <Button3D width={0.05} height={0.05} icon="✖️" position={[w / 2 - 0.035, h / 2 - 0.035, 0.004]} onActivate={() => setPanel(null)} />
        </Panel>
      </group>
    </FacePlayer>
  );
}

/** Paramètres : main dominante, assis / debout, son, FPS, aide, replacer, nouvelle partie */
export function Settings3D({ z }: { z: number }) {
  const panel = useVR((s) => s.panel);
  const setPanel = useVR((s) => s.setPanel);
  const prefs = useVR((s) => s.prefs);
  const setPrefs = useVR((s) => s.setPrefs);
  const setPhase = useVR((s) => s.setPhase);
  const autoPause = useGame((s) => s.settings.autoPause);
  const setSettings = useGame((s) => s.setSettings);
  const newGame = useGame((s) => s.newGame);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (!confirm) return;
    const t = setTimeout(() => setConfirm(false), 4000);
    return () => clearTimeout(t);
  }, [confirm]);
  if (panel !== 'settings') return null;
  const w = 0.62;
  const h = 0.5;
  const Row = ({ i, children }: { i: number; children: React.ReactNode }) => <group position={[0, h / 2 - 0.115 - i * 0.085, 0.004]}>{children}</group>;
  return (
    <FacePlayer position={[0, 0.004, z]} tilt={0.8}>
      <group position={[0, h / 2, 0]}>
        <Panel width={w} height={h}>
          <Label text="⚙️ Paramètres" size={0.036} position={[0, h / 2 - 0.04, 0]} />
          <Row i={0}>
            <Label text="Main dominante" size={0.026} align="left" position={[-w / 2 + 0.04, 0, 0]} />
            <Button3D width={0.13} height={0.065} icon="🫲" label="Gauche" active={prefs.dominant === 'left'} position={[0.1, 0, 0]} onActivate={() => setPrefs({ dominant: 'left' })} />
            <Button3D width={0.13} height={0.065} icon="🫱" label="Droite" active={prefs.dominant === 'right'} position={[0.25, 0, 0]} onActivate={() => setPrefs({ dominant: 'right' })} />
          </Row>
          <Row i={1}>
            <Label text="Position" size={0.026} align="left" position={[-w / 2 + 0.04, 0, 0]} />
            <Button3D width={0.13} height={0.065} icon="🪑" label="Assis" active={prefs.seated} position={[0.1, 0, 0]} onActivate={() => setPrefs({ seated: true })} />
            <Button3D width={0.13} height={0.065} icon="🧍" label="Debout" active={!prefs.seated} position={[0.25, 0, 0]} onActivate={() => setPrefs({ seated: false })} />
          </Row>
          <Row i={2}>
            <Label text="Son" size={0.026} align="left" position={[-w / 2 + 0.04, 0, 0]} />
            <Button3D width={0.28} height={0.065} icon={prefs.sound ? '🔊' : '🔇'} label={prefs.sound ? 'Activé' : 'Coupé'} active={prefs.sound} position={[0.175, 0, 0]} onActivate={() => setPrefs({ sound: !prefs.sound })} />
          </Row>
          <Row i={3}>
            <Label text="Pause sur décision" size={0.026} align="left" position={[-w / 2 + 0.04, 0, 0]} />
            <Button3D width={0.28} height={0.065} icon="⏸" label={autoPause ? 'Oui' : 'Non'} active={autoPause} position={[0.175, 0, 0]} onActivate={() => setSettings({ autoPause: !autoPause })} />
          </Row>
          <Row i={4}>
            <Label text="Compteur d'images" size={0.026} align="left" position={[-w / 2 + 0.04, 0, 0]} />
            <Button3D width={0.28} height={0.065} icon="📈" label={prefs.showFps ? 'Affiché' : 'Masqué'} active={prefs.showFps} position={[0.175, 0, 0]} onActivate={() => setPrefs({ showFps: !prefs.showFps })} />
          </Row>
          <group position={[0, -h / 2 + 0.05, 0.004]}>
            <Button3D width={0.17} height={0.07} icon="📍" label="Replacer" position={[-0.2, 0, 0]} onActivate={() => { setPanel(null); setPhase('placing'); }} />
            <Button3D width={0.17} height={0.07} icon="👋" label="Revoir" position={[0, 0, 0]} onActivate={() => { setPrefs({ tutorialDone: false }); useVR.setState({ tutorialStep: 0 }); setPanel(null); }} />
            <Button3D width={0.2} height={0.07} icon="🆕" label={confirm ? 'Retapez !' : 'Nouvelle'} danger={confirm} position={[0.2, 0, 0]} onActivate={() => { if (confirm) { newGame(); setPanel(null); setConfirm(false); } else setConfirm(true); }} />
          </group>
          <Button3D width={0.05} height={0.05} icon="✖️" position={[w / 2 - 0.035, h / 2 - 0.035, 0.004]} onActivate={() => setPanel(null)} />
        </Panel>
      </group>
    </FacePlayer>
  );
}

/** Fin de partie : récapitulatif sur le plateau, un seul bouton */
export function GameOver3D() {
  const game = useGame((s) => (s.game.gameOver ? s.game : null));
  const newGame = useGame((s) => s.newGame);
  if (!game) return null;
  const w = 0.6;
  const h = 0.4;
  const stat = (icon: string, v: string | number, label: string, i: number) => (
    <group key={label} position={[(i % 3 - 1) * 0.19, 0.03 - Math.floor(i / 3) * 0.1, 0]}>
      <Label text={`${icon} ${v}`} size={0.036} position={[0, 0.012, 0]} />
      <Label text={label} size={0.018} weight={600} color={THEME.dim} position={[0, -0.025, 0]} />
    </group>
  );
  return (
    <FacePlayer position={[0, 0.3, 0]} tilt={0.25}>
      <Panel width={w} height={h} border={THEME.bad}>
        <Label text="Le village est désert…" size={0.044} position={[0, h / 2 - 0.05, 0]} />
        <Label text="Le dernier habitant a quitté les lieux." size={0.024} color={THEME.dim} position={[0, h / 2 - 0.095, 0]} />
        {[stat('📅', game.day - 1, 'jours', 0), stat('👥', game.stats.maxPopulation, 'population max', 1), stat('🏗️', game.stats.buildingsBuilt, 'bâtiments', 2), stat('🗡️', game.stats.banditsKilled, 'bandits', 3), stat('🧯', game.stats.firesPutOut, 'feux éteints', 4), stat('⭐', score(game), 'score', 5)]}
        <Button3D width={0.3} height={0.075} icon="🆕" label="Nouvelle partie" position={[0, -h / 2 + 0.05, 0.004]} onActivate={() => newGame()} />
      </Panel>
    </FacePlayer>
  );
}

/** Icône discrète quand le suivi des mains est perdu : allumer la lumière ou prendre les manettes */
export function HandsLost({ z }: { z: number }) {
  const lost = useVR((s) => s.handsLost);
  if (!lost) return null;
  return (
    <FacePlayer position={[0, 0.14, z]} tilt={0.2}>
      <Panel width={0.2} height={0.07} border={THEME.warn}>
        <Label text="🖐️❓ 💡 / 🎮" size={0.03} />
      </Panel>
    </FacePlayer>
  );
}

export function TableObjects() {
  const scale = useVR((s) => s.board.scale);
  const dominant = useVR((s) => s.prefs.dominant);
  const { hw, hd } = boardHalf(scale);
  // Du côté de la main dominante : sablier et annuler ; de l'autre : livre et engrenage (la boîte est de ce côté aussi)
  const side = dominant === 'right' ? 1 : -1;
  const zRow = hd + 0.2;
  return (
    <group>
      <Hourglass x={side * (hw - 0.08)} z={zRow} />
      <UndoButton x={side * (hw - 0.25)} z={zRow} />
      <MenuObjects x={-side * (hw - 0.14)} z={zRow} />
      <Toast3D z={hd + 0.2} />
      <Chronicle3D z={hd + 0.34} />
      <Settings3D z={hd + 0.34} />
      <HandsLost z={hd + 0.2} />
      <GameOver3D />
    </group>
  );
}
