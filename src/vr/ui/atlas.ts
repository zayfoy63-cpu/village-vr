// Atlas unique de caractères pour toute l'interface 3D : chaque caractère (lettres accentuées,
// chiffres) est dessiné une seule fois en blanc sur un grand canvas partagé, et chaque icône du jeu
// (src/ui/icons, jetons dans les textes) une seule fois en couleur. Tous les textes sont des
// quadrilatères qui pointent dans cet atlas. Couleur du texte = couleur de sommet.
// Une seule texture, quel que soit le nombre de textes affichés.

import * as THREE from 'three';
import { drawIcon, iconOf } from '../../ui/icons';
import { PAL, TINT_BASE } from '../../palette';

/**
 * Polices embarquées (fichiers du jeu, aucun chargement extérieur) : une humane très lisible pour
 * les textes et les chiffres, une « plume » pour les titres (chiffres modernes : ceux de la police
 * de titres sont anciens et peu lisibles).
 */
export const FONT = "'Alegreya Sans', 'Segoe UI', Roboto, 'Noto Sans', sans-serif";
export const TITLE_FONT = "'Titre chiffres', 'IM Fell English', Georgia, serif";
export type FontKind = 'body' | 'title';

/** Taille de police dans l'atlas (pixels par em) */
const BASE = 64;
const SIZE = 2048;
const PAD = 8;
/** Grain du papier (fonds de panneaux et de boutons) : carré en haut à gauche de l'atlas */
const GRAIN = 128;
/** Bloc blanc plein (bordures), à droite du grain */
const WHITE = 32;
const WHITE_X = GRAIN + PAD;

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

/** Papier : marbrures douces + fibres, en gris très clair (multiplié par la couleur du fond) */
function drawGrain() {
  const img = ctx.createImageData(GRAIN, GRAIN);
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // Bruit grossier (8x8) interpolé, plus un bruit fin
  const N = 9;
  const coarse = Array.from({ length: N * N }, rand);
  const at = (i: number, j: number) => coarse[(j % N) * N + (i % N)];
  for (let y = 0; y < GRAIN; y++) {
    for (let x = 0; x < GRAIN; x++) {
      const fx = (x / GRAIN) * (N - 1);
      const fy = (y / GRAIN) * (N - 1);
      const i = Math.floor(fx);
      const j = Math.floor(fy);
      const tx = fx - i;
      const ty = fy - j;
      const c = (at(i, j) * (1 - tx) + at(i + 1, j) * tx) * (1 - ty) + (at(i, j + 1) * (1 - tx) + at(i + 1, j + 1) * tx) * ty;
      const v = 255 - c * 16 - rand() * 9;
      const k = (y * GRAIN + x) * 4;
      img.data[k] = v;
      img.data[k + 1] = v - 1;
      img.data[k + 2] = v - 4;
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // Quelques fibres
  ctx.strokeStyle = 'rgba(90,59,38,0.07)';
  ctx.lineWidth = 1;
  for (let f = 0; f < 40; f++) {
    const x = rand() * GRAIN;
    const y = rand() * GRAIN;
    const a = rand() * Math.PI;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(Math.min(GRAIN - 1, Math.max(0, x + Math.cos(a) * 9)), Math.min(GRAIN - 1, Math.max(0, y + Math.sin(a) * 9)));
    ctx.stroke();
  }
}

function reset() {
  if (!texture) return;
  ctx.clearRect(0, 0, SIZE, SIZE);
  drawGrain();
  ctx.fillStyle = TINT_BASE;
  ctx.fillRect(WHITE_X, 0, WHITE, WHITE);
  glyphs.clear();
  shelfX = WHITE_X + WHITE + PAD;
  shelfY = 0;
  shelfH = GRAIN;
  dirty = true;
  generation++;
}

/** Coordonnée de texture d'un pixel blanc plein */
export const WHITE_UV: [number, number] = [(WHITE_X + WHITE / 2) / SIZE, 1 - WHITE / 2 / SIZE];
/** Zone du grain de papier : (u0, v0, u1, v1), marge d'un pixel */
export const GRAIN_UV: [number, number, number, number] = [2 / SIZE, 1 - (GRAIN - 2) / SIZE, (GRAIN - 2) / SIZE, 1 - 2 / SIZE];

const fontOf = (weight: number, font: FontKind = 'body') => `${font === 'title' ? 400 : weight} ${BASE}px ${font === 'title' ? TITLE_FONT : FONT}`;

/**
 * Les polices embarquées se chargent à la demande : dès qu'elles sont prêtes, l'atlas repart de zéro
 * et tous les textes se redessinent avec elles (mesures comprises).
 */
let fontsAsked = false;
function loadFonts() {
  if (fontsAsked || typeof document === 'undefined' || !document.fonts) return;
  fontsAsked = true;
  const faces = [`400 ${BASE}px 'Alegreya Sans'`, `500 ${BASE}px 'Alegreya Sans'`, `700 ${BASE}px 'Alegreya Sans'`, `400 ${BASE}px 'IM Fell English'`, `400 ${BASE}px 'Titre chiffres'`];
  void Promise.all(faces.map((f) => document.fonts.load(f, 'Aé1'))).then(() => {
    advances.clear();
    reset();
  });
}

// --- Mesures (sans toucher à l'atlas) ---------------------------------------------------------

const advances = new Map<string, number>();
const measureCtx = document.createElement('canvas').getContext('2d')!;

/** Avance d'un caractère, en em */
export function advance(ch: string, weight: number, font: FontKind = 'body'): number {
  // Icône du jeu : un carré d'un peu plus d'un em
  if (iconOf(ch)) return ICON_ADVANCE;
  loadFonts();
  const key = `${font}|${weight}|${ch}`;
  let a = advances.get(key);
  if (a === undefined) {
    measureCtx.font = fontOf(weight, font);
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
export function lineWidth(text: string, weight: number, font: FontKind = 'body'): number {
  let w = 0;
  for (const g of graphemes(text)) w += advance(g, weight, font);
  return w;
}

// --- Atlas ------------------------------------------------------------------------------------

/**
 * Caractère dans l'atlas (dessiné à la première demande). `outline` : 'dark' = liseré d'encre autour
 * d'un texte clair ; 'halo' = contour seul (sans la lettre), teinté couleur papier sous un texte sombre.
 */
export function glyph(ch: string, weight: number, outline: false | 'dark' | 'halo', font: FontKind = 'body'): Glyph {
  atlasTexture();
  const icon = iconOf(ch);
  // Une icône est dessinée une seule fois, quel que soit le style du texte qui l'entoure
  const key = icon ? `icon|${ch}` : `${font}|${weight}|${outline || 0}|${ch}`;
  const hit = glyphs.get(key);
  if (hit) return hit;
  const stroke = outline && !icon ? BASE * (outline === 'halo' ? 0.2 : 0.14) : 0;
  const adv = advance(ch, weight, font) * BASE;
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
    return glyph(ch, weight, outline, font);
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
    ctx.font = fontOf(weight, font);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    if (outline) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = stroke;
      ctx.strokeStyle = outline === 'halo' ? TINT_BASE : `${PAL.ink}c0`;
      ctx.strokeText(ch, x + ox, y + oy);
    }
    if (outline !== 'halo') {
      ctx.fillStyle = TINT_BASE;
      ctx.fillText(ch, x + ox, y + oy);
    }
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
