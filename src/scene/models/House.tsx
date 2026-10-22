import { Part } from './Part';

/** Rotation variable selon l'id pour casser la répétition (partagée avec la fumée) */
export function houseRotation(id: number): number {
  return ((id * 7) % 4) * (Math.PI / 2);
}

/** Position locale du haut de la cheminée (avant rotation) */
export const HOUSE_CHIMNEY: [number, number, number] = [0.2, 0.98, -0.12];

export function House({ id }: { id: number }) {
  const roof = id % 3 === 0 ? 'roofBrown' : 'roofRed';
  const W = 0.66;
  const D = 0.56;
  const H = 0.48;
  const beam = 0.045;
  return (
    <group rotation={[0, houseRotation(id), 0]}>
      {/* Murs blancs */}
      <Part g="box" m="wall" p={[0, H / 2, 0]} s={[W, H, D]} />
      {/* Colombages : poteaux d'angle */}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <Part key={`${sx}${sz}`} g="box" m="timber" p={[(sx * W) / 2, H / 2, (sz * D) / 2]} s={[beam, H, beam]} shadow={false} />
        )),
      )}
      {/* Poutres horizontales */}
      <Part g="box" m="timber" p={[0, H * 0.55, D / 2 + 0.005]} s={[W, beam, 0.02]} shadow={false} />
      <Part g="box" m="timber" p={[0, H * 0.55, -D / 2 - 0.005]} s={[W, beam, 0.02]} shadow={false} />
      <Part g="box" m="timber" p={[W / 2 + 0.005, H * 0.55, 0]} s={[0.02, beam, D]} shadow={false} />
      <Part g="box" m="timber" p={[-W / 2 - 0.005, H * 0.55, 0]} s={[0.02, beam, D]} shadow={false} />
      <Part g="box" m="timber" p={[0, H - 0.01, D / 2 + 0.005]} s={[W, beam, 0.02]} shadow={false} />
      {/* Croix de Saint-André à l'étage */}
      <Part g="box" m="timber" p={[-0.17, H * 0.78, D / 2 + 0.008]} s={[0.03, 0.26, 0.02]} r={[0, 0, 0.6]} shadow={false} />
      <Part g="box" m="timber" p={[0.17, H * 0.78, D / 2 + 0.008]} s={[0.03, 0.26, 0.02]} r={[0, 0, -0.6]} shadow={false} />
      {/* Porte et fenêtres lumineuses */}
      <Part g="box" m="door" p={[0, 0.11, D / 2 + 0.01]} s={[0.13, 0.22, 0.02]} shadow={false} />
      <Part g="box" m="window" p={[-0.2, 0.17, D / 2 + 0.01]} s={[0.1, 0.09, 0.02]} shadow={false} />
      <Part g="box" m="window" p={[0.2, 0.17, D / 2 + 0.01]} s={[0.1, 0.09, 0.02]} shadow={false} />
      <Part g="box" m="window" p={[W / 2 + 0.01, 0.36, 0]} s={[0.02, 0.09, 0.1]} shadow={false} />
      <Part g="box" m="window" p={[-W / 2 - 0.01, 0.36, 0]} s={[0.02, 0.09, 0.1]} shadow={false} />
      {/* Toit en pyramide */}
      <Part g="pyramid" m={roof} p={[0, H + 0.22, 0]} s={[W + 0.16, 0.44, D + 0.16]} />
      {/* Cheminée */}
      <Part g="box" m="stoneDark" p={[HOUSE_CHIMNEY[0], 0.8, HOUSE_CHIMNEY[2]]} s={[0.09, 0.34, 0.09]} />
    </group>
  );
}
