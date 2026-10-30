// Bâtiments liés aux mécaniques cachées : puits, herboriste, bergerie, digue, palissade, torches,
// et le cimetière qui apparaît de lui-même.

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import { SHEEP } from '../../game/sheep';
import { useGame } from '../../store/gameStore';
import { Fence, Torch } from './Decor';
import { Part } from './Part';

/** Puits : margelle en pierre, toit de planches, seau suspendu */
export function Well() {
  return (
    <group>
      <Part g="cylinder" m="stoneLight" p={[0, 0.1, 0]} s={[0.36, 0.2, 0.36]} />
      <Part g="cylinder" m="water" p={[0, 0.19, 0]} s={[0.28, 0.02, 0.28]} shadow={false} />
      {[-0.17, 0.17].map((x) => (
        <Part key={x} g="box" m="timber" p={[x, 0.32, 0]} s={[0.03, 0.42, 0.03]} />
      ))}
      <Part g="box" m="timber" p={[0, 0.48, 0]} s={[0.4, 0.025, 0.025]} />
      <Part g="gable" m="roofBrown" p={[0, 0.5, 0]} s={[0.44, 0.14, 0.32]} r={[0, Math.PI / 2, 0]} />
      <Part g="box" m="ironDark" p={[0, 0.38, 0]} s={[0.006, 0.18, 0.006]} shadow={false} />
      <Part g="cylinderLow" m="woodRaw" p={[0, 0.28, 0]} s={[0.07, 0.07, 0.07]} />
    </group>
  );
}

/** Herboriste : chaumière couverte de lierre, bouquets qui sèchent, petit jardin */
export function Herbalist() {
  return (
    <group>
      <Part g="box" m="plaster" p={[-0.05, 0.17, -0.06]} s={[0.46, 0.34, 0.4]} />
      <Part g="gable" m="thatch" p={[-0.05, 0.34, -0.06]} s={[0.54, 0.26, 0.48]} />
      <Part g="box" m="hedge" p={[-0.28, 0.2, -0.06]} s={[0.02, 0.3, 0.3]} shadow={false} />
      <Part g="box" m="door" p={[0.04, 0.12, 0.145]} s={[0.1, 0.2, 0.01]} shadow={false} />
      {/* Bouquets d'herbes sous l'avancée */}
      {[-0.2, -0.12, -0.04].map((x, i) => (
        <Part key={x} g="cone6" m={i % 2 ? 'paintGreen' : 'hedge'} p={[x, 0.26, 0.17]} s={[0.035, 0.07, 0.035]} r={[Math.PI, 0, 0]} shadow={false} />
      ))}
      {/* Jardin de simples */}
      {[
        [0.3, 0.25, 'paintGreen'],
        [0.3, 0.05, 'hedge'],
        [0.3, -0.15, 'paintYellow'],
      ].map(([x, z, m]) => (
        <Part key={String(z)} g="ball" m={m as 'hedge'} p={[x as number, 0.05, z as number]} s={[0.14, 0.08, 0.14]} />
      ))}
      <Part g="cylinderLow" m="stoneDark" p={[0.12, 0.05, 0.3]} s={[0.12, 0.1, 0.12]} />
    </group>
  );
}

/** Un mouton qui broute (petite oscillation) ; maigre, il est plus fin et plus bas */
function Sheep({ p, phase, thin }: { p: [number, number, number]; phase: number; thin: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime * 0.6 + phase;
    ref.current.position.x = p[0] + Math.sin(t) * 0.05;
    ref.current.rotation.y = Math.cos(t) * 0.8 + phase;
  });
  const k = thin ? 0.72 : 1;
  return (
    <group ref={ref} position={p}>
      <Part g="ball" m={thin ? 'wall' : 'clothWhite'} p={[0, 0.08 * k, 0]} s={[0.14 * k, 0.1 * k, 0.1 * k]} />
      <Part g="ball" m="ironDark" p={[0.08 * k, 0.09 * k, 0]} s={0.05} shadow={false} />
    </group>
  );
}

