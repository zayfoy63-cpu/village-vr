import { Part } from './Part';

/** Tour de garde : fût en pierre, plateforme crénelée, toit en bois et bannière */
export function Tower() {
  return (
    <group>
      <Part g="box" m="stone" p={[0, 0.6, 0]} s={[0.36, 1.2, 0.36]} />
      <Part g="box" m="stoneDark" p={[0, 1.22, 0]} s={[0.5, 0.08, 0.5]} />
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <Part key={`${sx}${sz}`} g="box" m="stone" p={[sx * 0.2, 1.32, sz * 0.2]} s={[0.1, 0.14, 0.1]} shadow={false} />
        )),
      )}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <Part key={`p${sx}${sz}`} g="box" m="timber" p={[sx * 0.2, 1.45, sz * 0.2]} s={[0.03, 0.2, 0.03]} shadow={false} />
        )),
      )}
      <Part g="pyramid" m="roofBrown" p={[0, 1.66, 0]} s={[0.6, 0.3, 0.6]} />
      <Part g="box" m="window" p={[0, 0.8, 0.185]} s={[0.05, 0.14, 0.02]} shadow={false} />
      <Part g="box" m="window" p={[0.185, 0.5, 0]} s={[0.02, 0.12, 0.05]} shadow={false} />
      <Part g="box" m="door" p={[0, 0.12, 0.185]} s={[0.12, 0.24, 0.02]} shadow={false} />
      <Part g="cylinderLow" m="timber" p={[0, 1.95, 0]} s={[0.02, 0.3, 0.02]} shadow={false} />
      <Part g="box" m="cloth" p={[0.08, 2.03, 0]} s={[0.15, 0.1, 0.01]} shadow={false} />
    </group>
  );
}
