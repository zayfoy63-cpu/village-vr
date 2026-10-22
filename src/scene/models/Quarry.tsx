import { Part } from './Part';

/** Carrière : sol de pierre, blocs taillés et chèvre de levage en bois */
export function Quarry() {
  return (
    <group>
      <Part g="box" m="stoneDark" p={[0, 0.015, 0]} s={[0.86, 0.03, 0.86]} />
      <Part g="box" m="stone" p={[-0.2, 0.09, -0.2]} s={[0.22, 0.15, 0.22]} />
      <Part g="box" m="stone" p={[0.02, 0.07, -0.25]} s={[0.16, 0.11, 0.16]} />
      <Part g="box" m="stone" p={[-0.22, 0.22, -0.2]} s={[0.15, 0.12, 0.15]} r={[0, 0.4, 0]} />
      <Part g="rock" m="stoneDark" p={[0.25, 0.1, 0.22]} s={0.22} />
      <Part g="box" m="stone" p={[0.05, 0.05, 0.25]} s={[0.12, 0.08, 0.12]} r={[0, 0.7, 0]} />
      {/* Chèvre de levage */}
      <Part g="box" m="timber" p={[0.2, 0.3, -0.15]} s={[0.04, 0.6, 0.04]} r={[0, 0, 0.25]} />
      <Part g="box" m="timber" p={[0.36, 0.3, -0.15]} s={[0.04, 0.6, 0.04]} r={[0, 0, -0.25]} />
      <Part g="box" m="timber" p={[0.28, 0.58, -0.15]} s={[0.04, 0.04, 0.3]} />
      <Part g="box" m="stone" p={[0.28, 0.3, -0.15]} s={[0.1, 0.1, 0.1]} />
    </group>
  );
}
