import { Part } from './Part';

/** Cabane de bûcheron : cabane en rondins, tas de bûches et billot */
export function Lumber() {
  return (
    <group>
      <Part g="box" m="wood" p={[-0.08, 0.18, -0.08]} s={[0.5, 0.36, 0.42]} />
      <Part g="pyramid" m="roofBrown" p={[-0.08, 0.5, -0.08]} s={[0.62, 0.3, 0.54]} />
      <Part g="box" m="door" p={[-0.08, 0.1, 0.135]} s={[0.12, 0.2, 0.02]} shadow={false} />
      <Part g="box" m="window" p={[0.175, 0.22, -0.08]} s={[0.02, 0.08, 0.08]} shadow={false} />
      {/* Tas de bûches */}
      {[
        [0.22, 0.05, 0.22],
        [0.22, 0.05, 0.32],
        [0.22, 0.14, 0.27],
      ].map((p, i) => (
        <Part key={i} g="cylinderLow" m="woodLight" p={p as [number, number, number]} s={[0.09, 0.32, 0.09]} r={[0, 0, Math.PI / 2]} />
      ))}
      {/* Billot */}
      <Part g="cylinderLow" m="wood" p={[-0.28, 0.06, 0.28]} s={[0.14, 0.12, 0.14]} />
    </group>
  );
}
