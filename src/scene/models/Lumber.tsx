import { Banner, Chimney, Fence, Spinner, TileRoof, Wheel } from './Decor';
import { Part } from './Part';

type V3 = [number, number, number];

/** Cheminées par niveau (pour la fumée) */
export const LUMBER_CHIMNEYS: Record<number, V3[]> = { 3: [[-0.28, 0.98, -0.22]] };

function LogPile({ p, n = 3, m = 'woodLight' as const }: { p: V3; n?: number; m?: 'woodLight' | 'woodRaw' }) {
  const logs: V3[] = [
    [0, 0.05, -0.05],
    [0, 0.05, 0.05],
    [0, 0.14, 0],
    [0, 0.05, 0.15],
    [0, 0.14, 0.1],
    [0, 0.23, 0.05],
  ];
  return (
    <group position={p}>
      {logs.slice(0, n).map((l, i) => (
        <Part key={i} g="cylinderLow" m={m} p={l} s={[0.09, 0.32, 0.09]} r={[0, 0, Math.PI / 2]} />
      ))}
    </group>
  );
}

function Axe({ p }: { p: V3 }) {
  return (
    <group position={p} rotation={[0, 0, 0.5]}>
      <Part g="box" m="timber" p={[0, 0.09, 0]} s={[0.015, 0.18, 0.015]} shadow={false} />
      <Part g="box" m="ironDark" p={[0.025, 0.17, 0]} s={[0.05, 0.035, 0.01]} shadow={false} />
    </group>
  );
}

/**
 * Cabane de bûcheron.
 * Niv. 1 : appentis en bois brut, un tas de bûches.
 * Niv. 2 : cabane plus grande, toit de tuiles, porte rouge, enclos et abri à bois.
 * Niv. 3 : maison à étage sur soubassement de pierre, scierie à roue animée, cheminée, bannière.
 */
export function Lumber({ level = 1 }: { level?: number }) {
  if (level <= 1) {
    return (
      <group>
        <Part g="box" m="woodRaw" p={[-0.12, 0.13, -0.1]} s={[0.38, 0.26, 0.32]} />
        <Part g="box" m="plank" p={[-0.12, 0.3, -0.1]} s={[0.46, 0.03, 0.42]} r={[0.25, 0, 0]} />
        <Part g="box" m="door" p={[-0.12, 0.09, 0.065]} s={[0.1, 0.18, 0.02]} shadow={false} />
        <LogPile p={[0.22, 0, 0.2]} n={3} m="woodRaw" />
        <Part g="cylinderLow" m="woodRaw" p={[-0.3, 0.05, 0.28]} s={[0.13, 0.1, 0.13]} />
        <Axe p={[-0.3, 0.1, 0.28]} />
      </group>
    );
  }
  if (level === 2) {
    return (
      <group>
        <Fence w={0.5} d={0.34} p={[0.18, 0, 0.26]} />
        <Part g="box" m="woodLight" p={[-0.12, 0.18, -0.12]} s={[0.52, 0.36, 0.42]} />
        <TileRoof p={[-0.12, 0.36, -0.12]} w={0.62} h={0.28} d={0.52} />
        <Part g="box" m="cloth" p={[-0.12, 0.1, 0.095]} s={[0.12, 0.2, 0.02]} shadow={false} />
        <Part g="box" m="window" p={[0.145, 0.22, -0.12]} s={[0.02, 0.08, 0.08]} shadow={false} />
        <LogPile p={[0.18, 0, 0.22]} n={5} />
        {/* Abri à bois */}
        <group position={[0.32, 0, -0.26]}>
          {[-1, 1].map((sz) => (
            <Part key={sz} g="box" m="timber" p={[0, 0.13, sz * 0.12]} s={[0.03, 0.26, 0.03]} />
          ))}
          <Part g="box" m="roofTile" p={[0, 0.27, 0]} s={[0.2, 0.025, 0.32]} r={[0, 0, -0.2]} />
          <LogPile p={[0, 0, -0.06]} n={3} />
        </group>
        <Axe p={[-0.36, 0.0, 0.3]} />
      </group>
    );
  }
  return (
    <group>
      {/* Maison à étage : pierre + bois */}
      <Part g="box" m="stone" p={[-0.12, 0.13, -0.14]} s={[0.56, 0.26, 0.44]} />
      <Part g="box" m="woodLight" p={[-0.12, 0.4, -0.14]} s={[0.6, 0.28, 0.48]} />
      {[-0.36, -0.12, 0.12].map((x) => (
        <Part key={x} g="box" m="timber" p={[x, 0.4, 0.105]} s={[0.03, 0.28, 0.02]} shadow={false} />
      ))}
      <Part g="box" m="window" p={[-0.24, 0.42, 0.105]} s={[0.08, 0.08, 0.02]} shadow={false} />
      <Part g="box" m="window" p={[0, 0.42, 0.105]} s={[0.08, 0.08, 0.02]} shadow={false} />
      <Part g="box" m="cloth" p={[-0.12, 0.1, 0.085]} s={[0.12, 0.2, 0.02]} shadow={false} />
      <TileRoof p={[-0.12, 0.54, -0.14]} w={0.7} h={0.3} d={0.58} />
      <Chimney p={LUMBER_CHIMNEYS[3][0]} h={0.34} />
      {/* Scierie : bassin, roue à aubes animée et lame de scie */}
      <group position={[0.3, 0, 0.14]}>
        <Part g="box" m="water" p={[0, 0.02, 0]} s={[0.12, 0.04, 0.4]} shadow={false} />
        <Spinner p={[0, 0.2, 0]} axis="x" speed={1.2}>
          <Wheel r={0.17} />
        </Spinner>
        <Part g="box" m="woodLight" p={[-0.12, 0.1, 0.02]} s={[0.12, 0.2, 0.34]} />
        <Spinner p={[-0.12, 0.24, 0.02]} axis="x" speed={6}>
          <Part g="cylinder" m="stoneLight" s={[0.16, 0.012, 0.16]} r={[0, 0, Math.PI / 2]} />
        </Spinner>
      </group>
      <LogPile p={[0.22, 0, -0.32]} n={6} />
      <Banner p={[-0.42, 0, 0.3]} h={0.55} m="paintGreen" />
    </group>
  );
}
