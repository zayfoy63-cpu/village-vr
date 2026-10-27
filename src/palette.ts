// Palette unique du jeu : 16 couleurs inspirées des miniatures et livres d'heures médiévaux
// (pigments chauds un peu désaturés : terres, ocres, verts mousse, rouge brique, bleu guède).
// Tout le jeu — matériaux 3D, sol, végétation, interface PC et VR, icônes — n'utilise que ces couleurs.
// Les nuances (ombre, lumière, variations d'une maison à l'autre) en dérivent par l'éclairage ou par
// un léger décalage de luminosité, jamais par une nouvelle teinte.

export const PAL = {
  /** Encre brun-noir : traits, textes, contours */
  ink: '#2e1f14',
  /** Terre d'ombre : bois sombre, troncs, portes */
  umber: '#5a3b26',
  /** Bois : planches, rondins */
  wood: '#8c5b35',
  /** Ocre jaune : chaume, or terni, flammes */
  ochre: '#c08a3e',
  /** Paille : blé, lumière des fenêtres */
  straw: '#dcb965',
  /** Parchemin : papier, enduit */
  parchment: '#e8d6b0',
  /** Os : blanc cassé, neige, texte clair */
  bone: '#f3e9d2',
  /** Rouge brique : toits, tuiles, danger */
  brick: '#a8492f',
  /** Garance sombre : toits bordeaux, sceaux de cire */
  madder: '#742c28',
  /** Vert mousse : herbe, haies */
  moss: '#6e8139',
  /** Vert forêt : sapins, feuillage sombre */
  forest: '#3d5a2d',
  /** Vert sauge : herbe claire, lichen */
  sage: '#a3ad6c',
  /** Pierre : murs, rochers */
  stone: '#8e897b',
  /** Ardoise : toits d'ardoise, fer, nuit */
  slate: '#4d5761',
  /** Bleu guède : eau, toits bleus, manteaux */
  woad: '#4b6a8a',
  /** Givre : glace, ciel de nuit, reflets */
  frost: '#a8bfca',
} as const;

export type PalKey = keyof typeof PAL;

/** Couleur de la palette avec une opacité (CSS) */
export function palAlpha(key: PalKey, alpha: number): string {
  const h = PAL[key];
  const n = parseInt(h.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Publie la palette en variables CSS (--pal-ink…) pour l'interface PC : une seule source */
export function applyPaletteCss(root: HTMLElement = document.documentElement) {
  for (const [k, v] of Object.entries(PAL)) root.style.setProperty(`--pal-${k}`, v);
}

/**
 * Blanc neutre technique : base des matériaux teintés par instance ou par sommet (multiplié par une
 * couleur de la palette, jamais affiché tel quel).
 */
export const TINT_BASE = '#ffffff';
