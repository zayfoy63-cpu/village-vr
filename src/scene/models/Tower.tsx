import { Banner, Fence, TileRoof, Torch } from './Decor';
import { Part } from './Part';

/**
 * Tour de garde.
 * Niv. 1 : mirador en bois brut sur pilotis, échelle, petit toit de planches.
 * Niv. 2 : base en pierre, guérite en bois au toit de tuiles, palissade, torche.
 * Niv. 3 : grande tour de pierre crénelée, toit bleu, bannières au vent, torches.
 */
export function Tower({ level = 1 }: { level?: number }) {
  if (level <= 1) {
    return (
      <group>
        {[-1, 1].flatMap((sx) =>
          [-1, 1].map((sz) => <Part key={`${sx}${sz}`} g="box" m="woodRaw" p={[sx * 0.14, 0.42, sz * 0.14]} s={[0.04, 0.84, 0.04]} />),
        )}
        <Part g="box" m="woodRaw" p={[0, 0.3, 0]} s={[0.32, 0.03, 0.03]} r={[0, 0, 0.6]} shadow={false} />
        <Part g="box" m="plank" p={[0, 0.84, 0]} s={[0.4, 0.04, 0.4]} />
        {[-1, 1].map((s) => (
          <Part key={s} g="box" m="woodRaw" p={[s * 0.19, 0.92, 0]} s={[0.02, 0.12, 0.4]} shadow={false} />
        ))}
        <Part g="box" m="plank" p={[0, 1.12, 0]} s={[0.42, 0.03, 0.42]} r={[0.12, 0, 0]} />
        {/* Échelle */}
        <group position={[0, 0, 0.22]} rotation={[-0.15, 0, 0]}>
          {[-1, 1].map((s) => (
            <Part key={s} g="box" m="woodRaw" p={[s * 0.06, 0.42, 0]} s={[0.015, 0.84, 0.015]} shadow={false} />
          ))}
          {[0.15, 0.35, 0.55, 0.75].map((y) => (
            <Part key={y} g="box" m="woodRaw" p={[0, y, 0]} s={[0.12, 0.012, 0.012]} shadow={false} />
          ))}
        </group>
      </group>
    );
  }
  if (level === 2) {
    return (
      <group>
        <Fence w={0.86} d={0.86} m="woodRaw" />
        <Part g="box" m="stone" p={[0, 0.3, 0]} s={[0.38, 0.6, 0.38]} />
        <Part g="box" m="door" p={[0, 0.11, 0.195]} s={[0.1, 0.22, 0.02]} shadow={false} />
        <Part g="box" m="woodLight" p={[0, 0.78, 0]} s={[0.44, 0.36, 0.44]} />
        <Part g="box" m="window" p={[0, 0.8, 0.225]} s={[0.12, 0.08, 0.02]} shadow={false} />
        <Part g="box" m="window" p={[0.225, 0.8, 0]} s={[0.02, 0.08, 0.12]} shadow={false} />
        <TileRoof p={[0, 0.96, 0]} w={0.56} h={0.3} d={0.56} />
        <Torch p={[0.12, 0, 0.3]} />
        <Banner p={[0.22, 1.1, 0.22]} h={0.25} m="cloth" />
      </group>
    );
  }
  const H = 1.6;
  return (
    <group>
      <Part g="box" m="stoneDark" p={[0, 0.09, 0]} s={[0.6, 0.18, 0.6]} />
      <Part g="box" m="stone" p={[0, H / 2, 0]} s={[0.42, H, 0.42]} />
      <Part g="box" m="stoneDark" p={[0, H + 0.03, 0]} s={[0.62, 0.08, 0.62]} />
      {[-1, 1].flatMap((sx) =>
        [-1, 0, 1].map((sz) => (
          <group key={`${sx}${sz}`}>
            <Part g="box" m="stone" p={[sx * 0.26, H + 0.13, sz * 0.26]} s={[0.1, 0.13, 0.1]} shadow={false} />
            <Part g="box" m="stone" p={[sz * 0.26, H + 0.13, sx * 0.26]} s={[0.1, 0.13, 0.1]} shadow={false} />
          </group>
        )),
      )}
      <Part g="cylinder" m="stone" p={[0, H + 0.3, 0]} s={[0.3, 0.28, 0.3]} />
      <Part g="cone" m="roofBlue" p={[0, H + 0.62, 0]} s={[0.4, 0.4, 0.4]} />
      {[0.45, 0.85, 1.25].map((y) => (
        <Part key={y} g="box" m="window" p={[0, y, 0.215]} s={[0.05, 0.14, 0.02]} shadow={false} />
      ))}
      <Part g="box" m="door" p={[0, 0.14, 0.215]} s={[0.13, 0.26, 0.02]} shadow={false} />
      {[-1, 1].map((sx) => (
        <Part key={sx} g="box" m="cloth" p={[sx * 0.215, H - 0.3, 0]} s={[0.02, 0.4, 0.14]} shadow={false} />
      ))}
      <Banner p={[0, H + 0.8, 0]} h={0.35} m="paintYellow" />
      <Torch p={[0.18, 0, 0.32]} />
      <Torch p={[-0.18, 0, 0.32]} />
    </group>
  );
}
