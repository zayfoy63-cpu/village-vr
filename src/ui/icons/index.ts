// Icônes du jeu : une seule source (defs.ts) pour l'interface PC (SVG dans le DOM) et l'interface 3D
// VR (dessinées dans l'atlas de caractères partagé). Aucun emoji : leur rendu dépend des polices du
// système (carrés vides sous Windows pour les plus récents).
//
// Dans les textes, une icône est un caractère de la zone à usage privé d'Unicode (jeton) : `I.wood`.
// Le DOM les remplace par des SVG (<RichText>), l'atlas VR par le dessin correspondant.

import { ICON_DEFS, type IconDef } from './defs';

export type IconId = keyof typeof ICON_DEFS;
export { ICON_DEFS };

const IDS = Object.keys(ICON_DEFS) as IconId[];
const BASE = 0xe000;

/** Jetons d'icônes à insérer dans les textes : `${I.wood} Bois` */
export const I = Object.fromEntries(IDS.map((id, i) => [id, String.fromCharCode(BASE + i)])) as Record<IconId, string>;

/** Expression qui trouve les jetons d'icônes dans un texte */
export const ICON_TOKEN = /[-]/g;

/** Icône d'un jeton (undefined si ce n'est pas un jeton) */
export function iconOf(ch: string): IconId | undefined {
  if (ch.length !== 1) return undefined;
  const k = ch.charCodeAt(0) - BASE;
  return k >= 0 && k < IDS.length ? IDS[k] : undefined;
}

export function iconDef(id: IconId): IconDef {
  return ICON_DEFS[id];
}

/** Texte sans icônes (infobulles natives, aria) : chaque icône devient son nom */
export function plainText(text: string): string {
  return text
    .replace(ICON_TOKEN, (ch) => {
      const id = iconOf(ch);
      return id ? ICON_DEFS[id].name : '';
    })
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// --- Dessin sur canvas (atlas VR) ----------------------------------------------------------------

const OUTLINE = '#2b1d12';
let paths: Map<string, Path2D> | null = null;

function path(d: string): Path2D {
  paths ??= new Map();
  let p = paths.get(d);
  if (!p) {
    p = new Path2D(d);
    paths.set(d, p);
  }
  return p;
}

/** Dessine une icône dans un carré de `size` pixels dont le coin haut-gauche est (x, y) */
export function drawIcon(ctx: CanvasRenderingContext2D, id: IconId, x: number, y: number, size: number) {
  const k = size / 24;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const s of ICON_DEFS[id].shapes) {
    const p = path(s.d);
    if (s.fill === 'none') {
      // Trait : liseré sombre puis couleur
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = (s.w ?? 2) + 1.4;
      ctx.stroke(p);
      ctx.strokeStyle = s.stroke ?? OUTLINE;
      ctx.lineWidth = s.w ?? 2;
      ctx.stroke(p);
    } else {
      ctx.fillStyle = s.fill;
      ctx.fill(p);
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.1;
      ctx.stroke(p);
    }
  }
  ctx.restore();
}

/** Contour sombre commun (SVG du DOM) */
export const ICON_OUTLINE = OUTLINE;
