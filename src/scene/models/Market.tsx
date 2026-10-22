import { Banner, Spinner, TileRoof, Torch } from './Decor';
import { Part } from './Part';
import type { MAT } from '../shared';

type MatKey = keyof typeof MAT;

/** Étal : auvent rayé (ou toile unie), comptoir garni */
function Stall({ a = 'cloth', b = 'clothWhite', plain = false }: { a?: MatKey; b?: MatKey; plain?: boolean }) {
  const stripes = [-0.3, -0.15, 0, 0.15, 0.3];
  return (
    <group>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <Part key={`${sx}${sz}`} g="box" m={plain ? 'woodRaw' : 'timber'} p={[sx * 0.33, 0.24, sz * 0.22]} s={[0.04, 0.48, 0.04]} />
        )),
      )}
      {plain ? (
        <Part g="box" m="hay" p={[0, 0.5, 0]} s={[0.76, 0.025, 0.54]} r={[0.1, 0, 0]} />
      ) : (
        stripes.map((x, i) => <Part key={x} g="box" m={i % 2 ? b : a} p={[x, 0.53, 0]} s={[0.15, 0.03, 0.58]} r={[0.18, 0, 0]} />)
      )}
      <Part g="box" m={plain ? 'woodRaw' : 'woodLight'} p={[0, 0.14, 0.16]} s={[0.66, 0.2, 0.14]} />
      <Part g="box" m="hay" p={[-0.18, 0.27, 0.16]} s={[0.16, 0.05, 0.1]} shadow={false} />
      {!plain && <Part g="box" m="cloth" p={[0.05, 0.27, 0.16]} s={[0.12, 0.05, 0.1]} shadow={false} />}
      {!plain && <Part g="box" m="paintYellow" p={[0.22, 0.27, 0.16]} s={[0.1, 0.05, 0.1]} shadow={false} />}
    </group>
  );
}

/** Guirlande de fanions entre deux points */
function Bunting({ from, to, y }: { from: [number, number]; to: [number, number]; y: number }) {
  const n = 6;
  const cols: MatKey[] = ['cloth', 'paintYellow', 'paintBlue', 'paintGreen'];
  return (
    <group>
      {Array.from({ length: n }, (_, i) => {
        const k = (i + 0.5) / n;
        const sag = Math.sin(k * Math.PI) * 0.06;
        return (
          <Part
            key={i}
            g="cone6"
            m={cols[i % cols.length]}
            p={[from[0] + (to[0] - from[0]) * k, y - sag, from[1] + (to[1] - from[1]) * k]}
            s={[0.05, 0.07, 0.02]}
            r={[Math.PI, 0, 0]}
            shadow={false}
          />
        );
      })}
    </group>
  );
}

/**
 * Marché.
 * Niv. 1 : un étal simple en bois brut, toile unie.
 * Niv. 2 : deux étals aux auvents rayés vifs, guirlande de fanions, tonneaux.
 * Niv. 3 : halle en pierre au toit de tuiles, fontaine animée, bannières dorées, torches.
 */
export function Market({ level = 1 }: { level?: number }) {
  if (level <= 1) {
    return (
      <group scale={0.85}>
        <Stall plain />
        <Part g="box" m="woodRaw" p={[0.36, 0.07, 0.4]} s={[0.14, 0.14, 0.14]} />
      </group>
    );
  }
  if (level === 2) {
    return (
      <group>
        <group position={[-0.05, 0, 0.16]} scale={0.8}>
          <Stall />
        </group>
        <group position={[0.08, 0, -0.26]} scale={0.66} rotation={[0, Math.PI, 0]}>
          <Stall a="paintBlue" b="paintYellow" />
        </group>
        <Part g="box" m="timber" p={[-0.42, 0.3, 0]} s={[0.025, 0.6, 0.025]} />
        <Part g="box" m="timber" p={[0.42, 0.3, 0]} s={[0.025, 0.6, 0.025]} />
        <Bunting from={[-0.42, 0]} to={[0.42, 0]} y={0.58} />
        <Part g="cylinderLow" m="plank" p={[0.38, 0.09, 0.38]} s={[0.13, 0.18, 0.13]} />
        <Part g="cylinderLow" m="plank" p={[-0.38, 0.09, 0.38]} s={[0.13, 0.18, 0.13]} />
      </group>
    );
  }
  return (
    <group>
      {/* Halle : piliers de pierre et grand toit de tuiles */}
      <Part g="box" m="stoneLight" p={[0, 0.02, -0.08]} s={[0.84, 0.04, 0.6]} />
      {[-1, 0, 1].flatMap((ix) =>
        [-1, 1].map((sz) => <Part key={`${ix}${sz}`} g="box" m="stone" p={[ix * 0.36, 0.25, -0.08 + sz * 0.24]} s={[0.07, 0.46, 0.07]} />),
      )}
      <TileRoof p={[0, 0.48, -0.08]} w={0.66} h={0.3} d={0.94} rotY={Math.PI / 2} />
      <group position={[0, 0, -0.1]} scale={0.6}>
        <Stall />
      </group>
      {/* Fontaine */}
      <group position={[0.24, 0, 0.34]}>
        <Part g="cylinder" m="stoneLight" p={[0, 0.06, 0]} s={[0.26, 0.12, 0.26]} />
        <Part g="cylinder" m="water" p={[0, 0.121, 0]} s={[0.21, 0.005, 0.21]} shadow={false} />
        <Part g="cylinder" m="stone" p={[0, 0.18, 0]} s={[0.05, 0.14, 0.05]} />
        <Spinner p={[0, 0.27, 0]} axis="y" speed={2}>
          {[0, 1, 2, 3].map((i) => (
            <Part key={i} g="ball" m="water" p={[Math.cos((i * Math.PI) / 2) * 0.06, -0.03, Math.sin((i * Math.PI) / 2) * 0.06]} s={0.03} shadow={false} />
          ))}
        </Spinner>
      </group>
      <Banner p={[-0.42, 0, 0.36]} h={0.62} m="gold" />
      <Banner p={[-0.12, 0, 0.36]} h={0.5} m="cloth" />
      <Torch p={[0.42, 0.02, 0.18]} />
      <Torch p={[-0.42, 0.02, -0.34]} />
    </group>
  );
}
