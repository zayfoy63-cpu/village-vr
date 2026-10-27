import type { BuildingTypeId } from '../../game/types';
import { rnd } from '../handmade';
import { Part } from './Part';

// Petits signes de vie autour des bâtiments : bûches, tonneaux, seau, linge qui sèche, outils,
// caisses. Ce sont des <Part> (mêmes formes et matériaux que les modèles) : ils rejoignent les
// regroupements d'instances existants, sans appel de dessin de plus.

type Vec3 = [number, number, number];

function Woodpile({ p, yaw }: { p: Vec3; yaw: number }) {
  return (
    <group position={p} rotation={[0, yaw, 0]}>
      {[
        [-0.035, 0.022, 0],
        [0.035, 0.022, 0.004],
        [0, 0.058, -0.003],
      ].map((q, i) => (
        <Part key={i} g="cylinderLow" m={i === 2 ? 'woodLight' : 'wood'} p={q as Vec3} s={[0.042, 0.16, 0.042]} r={[Math.PI / 2, 0, 0]} shadow={false} />
      ))}
    </group>
  );
}

function Barrel({ p }: { p: Vec3 }) {
  return (
    <group position={p}>
      <Part g="cylinder" m="plank" p={[0, 0.045, 0]} s={[0.07, 0.09, 0.07]} shadow={false} />
      <Part g="cylinder" m="ironDark" p={[0, 0.07, 0]} s={[0.074, 0.008, 0.074]} shadow={false} />
    </group>
  );
}

function Bucket({ p }: { p: Vec3 }) {
  return <Part g="cylinderLow" m="woodRaw" p={[p[0], 0.022, p[2]]} s={[0.045, 0.044, 0.045]} shadow={false} />;
}

function Laundry({ p, yaw, id }: { p: Vec3; yaw: number; id: number }) {
  const cloths = ['clothWhite', 'paintBlue', 'cloth', 'whitewash'] as const;
  return (
    <group position={p} rotation={[0, yaw, 0]}>
      <Part g="box" m="timber" p={[-0.14, 0.09, 0]} s={[0.014, 0.18, 0.014]} r={[0, 0, 0.06]} shadow={false} />
      <Part g="box" m="timber" p={[0.14, 0.09, 0]} s={[0.014, 0.18, 0.014]} r={[0, 0, -0.05]} shadow={false} />
      <Part g="box" m="timber" p={[0, 0.172, 0]} s={[0.29, 0.005, 0.005]} r={[0, 0, 0.02]} shadow={false} />
      {[-0.08, 0, 0.08].map((x, i) => (
        <Part key={i} g="box" m={cloths[Math.floor(rnd(id, i, 131) * cloths.length)]} p={[x, 0.14 - i * 0.004, 0]} s={[0.055, 0.06 + rnd(id, i, 132) * 0.025, 0.005]} shadow={false} />
      ))}
    </group>
  );
}

function Tools({ p, yaw }: { p: Vec3; yaw: number }) {
  return (
    <group position={p} rotation={[0, yaw, 0]}>
      {/* Pelle et fourche appuyées l'une contre l'autre */}
      <Part g="box" m="wood" p={[-0.02, 0.07, 0]} s={[0.01, 0.15, 0.01]} r={[0, 0, 0.28]} shadow={false} />
      <Part g="box" m="ironDark" p={[0.005, 0.01, 0]} s={[0.035, 0.035, 0.006]} r={[0, 0, 0.28]} shadow={false} />
      <Part g="box" m="wood" p={[0.03, 0.07, 0]} s={[0.01, 0.15, 0.01]} r={[0, 0, -0.22]} shadow={false} />
    </group>
  );
}

function Crates({ p, yaw }: { p: Vec3; yaw: number }) {
  return (
    <group position={p} rotation={[0, yaw, 0]}>
      <Part g="box" m="plank" p={[0, 0.03, 0]} s={[0.07, 0.06, 0.07]} shadow={false} />
      <Part g="box" m="woodLight" p={[0.07, 0.025, 0.01]} s={[0.055, 0.05, 0.055]} r={[0, 0.4, 0]} shadow={false} />
      <Part g="box" m="woodLight" p={[0.01, 0.083, 0]} s={[0.05, 0.045, 0.05]} r={[0, -0.3, 0]} shadow={false} />
    </group>
  );
}

const KINDS = { woodpile: Woodpile, barrel: Barrel, bucket: Bucket, laundry: Laundry, tools: Tools, crates: Crates };
type Kind = keyof typeof KINDS;

/** Ce qu'on trouve autour de chaque type de bâtiment (le hasard en choisit un ou deux) */
const BY_TYPE: Partial<Record<BuildingTypeId, Kind[]>> = {
  hut: ['woodpile', 'bucket', 'tools'],
  house: ['laundry', 'woodpile', 'bucket', 'barrel'],
  townhouse: ['laundry', 'barrel', 'crates'],
  manor: ['laundry', 'barrel', 'woodpile'],
  lumber: ['woodpile', 'tools'],
  sawmill: ['woodpile', 'crates'],
  quarry: ['tools', 'crates'],
  mine: ['tools', 'crates', 'barrel'],
  forge: ['barrel', 'tools', 'woodpile'],
  bakery: ['woodpile', 'barrel', 'crates'],
  granary: ['crates', 'barrel'],
  market: ['crates', 'barrel'],
  mill: ['crates', 'barrel'],
  herbalist: ['bucket', 'laundry'],
  sheepfold: ['bucket', 'tools'],
  well: ['bucket'],
};

/** Coins du terrain d'un bâtiment, à l'écart de l'entrée (devant = +z) */
const CORNERS: [number, number][] = [
  [-0.38, -0.36],
  [0.38, -0.36],
  [-0.4, 0.3],
  [0.4, 0.3],
];

export function LifeProps({ id, type, size }: { id: number; type: BuildingTypeId; size: number }) {
  const kinds = BY_TYPE[type];
  if (!kinds) return null;
  const n = 1 + (rnd(id, 1, 133) > 0.45 ? 1 : 0);
  const first = Math.floor(rnd(id, 2, 134) * 4);
  return (
    <group>
      {Array.from({ length: n }, (_, i) => {
        const kind = kinds[Math.floor(rnd(id, 3 + i, 135) * kinds.length + i) % kinds.length];
        const C = KINDS[kind];
        const [cx, cz] = CORNERS[(first + i * 2) % 4];
        const p: Vec3 = [cx * size + (rnd(id, i, 136) - 0.5) * 0.05, 0, cz * size + (rnd(id, i, 137) - 0.5) * 0.05];
        const yaw = (rnd(id, i, 138) - 0.5) * 1.6 + (Math.abs(cx) > Math.abs(cz) ? Math.PI / 2 : 0);
        return <C key={i} p={p} yaw={yaw} id={id} />;
      })}
    </group>
  );
}
