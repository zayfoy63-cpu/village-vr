import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { seasonOf, type SeasonId } from '../game/config';
import type { Building, GameMap } from '../game/types';
import { SOIL } from '../game/mechanics/soil';
import { useGame } from '../store/gameStore';
import { GEO, MAT, tileToWorld } from './shared';

const MAX_FIELDS = 200;
const MAX_ROWS = 6;
/** Rangées de cultures par niveau (1, 2, 3) */
const ROWS_BY_LEVEL = [4, 5, 6];
/** Bottes de foin posées au bord du champ par niveau */
const BALES_BY_LEVEL = [0, 1, 2];

const DAMAGED_CROP = new THREE.Color('#6b5434');
/** Cultures d'un sol épuisé : paille pâle et délavée (distincte du doré d'un blé mûr) */
const TIRED_CROP = new THREE.Color('#d8d3a0');

const CROP_COLORS: Record<SeasonId, string> = {
  spring: '#93d35c',
  summer: '#6fae3c',
  autumn: '#e0b440',
  winter: '#a68a5c',
};

/** Tous les champs en 3 draw calls : terre labourée, rangées de cultures, bottes de foin */
export function Fields({ fields, map }: { fields: Building[]; map: GameMap }) {
  const soilRef = useRef<THREE.InstancedMesh>(null);
  const rowRef = useRef<THREE.InstancedMesh>(null);
  const baleRef = useRef<THREE.InstancedMesh>(null);
  const season = useGame((s) => seasonOf(s.game.day).id);
  const n = Math.min(fields.length, MAX_FIELDS);

  useLayoutEffect(() => {
    const soil = soilRef.current;
    const rows = rowRef.current;
    const bales = baleRef.current;
    if (!soil || !rows || !bales) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const qb = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const c = new THREE.Color(CROP_COLORS[season]);
    const tc = new THREE.Color();
    const rowH = season === 'winter' ? 0.03 : season === 'spring' ? 0.08 : 0.14;
    // Couleurs remplies pour toutes les instances : l'attribut existe dès le premier rendu
    for (let i = 0; i < MAX_FIELDS * MAX_ROWS; i++) rows.setColorAt(i, c);
    let r = 0;
    let bi = 0;
    for (let i = 0; i < n; i++) {
      const f = fields[i];
      const lvl = Math.max(1, Math.min(3, f.level)) - 1;
      const [x, , z] = tileToWorld(f.x, f.z, map.width, map.height);
      const rot = (f.id % 2) * (Math.PI / 2);
      q.setFromAxisAngle(up, rot);
      m.compose(p.set(x, 0.02, z), q, s.set(0.9, 0.04, 0.9));
      soil.setMatrixAt(i, m);
      const count = ROWS_BY_LEVEL[lvl];
      const span = 0.66;
      // Plus haut niveau = rangées plus serrées et légèrement plus hautes ; endommagé = cultures couchées
      const tiredK = Math.pow(Math.max(0, ((f.fatigue ?? 0) - SOIL.hint.yellowFrom) / (1 - SOIL.hint.yellowFrom)), 0.7);
      // Sol épuisé : cultures aussi plus basses et clairsemées (jusqu'à -45 %)
      const h = rowH * (1 + lvl * 0.2) * (f.damaged ? 0.35 : 1) * (1 - 0.45 * tiredK);
      for (let k = 0; k < count; k++) {
        const off = -span / 2 + (k * span) / (count - 1);
        m.compose(p.set(x + (rot ? 0 : off), 0.04 + h / 2, z + (rot ? off : 0)), q, s.set(0.09, h, 0.74));
        // Sol épuisé : les cultures jaunissent peu à peu (indice discret)
        const tired = tiredK;
        if (f.damaged) rows.setColorAt(r, DAMAGED_CROP);
        else if (season !== 'winter') rows.setColorAt(r, tc.copy(c).lerp(TIRED_CROP, tired * 0.9));
        else rows.setColorAt(r, c);
        rows.setMatrixAt(r++, m);
      }
      for (let k = 0; k < BALES_BY_LEVEL[lvl]; k++) {
        const ox = rot ? 0.41 : -0.3 + k * 0.6;
        const oz = rot ? -0.3 + k * 0.6 : 0.41;
        qb.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2).premultiply(q);
        m.compose(p.set(x + ox, 0.07, z + oz), qb, s.set(0.12, 0.14, 0.12));
        bales.setMatrixAt(bi++, m);
      }
    }
    soil.count = n;
    rows.count = r;
    bales.count = bi;
    for (const mesh of [soil, rows, bales]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
    if (rows.instanceColor) rows.instanceColor.needsUpdate = true;
  }, [fields, map, season, n]);

  return (
    <group>
      <instancedMesh ref={soilRef} args={[GEO.box, MAT.soil, MAX_FIELDS]} receiveShadow />
      <instancedMesh ref={rowRef} args={[GEO.box, undefined, MAX_FIELDS * MAX_ROWS]} castShadow receiveShadow>
        <meshStandardMaterial flatShading roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={baleRef} args={[GEO.cylinderLow, MAT.hay, MAX_FIELDS * 2]} castShadow receiveShadow />
    </group>
  );
}
