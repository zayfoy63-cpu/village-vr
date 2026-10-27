// Poignée et bord du plateau : le replacer, le monter / descendre, le recentrer ; attraper le bord pour le
// tourner (une main) ou le zoomer (deux mains).

import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useRef, useState } from 'react';
import * as THREE from 'three';
import { Part } from '../../scene/models/Part';
import { VR_CONFIG } from '../config';
import { feedback } from '../feedback';
import { boardHalf } from '../layout';
import { pointOnHorizontalPlane, samplePointer } from '../pointers';
import { useVR } from '../store';
import { Button3D } from './kit';
import { I } from '../../ui/icons';
import { PAL } from '../../palette';

const rimMat = new THREE.MeshBasicMaterial({ color: PAL.straw, transparent: true, opacity: 0, depthWrite: false });
const woodMat = new THREE.MeshStandardMaterial({ color: PAL.wood, roughness: 0.9, flatShading: true });

interface Grip {
  kind: 'rim' | 'handle';
  last?: THREE.Vector3;
  angle?: number;
  dist?: number;
  offset?: THREE.Vector3;
}

const grips = new Map<number, Grip>();

export function BoardRig3D() {
  const scale = useVR((s) => s.board.scale);
  const phase = useVR((s) => s.phase);
  const get = useThree((s) => s.get);
  const rim = useRef<THREE.Group>(null);
  const [hot, setHot] = useState(false);
  const { hw, hd } = boardHalf(scale);
  const pad = 0.07;

  useFrame((state) => {
    const vr = useVR.getState();
    const B = VR_CONFIG.board;
    // Matière de la bordure : s'illumine au survol ou pendant la saisie
    const active = grips.size > 0 || hot;
    rimMat.opacity += ((active ? 0.35 : 0) - rimMat.opacity) * 0.2;
    // Bordure éteinte : cachée (aucun dessin) mais toujours saisissable
    rimMat.visible = rimMat.opacity > 0.01;
    if (grips.size === 0 || vr.phase !== 'playing') return;
    const topY = vr.board.y + 0.033;
    const samples: { id: number; g: Grip; p: THREE.Vector3 }[] = [];
    for (const [id, g] of [...grips]) {
      const s = samplePointer(state, id);
      if (!s || !s.down) {
        grips.delete(id);
        continue;
      }
      const p = pointOnHorizontalPlane(s, g.kind === 'handle' && !s.dir ? s.origin.y : topY, new THREE.Vector3());
      if (p) samples.push({ id, g, p });
    }
    const rimGrips = samples.filter((x) => x.g.kind === 'rim');
    const handle = samples.find((x) => x.g.kind === 'handle');
    if (handle) {
      // Déplacer le plateau avec la main (x, z ; et y pour une saisie directe)
      const off = handle.g.offset ?? (handle.g.offset = new THREE.Vector3(vr.board.x - handle.p.x, vr.board.y - handle.p.y, vr.board.z - handle.p.z));
      const positional = handle.p.y !== topY;
      vr.setBoard({
        x: handle.p.x + off.x,
        z: handle.p.z + off.z,
        y: positional ? Math.min(B.maxHeight, Math.max(B.minHeight, handle.p.y + off.y)) : vr.board.y,
      });
    }
    const cx = vr.board.x;
    const cz = vr.board.z;
    if (rimGrips.length === 1) {
      const { g, p } = rimGrips[0];
      const a = Math.atan2(p.x - cx, p.z - cz);
      if (g.angle !== undefined) {
        let d = a - g.angle;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        vr.setBoard({ yaw: vr.board.yaw + d });
      }
      g.angle = a;
      g.dist = undefined;
    } else if (rimGrips.length >= 2) {
      const [a, b] = rimGrips;
      const d = Math.hypot(a.p.x - b.p.x, a.p.z - b.p.z);
      const ang = Math.atan2(a.p.x - b.p.x, a.p.z - b.p.z);
      if (a.g.dist !== undefined && a.g.dist > 0.02 && d > 0.02) {
        let da = ang - (a.g.angle ?? ang);
        da = Math.atan2(Math.sin(da), Math.cos(da));
        vr.setBoard({ scale: Math.min(B.maxScale, Math.max(B.minScale, vr.board.scale * (d / a.g.dist))), yaw: vr.board.yaw + da });
      }
      a.g.dist = d;
      a.g.angle = ang;
      b.g.angle = undefined;
    }
  });

  if (phase !== 'playing') return null;
  const down = (kind: Grip['kind']) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    // Un doigt qui effleure le bord ne l'agrippe pas : il faut pincer (ou gâchette / grip)
    if ((e as unknown as { pointerType?: string }).pointerType === 'touch') return;
    if (kind === 'rim' && useVR.getState().held) return;
    grips.set(e.pointerId, { kind });
    feedback('grab', e);
  };
  void get;
  const bars: [number, number, number, number][] = [
    [0, hd + pad / 2, hw * 2 + pad * 2, pad],
    [0, -hd - pad / 2, hw * 2 + pad * 2, pad],
    [hw + pad / 2, 0, pad, hd * 2],
    [-hw - pad / 2, 0, pad, hd * 2],
  ];
  return (
    <group>
      <group ref={rim}>
        {bars.map(([x, z, w, d], i) => (
          <mesh
            key={i}
            position={[x, 0.025, z]}
            material={rimMat}
            onPointerDown={down('rim')}
            onPointerOver={() => setHot(true)}
            onPointerOut={() => setHot(false)}
          >
            <boxGeometry args={[w, 0.05, d]} />
          </mesh>
        ))}
      </group>
      {/* Poignée : attraper pour déplacer le plateau, taper pour le replacer sur la table */}
      <group position={[-hw - 0.06, 0, hd + 0.06]}>
        <Part g="cylinder" m={woodMat} p={[0, 0.03, 0]} s={[0.066, 0.06, 0.066]} shadow={false} />
        <mesh
          position={[0, 0.035, 0]}
          onPointerDown={down('handle')}
          onClick={(e) => {
            e.stopPropagation();
            // Tap bref (sans déplacement) : replacer sur la table
            if (!grips.size) useVR.getState().setPhase('placing');
          }}
        >
          <cylinderGeometry args={[0.055, 0.055, 0.09, 10]} />
          <meshBasicMaterial visible={false} />
        </mesh>
        <Button3D width={0.06} height={0.06} icon={I.triUp} position={[-0.07, 0.07, 0]} onActivate={() => useVR.getState().setBoard({ y: Math.min(VR_CONFIG.board.maxHeight, useVR.getState().board.y + 0.05) })} />
        <Button3D width={0.06} height={0.06} icon={I.triDown} position={[-0.07, 0.005, 0]} onActivate={() => useVR.getState().setBoard({ y: Math.max(VR_CONFIG.board.minHeight, useVR.getState().board.y - 0.05) })} />
      </group>
    </group>
  );
}
