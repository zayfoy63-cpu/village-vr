// Atlas unique de caractères pour toute l'interface 3D : chaque caractère (lettres accentuées,
// chiffres) est dessiné une seule fois en blanc sur un grand canvas partagé, et chaque icône du jeu
// (src/ui/icons, jetons dans les textes) une seule fois en couleur. Tous les textes sont des
// quadrilatères qui pointent dans cet atlas. Couleur du texte = couleur de sommet.
// Une seule texture, quel que soit le nombre de textes affichés.

import * as THREE from 'three';
import { drawIcon, iconOf } from '../../ui/icons';
import { TINT_BASE } from '../../palette';

export const FONT = "system-ui, 'Segoe UI', Roboto, 'Noto Sans', sans-serif";

/** Taille de police dans l'atlas (pixels par em) */
const BASE = 64;
const SIZE = 2048;
const PAD = 8;
/** Bloc blanc plein (fonds de panneaux et de boutons) */
const WHITE = 32;

export interface Glyph {
  /** Coordonnées de texture (u0, v0) en bas à gauche, (u1, v1) en haut à droite */
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  /** Dimensions de la case et origine du tracé, en em */
  w: number;
  h: number;
  ox: number;
  oy: number;
  /** Icône du jeu (couleurs propres) : pas teintée */
  colored: boolean;
}

/** Icônes du jeu (jetons) : taille et avance en em */
const ICON_SIZE = 1.08;
const ICON_ADVANCE = 1.2;

// Créé à la première utilisation (la version PC sans interface 3D n'en a pas besoin)
let ctx: CanvasRenderingContext2D;
let texture: THREE.CanvasTexture | null = null;

export function atlasTexture(): THREE.CanvasTexture {
  if (!texture) {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    ctx = canvas.getContext('2d')!;
    texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    reset();
  }
  return texture;
}

const glyphs = new Map<string, Glyph>();
let shelfX = 0;
let shelfY = 0;
let shelfH = 0;
let dirty = true;
/** Change quand l'atlas est vidé (plein) : tous les textes se reconstruisent */
let generation = 0;

export function atlasGeneration() {
  return generation;
}

function reset() {
  if (!texture) return;
  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = TINT_BASE;
  ctx.fillRect(0, 0, WHITE, WHITE);
  glyphs.clear();
  shelfX = WHITE + PAD;
  shelfY = 0;
  shelfH = WHITE;
  dirty = true;
  generation++;
}

/** Coordonnée de texture d'un pixel blanc plein */
export const WHITE_UV: [number, number] = [WHITE / 2 / SIZE, 1 - WHITE / 2 / SIZE];

const fontOf = (weight: number) => `${weight} ${BASE}px ${FONT}`;

// --- Mesures (sans toucher à l'atlas) ---------------------------------------------------------

const advances = new Map<string, number>();
const measureCtx = document.createElement('canvas').getContext('2d')!;

/** Avance d'un caractère, en em */
export function advance(ch: string, weight: number): number {
  // Icône du jeu : un carré d'un peu plus d'un em
  if (iconOf(ch)) return ICON_ADVANCE;
  const key = `${weight}|${ch}`;
  let a = advances.get(key);
  if (a === undefined) {
    measureCtx.font = fontOf(weight);
    a = measureCtx.measureText(ch).width / BASE;
    advances.set(key, a);
  }
  return a;
}

const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter('fr', { granularity: 'grapheme' }) : null;
const splitCache = new Map<string, string[]>();

/** Découpe en caractères visibles (une lettre accentuée composée reste entière) */
export function graphemes(text: string): string[] {
  let out = splitCache.get(text);
  if (!out) {
    out = segmenter ? Array.from(segmenter.segment(text), (s) => s.segment) : Array.from(text);
    if (splitCache.size > 2000) splitCache.clear();
    splitCache.set(text, out);
  }
  return out;
}

/** Largeur d'une ligne en em */
export function lineWidth(text: string, weight: number): number {
  let w = 0;
  for (const g of graphemes(text)) w += advance(g, weight);
  return w;
}

// --- Atlas ------------------------------------------------------------------------------------

/** Caractère dans l'atlas (dessiné à la première demande) ; `outline` = liseré sombre */
export function glyph(ch: string, weight: number, outline: boolean): Glyph {
  atlasTexture();
  const icon = iconOf(ch);
  // Une icône est dessinée une seule fois, quel que soit le style du texte qui l'entoure
  const key = icon ? `icon|${ch}` : `${weight}|${outline ? 1 : 0}|${ch}`;
  const hit = glyphs.get(key);
  if (hit) return hit;
  const stroke = outline && !icon ? BASE * 0.14 : 0;
  const adv = advance(ch, weight) * BASE;
  const cw = Math.ceil(adv + stroke + PAD * 2);
  const ch_ = Math.ceil(BASE * 1.3 + stroke + PAD * 2);
  if (shelfX + cw > SIZE) {
    shelfX = 0;
    shelfY += shelfH + 1;
    shelfH = 0;
  }
  if (shelfY + ch_ > SIZE) {
    // Atlas plein (très rare) : on repart de zéro, les textes affichés se redessinent
    reset();
    return glyph(ch, weight, outline);
  }
  const x = shelfX;
  const y = shelfY;
  shelfX += cw + 1;
  shelfH = Math.max(shelfH, ch_);
  const ox = PAD + stroke / 2;
  const oy = ch_ / 2;
  if (icon) {
    // Icône du jeu : dessin vectoriel (mêmes tracés que les SVG de l'interface PC)
    const size = ICON_SIZE * BASE;
    drawIcon(ctx, icon, x + ox + (adv - size) / 2, y + oy - size / 2, size);
  } else {
    ctx.font = fontOf(weight);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    if (outline) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = stroke;
      ctx.strokeStyle = 'rgba(15,10,5,0.75)';
      ctx.strokeText(ch, x + ox, y + oy);
    }
    ctx.fillStyle = TINT_BASE;
    ctx.fillText(ch, x + ox, y + oy);
  }
  dirty = true;
  const g: Glyph = {
    u0: x / SIZE,
    u1: (x + cw) / SIZE,
    v0: 1 - (y + ch_) / SIZE,
    v1: 1 - y / SIZE,
    w: cw / BASE,
    h: ch_ / BASE,
    ox: ox / BASE,
    oy: oy / BASE,
    colored: !!icon,
  };
  glyphs.set(key, g);
  return g;
}

/** Envoie l'atlas au GPU s'il a changé (une fois par image au plus) */
export function flushAtlas() {
  if (!dirty || !texture) return;
  dirty = false;
  texture.needsUpdate = true;
}
