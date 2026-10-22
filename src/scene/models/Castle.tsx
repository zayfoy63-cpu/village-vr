import { Part } from './Part';

/** Cheminée du château (coordonnées locales) */
export const CASTLE_CHIMNEY: [number, number, number] = [0.28, 1.62, -0.28];

/** Château 2x2 : donjon, enceinte et quatre tours rondes à toits bleus */
export function Castle() {
  const half = 0.82;
  const wallH = 0.5;
  const t = 0.14;
  const merlons = [-0.6, -0.3, 0, 0.3, 0.6];
  return (
    <group>
      {/* Cour pavée */}
      <Part g="box" m="stoneDark" p={[0, 0.01, 0]} s={[half * 2, 0.02, half * 2]} />
      {/* Enceinte */}
      <Part g="box" m="stone" p={[0, wallH / 2, half]} s={[half * 2, wallH, t]} />
      <Part g="box" m="stone" p={[0, wallH / 2, -half]} s={[half * 2, wallH, t]} />
      <Part g="box" m="stone" p={[half, wallH / 2, 0]} s={[t, wallH, half * 2]} />
      <Part g="box" m="stone" p={[-half, wallH / 2, 0]} s={[t, wallH, half * 2]} />
      {merlons.map((m) => (
        <group key={m}>
          <Part g="box" m="stone" p={[m, wallH + 0.05, half]} s={[0.12, 0.1, t]} shadow={false} />
          <Part g="box" m="stone" p={[m, wallH + 0.05, -half]} s={[0.12, 0.1, t]} shadow={false} />
          <Part g="box" m="stone" p={[half, wallH + 0.05, m]} s={[t, 0.1, 0.12]} shadow={false} />
          <Part g="box" m="stone" p={[-half, wallH + 0.05, m]} s={[t, 0.1, 0.12]} shadow={false} />
        </group>
      ))}
      {/* Porte */}
      <Part g="box" m="door" p={[0, 0.17, half + 0.075]} s={[0.26, 0.34, 0.02]} shadow={false} />
      {/* Donjon */}
      <Part g="box" m="stone" p={[0, 0.6, -0.05]} s={[0.8, 1.2, 0.75]} />
      <Part g="pyramid" m="roofBlue" p={[0, 1.45, -0.05]} s={[0.92, 0.5, 0.87]} />
      <Part g="box" m="window" p={[-0.18, 0.85, 0.33]} s={[0.08, 0.14, 0.02]} shadow={false} />
      <Part g="box" m="window" p={[0.18, 0.85, 0.33]} s={[0.08, 0.14, 0.02]} shadow={false} />
      <Part g="box" m="window" p={[0, 0.55, 0.33]} s={[0.1, 0.14, 0.02]} shadow={false} />
      <Part g="box" m="window" p={[0.41, 0.8, -0.05]} s={[0.02, 0.14, 0.08]} shadow={false} />
      <Part g="box" m="window" p={[-0.41, 0.8, -0.05]} s={[0.02, 0.14, 0.08]} shadow={false} />
      <Part g="box" m="stoneDark" p={[CASTLE_CHIMNEY[0], 1.45, CASTLE_CHIMNEY[2]]} s={[0.1, 0.36, 0.1]} />
      {/* Mât et drapeau */}
      <Part g="cylinderLow" m="timber" p={[0, 1.85, -0.05]} s={[0.025, 0.4, 0.025]} shadow={false} />
      <Part g="box" m="flag" p={[0.1, 1.98, -0.05]} s={[0.2, 0.12, 0.01]} shadow={false} />
      {/* Tours rondes */}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <group key={`${sx}${sz}`} position={[sx * half, 0, sz * half]}>
            <Part g="cylinder" m="stone" p={[0, 0.45, 0]} s={[0.44, 0.9, 0.44]} />
            <Part g="cylinder" m="stoneDark" p={[0, 0.93, 0]} s={[0.5, 0.06, 0.5]} shadow={false} />
            <Part g="cone" m="roofBlue" p={[0, 1.18, 0]} s={[0.56, 0.46, 0.56]} />
            <Part g="box" m="window" p={[0, 0.62, 0.22]} s={[0.05, 0.1, 0.02]} shadow={false} />
          </group>
        )),
      )}
    </group>
  );
}
