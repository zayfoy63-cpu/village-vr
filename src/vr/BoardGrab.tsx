// Le plateau se manipule comme un vrai plateau de jeu de société : au lancement il est présenté devant
// le joueur (à hauteur de taille, incliné vers lui, bords lumineux) ; on l'attrape par ses bords (une
// main : déplacer et tourner ; deux mains : porter comme une planche, très stable), il reste à
// l'horizontale ; relâché près de la vraie table, il s'y aimante (petit « toc » et vibration), relâché
// en l'air, il flotte. Un cadenas le verrouille après chaque pose. Deux pincements au-dessus des cases
// (loin des bords) zooment. Réglages : VR_CONFIG.grab et VR_CONFIG.snap.

import { useFrame } from '@react-three/fiber';
import { useXR } from '@react-three/xr';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { VR_CONFIG } from './config';
import { isDragging } from './Drag';
import { haptic, sfx } from './feedback';
import { useVR, saveBoard, type Board, type Hand } from './store';
import { boardOuter, boardTop, edgeNear, grabEdgeAt, overBoard, readInputs, toBoardLocal, type Edge, type GrabInput } from './boardGrabLogic';
import { Button3D, FacePlayer, Label, Panel, THEME } from './ui/kit';
import { GhostHand } from './ui/Tutorial3D';
import { I } from '../ui/icons';
import { PAL } from '../palette';

// --- État de la saisie (hors React : mis à jour à chaque image) -------------------------------

interface Holder {
  edge: Edge;
}

const holders = new Map<string, Holder>();
/** Repère pris au début de la saisie (ou quand une main s'ajoute / part) : aucun saut */
let anchor: { board: Board; points: THREE.Vector3[]; yaw: number; angle: number } | null = null;
const wasPressed = new Map<string, boolean>();
/** Pincements commencés au-dessus des cases (candidats au zoom) */
const zoomKeys = new Set<string>();
let zoom: { d0: number; scale0: number } | null = null;
let snap: { from: number; to: number; t: number; hand: Hand } | null = null;
/**
 * Surface réelle sous le plateau : hauteur et moment où elle a été vue. Les plans détectés (dessus de
 * table annoncé par le casque) passent avant le hit-test (maillage de la pièce, moins régulier).
 */
let surface: { y: number; at: number } | null = null;
let planeSurface: { y: number; at: number } | null = null;
let hitSurface: { y: number; at: number } | null = null;
/** Intensité de la surbrillance de chaque bord (lue par <BoardEdges>) */
export const edgeGlow = [0, 0, 0, 0];
let lastInputs: GrabInput[] = [];

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const clampY = (y: number) => Math.min(VR_CONFIG.board.maxHeight, Math.max(VR_CONFIG.board.minHeight - 0.4, y));

/** Position « devant moi » : à hauteur de taille, à distance de bras, face au joueur */
export function frontOfPlayer(camera: THREE.Camera): Pick<Board, 'x' | 'y' | 'z' | 'yaw'> {
  const B = VR_CONFIG.board;
  const cam = new THREE.Vector3();
  camera.getWorldPosition(cam);
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion()));
  fwd.y = 0;
  if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1);
  fwd.normalize();
  const x = cam.x + fwd.x * B.frontDistance;
  const z = cam.z + fwd.z * B.frontDistance;
  const y = Math.min(B.frontHeightMax, Math.max(B.frontHeightMin, cam.y - B.waistBelowEyes));
  return { x, y, z, yaw: Math.atan2(cam.x - x, cam.z - z) };
}

/** Pose terminée (relâché, « Jouer ici », recentrage) : la partie commence, plateau verrouillé et mémorisé */
function settle() {
  const vr = useVR.getState();
  useVR.setState({ phase: 'playing', locked: true, grabbing: 0 });
  saveBoard(vr.board);
}

/** « Jouer ici » : le plateau présenté reste où il est, à plat */
export function placeHere() {
  holders.clear();
  anchor = null;
  useVR.setState({ tilt: 0 });
  settle();
}

