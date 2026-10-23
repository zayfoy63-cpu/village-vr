// Toute l'interface 3D (fonds de panneaux, boutons, textes, icônes) en UN seul maillage dessiné en
// un seul appel. Chaque élément du kit déclare ses triangles dans son repère local et un objet 3D
// d'ancrage ; juste avant chaque rendu, les sommets sont placés en coordonnées monde.
// Ordre de dessin : du plus loin au plus proche, chaque panneau d'un bloc (son fond puis son contenu),
// sans aucune texture par texte : seulement l'atlas partagé.

import * as THREE from 'three';
import { WHITE_UV, advance, atlasGeneration, atlasTexture, flushAtlas, glyph, graphemes, lineWidth } from './atlas';

interface Node {
  visible: boolean;
  parent: Node | null;
  matrixWorld: THREE.Matrix4;
}

export interface Tris {
  pos: Float32Array;
  uv: Float32Array;
  col: Float32Array;
  idx: Uint16Array;
}

export interface UIItem {
  anchor: Node;
  /** Panneau qui contient l'élément : tout le panneau est trié d'un bloc (fond puis contenu) */
  root: { current: Node | null } | null;
  /** 0 = fond de panneau (dessiné avant le contenu du panneau), 1 = boutons et textes */
  layer: 0 | 1;
  build: () => Tris;
  data?: Tris;
  dirty: boolean;
  gen: number;
  seq: number;
  vOff: number;
  dist: number;
}

// ---------------------------------------------------------------------------------------------
// Construction des triangles
// ---------------------------------------------------------------------------------------------

export type RGBA = [number, number, number, number];
const colors = new Map<string, RGBA>();
const _c = new THREE.Color();

/** Couleur CSS (#hex, rgb(), rgba()) en couleur linéaire + alpha */
export function rgba(css: string, opacity = 1): RGBA {
  const key = `${css}|${opacity}`;
  let c = colors.get(key);
  if (!c) {
    const m = /rgba?\(([^)]+)\)/.exec(css);
    let a = 1;
    if (m) {
      const parts = m[1].split(',').map((x) => parseFloat(x));
      _c.setRGB(parts[0] / 255, parts[1] / 255, parts[2] / 255, THREE.SRGBColorSpace);
      if (parts.length > 3) a = parts[3];
    } else _c.setStyle(css);
    c = [_c.r, _c.g, _c.b, a * opacity];
    colors.set(key, c);
  }
  return c;
}

const WHITE: RGBA = [1, 1, 1, 1];

export interface TextOpts {
  size: number;
  color: RGBA;
  weight: number;
  outline: boolean;
  /** Ligne centrée verticalement sur y */
  x: number;
  y: number;
  align: 'left' | 'center' | 'right';
  /** Largeur maximale : le texte est resserré au-delà (comme fillText(…, maxWidth)) */
  squeeze?: number;
  /** Opacité des icônes (couleurs propres, non teintées) */
  iconAlpha?: number;
}

export class Builder {
  pos: number[] = [];
  uv: number[] = [];
  col: number[] = [];
  idx: number[] = [];

  private vert(x: number, y: number, u: number, v: number, c: RGBA) {
    this.pos.push(x, y, 0);
    this.uv.push(u, v);
    this.col.push(c[0], c[1], c[2], c[3]);
    return this.pos.length / 3 - 1;
  }

  quad(x0: number, y0: number, x1: number, y1: number, u0: number, v0: number, u1: number, v1: number, c: RGBA) {
    const a = this.vert(x0, y0, u0, v0, c);
    this.vert(x1, y0, u1, v0, c);
    this.vert(x1, y1, u1, v1, c);
    this.vert(x0, y1, u0, v1, c);
    this.idx.push(a, a + 1, a + 2, a, a + 2, a + 3);
  }

