// Regroupement des modèles : toutes les pièces (<Part>) de tous les bâtiments, miniatures et décors
// sont dessinées par quelques InstancedMesh partagés, un par (forme, famille de matériau, ombre).
// La couleur de chaque pièce passe en couleur d'instance : un seul matériau blanc pour presque tout.
//
// Chaque <Part> garde un maillage invisible (aucun appel de dessin) qui sert de repère et de cible
// aux clics, rayons et doigts : l'interaction est inchangée. Juste avant chaque rendu, après la mise
// à jour des matrices, les matrices monde de ces repères sont recopiées dans les instances.

import * as THREE from 'three';
import { TINT_BASE } from '../palette';

/** Ce qu'on lit d'un repère : sa matrice monde, sa visibilité et ses parents */
interface Node {
  visible: boolean;
  parent: Node | null;
  matrixWorld: THREE.Matrix4;
}

interface Item {
  obj: Node;
  color: THREE.Color | null;
  /** Écart de luminosité propre à la pièce (style fait main) */
  tint: number;
}

export interface Pool {
  key: string;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  shadow: boolean;
  tinted: boolean;
  items: Set<Item>;
  mesh: THREE.InstancedMesh;
  capacity: number;
}

/** Matériau invisible des repères : jamais dessiné, mais toujours touché par les rayons */
export const HIDDEN = new THREE.MeshBasicMaterial({ visible: false });

const pools = new Map<string, Pool>();
const sharedStd = new Map<string, THREE.MeshStandardMaterial>();
const geoIds = new WeakMap<THREE.BufferGeometry, number>();
let nextGeoId = 1;
let version = 0;
const listeners = new Set<() => void>();

function geoId(g: THREE.BufferGeometry) {
  let id = geoIds.get(g);
  if (!id) geoIds.set(g, (id = nextGeoId++));
  return id;
}

/**
 * Famille de matériau : les matériaux standard opaques et sans émission ne diffèrent que par leur
 * couleur (et leur rugosité) : ils partagent un matériau blanc teinté par instance.
 */
function family(m: THREE.Material): { key: string; material: THREE.Material; tinted: boolean } {
  const s = m as THREE.MeshStandardMaterial;
  const plain =
    s.isMeshStandardMaterial &&
    !s.transparent &&
    s.opacity === 1 &&
    s.metalness === 0 &&
    !s.map &&
    s.emissive.r === 0 &&
    s.emissive.g === 0 &&
    s.emissive.b === 0 &&
    s.side === THREE.FrontSide;
  if (!plain) return { key: `m${m.uuid}`, material: m, tinted: false };
  const key = `std|${s.roughness}|${s.flatShading ? 1 : 0}`;
  let shared = sharedStd.get(key);
  if (!shared) {
    shared = new THREE.MeshStandardMaterial({ color: TINT_BASE, roughness: s.roughness, metalness: 0, flatShading: s.flatShading });
    sharedStd.set(key, shared);
  }
  return { key, material: shared, tinted: true };
}

function makeMesh(p: Pick<Pool, 'geometry' | 'material' | 'shadow' | 'tinted'>, capacity: number) {
  const mesh = new THREE.InstancedMesh(p.geometry, p.material, capacity);
  mesh.count = 0;
  mesh.visible = false;
  mesh.frustumCulled = false;
  mesh.castShadow = p.shadow;
  mesh.receiveShadow = p.shadow;
  mesh.matrixAutoUpdate = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  if (p.tinted) {
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  }
  // Les instances ne se touchent pas : les clics vont aux repères invisibles
  mesh.raycast = () => {};
  return mesh;
}

function bump() {
  version++;
  for (const l of listeners) l();
}

/** Ajoute une pièce (avec un écart de luminosité facultatif) ; renvoie de quoi la retirer */
export function addPart(geometry: THREE.BufferGeometry, material: THREE.Material, shadow: boolean, obj: Node, tint = 1): () => void {
  const fam = family(material);
  const key = `${geoId(geometry)}|${fam.key}|${shadow ? 1 : 0}`;
  let pool = pools.get(key);
  if (!pool) {
    const base = { geometry, material: fam.material, shadow, tinted: fam.tinted };
    pool = { key, ...base, items: new Set(), capacity: 64, mesh: makeMesh(base, 64) };
    pools.set(key, pool);
    bump();
  }
  const item: Item = { obj, color: fam.tinted ? (material as THREE.MeshStandardMaterial).color : null, tint };
  pool.items.add(item);
  if (pool.items.size > pool.capacity) {
    // Plus de place : un maillage deux fois plus grand remplace l'ancien
    pool.mesh.dispose();
    pool.capacity *= 2;
    pool.mesh = makeMesh(pool, pool.capacity);
    bump();
  }
  const p = pool;
  return () => {
    p.items.delete(item);
  };
}

export function poolList(): Pool[] {
  return [...pools.values()];
}

export function subscribePools(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function poolsVersion() {
  return version;
}

/** Dans la scène, et visible avec toute sa chaîne de parents */
function shownIn(o: Node, scene: unknown): boolean {
  let a: Node = o;
  for (;;) {
    if (!a.visible) return false;
    if (!a.parent) return (a as unknown) === scene;
    a = a.parent;
  }
}

/** Recopie les matrices monde des repères dans les instances (appelé juste avant chaque rendu) */
export function syncPools(scene: THREE.Scene) {
  for (const pool of pools.values()) {
    const mesh = pool.mesh;
    const mats = mesh.instanceMatrix.array as Float32Array;
    const cols = mesh.instanceColor?.array as Float32Array | undefined;
    let n = 0;
    for (const it of pool.items) {
      const o = it.obj;
      // Repère détaché de la scène (démontage en cours) ou caché : rien à dessiner
      if (!shownIn(o, scene)) continue;
      mats.set(o.matrixWorld.elements, n * 16);
      if (cols && it.color) {
        cols[n * 3] = it.color.r * it.tint;
        cols[n * 3 + 1] = it.color.g * it.tint;
        cols[n * 3 + 2] = it.color.b * it.tint;
      }
      n++;
    }
    mesh.count = n;
    mesh.visible = n > 0;
    if (n > 0) {
      mesh.instanceMatrix.clearUpdateRanges();
      mesh.instanceMatrix.addUpdateRange(0, n * 16);
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) {
        mesh.instanceColor.clearUpdateRanges();
        mesh.instanceColor.addUpdateRange(0, n * 3);
        mesh.instanceColor.needsUpdate = true;
      }
    }
  }
}
