import { Part } from './Part';

/** Tour de garde. Chaque niveau la rend plus haute ; niv. 2 : socle ; niv. 3 : plateforme élargie et bannières. */
export function Tower({ level = 1 }: { level?: number }) {
  const H = [1.2, 1.5, 1.8][Math.min(2, level - 1)];
  const top = level >= 3 ? 0.62 : 0.5;
  const half = top / 2 - 0.05;
  return (
    <group>
      {level >= 2 && <Part g="box" m="stoneDark" p={[0, 0.08, 0]} s={[0.5, 0.16, 0.5]} />}
      <Part g="box" m="stone" p={[0, H / 2, 0]} s={[0.36, H, 0.36]} />
      <Part g="box" m="stoneDark" p={[0, H + 0.02, 0]} s={[top, 0.08, top]} />
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <group key={`${sx}${sz}`}>
            <Part g="box" m="stone" p={[sx * half, H + 0.12, sz * half]} s={[0.1, 0.14, 0.1]} shadow={false} />
            <Part g="box" m="timber" p={[sx * half, H + 0.25, sz * half]} s={[0.03, 0.2, 0.03]} shadow={false} />
          </group>
        )),
      )}
      <Part g="pyramid" m={level >= 3 ? 'roofBlue' : 'roofBrown'} p={[0, H + 0.46, 0]} s={[top + 0.1, 0.3, top + 0.1]} />
      {Array.from({ length: level + 1 }, (_, i) => (
        <Part key={i} g="box" m="window" p={[0, 0.5 + i * 0.35, 0.185]} s={[0.05, 0.14, 0.02]} shadow={false} />
      ))}
      <Part g="box" m="door" p={[0, 0.12, 0.185]} s={[0.12, 0.24, 0.02]} shadow={false} />
      <Part g="cylinderLow" m="timber" p={[0, H + 0.75, 0]} s={[0.02, 0.3, 0.02]} shadow={false} />
      <Part g="box" m="cloth" p={[0.08, H + 0.83, 0]} s={[0.15, 0.1, 0.01]} shadow={false} />
      {level >= 3 &&
        [-1, 1].map((sx) => (
          <Part key={sx} g="box" m="cloth" p={[sx * 0.185, H - 0.2, 0]} s={[0.02, 0.3, 0.12]} shadow={false} />
        ))}
    </group>
  );
}
