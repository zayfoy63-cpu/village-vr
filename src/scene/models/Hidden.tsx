// Bâtiments liés aux mécaniques cachées : puits, herboriste, bergerie, digue, palissade, torches,
// et le cimetière qui apparaît de lui-même.

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
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

/** Un mouton qui broute (petite oscillation) */
function Sheep({ p, phase }: { p: [number, number, number]; phase: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime * 0.6 + phase;
    ref.current.position.x = p[0] + Math.sin(t) * 0.06;
    ref.current.rotation.y = Math.cos(t) * 0.8 + phase;
  });
  return (
    <group ref={ref} position={p}>
      <Part g="ball" m="clothWhite" p={[0, 0.08, 0]} s={[0.14, 0.1, 0.1]} />
      <Part g="ball" m="ironDark" p={[0.08, 0.09, 0]} s={0.05} shadow={false} />
    </group>
  );
}

/** Bergerie : abri en bois, enclos et quelques moutons (moins nombreux si elle a été attaquée) */
export function Sheepfold({ id }: { id: number }) {
  const damaged = useGame((s) => !!s.game.buildings.find((b) => b.id === id)?.damaged);
  const flock = damaged ? 1 : 3;
  return (
    <group>
      <Fence w={0.9} d={0.86} m="woodRaw" />
      <Part g="box" m="woodRaw" p={[-0.18, 0.16, -0.22]} s={[0.4, 0.32, 0.3]} />
      <Part g="gable" m="thatch" p={[-0.18, 0.32, -0.22]} s={[0.46, 0.2, 0.38]} r={[0, Math.PI / 2, 0]} />
      {[
        [0.15, 0, 0.1],
        [-0.1, 0, 0.22],
        [0.25, 0, -0.2],
      ]
        .slice(0, flock)
        .map((p, i) => (
          <Sheep key={i} p={p as [number, number, number]} phase={i * 2.1} />
        ))}
      <Part g="ball" m="hay" p={[0.3, 0.06, 0.28]} s={[0.12, 0.1, 0.12]} />
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
