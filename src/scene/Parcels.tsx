import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ALL_PARCELS, parcelOf, type ParcelRect } from '../game/parcels';
import type { GameMap, ParcelFeature } from '../game/types';
import { useGame } from '../store/gameStore';
import { Banner } from './models/Decor';
import { Part } from './models/Part';
import { parcelScreen } from './badgeAnchors';
import { GEO, TILE } from './shared';

const fogMat = new THREE.MeshStandardMaterial({
  color: '#c3c8d2',
  transparent: true,
  opacity: 0.26,
  depthWrite: false,
  roughness: 1,
});
const outlineMat = new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.85, depthWrite: false });

function rectCenter(r: ParcelRect, map: GameMap): [number, number] {
  return [((r.x0 + r.x1) / 2 - map.width / 2) * TILE, ((r.z0 + r.z1) / 2 - map.height / 2) * TILE];
}

/** Brouillard léger au-dessus des parcelles verrouillées (1 draw call) */
function Fog({ locked, map }: { locked: ParcelRect[]; map: GameMap }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    locked.forEach((r, i) => {
      const [cx, cz] = rectCenter(r, map);
      // Le brouillard "respire" doucement
      const h = 0.9 + Math.sin(clock.elapsedTime * 0.6 + i) * 0.08;
      m.compose(new THREE.Vector3(cx, h / 2, cz), new THREE.Quaternion(), new THREE.Vector3((r.x1 - r.x0) * 0.995, h, (r.z1 - r.z0) * 0.995));
      mesh.setMatrixAt(i, m);
    });
    mesh.count = locked.length;
    mesh.instanceMatrix.needsUpdate = true;
  });
  if (!locked.length) return null;
  return <instancedMesh ref={ref} args={[GEO.box, fogMat, 12]} frustumCulled={false} />;
}

/** Contour doré de la parcelle survolée (ou ouverte) */
function Outline({ rect, map }: { rect: ParcelRect; map: GameMap }) {
  const [cx, cz] = rectCenter(rect, map);
  const w = rect.x1 - rect.x0;
  const d = rect.z1 - rect.z0;
  const t = 0.06;
  return (
    <group position={[cx, 0.04, cz]}>
      {[
        [0, -d / 2, w, t],
        [0, d / 2, w, t],
        [-w / 2, 0, t, d],
        [w / 2, 0, t, d],
      ].map(([x, z, sx, sz], i) => (
        <mesh key={i} geometry={GEO.box} material={outlineMat} position={[x, 0, z]} scale={[sx, 0.05, sz]} />
      ))}
    </group>
  );
}

/** Projette le centre des parcelles verrouillées à l'écran (lu par ui/ParcelBadges) */
function BadgeProjector({ locked, map }: { locked: ParcelRect[]; map: GameMap }) {
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    parcelScreen.clear();
    for (const r of locked) {
      const [cx, cz] = rectCenter(r, map);
      // Projection écran (sur PC ; en VR la couche HTML n'est pas affichée)
      v.set(cx, 1.25, cz).project(camera);
      parcelScreen.set(r.id, {
        x: ((v.x + 1) / 2) * size.width,
        y: ((1 - v.y) / 2) * size.height,
        visible: v.z < 1 && v.z > -1,
      });
    }
  });
  return null;
}