  /** Rectangle arrondi plein (et sa bordure) centré sur (0, 0) */
  plate(w: number, h: number, r: number, fill: RGBA, border: RGBA | null, bw: number) {
    const [u, v] = WHITE_UV;
    const outer = rounded(w, h, r);
    const inner = border ? rounded(w - bw * 2, h - bw * 2, Math.max(0, r - bw)) : outer;
    const center = this.vert(0, 0, u, v, fill);
    const first = this.pos.length / 3;
    for (const [x, y] of inner) this.vert(x, y, u, v, fill);
    const n = inner.length;
    for (let i = 0; i < n; i++) this.idx.push(center, first + i, first + ((i + 1) % n));
    if (!border) return;
    const a = this.pos.length / 3;
    for (const [x, y] of outer) this.vert(x, y, u, v, border);
    const b = this.pos.length / 3;
    for (const [x, y] of inner) this.vert(x, y, u, v, border);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      this.idx.push(a + i, a + j, b + j, a + i, b + j, b + i);
    }
  }

  /** Une ligne de texte, caractère par caractère depuis l'atlas */
  text(str: string, o: TextOpts) {
    const lw = lineWidth(str, o.weight) * o.size;
    const sx = o.squeeze && lw > o.squeeze ? o.squeeze / lw : 1;
    const width = lw * sx;
    let pen = o.align === 'left' ? o.x : o.align === 'right' ? o.x - width : o.x - width / 2;
    const em = o.size;
    for (const ch of graphemes(str)) {
      const adv = advance(ch, o.weight) * em * sx;
      if (ch.trim()) {
        const g = glyph(ch, o.weight, o.outline);
        const c: RGBA = g.colored ? [1, 1, 1, (o.iconAlpha ?? 1) * o.color[3]] : o.color;
        const left = pen - g.ox * em * sx;
        const top = o.y + g.oy * em;
        this.quad(left, top - g.h * em, left + g.w * em * sx, top, g.u0, g.v0, g.u1, g.v1, c);
      }
      pen += adv;
    }
  }

  done(): Tris {
    return { pos: new Float32Array(this.pos), uv: new Float32Array(this.uv), col: new Float32Array(this.col), idx: new Uint16Array(this.idx) };
  }
}