/** Recalcule le repère de saisie avec les mains présentes (évite tout saut) */
function reanchor(inputs: GrabInput[]) {
  const pts = [...holders.keys()].map((k) => inputs.find((i) => i.key === k)).filter((i): i is GrabInput => !!i);
  if (!pts.length) {
    anchor = null;
    return;
  }
  const b = useVR.getState().board;
  anchor = {
    board: { ...b },
    points: pts.map((p) => p.point.clone()),
    yaw: pts[0].yaw,
    angle: pts.length > 1 ? Math.atan2(pts[1].point.x - pts[0].point.x, pts[1].point.z - pts[0].point.z) : 0,
  };
}

/** Le pointeur `world` (saisie d'un bâtiment) est-il plutôt en train d'attraper un bord libre du plateau ? */
export function boardEdgeGrabbable(world: THREE.Vector3): boolean {
  const vr = useVR.getState();
  if (!vr.active || vr.pcPreview || vr.locked) return false;
  return grabEdgeAt(world, vr.board, vr.tilt, vr.prefs.dominant) !== null;
}

// --- Contrôle (une fois dans la scène XR) ------------------------------------------------------

export function BoardGrab() {
  const mode = useXR((s) => s.mode);
  const planes = useXR((s) => s.detectedPlanes);
  const phase = useVR((s) => s.phase);
  const grabbing = useVR((s) => s.grabbing);
  // Sonde du hit-test : un rayon vers le bas depuis le dessus du plateau, demandé puis lu à l'image suivante
  const probeSource = useRef<XRHitTestSource | null>(null);
  const probing = useRef(false);
  const lastProbe = useRef(0);
  const presented = useRef(false);
  const recenterSeen = useRef(useVR.getState().recenterAsk);
  const saveTimer = useRef(0);
  const savedKey = useRef('');
  const shadow = useRef<THREE.Mesh>(null);
  const hint = useRef<THREE.Group>(null);
  const shadowGeo = useMemo(() => softRect(), []);

  useFrame((state, dt, frame) => {
    const vr = useVR.getState();
    const S = VR_CONFIG.snap;
    const G = VR_CONFIG.grab;
    const now = performance.now() / 1000;
    if (mode === null || !vr.active || vr.pcPreview) return;

    // Présentation au lancement : devant le joueur, à hauteur de taille (une fois la tête suivie)
    if (vr.phase === 'placing' && !presented.current) {
      const cam = state.camera.getWorldPosition(new THREE.Vector3());
      if (cam.y > 0.3) {
        presented.current = true;
        vr.setBoard(frontOfPlayer(state.camera));
      }
    }
    if (vr.phase === 'playing') presented.current = false;

    // Recentrage demandé (paramètres) : devant le joueur, à plat, verrouillé
    if (vr.recenterAsk !== recenterSeen.current) {
      recenterSeen.current = vr.recenterAsk;
      holders.clear();
      anchor = null;
      snap = null;
      vr.setBoard(frontOfPlayer(state.camera));
      useVR.setState({ tilt: 0 });
      settle();
      sfx('drop');
    }

    const ref = state.gl.xr.getReferenceSpace();
    if (import.meta.env.DEV && frame && ref && dbg.planes) dbg.list = planeList(planes, frame, ref);
    const inputs = frame && ref ? readInputs(frame, ref) : [];
    lastInputs = inputs;
    const canGrab = vr.phase === 'placing' || !vr.locked;

    // Appuis et relâchements
    let changed = false;
    for (const inp of inputs) {
      const was = wasPressed.get(inp.key) ?? false;
      wasPressed.set(inp.key, inp.pressed);
      if (inp.pressed && !was) {
        const edge = canGrab && vr.held === null && !isDragging() && !zoom && holders.size < 2 ? grabEdgeAt(inp.point, vr.board, vr.tilt, vr.prefs.dominant) : null;
        if (edge !== null) {
          holders.set(inp.key, { edge });
          snap = null;
          changed = true;
          sfx('grab');
          haptic('grab', inp.hand);
        } else if (vr.phase === 'playing' && overBoard(toBoardLocal(inp.point, vr.board, vr.tilt), vr.board.scale)) zoomKeys.add(inp.key);
      } else if (!inp.pressed && was) {
        zoomKeys.delete(inp.key);
        if (holders.delete(inp.key)) {
          changed = true;
          if (!holders.size) release(inp.hand);
        }
      }
    }
    // Main ou manette perdue en cours de saisie : relâchée
    for (const k of [...holders.keys()])
      if (!inputs.some((i) => i.key === k)) {
        holders.delete(k);
        changed = true;
        if (!holders.size) release(vr.prefs.dominant);
      }
    if (changed) reanchor(inputs);
    if (vr.grabbing !== holders.size) useVR.setState({ grabbing: holders.size });

    // Déplacer : une main (position + rotation de la main), deux mains (porter une planche)
    if (holders.size && anchor) {
      const pts = [...holders.keys()].map((k) => inputs.find((i) => i.key === k)!).filter(Boolean);
      const a = anchor;
      let target: Board | null = null;
      if (pts.length === 1 && a.points.length === 1) {
        const d = wrap(pts[0].yaw - a.yaw);
        const off = new THREE.Vector3(a.board.x - a.points[0].x, a.board.y - a.points[0].y, a.board.z - a.points[0].z).applyAxisAngle(UP, d);
        target = { ...a.board, x: pts[0].point.x + off.x, y: pts[0].point.y + off.y, z: pts[0].point.z + off.z, yaw: a.board.yaw + d };
      } else if (pts.length === 2 && a.points.length === 2) {
        const mid0 = a.points[0].clone().add(a.points[1]).multiplyScalar(0.5);
        const mid = pts[0].point.clone().add(pts[1].point).multiplyScalar(0.5);
        const d = wrap(Math.atan2(pts[1].point.x - pts[0].point.x, pts[1].point.z - pts[0].point.z) - a.angle);
        const off = new THREE.Vector3(a.board.x - mid0.x, a.board.y - mid0.y, a.board.z - mid0.z).applyAxisAngle(UP, d);
        target = { ...a.board, x: mid.x + off.x, y: mid.y + off.y, z: mid.z + off.z, yaw: a.board.yaw + d };
      }
      if (target) {
        const b = vr.board;
        const k = 1 - Math.exp(-dt * (pts.length === 2 ? G.smoothTwo : G.smoothOne));
        vr.setBoard({
          x: b.x + (target.x - b.x) * k,
          y: clampY(b.y + (target.y - b.y) * k),
          z: b.z + (target.z - b.z) * k,
          yaw: b.yaw + wrap(target.yaw - b.yaw) * k,
        });
      }
    }

    // Zoom : deux pincements au-dessus des cases, on écarte ou on rapproche les mains
    const zk = [...zoomKeys].map((k) => inputs.find((i) => i.key === k && i.pressed)).filter((i): i is GrabInput => !!i);
    if (zk.length === 2 && !holders.size && vr.held === null) {
      const d = zk[0].point.distanceTo(zk[1].point);
      if (!zoom) zoom = { d0: Math.max(0.02, d), scale0: vr.board.scale };
      const B = VR_CONFIG.board;
      vr.setBoard({ scale: Math.min(B.maxScale, Math.max(B.minScale, (zoom.scale0 * d) / zoom.d0)) });
      if (!vr.zooming) useVR.setState({ zooming: true });
    } else if (zoom || vr.zooming) {
      zoom = null;
      useVR.setState({ zooming: false });
    }

    // Inclinaison de présentation : s'efface dès qu'on attrape le plateau
    const tiltTarget = vr.phase === 'placing' && !holders.size ? VR_CONFIG.board.presentTilt : 0;
    if (Math.abs(vr.tilt - tiltTarget) > 1e-4) useVR.setState({ tilt: vr.tilt + (tiltTarget - vr.tilt) * Math.min(1, dt * 8) });

    // Aimantation sur la table : courte descente, petit rebond, « toc »
    if (snap) {
      snap.t = Math.min(1, snap.t + dt / S.duration);
      const k = snap.t;
      const ease = 1 - (1 - k) ** 3;
      // Descente amortie, puis un tout petit rebond au contact
      const bounce = k > 0.7 ? Math.sin(((k - 0.7) / 0.3) * Math.PI) * S.bounce : 0;
      vr.setBoard({ y: snap.to + (snap.from - snap.to) * (1 - ease) + bounce });
      if (k >= 1) {
        vr.setBoard({ y: snap.to });
        sfx('thud');
        haptic('thud', snap.hand);
        saveBoard(useVR.getState().board);
        snap = null;
      }
    }

    // Surface sous le plateau : plans détectés (tables) et hit-test vers le bas
    const sensing = holders.size > 0 || vr.phase === 'placing';
    if (sensing && frame && ref) {
      const fromPlanes = planeBelow(planes, frame, ref, vr.board);
      if (fromPlanes !== null) planeSurface = { y: fromPlanes, at: now };
      const src = probeSource.current;
      if (src) {
        probeSource.current = null;
        for (const r of frame.getHitTestResults(src)) {
          const pose = r.getPose(ref);
          if (!pose) continue;
          const m = new THREE.Matrix4().fromArray(pose.transform.matrix);
          const up = new THREE.Vector3().setFromMatrixColumn(m, 1);
          const y = pose.transform.position.y;
          // Surface horizontale (normale verticale, dans un sens ou dans l'autre selon l'appareil)
          if (Math.abs(up.y) < 0.85 || y > vr.board.y + S.above + 0.3 || y < 0.2) continue;
          hitSurface = { y, at: now };
          if (import.meta.env.DEV) dbg.hits++;
          break;
        }
        src.cancel();
      } else if (!probing.current && now - lastProbe.current > S.probeEvery && frame.session.requestHitTestSource) {
        lastProbe.current = now;
        probing.current = true;
        const b = vr.board;
        frame.session
          .requestHitTestSource({ space: ref, offsetRay: new XRRay({ x: b.x, y: b.y + 0.3, z: b.z }, { x: 0, y: -1, z: 0 }), entityTypes: ['plane', 'mesh'] })
          ?.then((source) => (probeSource.current = source))
          .catch((err) => {
            if (import.meta.env.DEV) dbg.err = String(err);
          })
          .finally(() => (probing.current = false));
      }
    }
    if (planeSurface && now - planeSurface.at > S.forgetAfter) planeSurface = null;
    if (hitSurface && now - hitSurface.at > S.forgetAfter) hitSurface = null;
    if (!snap) surface = planeSurface ?? hitSurface;
    const sy = surface?.y ?? null;
    if ((sy === null) !== (vr.surfaceY === null) || (sy !== null && vr.surfaceY !== null && Math.abs(sy - vr.surfaceY) > 0.002)) useVR.setState({ surfaceY: sy });

    // Ombre douce sur la vraie table pendant qu'on déplace le plateau
    const sh = shadow.current;
    if (sh) {
      const b = useVR.getState().board;
      const h = sy === null ? 0 : b.y - sy;
      const show = holders.size > 0 && sy !== null && h > 0.004 && h < S.shadowFade;
      sh.visible = show;
      if (show) {
        const { hw, hd } = boardOuter(b.scale);
        const grow = 1 + h * 0.5;
        sh.position.set(b.x, sy! + 0.002, b.z);
        sh.rotation.set(0, b.yaw, 0);
        sh.scale.set((hw * 2 + 0.03) * grow, 1, (hd * 2 + 0.03) * grow);
        (sh.material as THREE.MeshBasicMaterial).opacity = S.shadowOpacity * (1 - h / S.shadowFade);
      }
    }

    // Surbrillance des bords : bord tenu, main ou manette qui s'approche ; invitation douce si libre
    const pulse = 0.25 + 0.2 * Math.sin(now * 3);
    for (let i = 0; i < 4; i++) edgeGlow[i] = 0;
    if (canGrab) {
      if (!holders.size) for (let i = 0; i < 4; i++) edgeGlow[i] = vr.phase === 'placing' ? pulse : pulse * 0.5;
      for (const inp of inputs) {
        const near = edgeNear(toBoardLocal(inp.point, vr.board, vr.tilt), vr.board.scale, G.glowFrom);
        if (near) edgeGlow[near.edge] = Math.max(edgeGlow[near.edge], 0.35 + 0.5 * (1 - Math.max(0, near.d) / G.glowFrom));
      }
      for (const h of holders.values()) edgeGlow[h.edge] = 1;
    }

    // La consigne de présentation suit le plateau (sans son inclinaison)
    const g = hint.current;
    if (g) {
      const b = useVR.getState().board;
      g.position.set(b.x, b.y, b.z);
      g.rotation.set(0, b.yaw, 0);
    }

    // Position mémorisée pour la session (sans écrire à chaque image)
    if ((saveTimer.current += dt) > 1 && !holders.size && vr.phase === 'playing') {
      saveTimer.current = 0;
      const b = useVR.getState().board;
      const key = `${b.x.toFixed(3)}|${b.y.toFixed(3)}|${b.z.toFixed(3)}|${b.yaw.toFixed(3)}|${b.scale.toFixed(4)}`;
      if (key !== savedKey.current) {
        savedKey.current = key;
        saveBoard(b);
      }
    }
  });

  return (
    <group>
      <mesh ref={shadow} geometry={shadowGeo} material={shadowMat} visible={false} renderOrder={-1} />
      {mode !== null && phase === 'placing' && grabbing === 0 && (
        <group ref={hint}>
          <FacePlayer position={[0, 0.36, -0.05]} tilt={0.2}>
            <Panel width={0.5} height={0.17}>
              <Label title text={`${I.pinch} Attrapez le plateau par ses bords`} size={0.03} position={[0, 0.045, 0]} />
              <Label text="Pincez ou serrez le grip près d'un bord, puis posez-le sur votre table." size={0.019} weight={600} color={THEME.dim} maxWidth={0.46} position={[0, 0.005, 0]} />
              <Button3D width={0.2} height={0.05} icon={I.check} label="Jouer ici" position={[0, -0.05, 0.004]} onActivate={placeHere} />
            </Panel>
          </FacePlayer>
        </group>
      )}
    </group>
  );
}

