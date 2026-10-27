// Toute l'interface 3D (fonds de panneaux, boutons, textes, icônes) en UN seul maillage dessiné en
// un seul appel. Chaque élément du kit déclare ses triangles dans son repère local et un objet 3D
// d'ancrage ; juste avant chaque rendu, les sommets sont placés en coordonnées monde.
// Ordre de dessin : du plus loin au plus proche, chaque panneau d'un bloc (son fond puis son contenu),
// sans aucune texture par texte : seulement l'atlas partagé.

import * as THREE from 'three';
import { GRAIN_UV, WHITE_UV, advance, atlasGeneration, atlasTexture, flushAtlas, glyph, graphemes, lineWidth, type FontKind } from './atlas';
import { PAL } from '../../palette';

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
  /** Police : texte courant et chiffres (par défaut) ou titres à la plume */
  font?: FontKind;
}

/** Bord des plaques : papier découpé à la main, sceau de cire, ou net */
export type Edge = 'paper' | 'wax' | 'clean';

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

  /**
   * Plaque pleine (et sa bordure) centrée sur (0, 0). Fond sur le grain de papier de l'atlas, bords
   * légèrement irréguliers (papier) ou bosselés (cire) : jamais deux arêtes parfaitement droites.
   */
  plate(w: number, h: number, r: number, fill: RGBA, border: RGBA | null, bw: number, edge: Edge = 'paper') {
    const [u, v] = WHITE_UV;
    const [gu0, gv0, gu1, gv1] = GRAIN_UV;
    const gu = (x: number) => gu0 + (x / w + 0.5) * (gu1 - gu0);
    const gv = (y: number) => gv0 + (y / h + 0.5) * (gv1 - gv0);
    const outer = outline(w, h, r, edge, w, h);
    const inner = border ? outline(w - bw * 2, h - bw * 2, Math.max(0, r - bw), edge, w, h) : outer;
    const center = this.vert(0, 0, gu(0), gv(0), fill);
    const first = this.pos.length / 3;
    for (const [x, y] of inner) this.vert(x, y, gu(x), gv(y), fill);
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

  /**
   * Une ligne de texte, caractère par caractère depuis l'atlas. Avec `outline` : liseré d'encre
   * sous un texte clair, ou halo couleur papier sous un texte sombre (encre lisible sur tout fond).
   */
  text(str: string, o: TextOpts) {
    const font = o.font ?? 'body';
    const lw = lineWidth(str, o.weight, font) * o.size;
    const sx = o.squeeze && lw > o.squeeze ? o.squeeze / lw : 1;
    const width = lw * sx;
    const start = o.align === 'left' ? o.x : o.align === 'right' ? o.x - width : o.x - width / 2;
    const em = o.size;
    const dark = o.color[0] * 0.3 + o.color[1] * 0.59 + o.color[2] * 0.11 < 0.25;
    const halo = o.outline && dark;
    const passes: ('halo' | 'text')[] = halo ? ['halo', 'text'] : ['text'];
    for (const pass of passes) {
      let pen = start;
      for (const ch of graphemes(str)) {
        const adv = advance(ch, o.weight, font) * em * sx;
        if (ch.trim()) {
          const g = glyph(ch, o.weight, pass === 'halo' ? 'halo' : o.outline && !halo ? 'dark' : false, font);
          if (pass === 'text' || !g.colored) {
            const c: RGBA = g.colored ? [1, 1, 1, (o.iconAlpha ?? 1) * o.color[3]] : pass === 'halo' ? [HALO[0], HALO[1], HALO[2], 0.85 * o.color[3]] : o.color;
            const left = pen - g.ox * em * sx;
            const top = o.y + g.oy * em;
            this.quad(left, top - g.h * em, left + g.w * em * sx, top, g.u0, g.v0, g.u1, g.v1, c);
          }
        }
        pen += adv;
      }
    }
  }

  done(): Tris {
    return { pos: new Float32Array(this.pos), uv: new Float32Array(this.uv), col: new Float32Array(this.col), idx: new Uint16Array(this.idx) };
  }
}

const outlineCache = new Map<string, [number, number][]>();
/** Petit bruit stable dans [-1, 1] */
const wobble = (i: number, k: number) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
};

/**
 * Contour d'une plaque (sens trigonométrique) : coins arrondis (4 segments) et côtés découpés en
 * petits segments légèrement décalés. Le décalage ne dépend que de la taille de la plaque extérieure
 * (`ow`, `oh`) et du rang du point : bord extérieur et bord intérieur bougent ensemble (trait régulier).
 */
function outline(w: number, h: number, r: number, edge: Edge, ow: number, oh: number): [number, number][] {
  const key = `${w.toFixed(4)}|${h.toFixed(4)}|${r.toFixed(4)}|${edge}|${ow.toFixed(4)}|${oh.toFixed(4)}`;
  let pts = outlineCache.get(key);
  if (pts) return pts;
  pts = [];
  const rr = Math.min(r, w / 2, h / 2);
  const seed = Math.round(ow * 1e4) * 7 + Math.round(oh * 1e4);
  // Amplitude du tremblé : discrète sur le papier, plus marquée sur la cire
  const amp = edge === 'clean' ? 0 : edge === 'wax' ? Math.min(ow, oh) * 0.045 : Math.min(0.0016, Math.min(ow, oh) * 0.02);
  const sideSteps = (len: number) => (edge === 'clean' ? 0 : Math.min(10, Math.max(1, Math.round(len / (edge === 'wax' ? 0.012 : 0.025)))));
  const corners: [number, number, number][] = [
    [w / 2 - rr, h / 2 - rr, 0],
    [-w / 2 + rr, h / 2 - rr, Math.PI / 2],
    [-w / 2 + rr, -h / 2 + rr, Math.PI],
    [w / 2 - rr, -h / 2 + rr, (3 * Math.PI) / 2],
  ];
  let idx = 0;
  const push = (x: number, y: number, nx: number, ny: number) => {
    const d = amp * wobble(seed, idx++);
    pts!.push([x + nx * d, y + ny * d]);
  };
  corners.forEach(([cx, cy, a0], c) => {
    for (let k = 0; k <= 4; k++) {
      const a = a0 + (k / 4) * (Math.PI / 2);
      push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, Math.cos(a), Math.sin(a));
    }
    // Côté suivant : du bout de ce coin au début du coin suivant
    const [nxc, nyc, na0] = corners[(c + 1) % 4];
    const ex = cx + Math.cos(a0 + Math.PI / 2) * rr;
    const ey = cy + Math.sin(a0 + Math.PI / 2) * rr;
    const sx = nxc + Math.cos(na0) * rr;
    const sy = nyc + Math.sin(na0) * rr;
    // Nombre de segments fixé par la plaque extérieure : mêmes points pour les deux bords
    const n = sideSteps(c % 2 === 0 ? ow : oh);
    const nx = Math.cos(a0 + Math.PI / 2);
    const ny = Math.sin(a0 + Math.PI / 2);
    for (let k = 1; k < n; k++) push(ex + ((sx - ex) * k) / n, ey + ((sy - ey) * k) / n, nx, ny);
  });
  if (outlineCache.size > 800) outlineCache.clear();
  outlineCache.set(key, pts);
  return pts;
}

/** Couleur du halo sous les textes sombres (papier) */
const HALO = rgba(PAL.parchment);

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
