import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { seasonOf, type SeasonId } from '../game/config';
import type { Building, GameMap } from '../game/types';
import { useGame } from '../store/gameStore';
import { GEO, MAT, tileToWorld } from './shared';

const MAX_FIELDS = 200;
const ROWS = 4;

const CROP_COLORS: Record<SeasonId, string> = {
  spring: '#93d35c',
  summer: '#6fae3c',
  autumn: '#e0b440',
  winter: '#a68a5c',
};

/** Tous les champs en 2 draw calls : la terre labourée et les rangées de cultures */
export function Fields({ fields, map }: { fields: Building[]; map: GameMap }) {
  const soilRef = useRef<THREE.InstancedMesh>(null);
  const rowRef = useRef<THREE.InstancedMesh>(null);
  const season = useGame((s) => seasonOf(s.game.day).id);
  const n = Math.min(fields.length, MAX_FIELDS);

  useLayoutEffect(() => {
    const soil = soilRef.current;
    const rows = rowRef.current;
    if (!soil || !rows) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const c = new THREE.Color(CROP_COLORS[season]);
    const rowH = season === 'winter' ? 0.03 : season === 'spring' ? 0.08 : 0.14;
    // Couleurs remplies pour toutes les instances : l'attribut existe dès le premier rendu
    for (let i = 0; i < MAX_FIELDS * ROWS; i++) rows.setColorAt(i, c);
    for (let i = 0; i < n; i++) {
      const f = fields[i];
      const [x, , z] = tileToWorld(f.x, f.z, map.width, map.height);
      const rot = (f.id % 2) * (Math.PI / 2);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot);
      m.compose(p.set(x, 0.02, z), q, s.set(0.9, 0.04, 0.9));
      soil.setMatrixAt(i, m);
      for (let r = 0; r < ROWS; r++) {
        const off = -0.3 + (r * 0.6) / (ROWS - 1);
        const ox = rot ? 0 : off;
        const oz = rot ? off : 0;
        m.compose(p.set(x + ox, 0.04 + rowH / 2, z + oz), q, s.set(0.11, rowH, 0.78));
        rows.setMatrixAt(i * ROWS + r, m);
      }
    }
    soil.count = n;
    rows.count = n * ROWS;
    soil.instanceMatrix.needsUpdate = true;
    rows.instanceMatrix.needsUpdate = true;
    if (rows.instanceColor) rows.instanceColor.needsUpdate = true;
    soil.computeBoundingSphere();
    rows.computeBoundingSphere();
  }, [fields, map, season, n]);

  return (
    <group>
      <instancedMesh ref={soilRef} args={[GEO.box, MAT.soil, MAX_FIELDS]} receiveShadow />
      <instancedMesh ref={rowRef} args={[GEO.box, undefined, MAX_FIELDS * ROWS]} castShadow receiveShadow>
        <meshStandardMaterial flatShading roughness={0.9} />
      </instancedMesh>
    </group>
  );
}