const UP = new THREE.Vector3(0, 1, 0);

/** Relâché : aimanté sur la table si elle est juste en dessous (ou un peu au-dessus), sinon il flotte */
function release(hand: Hand) {
  const vr = useVR.getState();
  const S = VR_CONFIG.snap;
  anchor = null;
  const sy = surface?.y ?? null;
  const h = sy === null ? Infinity : vr.board.y - sy;
  if (sy !== null && h <= S.above && h >= -S.below) snap = { from: vr.board.y, to: sy, t: 0, hand };
  else {
    sfx('drop');
    haptic('drop', hand);
  }
  settle();
}

/** Plus haute table détectée sous le centre du plateau (plans horizontaux), ou null */
const _inv = new THREE.Matrix4();
const _c = new THREE.Vector3();
function planeBelow(planes: readonly XRPlane[], frame: XRFrame, ref: XRReferenceSpace, b: Board): number | null {
  let best: number | null = null;
  for (const plane of planes) {
    if (plane.orientation !== 'horizontal') continue;
    const pose = frame.getPose(plane.planeSpace, ref);
    if (!pose) continue;
    _inv.fromArray(pose.transform.matrix);
    const up = new THREE.Vector3().setFromMatrixColumn(_inv, 1);
    const y = pose.transform.position.y;
    // Plan horizontal : sa normale est verticale (selon les appareils, l'axe y du plan peut être retourné)
    if (Math.abs(up.y) < 0.85 || y < 0.2 || y > b.y + VR_CONFIG.snap.above + 0.3) continue;
    _inv.invert();
    _c.set(b.x, y, b.z).applyMatrix4(_inv);
    if (!insidePolygon(_c.x, _c.z, plane.polygon)) continue;
    if (best === null || y > best) best = y;
  }
  return best;
}

