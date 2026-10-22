import { Part } from './Part';

/** Marché : étal à auvent rayé, comptoir, caisses et tonneaux */
export function Market() {
  const stripes = [-0.3, -0.15, 0, 0.15, 0.3];
  return (
    <group>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <Part key={`${sx}${sz}`} g="box" m="timber" p={[sx * 0.33, 0.24, sz * 0.22]} s={[0.04, 0.48, 0.04]} />
        )),
      )}
      {stripes.map((x, i) => (
        <Part
          key={x}
          g="box"
          m={i % 2 ? 'clothWhite' : 'cloth'}
          p={[x, 0.53, 0]}
          s={[0.15, 0.03, 0.58]}
          r={[0.18, 0, 0]}
        />
      ))}
      <Part g="box" m="woodLight" p={[0, 0.14, 0.16]} s={[0.66, 0.2, 0.14]} />
      <Part g="box" m="hay" p={[-0.18, 0.27, 0.16]} s={[0.16, 0.05, 0.1]} shadow={false} />
      <Part g="box" m="cloth" p={[0.05, 0.27, 0.16]} s={[0.12, 0.05, 0.1]} shadow={false} />
      <Part g="box" m="flag" p={[0.22, 0.27, 0.16]} s={[0.1, 0.05, 0.1]} shadow={false} />
      <Part g="box" m="wood" p={[0.3, 0.07, 0.38]} s={[0.14, 0.14, 0.14]} />
      <Part g="box" m="wood" p={[-0.34, 0.07, -0.38]} s={[0.14, 0.14, 0.14]} />
      <Part g="cylinderLow" m="plank" p={[-0.33, 0.09, 0.38]} s={[0.13, 0.18, 0.13]} />
      <Part g="cylinderLow" m="plank" p={[0.36, 0.09, -0.36]} s={[0.13, 0.18, 0.13]} />
    </group>
  );
}