const roundCache = new Map<string, [number, number][]>();
/** Contour d'un rectangle arrondi (sens trigonométrique), 4 segments par coin */
function rounded(w: number, h: number, r: number): [number, number][] {
  const key = `${w.toFixed(4)}|${h.toFixed(4)}|${r.toFixed(4)}`;
  let pts = roundCache.get(key);
  if (pts) return pts;
  pts = [];
  const rr = Math.min(r, w / 2, h / 2);
  const corners: [number, number, number][] = [
    [w / 2 - rr, h / 2 - rr, 0],
    [-w / 2 + rr, h / 2 - rr, Math.PI / 2],
    [-w / 2 + rr, -h / 2 + rr, Math.PI],
    [w / 2 - rr, -h / 2 + rr, (3 * Math.PI) / 2],
  ];
  for (const [cx, cy, a0] of corners) for (let k = 0; k <= 4; k++) {
    const a = a0 + (k / 4) * (Math.PI / 2);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  if (roundCache.size > 500) roundCache.clear();
  roundCache.set(key, pts);
  return pts;
}

/** Blanc : icônes non teintées */
export const NO_TINT = WHITE;

// ---------------------------------------------------------------------------------------------
// Registre et maillage unique
// ---------------------------------------------------------------------------------------------

const items = new Set<UIItem>();
let seq = 0;

export function addItem(anchor: Node, layer: 0 | 1, build: () => Tris, root: UIItem['root'] = null): UIItem {
  const it: UIItem = { anchor, root, layer, build, dirty: true, gen: -1, seq: seq++, vOff: 0, dist: 0 };
  items.add(it);
  return it;
}

export function removeItem(it: UIItem) {
  items.delete(it);
}

let mesh: THREE.Mesh | null = null;
let capV = 0;
let capI = 0;
let lastVisible: UIItem[] = [];

/** (Ré)alloue les tampons ; une nouvelle géométrie remplace l'ancienne (libérée côté GPU) */
function alloc(nv: number, ni: number) {
  capV = Math.max(nv, capV * 2, 4096);
  capI = Math.max(ni, capI * 2, 8192);
  const geo = new THREE.BufferGeometry();
  for (const [name, size] of [['position', 3], ['uv', 2], ['color', 4]] as const) {
    const attr = new THREE.BufferAttribute(new Float32Array(capV * size), size);
    attr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute(name, attr);
  }
  const index = new THREE.BufferAttribute(new Uint32Array(capI), 1);
  index.setUsage(THREE.DynamicDrawUsage);
  geo.setIndex(index);
  const old = mesh!.geometry;
  mesh!.geometry = geo;
  old.dispose();
}

export function uiMesh(): THREE.Mesh {
  if (!mesh) {
    const mat = new THREE.MeshBasicMaterial({
      map: atlasTexture(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    mesh.renderOrder = 10;
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = false;
    mesh.raycast = () => {};
    alloc(1, 1);
  }
  return mesh;
}

function shownIn(o: Node, scene: unknown): boolean {
  let a: Node = o;
  for (;;) {
    if (!a.visible) return false;
    if (!a.parent) return (a as unknown) === scene;
    a = a.parent;
  }
}

const _cam = new THREE.Vector3();

/** Place tous les sommets de l'interface en coordonnées monde (appelé juste avant chaque rendu) */
export function syncUI(scene: unknown, camera: THREE.Camera) {
  if (!mesh) return;
  const visible: UIItem[] = [];
  for (const it of items) if (shownIn(it.anchor, scene)) visible.push(it);
  let layoutDirty = visible.length !== lastVisible.length || visible.some((it, i) => it !== lastVisible[i]);
  // Reconstruction des éléments modifiés (deux passes si l'atlas s'est vidé entre-temps)
  for (let pass = 0; pass < 2; pass++) {
    const gen = atlasGeneration();
    for (const it of visible) {
      if (it.dirty || it.gen !== gen) {
        it.data = it.build();
        it.dirty = false;
        it.gen = gen;
        layoutDirty = true;
      }
    }
    if (atlasGeneration() === gen) break;
  }
  lastVisible = visible;

  let nv = 0;
  let ni = 0;
  for (const it of visible) {
    nv += it.data!.pos.length / 3;
    ni += it.data!.idx.length;
  }
  if (nv > capV || ni > capI) {
    alloc(nv, ni);
    layoutDirty = true;
  }
  const geo = mesh.geometry;
  const P = geo.getAttribute('position') as THREE.BufferAttribute;
  const U = geo.getAttribute('uv') as THREE.BufferAttribute;
  const C = geo.getAttribute('color') as THREE.BufferAttribute;
  const I = geo.getIndex()!;
  const pa = P.array as Float32Array;

  if (layoutDirty) {
    let off = 0;
    for (const it of visible) {
      const d = it.data!;
      it.vOff = off;
      (U.array as Float32Array).set(d.uv, off * 2);
      (C.array as Float32Array).set(d.col, off * 4);
      off += d.pos.length / 3;
    }
    U.clearUpdateRanges();
    U.addUpdateRange(0, nv * 2);
    U.needsUpdate = true;
    C.clearUpdateRanges();
    C.addUpdateRange(0, nv * 4);
    C.needsUpdate = true;
  }

  // Sommets en coordonnées monde + profondeur dans l'axe de la caméra (ordre de dessin, comme three)
  camera.getWorldPosition(_cam);
  const ce = camera.matrixWorld.elements;
  const fx = -ce[8];
  const fy = -ce[9];
  const fz = -ce[10];
  for (const it of visible) {
    const e = it.anchor.matrixWorld.elements;
    const src = it.data!.pos;
    let o = it.vOff * 3;
    for (let k = 0; k < src.length; k += 3) {
      const x = src[k];
      const y = src[k + 1];
      const z = src[k + 2];
      pa[o++] = e[0] * x + e[4] * y + e[8] * z + e[12];
      pa[o++] = e[1] * x + e[5] * y + e[9] * z + e[13];
      pa[o++] = e[2] * x + e[6] * y + e[10] * z + e[14];
    }
    // Profondeur du panneau parent (s'il y en a un) : un panneau proche recouvre ce qui est derrière
    const r = it.root?.current?.matrixWorld.elements ?? e;
    it.dist = (r[12] - _cam.x) * fx + (r[13] - _cam.y) * fy + (r[14] - _cam.z) * fz;
  }
  P.clearUpdateRanges();
  P.addUpdateRange(0, nv * 3);
  P.needsUpdate = true;

  // Du plus loin au plus proche ; dans un même panneau : le fond, puis le contenu dans l'ordre
  const order = visible.slice().sort((a, b) => b.dist - a.dist || a.layer - b.layer || a.seq - b.seq);
  const ia = I.array as Uint32Array;
  let n = 0;
  for (const it of order) {
    const idx = it.data!.idx;
    const base = it.vOff;
    for (let k = 0; k < idx.length; k++) ia[n++] = idx[k] + base;
  }
  I.clearUpdateRanges();
  I.addUpdateRange(0, n);
  I.needsUpdate = true;
  geo.setDrawRange(0, n);
  mesh.visible = n > 0;
  flushAtlas();
}
