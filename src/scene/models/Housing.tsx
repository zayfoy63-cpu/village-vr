// Habitations débloquées par la progression : Cabane, Maison bourgeoise, Manoir.
// (La Maison classique est dans House.tsx.) Toutes pivotent avec houseRotation().

import { houseRotation } from './House';
import { Part } from './Part';

type V3 = [number, number, number];

/** Hauts de cheminées (coordonnées locales, avant rotation) pour la fumée */
export const HUT_CHIMNEYS: V3[] = [[0.13, 0.64, -0.1]];
export const TOWNHOUSE_CHIMNEYS: V3[] = [
  [0.3, 1.08, -0.18],
  [-0.3, 1.08, 0.18],
];
export const MANOR_CHIMNEYS: V3[] = [
  [-0.32, 1.28, -0.2],
  [0.12, 1.28, -0.2],
  [-0.27, 1.0, 0.3],
];

/** Cabane : murs en planches, toit de chaume, une seule pièce */
export function Hut({ id }: { id: number }) {
  return (
    <group rotation={[0, houseRotation(id), 0]}>
      <Part g="box" m="wood" p={[0, 0.15, 0]} s={[0.46, 0.3, 0.42]} />
      {/* Rondins d'angle */}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <Part key={`${sx}${sz}`} g="cylinderLow" m="plank" p={[sx * 0.23, 0.15, sz * 0.21]} s={[0.05, 0.32, 0.05]} shadow={false} />
        )),
      )}
      <Part g="pyramid" m="thatch" p={[0, 0.47, 0]} s={[0.64, 0.36, 0.6]} />
      <Part g="box" m="door" p={[-0.08, 0.1, 0.215]} s={[0.12, 0.2, 0.02]} shadow={false} />
      <Part g="box" m="window" p={[0.12, 0.17, 0.215]} s={[0.08, 0.07, 0.02]} shadow={false} />
      <Part g="box" m="stoneDark" p={[HUT_CHIMNEYS[0][0], 0.52, HUT_CHIMNEYS[0][2]]} s={[0.07, 0.24, 0.07]} />
      {/* Petit tas de bois */}
      <Part g="cylinderLow" m="woodLight" p={[0.3, 0.04, 0.12]} s={[0.07, 0.2, 0.07]} r={[Math.PI / 2, 0, 0]} />
    </group>
  );
}

/** Maison bourgeoise : rez-de-chaussée en pierre, étage à colombages en encorbellement, toit d'ardoise */
export function Townhouse({ id }: { id: number }) {
  const W = 0.74;
  const D = 0.6;
  return (
    <group rotation={[0, houseRotation(id), 0]}>
      {/* Rez-de-chaussée en pierre */}
      <Part g="box" m="stone" p={[0, 0.18, 0]} s={[W, 0.36, D]} />
      <Part g="box" m="door" p={[0, 0.12, D / 2 + 0.01]} s={[0.14, 0.24, 0.02]} shadow={false} />
      <Part g="box" m="cloth" p={[0, 0.27, D / 2 + 0.05]} s={[0.22, 0.02, 0.1]} r={[0.35, 0, 0]} shadow={false} />
      <Part g="box" m="window" p={[-0.24, 0.18, D / 2 + 0.01]} s={[0.12, 0.1, 0.02]} shadow={false} />
      <Part g="box" m="window" p={[0.24, 0.18, D / 2 + 0.01]} s={[0.12, 0.1, 0.02]} shadow={false} />
      {/* Étage en encorbellement */}
      <Part g="box" m="plaster" p={[0, 0.54, 0]} s={[W + 0.06, 0.36, D + 0.06]} />
      <Part g="box" m="timber" p={[0, 0.37, D / 2 + 0.035]} s={[W + 0.08, 0.04, 0.02]} shadow={false} />
      <Part g="box" m="timber" p={[0, 0.71, D / 2 + 0.035]} s={[W + 0.08, 0.04, 0.02]} shadow={false} />
      {[-0.4, -0.13, 0.13, 0.4].map((x) => (
        <Part key={x} g="box" m="timber" p={[x, 0.54, D / 2 + 0.035]} s={[0.035, 0.36, 0.02]} shadow={false} />
      ))}
      {[-0.27, 0, 0.27].map((x) => (
        <Part key={x} g="box" m="window" p={[x, 0.56, D / 2 + 0.04]} s={[0.1, 0.12, 0.02]} shadow={false} />
      ))}
      <Part g="box" m="window" p={[W / 2 + 0.04, 0.56, 0]} s={[0.02, 0.12, 0.1]} shadow={false} />
      <Part g="box" m="window" p={[-W / 2 - 0.04, 0.56, 0]} s={[0.02, 0.12, 0.1]} shadow={false} />
      {/* Jardinière fleurie */}
      <Part g="box" m="hedge" p={[0, 0.42, D / 2 + 0.07]} s={[0.4, 0.04, 0.05]} shadow={false} />
      {/* Toit à deux pans en ardoise */}
      <Part g="gable" m="roofSlate" p={[0, 0.72, 0]} s={[W + 0.18, 0.42, D + 0.18]} />
      {TOWNHOUSE_CHIMNEYS.map(([x, y, z]) => (
        <Part key={x} g="box" m="stoneDark" p={[x, y - 0.17, z]} s={[0.09, 0.34, 0.09]} />
      ))}
    </group>
  );
}