function insidePolygon(x: number, z: number, poly: readonly DOMPointReadOnly[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const c = poly[j];
    if (a.z > z !== c.z > z && x < ((c.x - a.x) * (z - a.z)) / (c.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

// --- Ombre douce : rectangle opaque au centre, bord qui s'estompe (alpha par sommet) -------------

const shadowMat = new THREE.MeshBasicMaterial({ color: PAL.ink, vertexColors: true, transparent: true, opacity: 0.4, depthWrite: false });

function softRect(): THREE.BufferGeometry {
  // Carré unité (mis à l'échelle du plateau) : intérieur plein, couronne extérieure transparente
  const inner = 0.42;
  const outer = 0.5;
  const pos: number[] = [];
  const col: number[] = [];
  const ring = (r: number, a: number) => {
    for (const [x, z] of [[-r, -r], [r, -r], [r, r], [-r, r]]) {
      pos.push(x, 0, z);
      col.push(1, 1, 1, a);
    }
  };
  ring(inner, 1);
  ring(outer, 0);
  const idx = [0, 2, 1, 0, 3, 2];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    idx.push(i, 4 + j, 4 + i, i, j, 4 + j);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  g.setIndex(idx);
  return g;
}

// --- Bords lumineux, cadenas et mains fantômes (dans le repère du plateau) ---------------------

const glowMat = new THREE.MeshBasicMaterial({ color: PAL.straw, vertexColors: true, transparent: true, depthWrite: false, toneMapped: false });

/** Quatre bandes autour du plateau (une par bord) ; l'alpha de chaque bande suit `edgeGlow` */
function glowGeometry(scale: number): THREE.BufferGeometry {
  const { hw, hd } = boardOuter(scale);
  const i0 = 0.006;
  const o = 0.035;
  const y = boardTop(scale) * 0.2;
  const pos: number[] = [];
  const idx: number[] = [];
  // Chaque bande : 2 sommets sur le bord (intérieur), 2 à l'extérieur
  const strip = (ax: number, az: number, bx: number, bz: number, nx: number, nz: number) => {
    const s = pos.length / 3;
    pos.push(ax - nx * i0, y, az - nz * i0, bx - nx * i0, y, bz - nz * i0, bx + nx * o, y, bz + nz * o, ax + nx * o, y, az + nz * o);
    idx.push(s, s + 2, s + 1, s, s + 3, s + 2);
  };
  strip(-hw, hd, hw, hd, 0, 1); // devant
  strip(hw, -hd, -hw, -hd, 0, -1); // fond
  strip(hw, hd, hw, -hd, 1, 0); // droite
  strip(-hw, -hd, -hw, hd, -1, 0); // gauche
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(16 * 4).fill(1), 4));
  g.setIndex(idx);
  return g;
}

export function BoardEdges() {
  const scale = useVR((s) => s.board.scale);
  const phase = useVR((s) => s.phase);
  const locked = useVR((s) => s.locked);
  const grabbing = useVR((s) => s.grabbing);
  const geo = useMemo(() => glowGeometry(scale), [scale]);
  const mesh = useRef<THREE.Mesh>(null);
  const ghostL = { group: useRef<THREE.Group>(null), thumb: useRef<THREE.Mesh>(null), index: useRef<THREE.Mesh>(null) };
  const ghostR = { group: useRef<THREE.Group>(null), thumb: useRef<THREE.Mesh>(null), index: useRef<THREE.Mesh>(null) };
  const { hw, hd } = boardOuter(scale);

  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    const col = geo.getAttribute('color') as THREE.BufferAttribute;
    let any = false;
    for (let e = 0; e < 4; e++) {
      const a = edgeGlow[e];
      any ||= a > 0.01;
      // Bord intérieur lumineux, bord extérieur qui s'efface
      col.setW(e * 4, a);
      col.setW(e * 4 + 1, a);
      col.setW(e * 4 + 2, 0);
      col.setW(e * 4 + 3, 0);
    }
    col.needsUpdate = true;
    // Rien à briller : rien de dessiné
    m.visible = any;

    // Mains fantômes de la présentation : elles pincent les bords gauche et droit et soulèvent un peu
    const show = phase === 'placing' && grabbing === 0;
    const t = (clock.elapsedTime % VR_CONFIG.help.ghostCycle) / VR_CONFIG.help.ghostCycle;
    const pinch = Math.min(1, Math.max(0, (t - 0.25) / 0.2));
    const lift = t > 0.45 ? Math.sin(((t - 0.45) / 0.55) * Math.PI) * 0.04 : 0;
    for (const [g, side] of [[ghostL, -1], [ghostR, 1]] as const) {
      const grp = g.group.current;
      if (!grp) continue;
      grp.visible = show;
      if (!show) continue;
      const approach = Math.min(1, t / 0.25);
      grp.position.set(side * (hw + 0.05 - approach * 0.04), boardTop(scale) + 0.02 + (1 - approach) * 0.06 + lift, 0);
      grp.rotation.set(0, side * -Math.PI / 2, 0);
      if (g.thumb.current) g.thumb.current.rotation.z = (side > 0 ? -1 : 1) * (0.8 - pinch * 0.6);
      if (g.index.current) g.index.current.rotation.x = Math.PI / 2 + pinch * 0.35;
    }
  });

  return (
    <group>
      <mesh ref={mesh} geometry={geo} material={glowMat} visible={false} renderOrder={2} />
      <GhostHand group={ghostL.group} thumb={ghostL.thumb} index={ghostL.index} right={false} />
      <GhostHand group={ghostR.group} thumb={ghostR.thumb} index={ghostR.index} right />
      {/* Cadenas près du coin avant droit (en retrait du présentoir des ressources) : verrouillé après
          chaque pose, un tapotement le libère */}
      {phase === 'playing' && (
        <FacePlayer position={[hw + 0.045, boardTop(scale) + 0.035, hd * 0.45]} tilt={0.3}>
          <Button3D
            width={0.055}
            height={0.055}
            icon={locked ? I.lock : I.unlock}
            testId="board-lock"
            active={!locked}
            onActivate={() => useVR.getState().setLocked(!useVR.getState().locked)}
          />
        </FacePlayer>
      )}
    </group>
  );
}

