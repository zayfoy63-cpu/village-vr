import { Part } from './Part';

/** Grenier sur pilotis (contre les rats), toit à deux pans. Plus grand et plus riche à chaque niveau. */
export function Granary({ level = 1 }: { level?: number }) {
  const s = [1, 1.12, 1.22][Math.min(2, level - 1)];
  return (
    <group scale={s}>
      {/* Pilotis coiffés de pierres plates (les rats ne grimpent pas) */}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <group key={`${sx}${sz}`} position={[sx * 0.24, 0, sz * 0.2]}>
            <Part g="cylinderLow" m="timber" p={[0, 0.07, 0]} s={[0.06, 0.14, 0.06]} />
            <Part g="cylinderLow" m="stone" p={[0, 0.15, 0]} s={[0.12, 0.03, 0.12]} />
          </group>
        )),
      )}
      <Part g="box" m="plank" p={[0, 0.19, 0]} s={[0.6, 0.04, 0.5]} />
      <Part g="box" m={level >= 2 ? 'woodLight' : 'wood'} p={[0, 0.36, 0]} s={[0.54, 0.3, 0.44]} />
      {/* Bardage vertical */}
      {[-0.18, 0, 0.18].map((x) => (
        <Part key={x} g="box" m="timber" p={[x, 0.36, 0.225]} s={[0.025, 0.3, 0.01]} shadow={false} />
      ))}
      <Part g="box" m="door" p={[0.12, 0.33, 0.228]} s={[0.12, 0.2, 0.01]} shadow={false} />
      <Part g="gable" m={level >= 3 ? 'roofSlate' : 'thatch'} p={[0, 0.51, 0]} s={[0.66, 0.3, 0.56]} r={[0, Math.PI / 2, 0]} />
      {/* Sacs de grain */}
      <Part g="ball" m="hay" p={[-0.33, 0.06, 0.3]} s={[0.1, 0.12, 0.1]} />
      {level >= 2 && <Part g="ball" m="hay" p={[-0.22, 0.06, 0.33]} s={[0.1, 0.12, 0.1]} />}
      {level >= 3 && (
        <>
          <Part g="ball" m="hay" p={[0.33, 0.06, 0.3]} s={[0.1, 0.12, 0.1]} />
          <Part g="box" m="window" p={[-0.12, 0.42, 0.228]} s={[0.07, 0.06, 0.01]} shadow={false} />
        </>
      )}
    </group>
  );
}