/** Emplacements des moutons dans l'enclos : les premiers sont toujours occupés, les suivants s'ajoutent avec le niveau */
const FLOCK: [number, number, number][] = [
  [0.15, 0, 0.1],
  [-0.1, 0, 0.22],
  [0.27, 0, -0.18],
  [0.0, 0, -0.05],
  [0.3, 0, 0.3],
  [-0.32, 0, 0.3],
  [0.12, 0, -0.32],
  [-0.05, 0, 0.36],
];
/** Troupeau visible par niveau */
const FLOCK_SIZE = [0, 3, 5, 8];

/** Abreuvoir et balle de foin communs aux niveaux */
function Trough({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <Part g="box" m="woodRaw" p={[0, 0.04, 0]} s={[0.2, 0.07, 0.07]} />
      <Part g="box" m="water" p={[0, 0.075, 0]} s={[0.17, 0.01, 0.045]} shadow={false} />
    </group>
  );
}

/**
 * Bergerie, un aspect par niveau : 1 petit abri de chaume et 3 moutons ; 2 étable de bois à toit de bardeaux,
 * abreuvoir et 5 moutons ; 3 bergerie à soubassement de pierre, toit de tuiles, lanterne, meules et 8 moutons.
 * Moins de moutons si elle a été attaquée, des moutons plus fins si le troupeau maigrit (blé manquant l'hiver).
 */
export function Sheepfold({ id, level = 1 }: { id: number; level?: number }) {
  const damaged = useGame((s) => !!s.game.buildings.find((b) => b.id === id)?.damaged);
  const thin = useGame((s) => (s.game.buildings.find((b) => b.id === id)?.lean ?? 0) >= SHEEP.thinFrom);
  const lvl = Math.max(1, Math.min(3, level));
  const flock = damaged ? Math.max(1, Math.ceil(FLOCK_SIZE[lvl] / 3)) : FLOCK_SIZE[lvl];
  return (
    <group>
      <Fence w={0.92} d={0.88} m={lvl === 1 ? 'woodRaw' : lvl === 2 ? 'woodLight' : 'timber'} />
      {lvl === 1 && (
        <>
          <Part g="box" m="woodRaw" p={[-0.18, 0.16, -0.22]} s={[0.4, 0.32, 0.3]} />
          <Part g="gable" m="thatch" p={[-0.18, 0.32, -0.22]} s={[0.46, 0.2, 0.38]} r={[0, Math.PI / 2, 0]} />
          <Part g="ball" m="hay" p={[0.3, 0.06, 0.28]} s={[0.12, 0.1, 0.12]} />
        </>
      )}
      {lvl === 2 && (
        <>
          <Part g="box" m="timber" p={[-0.2, 0.0, -0.2]} s={[0.46, 0.02, 0.36]} shadow={false} />
          <Part g="box" m="woodLight" p={[-0.2, 0.2, -0.2]} s={[0.46, 0.4, 0.34]} />
          <Part g="box" m="door" p={[-0.2, 0.13, -0.025]} s={[0.14, 0.26, 0.01]} shadow={false} />
          <Part g="gable" m="roofBrown" p={[-0.2, 0.4, -0.2]} s={[0.54, 0.24, 0.44]} r={[0, Math.PI / 2, 0]} />
          <Part g="ball" m="hay" p={[0.3, 0.07, -0.3]} s={[0.14, 0.12, 0.14]} />
          <Part g="ball" m="hay" p={[0.38, 0.06, -0.18]} s={[0.1, 0.09, 0.1]} />
          <Trough p={[0.12, 0, 0.34]} />
        </>
      )}
      {lvl === 3 && (
        <>
          <Part g="box" m="stoneLight" p={[-0.2, 0.1, -0.2]} s={[0.52, 0.2, 0.4]} />
          <Part g="box" m="plaster" p={[-0.2, 0.3, -0.2]} s={[0.48, 0.2, 0.36]} />
          <Part g="box" m="timber" p={[-0.2, 0.3, -0.015]} s={[0.48, 0.02, 0.02]} shadow={false} />
          <Part g="box" m="door" p={[-0.2, 0.14, -0.0]} s={[0.15, 0.26, 0.01]} shadow={false} />
          <Part g="gable" m="roofRed" p={[-0.2, 0.4, -0.2]} s={[0.6, 0.3, 0.5]} r={[0, Math.PI / 2, 0]} />
          {/* Lanterne à la porte */}
          <Part g="box" m="ironDark" p={[-0.07, 0.3, 0.0]} s={[0.012, 0.1, 0.012]} shadow={false} />
          <Part g="ball" m="paintYellow" p={[-0.07, 0.34, 0.0]} s={0.04} shadow={false} />
          {/* Meules et abreuvoir, parc séparé au fond */}
          <Part g="cylinderLow" m="hay" p={[0.34, 0.1, -0.3]} s={[0.17, 0.2, 0.17]} />
          <Part g="cylinderLow" m="hay" p={[0.36, 0.07, -0.1]} s={[0.12, 0.14, 0.12]} />
          <Part g="box" m="timber" p={[0.12, 0.07, -0.02]} s={[0.4, 0.02, 0.012]} shadow={false} />
          <Trough p={[-0.12, 0, 0.36]} />
        </>
      )}
      {FLOCK.slice(0, flock).map((p, i) => (
        <Sheep key={i} p={p} phase={i * 2.1} thin={thin} />
      ))}
    </group>
  );
}

