import { Part } from './Part';

/** Étal à auvent rayé */
function Stall({ cloth = 'cloth' as const }: { cloth?: 'cloth' | 'roofBlue' }) {
  const stripes = [-0.3, -0.15, 0, 0.15, 0.3];
  return (
    <group>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <Part key={`${sx}${sz}`} g="box" m="timber" p={[sx * 0.33, 0.24, sz * 0.22]} s={[0.04, 0.48, 0.04]} />
        )),
      )}
      {stripes.map((x, i) => (
        <Part key={x} g="box" m={i % 2 ? 'clothWhite' : cloth} p={[x, 0.53, 0]} s={[0.15, 0.03, 0.58]} r={[0.18, 0, 0]} />
      ))}
      <Part g="box" m="woodLight" p={[0, 0.14, 0.16]} s={[0.66, 0.2, 0.14]} />
      <Part g="box" m="hay" p={[-0.18, 0.27, 0.16]} s={[0.16, 0.05, 0.1]} shadow={false} />
      <Part g="box" m="cloth" p={[0.05, 0.27, 0.16]} s={[0.12, 0.05, 0.1]} shadow={false} />
      <Part g="box" m="flag" p={[0.22, 0.27, 0.16]} s={[0.1, 0.05, 0.1]} shadow={false} />
    </group>
  );
}

/** Marché. Niv. 2 : second étal bleu. Niv. 3 : puits et bannières dorées. */
export function Market({ level = 1 }: { level?: number }) {
  return (
    <group>
      <group position={level >= 2 ? [0, 0, 0.12] : [0, 0, 0]} scale={level >= 2 ? 0.85 : 1}>
        <Stall />
      </group>
      {level >= 2 && (
        <group position={[-0.12, 0, -0.28]} scale={0.6} rotation={[0, Math.PI, 0]}>
          <Stall cloth="roofBlue" />
        </group>
      )}
      <Part g="box" m="wood" p={[0.36, 0.07, 0.4]} s={[0.14, 0.14, 0.14]} />
      <Part g="cylinderLow" m="plank" p={[-0.36, 0.09, 0.4]} s={[0.13, 0.18, 0.13]} />
      {level < 2 && <Part g="box" m="wood" p={[-0.34, 0.07, -0.38]} s={[0.14, 0.14, 0.14]} />}
      {level >= 3 && (
        <>
          {/* Puits */}
          <group position={[0.3, 0, -0.3]}>
            <Part g="cylinder" m="stone" p={[0, 0.08, 0]} s={[0.22, 0.16, 0.22]} />
            <Part g="cylinder" m="water" p={[0, 0.161, 0]} s={[0.17, 0.005, 0.17]} shadow={false} />
            {[-1, 1].map((sx) => (
              <Part key={sx} g="box" m="timber" p={[sx * 0.09, 0.26, 0]} s={[0.025, 0.22, 0.025]} />
            ))}
            <Part g="pyramid" m="roofRed" p={[0, 0.42, 0]} s={[0.28, 0.12, 0.2]} />
          </group>
          {/* Bannières dorées */}
          {[-1, 1].map((sx) => (
            <group key={sx} position={[sx * 0.42, 0, 0.05]}>
              <Part g="cylinderLow" m="timber" p={[0, 0.35, 0]} s={[0.02, 0.7, 0.02]} />
              <Part g="box" m="gold" p={[0, 0.58, 0.04]} s={[0.01, 0.16, 0.08]} shadow={false} />
            </group>
          ))}
        </>
      )}
    </group>
  );
}
