import { Part } from './Part';

type V3 = [number, number, number];

function LogPile({ p, n = 3 }: { p: V3; n?: number }) {
  const logs: V3[] = [
    [0, 0.05, -0.05],
    [0, 0.05, 0.05],
    [0, 0.14, 0],
    [0, 0.05, 0.15],
    [0, 0.14, 0.1],
  ];
  return (
    <group position={p}>
      {logs.slice(0, n).map((l, i) => (
        <Part key={i} g="cylinderLow" m="woodLight" p={l} s={[0.09, 0.32, 0.09]} r={[0, 0, Math.PI / 2]} />
      ))}
    </group>
  );
}

/** Cabane de bûcheron. Niv. 2 : cabane agrandie + 2e tas. Niv. 3 : appentis de scierie. */
export function Lumber({ level = 1 }: { level?: number }) {
  const s = level >= 2 ? 1.12 : 1;
  return (
    <group>
      <group scale={s} position={[-0.08, 0, -0.08]}>
        <Part g="box" m="wood" p={[0, 0.18, 0]} s={[0.5, 0.36, 0.42]} />
        <Part g="pyramid" m={level >= 3 ? 'roofRed' : 'roofBrown'} p={[0, 0.5, 0]} s={[0.62, 0.3, 0.54]} />
        <Part g="box" m="door" p={[0, 0.1, 0.215]} s={[0.12, 0.2, 0.02]} shadow={false} />
        <Part g="box" m="window" p={[0.255, 0.22, 0]} s={[0.02, 0.08, 0.08]} shadow={false} />
      </group>
      <LogPile p={[0.22, 0, 0.22]} n={level >= 2 ? 5 : 3} />
      <Part g="cylinderLow" m="wood" p={[-0.3, 0.06, 0.3]} s={[0.14, 0.12, 0.14]} />
      {level >= 2 && <LogPile p={[0.32, 0, -0.3]} n={3} />}
      {level >= 3 && (
        // Appentis de scierie : poteaux, toit et grume sur chevalets
        <group position={[-0.3, 0, 0.12]}>
          {[-1, 1].map((sz) => (
            <Part key={sz} g="box" m="timber" p={[0, 0.17, sz * 0.12]} s={[0.03, 0.34, 0.03]} />
          ))}
          <Part g="box" m="plank" p={[0.03, 0.36, 0]} s={[0.2, 0.03, 0.32]} r={[0, 0, -0.25]} />
          <Part g="cylinderLow" m="woodLight" p={[0.05, 0.1, 0]} s={[0.07, 0.3, 0.07]} r={[Math.PI / 2, 0, 0]} />
        </group>
      )}
    </group>
  );
}