/** Digue : talus de terre et de pierres le long de la berge */
export function Dike() {
  return (
    <group>
      <Part g="gable" m="soil" p={[0, 0, 0]} s={[0.98, 0.22, 0.98]} />
      {[-0.32, -0.1, 0.12, 0.34].map((x, i) => (
        <Part key={x} g="rock" m={i % 2 ? 'stone' : 'stoneDark'} p={[x, 0.16, (i % 2) * 0.08 - 0.04]} s={[0.16, 0.1, 0.14]} />
      ))}
      <Part g="box" m="hedge" p={[0, 0.215, 0]} s={[0.9, 0.02, 0.12]} shadow={false} />
    </group>
  );
}

/** Palissade : rangée de pieux taillés en pointe */
export function Palisade() {
  return (
    <group>
      {Array.from({ length: 7 }, (_, i) => -0.42 + i * 0.14).flatMap((x) =>
        [-0.36, 0.36].map((z) => (
          <group key={`${x}${z}`} position={[x, 0, z]}>
            <Part g="cylinderLow" m="woodRaw" p={[0, 0.17, 0]} s={[0.07, 0.34, 0.07]} />
            <Part g="cone6" m="woodRaw" p={[0, 0.38, 0]} s={[0.07, 0.08, 0.07]} shadow={false} />
          </group>
        )),
      )}
      {[-0.36, 0.36].map((z) => (
        <Part key={z} g="box" m="timber" p={[0, 0.24, z + (z > 0 ? -0.04 : 0.04)]} s={[0.92, 0.03, 0.02]} shadow={false} />
      ))}
    </group>
  );
}

/** Torches : quatre flambeaux sur pieux autour d'un petit brasero */
export function Torches() {
  return (
    <group>
      {[
        [-0.3, -0.3],
        [0.3, -0.3],
        [-0.3, 0.3],
        [0.3, 0.3],
      ].map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0, z]} scale={2}>
          <Torch p={[0, 0, 0]} />
        </group>
      ))}
      <Part g="cylinder" m="stoneDark" p={[0, 0.06, 0]} s={[0.2, 0.12, 0.2]} />
      <Part g="cone6" m="window" p={[0, 0.17, 0]} s={[0.12, 0.14, 0.12]} shadow={false} />
    </group>
  );
}

/** Cimetière : muret, croix et stèles (une par défunt, jusqu'à 9) */
export function Cemetery() {
  const deaths = useGame((s) => Math.min(9, s.game.mech.deaths));
  return (
    <group>
      <Fence w={0.92} d={0.92} m="stoneDark" gap="none" />
      {Array.from({ length: Math.max(1, deaths) }, (_, i) => {
        const x = -0.28 + (i % 3) * 0.28;
        const z = -0.28 + Math.floor(i / 3) * 0.28;
        return i % 2 ? (
          <group key={i} position={[x, 0, z]}>
            <Part g="box" m="stone" p={[0, 0.08, 0]} s={[0.025, 0.16, 0.025]} />
            <Part g="box" m="stone" p={[0, 0.12, 0]} s={[0.1, 0.025, 0.025]} />
          </group>
        ) : (
          <Part key={i} g="box" m="stoneLight" p={[x, 0.07, z]} s={[0.12, 0.14, 0.04]} />
        );
      })}
    </group>
  );
}
