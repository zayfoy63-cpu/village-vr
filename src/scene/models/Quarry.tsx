import { Banner, Chimney, Fence, Spinner, TileRoof, Wheel } from './Decor';
import { Part } from './Part';

type V3 = [number, number, number];

export const QUARRY_CHIMNEYS: Record<number, V3[]> = { 3: [[-0.16, 0.66, -0.34]] };

function Blocks({ p, n }: { p: V3; n: number }) {
  const spots: [V3, V3][] = [
    [[0, 0.05, 0], [0.13, 0.1, 0.13]],
    [[0.15, 0.05, 0], [0.13, 0.1, 0.13]],
    [[0.07, 0.15, 0], [0.13, 0.1, 0.13]],
    [[0, 0.05, 0.15], [0.13, 0.1, 0.13]],
    [[0.15, 0.05, 0.15], [0.13, 0.1, 0.13]],
  ];
  return (
    <group position={p}>
      {spots.slice(0, n).map(([q, s], i) => (
        <Part key={i} g="box" m="stoneLight" p={q} s={s} />
      ))}
    </group>
  );
}

function Tripod({ p }: { p: V3 }) {
  return (
    <group position={p}>
      {[0, 2.1, 4.2].map((a) => (
        <Part key={a} g="box" m="woodRaw" p={[Math.cos(a) * 0.07, 0.22, Math.sin(a) * 0.07]} s={[0.025, 0.46, 0.025]} r={[Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3]} />
      ))}
      <Part g="rock" m="stone" p={[0, 0.16, 0]} s={0.08} shadow={false} />
    </group>
  );
}

/**
 * Carrière.
 * Niv. 1 : petite fosse, roches brutes, trépied en bois brut.
 * Niv. 2 : fosse agrandie, blocs taillés, grue pivotante, clôture et abri à tuiles.
 * Niv. 3 : atelier de taille en pierre (cheminée), grande roue de levage animée, bannière, charrette.
 */
export function Quarry({ level = 1 }: { level?: number }) {
  const pit = level === 1 ? 0.6 : 0.88;
  return (
    <group>
      <Part g="box" m="stoneDark" p={[0, 0.012, 0]} s={[pit, 0.025, pit]} />
      <Part g="rock" m="stone" p={[-0.12, 0.08, -0.12]} s={0.2} />
      <Part g="rock" m="stoneDark" p={[0.14, 0.06, 0.1]} s={0.14} />
      {level === 1 && (
        <>
          <Tripod p={[0.12, 0, -0.14]} />
          <Part g="box" m="timber" p={[-0.2, 0.03, 0.2]} s={[0.2, 0.015, 0.02]} r={[0, 0.5, 0]} shadow={false} />
        </>
      )}
      {level === 2 && (
        <>
          <Fence w={0.9} d={0.9} m="woodLight" />
          <Blocks p={[0.12, 0, 0.12]} n={4} />
          {/* Grue pivotante */}
          <group position={[-0.22, 0, 0.18]}>
            <Part g="box" m="woodLight" p={[0, 0.3, 0]} s={[0.05, 0.6, 0.05]} />
            <Spinner p={[0, 0.58, 0]} axis="y" speed={0.4}>
              <Part g="box" m="woodLight" p={[0.15, 0, 0]} s={[0.36, 0.035, 0.035]} />
              <Part g="box" m="ironDark" p={[0.3, -0.12, 0]} s={[0.008, 0.24, 0.008]} shadow={false} />
              <Part g="box" m="stoneLight" p={[0.3, -0.25, 0]} s={[0.08, 0.06, 0.08]} />
            </Spinner>
          </group>
          {/* Abri à outils */}
          <group position={[0.26, 0, -0.26]}>
            <Part g="box" m="woodLight" p={[0, 0.12, 0]} s={[0.26, 0.24, 0.22]} />
            <TileRoof p={[0, 0.24, 0]} w={0.32} h={0.14} d={0.28} rotY={Math.PI / 2} />
          </group>
        </>
      )}
      {level >= 3 && (
        <>
          <Blocks p={[0.12, 0, 0.12]} n={5} />
          {/* Atelier de taille en pierre */}
          <group position={[-0.2, 0, -0.26]}>
            <Part g="box" m="stoneLight" p={[0, 0.16, 0]} s={[0.4, 0.32, 0.3]} />
            <Part g="box" m="door" p={[0, 0.1, 0.155]} s={[0.1, 0.2, 0.02]} shadow={false} />
            <Part g="box" m="window" p={[0.12, 0.2, 0.155]} s={[0.07, 0.07, 0.02]} shadow={false} />
            <TileRoof p={[0, 0.32, 0]} w={0.48} h={0.2} d={0.38} rotY={Math.PI / 2} />
          </group>
          <Chimney p={QUARRY_CHIMNEYS[3][0]} h={0.3} />
          {/* Grande roue de levage (cage à écureuil) */}
          <group position={[0.3, 0, -0.12]}>
            <Part g="box" m="woodLight" p={[0, 0.22, -0.08]} s={[0.04, 0.44, 0.04]} />
            <Part g="box" m="woodLight" p={[0, 0.22, 0.08]} s={[0.04, 0.44, 0.04]} />
            <Spinner p={[0, 0.24, 0]} axis="x" speed={1}>
              <Wheel r={0.2} spokes={8} />
            </Spinner>
            <Part g="box" m="woodLight" p={[-0.12, 0.5, 0]} s={[0.36, 0.04, 0.04]} r={[0, 0, 0.35]} />
          </group>
          {/* Charrette chargée */}
          <group position={[-0.24, 0, 0.28]}>
            <Part g="box" m="plank" p={[0, 0.09, 0]} s={[0.24, 0.05, 0.14]} />
            <Part g="box" m="stoneLight" p={[0, 0.15, 0]} s={[0.14, 0.07, 0.09]} />
            {[-1, 1].map((sz) => (
              <Part key={sz} g="cylinderLow" m="timber" p={[0, 0.06, sz * 0.08]} s={[0.12, 0.02, 0.12]} r={[Math.PI / 2, 0, 0]} />
            ))}
          </group>
          <Banner p={[0.4, 0, 0.38]} h={0.6} m="paintBlue" />
        </>
      )}
    </group>
  );
}
