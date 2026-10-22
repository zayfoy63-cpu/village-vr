import { Part } from './Part';

function Crane({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <Part g="box" m="timber" p={[-0.08, 0.3, 0]} s={[0.04, 0.6, 0.04]} r={[0, 0, 0.25]} />
      <Part g="box" m="timber" p={[0.08, 0.3, 0]} s={[0.04, 0.6, 0.04]} r={[0, 0, -0.25]} />
      <Part g="box" m="timber" p={[0, 0.58, 0]} s={[0.04, 0.04, 0.3]} />
      <Part g="box" m="stone" p={[0, 0.3, 0]} s={[0.1, 0.1, 0.1]} />
    </group>
  );
}

/** Carrière. Niv. 2 : plus de blocs + 2e chèvre de levage. Niv. 3 : atelier de taille et charrette. */
export function Quarry({ level = 1 }: { level?: number }) {
  return (
    <group>
      <Part g="box" m="stoneDark" p={[0, 0.015, 0]} s={[0.88, 0.03, 0.88]} />
      <Part g="box" m="stone" p={[-0.2, 0.09, -0.2]} s={[0.22, 0.15, 0.22]} />
      <Part g="box" m="stone" p={[0.02, 0.07, -0.25]} s={[0.16, 0.11, 0.16]} />
      <Part g="box" m="stone" p={[-0.22, 0.22, -0.2]} s={[0.15, 0.12, 0.15]} r={[0, 0.4, 0]} />
      <Part g="rock" m="stoneDark" p={[0.25, 0.1, 0.22]} s={0.22} />
      <Part g="box" m="stone" p={[0.05, 0.05, 0.25]} s={[0.12, 0.08, 0.12]} r={[0, 0.7, 0]} />
      <Crane x={0.28} z={-0.15} />
      {level >= 2 && (
        <>
          <Crane x={-0.3} z={0.15} />
          <Part g="box" m="stone" p={[0.12, 0.06, 0.05]} s={[0.12, 0.1, 0.12]} />
          <Part g="box" m="stone" p={[0.18, 0.16, 0.05]} s={[0.1, 0.09, 0.1]} r={[0, 0.5, 0]} />
          <Part g="box" m="stone" p={[-0.05, 0.05, -0.05]} s={[0.1, 0.08, 0.1]} />
        </>
      )}
      {level >= 3 && (
        <>
          {/* Atelier de taille */}
          <group position={[-0.24, 0, -0.26]}>
            <Part g="box" m="stone" p={[0, 0.15, 0]} s={[0.34, 0.3, 0.3]} />
            <Part g="gable" m="roofSlate" p={[0, 0.3, 0]} s={[0.42, 0.2, 0.38]} />
            <Part g="box" m="window" p={[0, 0.16, 0.155]} s={[0.08, 0.08, 0.02]} shadow={false} />
          </group>
          {/* Charrette */}
          <group position={[0.05, 0, 0.32]}>
            <Part g="box" m="plank" p={[0, 0.1, 0]} s={[0.24, 0.06, 0.14]} />
            <Part g="box" m="stone" p={[0, 0.16, 0]} s={[0.14, 0.07, 0.09]} />
            {[-1, 1].map((sz) => (
              <Part key={sz} g="cylinderLow" m="timber" p={[0, 0.06, sz * 0.08]} s={[0.12, 0.02, 0.12]} r={[Math.PI / 2, 0, 0]} />
            ))}
          </group>
        </>
      )}
    </group>
  );
}
