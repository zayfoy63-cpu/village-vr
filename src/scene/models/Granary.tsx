import { Banner, Fence, Spinner, TileRoof } from './Decor';
import { Part } from './Part';

function Stilts({ m }: { m: 'woodRaw' | 'timber' }) {
  return (
    <>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <group key={`${sx}${sz}`} position={[sx * 0.2, 0, sz * 0.16]}>
            <Part g="cylinderLow" m={m} p={[0, 0.07, 0]} s={[0.05, 0.14, 0.05]} />
            <Part g="cylinderLow" m="stone" p={[0, 0.15, 0]} s={[0.1, 0.025, 0.1]} />
          </group>
        )),
      )}
    </>
  );
}

/**
 * Grenier (contre les rats).
 * Niv. 1 : petite grange en bois brut sur pilotis, toit de chaume.
 * Niv. 2 : grange chaulée plus grande, toit de tuiles, enclos, sacs de grain.
 * Niv. 3 : soubassement en pierre, grenier à étage, potence de levage avec poulie animée, bannière.
 */
export function Granary({ level = 1 }: { level?: number }) {
  if (level <= 1) {
    return (
      <group scale={0.85}>
        <Stilts m="woodRaw" />
        <Part g="box" m="plank" p={[0, 0.18, 0]} s={[0.5, 0.035, 0.42]} />
        <Part g="box" m="woodRaw" p={[0, 0.33, 0]} s={[0.44, 0.26, 0.36]} />
        <Part g="box" m="door" p={[0.1, 0.3, 0.185]} s={[0.1, 0.18, 0.01]} shadow={false} />
        <Part g="gable" m="thatch" p={[0, 0.46, 0]} s={[0.56, 0.28, 0.46]} r={[0, Math.PI / 2, 0]} />
        <Part g="ball" m="hay" p={[-0.3, 0.06, 0.28]} s={[0.1, 0.12, 0.1]} />
      </group>
    );
  }
  if (level === 2) {
    return (
      <group>
        <Fence w={0.9} d={0.86} m="woodLight" />
        <Stilts m="timber" />
        <Part g="box" m="plank" p={[0, 0.18, 0]} s={[0.58, 0.04, 0.48]} />
        <Part g="box" m="whitewash" p={[0, 0.36, 0]} s={[0.54, 0.32, 0.44]} />
        {[-0.2, 0, 0.2].map((x) => (
          <Part key={x} g="box" m="timber" p={[x, 0.36, 0.225]} s={[0.025, 0.32, 0.01]} shadow={false} />
        ))}
        <Part g="box" m="paintBlue" p={[0.12, 0.33, 0.228]} s={[0.12, 0.2, 0.01]} shadow={false} />
        <TileRoof p={[0, 0.52, 0]} w={0.56} h={0.3} d={0.66} rotY={Math.PI / 2} />
        {[-0.3, -0.18, 0.3].map((x) => (
          <Part key={x} g="ball" m="hay" p={[x, 0.06, 0.32]} s={[0.1, 0.12, 0.1]} />
        ))}
      </group>
    );
  }
  return (
    <group>
      {/* Soubassement en pierre + grenier à colombages */}
      <Part g="box" m="stoneLight" p={[0, 0.16, -0.04]} s={[0.62, 0.32, 0.5]} />
      <Part g="box" m="door" p={[-0.12, 0.12, 0.215]} s={[0.14, 0.24, 0.02]} shadow={false} />
      <Part g="box" m="whitewash" p={[0, 0.48, -0.04]} s={[0.66, 0.32, 0.54]} />
      {[-0.3, -0.1, 0.1, 0.3].map((x) => (
        <Part key={x} g="box" m="timber" p={[x, 0.48, 0.235]} s={[0.025, 0.32, 0.01]} shadow={false} />
      ))}
      <Part g="box" m="window" p={[0.2, 0.5, 0.24]} s={[0.08, 0.08, 0.01]} shadow={false} />
      <Part g="box" m="woodLight" p={[0, 0.5, 0.24]} s={[0.12, 0.16, 0.01]} shadow={false} />
      <TileRoof p={[0, 0.64, -0.04]} w={0.64} h={0.34} d={0.78} rotY={Math.PI / 2} />
      {/* Potence de levage : poulie animée et sac suspendu */}
      <Part g="box" m="timber" p={[0, 0.78, 0.36]} s={[0.04, 0.04, 0.3]} />
      <Spinner p={[0, 0.76, 0.48]} axis="x" speed={2}>
        <Part g="cylinder" m="ironDark" s={[0.08, 0.02, 0.08]} r={[0, 0, Math.PI / 2]} />
      </Spinner>
      <Part g="box" m="ironDark" p={[0, 0.6, 0.48]} s={[0.006, 0.3, 0.006]} shadow={false} />
      <Part g="ball" m="hay" p={[0, 0.42, 0.48]} s={[0.1, 0.12, 0.1]} />
      {[-0.32, -0.2, 0.3, 0.38].map((x, i) => (
        <Part key={x} g="ball" m="hay" p={[x, 0.06, 0.34 - (i % 2) * 0.06]} s={[0.1, 0.12, 0.1]} />
      ))}
      <Banner p={[0.38, 0, -0.34]} h={0.7} m="paintYellow" />
    </group>
  );
}