/** Camp de bandits : tentes rouges, feu de camp, palissade, étendard */
function Camp() {
  const fire = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (fire.current) fire.current.scale.setScalar(0.8 + Math.sin(clock.elapsedTime * 15) * 0.2);
  });
  return (
    <group>
      {[
        [-0.45, -0.3],
        [0.45, -0.3],
        [-0.3, 0.4],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, i * 0.8, 0]}>
          <Part g="pyramid" m={i % 2 ? 'cloth' : 'woodRaw'} p={[0, 0.2, 0]} s={[0.42, 0.4, 0.42]} />
          <Part g="box" m="ironDark" p={[0, 0.08, 0.2]} s={[0.1, 0.15, 0.02]} shadow={false} />
        </group>
      ))}
      <Part g="rock" m="stoneDark" p={[0.2, 0.03, 0.2]} s={[0.22, 0.06, 0.22]} shadow={false} />
      <group ref={fire} position={[0.2, 0.1, 0.2]}>
        <Part g="cone6" m="window" s={[0.1, 0.18, 0.1]} shadow={false} />
      </group>
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return <Part key={i} g="cone6" m="woodRaw" p={[Math.cos(a) * 0.85, 0.14, Math.sin(a) * 0.7]} s={[0.06, 0.28, 0.06]} />;
      })}
      <Banner p={[-0.55, 0, 0.55]} h={0.6} m="ironDark" />
    </group>
  );
}

/** Ruines : murs écroulés, colonne brisée, gravats */
function Ruins() {
  return (
    <group>
      <Part g="box" m="stoneLight" p={[-0.5, 0.18, -0.15]} s={[0.12, 0.36, 0.5]} r={[0, 0, 0.08]} />
      <Part g="box" m="stoneLight" p={[-0.2, 0.1, -0.35]} s={[0.5, 0.2, 0.1]} />
      <Part g="cylinder" m="stoneLight" p={[0.35, 0.22, -0.1]} s={[0.14, 0.44, 0.14]} />
      <Part g="cylinder" m="stoneLight" p={[0.15, 0.06, 0.25]} s={[0.14, 0.4, 0.14]} r={[0, 0, Math.PI / 2]} />
      <Part g="box" m="stone" p={[0.55, 0.05, 0.2]} s={[0.18, 0.1, 0.18]} r={[0, 0.5, 0]} />
      {[0, 1, 2, 3, 4].map((i) => (
        <Part key={i} g="rock" m="stoneDark" p={[-0.4 + i * 0.22, 0.04, 0.3 - (i % 2) * 0.15]} s={0.1} shadow={false} />
      ))}
      <Part g="box" m="gold" p={[-0.05, 0.05, 0.05]} s={[0.12, 0.08, 0.08]} shadow={false} />
    </group>
  );
}

function Feature({ f, map }: { f: ParcelFeature; map: GameMap }) {
  const inspectFeature = useGame((s) => s.inspectFeature);
  const x = (f.x + f.w / 2 - map.width / 2) * TILE;
  const z = (f.z + f.h / 2 - map.height / 2) * TILE;
  return (
    <group
      position={[x, 0, z]}
      scale={[f.w / 2, 1, f.h / 2 + (f.h === 1 ? 0.5 : 0)]}
      onClick={(e) => {
        if (e.delta > 6) return;
        e.stopPropagation();
        inspectFeature(f.id);
      }}
    >
      {f.type === 'camp' ? <Camp /> : <Ruins />}
    </group>
  );
}

/** Parcelles : brouillard et pastilles sur les zones verrouillées, dangers (camps, ruines) */
export function Parcels({ map }: { map: GameMap }) {
  const owned = useGame((s) => s.game.parcels.owned);
  const features = useGame((s) => s.game.features);
  const hoverParcel = useGame((s) => (s.hover ? parcelOf(s.hover.x, s.hover.z) : -1));
  const openParcel = useGame((s) => s.inspectedParcel);
  const locked = useMemo(() => ALL_PARCELS.filter((r) => !owned.includes(r.id)), [owned]);
  const highlight = openParcel ?? (hoverParcel >= 0 && !owned.includes(hoverParcel) ? hoverParcel : null);
  return (
    <group>
      <Fog locked={locked} map={map} />
      <BadgeProjector locked={locked} map={map} />
      {highlight !== null && <Outline rect={ALL_PARCELS[highlight]} map={map} />}
      {features
        .filter((f) => !f.cleared)
        .map((f) => (
          <Feature key={f.id} f={f} map={map} />
        ))}
    </group>
  );
}