/** Manoir : corps principal à étage, aile en retour, tourelle, jardin à haies */
export function Manor({ id }: { id: number }) {
  return (
    <group rotation={[0, houseRotation(id), 0]}>
      {/* Allée et haies */}
      <Part g="box" m="stoneDark" p={[0.08, 0.01, 0.36]} s={[0.16, 0.02, 0.22]} shadow={false} />
      <Part g="box" m="hedge" p={[0.32, 0.05, 0.42]} s={[0.26, 0.1, 0.07]} />
      <Part g="box" m="hedge" p={[-0.12, 0.05, 0.44]} s={[0.12, 0.1, 0.07]} />
      {/* Corps principal (rez-de-chaussée pierre + étage enduit) */}
      <Part g="box" m="stone" p={[0, 0.2, -0.12]} s={[0.88, 0.4, 0.5]} />
      <Part g="box" m="plaster" p={[0, 0.58, -0.12]} s={[0.88, 0.36, 0.5]} />
      <Part g="box" m="timber" p={[0, 0.41, 0.135]} s={[0.9, 0.04, 0.02]} shadow={false} />
      {[-0.34, -0.12, 0.1, 0.3].map((x) => (
        <group key={x}>
          <Part g="box" m="window" p={[x, 0.22, 0.135]} s={[0.09, 0.13, 0.02]} shadow={false} />
          <Part g="box" m="window" p={[x, 0.6, 0.135]} s={[0.09, 0.13, 0.02]} shadow={false} />
        </group>
      ))}
      <Part g="box" m="door" p={[0.08, 0.14, 0.14]} s={[0.14, 0.26, 0.02]} shadow={false} />
      <Part g="box" m="stone" p={[0.08, 0.02, 0.2]} s={[0.22, 0.04, 0.1]} shadow={false} />
      {/* Toit à deux pans bordeaux (faîtage selon x) */}
      <Part g="gable" m="roofBurgundy" p={[0, 0.76, -0.12]} s={[0.62, 0.46, 1.0]} r={[0, Math.PI / 2, 0]} />
      {/* Aile en retour */}
      <Part g="box" m="stone" p={[-0.27, 0.2, 0.24]} s={[0.34, 0.4, 0.3]} />
      <Part g="box" m="plaster" p={[-0.27, 0.5, 0.24]} s={[0.34, 0.2, 0.3]} />
      <Part g="box" m="window" p={[-0.27, 0.5, 0.395]} s={[0.1, 0.1, 0.02]} shadow={false} />
      <Part g="box" m="window" p={[-0.27, 0.22, 0.395]} s={[0.1, 0.12, 0.02]} shadow={false} />
      <Part g="gable" m="roofBurgundy" p={[-0.27, 0.6, 0.24]} s={[0.42, 0.3, 0.38]} />
      {/* Tourelle d'angle */}
      <Part g="cylinder" m="stone" p={[0.42, 0.45, 0.12]} s={[0.2, 0.9, 0.2]} />
      <Part g="cone" m="roofBurgundy" p={[0.42, 1.06, 0.12]} s={[0.26, 0.34, 0.26]} />
      <Part g="box" m="window" p={[0.42, 0.66, 0.22]} s={[0.04, 0.09, 0.02]} shadow={false} />
      <Part g="cylinderLow" m="timber" p={[0.42, 1.3, 0.12]} s={[0.015, 0.18, 0.015]} shadow={false} />
      <Part g="box" m="flag" p={[0.47, 1.35, 0.12]} s={[0.09, 0.06, 0.01]} shadow={false} />
      {/* Cheminées */}
      {MANOR_CHIMNEYS.map(([x, y, z]) => (
        <Part key={`${x}${z}`} g="box" m="stoneDark" p={[x, y - 0.18, z]} s={[0.09, 0.36, 0.09]} />
      ))}
    </group>
  );
}