// Outils de test (développement) : entrées lues, saisie en cours, surface, plans détectés
const dbg: { planes: boolean; list: string[]; hits: number; err: string } = { planes: false, list: [], hits: 0, err: '' };
function planeList(planes: readonly XRPlane[], frame: XRFrame, ref: XRReferenceSpace): string[] {
  return planes.map((p) => {
    const pose = frame.getPose(p.planeSpace, ref);
    const pos = pose?.transform.position;
    const xs = p.polygon.map((q) => q.x);
    const zs = p.polygon.map((q) => q.z);
    const m = pose ? new THREE.Matrix4().fromArray(pose.transform.matrix) : null;
    const up = m ? new THREE.Vector3().setFromMatrixColumn(m, 1) : null;
    const b = useVR.getState().board;
    const loc = m ? new THREE.Vector3(b.x, pos!.y, b.z).applyMatrix4(m.clone().invert()) : null;
    return `${p.semanticLabel} ${p.orientation} up=${up?.toArray().map((v) => v.toFixed(2))} board→${loc?.toArray().map((v) => v.toFixed(2))} pos=${pos ? [pos.x, pos.y, pos.z].map((v) => v.toFixed(2)) : '-'} x[${Math.min(...xs).toFixed(2)},${Math.max(...xs).toFixed(2)}] z[${Math.min(...zs).toFixed(2)},${Math.max(...zs).toFixed(2)}]`;
  });
}
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__boardGrab = {
    hitTests: () => ({ hits: dbg.hits, err: dbg.err }),
    planes: () => {
      dbg.planes = true;
      return dbg.list;
    },
    inputs: () => lastInputs.map((i) => ({ key: i.key, point: i.point.toArray(), yaw: i.yaw, pressed: i.pressed })),
    holders: () => [...holders.entries()].map(([k, h]) => ({ key: k, edge: h.edge })),
    surface: () => surface,
    glow: () => [...edgeGlow],
    placeHere,
    /** Point monde au milieu d'un bord (0 devant, 1 fond, 2 droite, 3 gauche), `out` m à l'extérieur */
    edgePoint: (edge: Edge, out = 0.015, along = 0) => {
      const vr = useVR.getState();
      const { hw, hd } = boardOuter(vr.board.scale);
      const y = boardTop(vr.board.scale);
      const local =
        edge === 0 ? new THREE.Vector3(along, y, hd + out) : edge === 1 ? new THREE.Vector3(along, y, -hd - out) : edge === 2 ? new THREE.Vector3(hw + out, y, along) : new THREE.Vector3(-hw - out, y, along);
      const b = vr.board;
      const m = new THREE.Matrix4().compose(new THREE.Vector3(b.x, b.y, b.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(vr.tilt, b.yaw, 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
      return local.applyMatrix4(m).toArray();
    },
    /** Point monde au-dessus des cases (repère du plateau : x, hauteur au-dessus des cases, z) */
    abovePoint: (x: number, h: number, z: number) => {
      const vr = useVR.getState();
      const b = vr.board;
      const m = new THREE.Matrix4().compose(new THREE.Vector3(b.x, b.y, b.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(vr.tilt, b.yaw, 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
      return new THREE.Vector3(x, boardTop(b.scale) + h, z).applyMatrix4(m).toArray();
    },
  };
}
