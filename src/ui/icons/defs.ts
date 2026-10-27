// Dessins des icônes du jeu (repère 24 x 24), façon enluminure : trait d'encre brune un peu
// tremblé, lavis de couleurs de la palette posé légèrement à côté du trait (comme colorié à la main).
// Une seule source : l'interface PC les affiche en SVG, l'interface VR les dessine dans l'atlas de
// caractères partagé (Path2D, mêmes tracés).

import { PAL, palMix } from '../../palette';

export interface Shape {
  /** Tracé SVG */
  d: string;
  /** Remplissage (« none » pour un trait seul) */
  fill: string;
  /** Trait coloré (lignes) ; sinon contour sombre fin */
  stroke?: string;
  w?: number;
}

export interface IconDef {
  /** Nom affiché au survol (ressources) et dans les textes accessibles */
  name: string;
  shapes: Shape[];
}

// --- Petits outils de dessin -----------------------------------------------------------------

/** Main levée : chaque sommet bouge un peu, toujours de la même façon pour un même point */
const shaky = (pts: string) =>
  pts
    .trim()
    .split(/\s+/)
    .map((pt) => {
      const [x, y] = pt.split(',').map(Number);
      const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const k = Math.sin(x * 39.346 + y * 11.135) * 24634.6345;
      const dx = (h - Math.floor(h) - 0.5) * 0.6;
      const dy = (k - Math.floor(k) - 0.5) * 0.6;
      return `${+(x + dx).toFixed(2)},${+(y + dy).toFixed(2)}`;
    });

/** Polygone fermé : "x,y x,y …" */
const p = (pts: string, fill: string): Shape => ({ d: `M${shaky(pts).join('L')}Z`, fill });
/** Cercle */
const c = (cx: number, cy: number, r: number, fill: string): Shape => ({
  d: `M${cx - r},${cy}a${r},${r} 0 1,0 ${r * 2},0a${r},${r} 0 1,0 ${-r * 2},0Z`,
  fill,
});
/** Ellipse */
const e = (cx: number, cy: number, rx: number, ry: number, fill: string): Shape => ({
  d: `M${cx - rx},${cy}a${rx},${ry} 0 1,0 ${rx * 2},0a${rx},${ry} 0 1,0 ${-rx * 2},0Z`,
  fill,
});
/** Rectangle */
const r = (x: number, y: number, w: number, h: number, fill: string): Shape => p(`${x},${y} ${x + w},${y} ${x + w},${y + h} ${x},${y + h}`, fill);
/** Trait (ligne brisée ou tracé libre) */
const l = (d: string, stroke: string, w = 2): Shape => ({ d: d.includes('M') ? d : `M${shaky(d).join('L')}`, fill: 'none', stroke, w });

// --- Palette -----------------------------------------------------------------------------------

const K = {
  wood: palMix('ochre', 'brick', 0.5),
  woodDark: PAL.wood,
  woodLight: palMix('ochre', 'parchment', 0.5),
  stone: palMix('bone', 'woad', 0.5),
  stoneDark: palMix('stone', 'woad', 0.5),
  stoneLight: palMix('bone', 'frost', 0.5),
  gold: PAL.straw,
  goldDark: PAL.ochre,
  wheat: PAL.straw,
  wheatDark: PAL.ochre,
  green: PAL.moss,
  greenDark: PAL.moss,
  greenLight: PAL.sage,
  red: PAL.brick,
  redDark: PAL.brick,
  blue: PAL.woad,
  blueDark: PAL.woad,
  blueLight: PAL.frost,
  white: PAL.bone,
  cream: palMix('parchment', 'bone', 0.5),
  skin: palMix('ochre', 'bone', 0.5),
  dark: palMix('ink', 'woad', 0.5),
  iron: palMix('bone', 'frost', 0.5),
  orange: PAL.ochre,
  yellow: PAL.straw,
  purple: PAL.woad,
  face: PAL.straw,
  faceDark: PAL.straw,
};

// Visages (moral, maladie) : cercle à deux facettes, yeux, bouche
const face = (base: string = K.face, shade: string = K.faceDark): Shape[] => [
  c(12, 12, 9.5, base),
  // Croissant d'ombre sur le côté droit (facette)
  { d: 'M12,2.5A9.5,9.5 0 0,1 12,21.5A11,11 0 0,0 12,2.5Z', fill: shade },
];
const eyes = (y = 10.2): Shape[] => [c(8.6, y, 1.3, K.dark), c(15.4, y, 1.3, K.dark)];

// Bâtiment générique : murs + toit
const wallsRoof = (wall: string, roof: string, roofDark: string): Shape[] => [
  p('5,12 19,12 19,21 5,21', wall),
  p('3,12.5 12,4 21,12.5', roof),
  p('12,4 21,12.5 12,12.5', roofDark),
];

// Main ouverte (paume vers soi) ; `mirror` pour l'autre main
const hand = (mirror = false): Shape[] => {
  const m = (pts: string) => (mirror ? pts.replace(/(\d+(?:\.\d+)?),/g, (_, x) => `${24 - Number(x)},`) : pts);
  return [
    p(m('7,21 6,13 4.5,9.5 6.5,8.8 8.5,12 8.5,5 10.5,4.6 11.2,11 11.5,3.8 13.6,3.8 13.8,11 14.6,4.8 16.6,5.2 16.4,12 17.6,8 19.5,8.6 18.4,15 16,21'), K.skin),
    p(m('8.5,16 16,16 16,21 7,21'), palMix('ochre', 'parchment', 0.5)),
  ];
};

export const ICON_DEFS = {
  // ---------------------------------------------------------------- Ressources
  wheat: {
    name: 'Blé',
    shapes: [
      l('12,22.5 12,7', K.wheatDark, 2),
      ...[5.5, 9.5, 13.5].flatMap((y) => [p(`12,${y + 3.5} 7.2,${y + 1.6} 6,${y - 1.6} 11,${y}`, K.wheat), p(`12,${y + 3.5} 16.8,${y + 1.6} 18,${y - 1.6} 13,${y}`, K.wheatDark)]),
      p('12,6.5 10.2,3.6 12,1 13.8,3.6', K.wheat),
    ],
  },
  wood: {
    name: 'Bois',
    shapes: [
      p('5.5,7.5 19.5,3.5 22.5,12 8.5,16.5', K.wood),
      p('8.5,16.5 22.5,12 23,14.5 9,19', K.woodDark),
      e(6.2, 12.6, 4.2, 5.2, K.woodLight),
      e(6.2, 12.6, 2, 2.5, K.wood),
      p('14,5.4 15.6,1.5 17.4,2 16.4,4.8', K.greenDark),
    ],
  },
  stone: {
    name: 'Pierre',
    shapes: [
      p('2.5,18 5.5,9.5 11.5,5 18.5,7.5 21.5,15.5 16,20 7,20.5', K.stone),
      p('11.5,5 18.5,7.5 21.5,15.5 14,12', K.stoneLight),
      p('2.5,18 7,20.5 16,20 21.5,15.5 14,12 8,14', K.stoneDark),
    ],
  },
  gold: {
    name: 'Or',
    shapes: [c(12, 12, 9, K.gold), p('12,3 21,12 12,21 16.5,12', K.goldDark), c(12, 12, 5.4, PAL.straw), p('10.5,8 13.5,8 13.5,16 10.5,16', K.goldDark)],
  },
  flour: {
    name: 'Farine',
    shapes: [
      p('6,9 8,5.5 16,5.5 18,9 19.5,20 4.5,20', K.white),
      p('12,9 18,9 19.5,20 12,20', K.cream),
      p('7.5,8.6 16.5,8.6 16,10.2 8,10.2', palMix('ochre', 'parchment', 0.5)),
      p('12,12 10.5,15 12,18 13.5,15', K.wheat),
    ],
  },
  bread: {
    name: 'Pain',
    shapes: [
      p('2.5,15 4,9.5 9,6.5 15,6.5 20,9.5 21.5,15 19,18 5,18', PAL.ochre),
      p('2.5,15 5,18 19,18 21.5,15', palMix('ochre', 'brick', 0.5)),
      l('7.5,9.5 9.5,13', palMix('straw', 'parchment', 0.5), 1.6),
      l('11.5,8.6 13,12.4', palMix('straw', 'parchment', 0.5), 1.6),
      l('15.5,9.2 16.5,12.8', palMix('straw', 'parchment', 0.5), 1.6),
    ],
  },
  planks: {
    name: 'Planches',
    shapes: [
      p('3,16 17,12.5 21,14.5 7,18.5', K.woodLight),
      p('3,16 7,18.5 7,20.5 3,18', K.woodDark),
      p('7,18.5 21,14.5 21,16.5 7,20.5', K.wood),
      p('3,11 17,7.5 21,9.5 7,13.5', K.woodLight),
      p('3,11 7,13.5 7,15.5 3,13', K.woodDark),
      p('7,13.5 21,9.5 21,11.5 7,15.5', K.wood),
    ],
  },
  ironOre: {
    name: 'Minerai de fer',
    shapes: [
      p('3,17 5.5,9 11,5.5 18,7 21,14 16.5,19.5 8,20', PAL.slate),
      p('11,5.5 18,7 21,14 13.5,11.5', palMix('stone', 'woad', 0.5)),
      p('7,11 9.5,9.5 10.5,12 8,13', palMix('ochre', 'brick', 0.5)),
      p('14,14 17,13 16.5,16 14.5,16.5', palMix('ochre', 'brick', 0.5)),
      p('12,7.5 14,7 13.5,9', K.iron),
    ],
  },
  tools: {
    name: 'Outils',
    shapes: [
      p('5,20.5 3.5,19 14,8.5 15.5,10', K.wood),
      p('11.5,4.5 17,2.5 21.5,7 19.5,12.5 15,8', K.stoneDark),
      p('20.5,20.5 19,22 8.5,11.5 10,10', K.woodDark),
      p('3,7 7,3 9.5,5.5 7.5,6.5 8.5,8.5 6.5,9.5 5.5,7.5', K.iron),
    ],
  },
  weapons: {
    name: 'Armes',
    shapes: [
      p('4,4 6,3.5 18,15.5 16.5,17', K.iron),
      p('20,4 18,3.5 6,15.5 7.5,17', K.stoneLight),
      p('14.5,14 18.5,18 17,19.5 13,15.5', K.gold),
      p('9.5,14 5.5,18 7,19.5 11,15.5', K.gold),
      c(19.5, 20, 1.6, K.woodDark),
      c(4.5, 20, 1.6, K.woodDark),
    ],
  },

  // ---------------------------------------------------------------- Saisons
  spring: {
    name: 'Printemps',
    shapes: [
      p('3,20 7,16.5 17,16.5 21,20', K.woodDark),
      l('12,17 12,10', K.greenDark, 1.8),
      p('12,11 6,9.5 4.5,5 9.5,6', K.green),
      p('12,10 18,7 20.5,3 14.5,4', K.greenLight),
    ],
  },
  summer: {
    name: 'Été',
    shapes: [
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const a = (i * Math.PI) / 4;
        const f = (k: number, d: number) => `${(12 + Math.cos(a + k) * d).toFixed(2)},${(12 + Math.sin(a + k) * d).toFixed(2)}`;
        return p(`${f(-0.28, 7.2)} ${f(0, 11.3)} ${f(0.28, 7.2)}`, K.orange);
      }),
      c(12, 12, 6, K.yellow),
      p('12,6 18,12 12,18 15,12', K.gold),
    ],
  },
  autumn: {
    name: 'Automne',
    shapes: [
      p('12,2.5 14.5,7.5 19.5,6 18,11 22,13.5 16.5,15.5 17,20 12,17.5 7,20 7.5,15.5 2,13.5 6,11 4.5,6 9.5,7.5', K.orange),
      p('12,2.5 14.5,7.5 19.5,6 18,11 22,13.5 16.5,15.5 17,20 12,17.5', palMix('ochre', 'brick', 0.5)),
      l('12,22 12,8', K.woodDark, 1.4),
    ],
  },
  winter: {
    name: 'Hiver',
    shapes: [
      ...[0, 60, 120].map((deg) => {
        const a = (deg * Math.PI) / 180;
        const x = Math.cos(a) * 9.5;
        const y = Math.sin(a) * 9.5;
        return l(`${(12 - x).toFixed(2)},${(12 - y).toFixed(2)} ${(12 + x).toFixed(2)},${(12 + y).toFixed(2)}`, K.blueLight, 2.2);
      }),
      c(12, 12, 2.4, K.white),
    ],
  },

  // ---------------------------------------------------------------- Bâtiments et onglets
  house: { name: 'Maison', shapes: [...wallsRoof(K.cream, K.red, K.redDark), r(10.2, 15.5, 3.6, 5.5, K.woodDark), r(15, 14, 2.6, 2.6, K.yellow), r(6.4, 14, 2.6, 2.6, K.yellow)] },
  hut: {
    name: 'Cabane',
    shapes: [p('5.5,13 18.5,13 18.5,21 5.5,21', K.wood), p('2.5,14 12,4 21.5,14', K.wheat), p('12,4 21.5,14 12,14', K.wheatDark), r(10.3, 15.5, 3.4, 5.5, K.woodDark)],
  },
  townhouse: {
    name: 'Maison bourgeoise',
    shapes: [
      p('3,11 10,11 10,21 3,21', K.cream),
      p('2,11.5 6.5,6 11,11.5', palMix('slate', 'woad', 0.5)),
      p('10,8 20,8 20,21 10,21', K.stoneLight),
      p('9,8.5 15,2.5 21,8.5', palMix('slate', 'woad', 0.5)),
      p('15,2.5 21,8.5 15,8.5', palMix('ink', 'woad', 0.5)),
      r(12, 11, 2.5, 2.5, K.yellow),
      r(15.6, 11, 2.5, 2.5, K.yellow),
      r(13.6, 16, 2.8, 5, K.woodDark),
      r(5, 14, 2.4, 2.4, K.yellow),
    ],
  },
  manor: {
    name: 'Manoir',
    shapes: [
      p('2.5,12 21.5,12 21.5,21 2.5,21', K.cream),
      p('1.5,12.5 6,8 18,8 22.5,12.5', PAL.madder),
      p('7,8.5 12,3 17,8.5', PAL.madder),
      ...[4.5, 9, 13.2, 17.5].map((x) => r(x, 14, 2.2, 3, K.yellow)),
      r(10.6, 17.5, 2.8, 3.5, K.woodDark),
    ],
  },
  castle: {
    name: 'Château',
    shapes: [
      p('6,10 18,10 18,21 6,21', K.stone),
      p('6,10 7.5,7.5 9,10 10.5,7.5 12,10 13.5,7.5 15,10 16.5,7.5 18,10', K.stone),
      p('2,11 6,11 6,21 2,21', K.stoneDark),
      p('18,11 22,11 22,21 18,21', K.stoneDark),
      p('1.5,11.5 4,5 6.5,11.5', K.blue),
      p('17.5,11.5 20,5 22.5,11.5', K.blue),
      p('9.8,21 9.8,16 12,14 14.2,16 14.2,21', K.woodDark),
      l('12,7.5 12,2.5', K.woodDark, 1.2),
      p('12,2.5 15.5,3.6 12,4.8', K.red),
    ],
  },
  windmill: {
    name: 'Moulin',
    shapes: [
      p('8.5,22 10.5,10 13.5,10 15.5,22', K.cream),
      p('12,10 13.5,10 15.5,22 12,22', PAL.parchment),
      p('10,10.5 12,7.5 14,10.5', K.redDark),
      p('12,9 4,3 3,5 11,10.5', K.white),
      p('12,9 20,3 21,5 13,10.5', PAL.bone),
      p('12,9 3.5,14.5 4.5,16 12.5,10.5', PAL.bone),
      p('12,9 20.5,14.5 19.5,16 11.5,10.5', K.white),
      c(12, 9, 1.3, K.woodDark),
    ],
  },
  craft: {
    name: 'Artisanat',
    shapes: [
      p('4,21 2.5,19.5 15.5,6.5 17,8', K.wood),
      p('20,21 21.5,19.5 8.5,6.5 7,8', K.woodDark),
      p('11.5,3 17,2.5 21,6 20,7.5 16.5,5.5 13,6', K.iron),
      p('3,7.5 4.5,2.5 9.5,4 8,9.5', K.stoneDark),
    ],
  },
  scales: {
    name: 'Balance',
    shapes: [
      p('11,5 13,5 13,19 11,19', K.goldDark),
      p('7,19 17,19 18,21.5 6,21.5', K.goldDark),
      p('3,6.5 21,6.5 21,8 3,8', K.gold),
      l('M5,8 L2.5,14 M5,8 L7.5,14', K.goldDark, 1.1),
      l('M19,8 L16.5,14 M19,8 L21.5,14', K.goldDark, 1.1),
      p('1.5,14 8.5,14 7,16.5 3,16.5', K.gold),
      p('15.5,14 22.5,14 21,16.5 17,16.5', K.gold),
      c(12, 4.5, 1.6, K.gold),
    ],
  },
  shield: {
    name: 'Bouclier',
    shapes: [
      p('4,4 20,4 20,12 12,21.5 4,12', K.blue),
      p('12,4 20,4 20,12 12,21.5', K.blueDark),
      p('10.7,5.5 13.3,5.5 13.3,10 18,10 18,12.5 13.3,12.5 13.3,18.5 12,20 10.7,18.5 10.7,12.5 6,12.5 6,10 10.7,10', K.gold),
    ],
  },
  axe: {
    name: 'Hache',
    shapes: [p('5,22 3,20.5 15,7 17,8.5', K.wood), p('12.5,3 18.5,2.5 22,8.5 18.5,12 15.5,8', K.iron), p('18.5,2.5 22,8.5 18.5,12 19,7', K.stoneDark)],
  },
  pickaxe: {
    name: 'Pioche',
    shapes: [p('6,22 4,20.5 15.5,6.5 17.5,8', K.wood), p('4,6 9,3.5 15.5,3.5 21,6 20,7.5 15.5,6 9.5,6 5,8', K.iron), p('21,6 20,7.5 17,6.3', K.stoneDark)],
  },
  barn: {
    name: 'Grenier',
    shapes: [
      p('4,11 20,11 20,21 4,21', K.red),
      p('12,11 20,11 20,21 12,21', K.redDark),
      p('2.5,11.5 7,5 17,5 21.5,11.5', palMix('umber', 'brick', 0.5)),
      p('8.5,13.5 15.5,13.5 15.5,21 8.5,21', K.cream),
      l('M8.5,13.5 L15.5,21 M15.5,13.5 L8.5,21', K.red, 1.4),
    ],
  },
  baguette: {
    name: 'Boulangerie',
    shapes: [
      p('3,17.5 16.5,4 20.5,3.5 20,7.5 6.5,21 3.5,20.5', PAL.ochre),
      p('3,17.5 3.5,20.5 6.5,21 20,7.5 18,8', palMix('ochre', 'brick', 0.5)),
      l('8,15.5 10,17', palMix('straw', 'parchment', 0.5), 1.5),
      l('11.5,12 13.5,13.5', palMix('straw', 'parchment', 0.5), 1.5),
      l('15,8.5 17,10', palMix('straw', 'parchment', 0.5), 1.5),
    ],
  },
  saw: {
    name: 'Scierie',
    shapes: [
      p('5,12 19.5,7.5 21,10.5 6.5,16.5 5.5,15 4.5,14.5', K.iron),
      p('6.5,16.5 21,10.5 20,12.5 7.5,17.5', K.stoneDark),
      p('2,13 5,10.5 8,16 5,18.5', K.wood),
    ],
  },
  hammer: {
    name: 'Forge',
    shapes: [p('5,22 3,20 14,9 16,11', K.wood), p('10,6.5 15.5,1.5 22,8 16.5,13', K.stoneDark), p('15.5,1.5 22,8 19.5,10.5 13,4', K.iron)],
  },
  tower: {
    name: 'Tour de garde',
    shapes: [
      p('8,8 16,8 17,21.5 7,21.5', K.stone),
      p('12,8 16,8 17,21.5 12,21.5', K.stoneDark),
      p('6.5,8.5 6.5,5.5 8.5,5.5 8.5,7 10.8,7 10.8,5.5 13.2,5.5 13.2,7 15.5,7 15.5,5.5 17.5,5.5 17.5,8.5', K.stone),
      r(11, 11, 2, 3, K.dark),
      l('12,5.5 12,1.5', K.woodDark, 1.2),
      p('12,1.5 16,2.6 12,3.7', K.red),
    ],
  },
  bucket: {
    name: 'Puits',
    shapes: [
      l('M5,9 C5,1.5 19,1.5 19,9', K.dark, 1.4),
      p('4,9 20,9 17.5,21 6.5,21', K.stone),
      p('12,9 20,9 17.5,21 12,21', K.stoneDark),
      e(12, 9, 8, 2, K.blueLight),
    ],
  },
  herb: {
    name: 'Herboriste',
    shapes: [
      l('M6,21 C10,16 13,10 18,3', K.greenDark, 1.6),
      p('8.5,17 4,15 3,11 7.5,13', K.green),
      p('11,13 7,9.5 7,5.5 11,9', K.greenLight),
      p('11.5,14 16,13.5 19,16.5 14,16.5', K.green),
      p('14.5,9 18.5,8 21.5,10.5 16.5,11', K.greenLight),
    ],
  },
  sheep: {
    name: 'Bergerie',
    shapes: [
      l('M8,16 L8,21 M11,16 L11,21 M14.5,16 L14.5,21 M17,16 L17,21', K.dark, 1.6),
      c(9, 12.5, 4, K.white),
      c(13, 11, 4.5, K.white),
      c(16.5, 13.5, 3.5, PAL.bone),
      c(11.5, 15, 3.5, PAL.bone),
      p('2,10 6,8.5 7.5,12.5 4,14', K.dark),
    ],
  },
  bricks: {
    name: 'Digue',
    shapes: [
      r(2.5, 5, 9, 4.5, K.red),
      r(12.5, 5, 9, 4.5, K.redDark),
      r(2.5, 10.5, 4, 4.5, K.redDark),
      r(7.5, 10.5, 9, 4.5, K.red),
      r(17.5, 10.5, 4, 4.5, K.redDark),
      r(2.5, 16, 9, 4.5, K.red),
      r(12.5, 16, 9, 4.5, K.redDark),
    ],
  },
  palisade: {
    name: 'Palissade',
    shapes: [
      ...[3, 8, 13, 18].map((x, i) => p(`${x},21 ${x},7 ${x + 1.5},3.5 ${x + 3},7 ${x + 3},21`, i % 2 ? K.woodDark : K.wood)),
      r(1.5, 12, 21, 2.2, K.woodLight),
    ],
  },
  torch: {
    name: 'Torches',
    shapes: [
      p('10.5,11 13.5,11 12.8,22 11.2,22', K.woodDark),
      p('9,10 15,10 14,12.5 10,12.5', K.stoneDark),
      p('12,1.5 15.5,6 14.5,10 9.5,10 8.5,6', K.orange),
      p('12,4.5 13.8,7.2 13,10 11,10 10.2,7.2', K.yellow),
    ],
  },
  tombstone: {
    name: 'Cimetière',
    shapes: [
      p('3,21 21,21 21,22.5 3,22.5', K.greenDark),
      p('6,21 6,8 8,4.5 16,4.5 18,8 18,21', K.stone),
      p('12,4.5 16,4.5 18,8 18,21 12,21', K.stoneDark),
      p('11,8 13,8 13,10 15,10 15,12 13,12 13,17 11,17 11,12 9,12 9,10 11,10', K.stoneLight),
    ],
  },

  // ---------------------------------------------------------------- Visages (moral, santé)
  happy: { name: 'Content', shapes: [...face(), ...eyes(9.5), p('6.5,13 17.5,13 15.5,17.5 12,18.8 8.5,17.5', K.redDark)] },
  smile: { name: 'Correct', shapes: [...face(), ...eyes(), l('M7.5,14 Q12,18 16.5,14', K.dark, 1.6)] },
  worried: { name: 'Inquiet', shapes: [...face(), ...eyes(), l('M7.5,17 Q12,13.5 16.5,17', K.dark, 1.6), l('M6.5,7.5 L10,6.5 M17.5,7.5 L14,6.5', K.dark, 1.2)] },
  angry: {
    name: 'En colère',
    shapes: [...face(PAL.ochre, palMix('ochre', 'brick', 0.5)), ...eyes(11), l('M6.5,7.5 L10.5,9.5 M17.5,7.5 L13.5,9.5', K.dark, 1.5), l('M8,17 L16,17', K.dark, 1.6)],
  },
  furious: {
    name: 'Furieux',
    shapes: [...face(PAL.brick, PAL.brick), ...eyes(11), l('M6,7 L10.5,9.8 M18,7 L13.5,9.8', K.dark, 1.6), p('7.5,15 16.5,15 15.5,18.5 8.5,18.5', K.white)],
  },
  sick: { name: 'Malade', shapes: [...face(PAL.sage, PAL.sage), ...eyes(), l('M7,16 Q9,14 11,16 T15,16 T17,15.5', K.greenDark, 1.5)] },
  cold: { name: 'Gelé', shapes: [...face(PAL.frost, palMix('woad', 'frost', 0.5)), ...eyes(), p('7.5,14.5 16.5,14.5 16.5,17.5 7.5,17.5', K.white), l('M10.5,14.5 L10.5,17.5 M13.5,14.5 L13.5,17.5', K.blueDark, 1)] },
  injured: { name: 'Blessé', shapes: [...face(), ...eyes(), l('M8.5,15.5 L15.5,15.5', K.dark, 1.5), p('4,6.5 6,4 19.5,15.5 17.5,18', K.white), p('10,9 12,11 14,9.5 12,7.5', palMix('bone', 'brick', 0.5))] },
  mask: { name: 'Quarantaine', shapes: [...face(), ...eyes(8.8), p('5,12 19,12 18,17.5 12,19.5 6,17.5', K.white), l('M5,12 L2.5,10.5 M19,12 L21.5,10.5', K.white, 1.2)] },

  // ---------------------------------------------------------------- Événements, dangers, états
  skull: {
    name: 'Mort',
    shapes: [
      p('5,10 7,4.5 12,2.5 17,4.5 19,10 17,14.5 16,19 8,19 7,14.5', K.white),
      p('12,2.5 17,4.5 19,10 17,14.5 16,19 12,19', palMix('parchment', 'frost', 0.5)),
      c(9, 10.5, 2.2, K.dark),
      c(15, 10.5, 2.2, K.dark),
      p('12,13 13.2,15.5 10.8,15.5', K.dark),
      l('M9.5,19 L9.5,21.5 M12,19 L12,21.5 M14.5,19 L14.5,21.5', K.dark, 1.2),
    ],
  },
  gear: {
    name: 'Production',
    shapes: [
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const a = (i * Math.PI) / 4;
        const q = (k: number, d: number) => `${(12 + Math.cos(a + k) * d).toFixed(2)},${(12 + Math.sin(a + k) * d).toFixed(2)}`;
        return p(`${q(-0.22, 7)} ${q(-0.16, 10.5)} ${q(0.16, 10.5)} ${q(0.22, 7)}`, K.stoneDark);
      }),
      c(12, 12, 7.3, K.stone),
      c(12, 12, 2.8, palMix('umber', 'woad', 0.5)),
    ],
  },
  dagger: {
    name: 'Bandits',
    shapes: [p('19.5,2.5 21,4 9,16 7.5,14.5', K.iron), p('21,4 9,16 8.5,15.2 20.2,3.3', K.stoneDark), p('5,13 7,11 12,16 10,18', K.gold), p('3,21 2.5,19.5 7.5,15 8.5,16.5', K.woodDark)],
  },
  storm: {
    name: 'Orage',
    shapes: [
      p('3.5,13 5,8.5 9,7.5 11,4.5 16,4.5 18.5,7.5 21,9 21,13', palMix('stone', 'woad', 0.5)),
      p('3.5,13 21,13 19.5,15 5,15', PAL.slate),
      p('12,14 9,19 11.5,19 10,23 15.5,16.5 13,16.5 14.5,14', K.yellow),
    ],
  },
  luggage: {
    name: 'Réfugiés',
    shapes: [l('M9,7 L9,4.5 L15,4.5 L15,7', K.woodDark, 1.6), p('3,7 21,7 21,20 3,20', palMix('ochre', 'brick', 0.5)), p('12,7 21,7 21,20 12,20', K.woodDark), r(3, 12, 18, 2, K.gold)],
  },
  people: {
    name: 'Habitants',
    shapes: [
      c(15.5, 7.5, 3.6, palMix('ochre', 'bone', 0.5)),
      p('9,21 10,14.5 15.5,12 21,14.5 22,21', PAL.woad),
      c(8.5, 8.5, 3.8, K.skin),
      p('2,21 3,15 8.5,12.5 14,15 15,21', PAL.moss),
    ],
  },
  horse: {
    name: 'Marchand',
    shapes: [
      p('6,21 7,13 9.5,7 9,3 11.5,5 16,5.5 21,11 20,13.5 17,13 14,11.5 14.5,21', palMix('ochre', 'madder', 0.5)),
      p('9,3 11.5,5 9.5,7 7,13 6.5,9.5', K.woodDark),
      c(15, 8.5, 1, K.dark),
    ],
  },
  fire: {
    name: 'Incendie',
    shapes: [
      p('12,1.5 16,6.5 19,6 19.5,13 17,19.5 12,22 7,19.5 4.5,13 6,8.5 8.5,10.5 9,5.5', K.red),
      p('12,7 15,11.5 15.5,17 12,20 8.5,17 8.5,12.5 10.5,13.5', K.orange),
      p('12,12.5 13.8,15.5 13.2,18.5 12,19.3 10.8,18.5 10.2,15.5', K.yellow),
    ],
  },
  cactus: {
    name: 'Sécheresse',
    shapes: [
      p('3,21.5 21,21.5 19,19 5,19', K.wheatDark),
      p('9.5,19 9.5,5 12,3 14.5,5 14.5,19', K.green),
      p('12,3 14.5,5 14.5,19 12,19', K.greenDark),
      p('9.5,13 5.5,13 5,8 7,8 7.5,11 9.5,11', K.green),
      p('14.5,11 17,11 17.5,6 19.5,6 19,13 14.5,13', K.greenDark),
    ],
  },
  sunflower: {
    name: 'Récolte',
    shapes: [
      l('12,13 12,22', K.greenDark, 1.8),
      p('12,18 7,15.5 8.5,19.5', K.green),
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const a = (i * Math.PI) / 4;
        const q = (k: number, d: number) => `${(12 + Math.cos(a + k) * d).toFixed(2)},${(9 + Math.sin(a + k) * d).toFixed(2)}`;
        return p(`${q(-0.4, 3.5)} ${q(0, 8)} ${q(0.4, 3.5)}`, i % 2 ? K.yellow : K.gold);
      }),
      c(12, 9, 3.8, PAL.wood),
    ],
  },
  farmer: {
    name: 'Paysan',
    shapes: [
      p('4,21.5 5,16 12,13.5 19,16 20,21.5', PAL.woad),
      c(12, 9.5, 4.2, K.skin),
      p('3,7.5 21,7.5 18,9 6,9', K.wheat),
      p('7.5,7.5 9,3 15,3 16.5,7.5', K.wheatDark),
    ],
  },
  wilted: {
    name: 'Gâchis',
    shapes: [
      l('M9,22 C9,16 9,12 13,9', K.greenDark, 1.6),
      p('9,17 4.5,15.5 6.5,13', K.green),
      p('13,9 18.5,6 20,10 17,14 13.5,13', palMix('brick', 'madder', 0.5)),
      p('13,9 18.5,6 17,9.5', PAL.brick),
      p('17,14 16.5,17.5 15.5,15', palMix('brick', 'madder', 0.5)),
    ],
  },
  flood: {
    name: 'Crue',
    shapes: [
      p('2,13 5,10.5 8,13 11,10.5 14,13 17,10.5 20,13 22,11.5 22,21.5 2,21.5', K.blue),
      p('2,17 5,14.5 8,17 11,14.5 14,17 17,14.5 20,17 22,15.5 22,21.5 2,21.5', K.blueDark),
      p('2,8 5,5.5 8,8 11,5.5 14,8 17,5.5 20,8 22,6.5 22,9 20,10.5 17,8 14,10.5 11,8 8,10.5 5,8 2,10.5', K.blueLight),
    ],
  },
  rat: {
    name: 'Rats',
    shapes: [
      l('M3,16 C1,12 4,9 6,11', palMix('bone', 'madder', 0.5), 1.4),
      p('4.5,16.5 7,11 13,9 17.5,11 21.5,14.5 18,17 6,17.5', K.stone),
      p('13,9 17.5,11 21.5,14.5 15,14', K.stoneDark),
      c(15.5, 9, 2, palMix('bone', 'madder', 0.5)),
      c(18.5, 13, 0.9, K.dark),
    ],
  },
  eye: {
    name: 'Éclaireur',
    shapes: [p('1.5,12 6,7 12,5.5 18,7 22.5,12 18,17 12,18.5 6,17', K.white), c(12, 12, 4.5, K.blue), c(12, 12, 2, K.dark), c(13.2, 10.8, 0.9, K.white)],
  },
  wolf: {
    name: 'Loups',
    shapes: [
      p('4,3 9,8 15,8 20,3 20.5,11 18,16 12,21.5 6,16 3.5,11', palMix('stone', 'woad', 0.5)),
      p('12,8 15,8 20,3 20.5,11 18,16 12,21.5', PAL.slate),
      p('9,15 15,15 12,20', K.white),
      c(9, 11, 1.1, K.yellow),
      c(15, 11, 1.1, K.yellow),
      p('10.8,15.2 13.2,15.2 12,17', K.dark),
    ],
  },
  moneyBag: {
    name: 'Butin',
    shapes: [
      p('8,4 16,4 14,7.5 18.5,11 20,17 17,21 7,21 4,17 5.5,11 10,7.5', palMix('ochre', 'parchment', 0.5)),
      p('12,7.5 14,7.5 18.5,11 20,17 17,21 12,21', palMix('umber', 'straw', 0.5)),
      r(9, 6.5, 6, 1.8, K.woodDark),
      c(12, 14.5, 3.4, K.gold),
    ],
  },
  lock: { name: 'Verrouillé', shapes: [l('M7.5,11 L7.5,7.5 C7.5,1.5 16.5,1.5 16.5,7.5 L16.5,11', K.stoneDark, 2.2), p('4.5,11 19.5,11 19.5,21.5 4.5,21.5', K.gold), p('12,11 19.5,11 19.5,21.5 12,21.5', K.goldDark), r(11, 14.5, 2, 4, K.dark)] },
  unlock: { name: 'Débloqué', shapes: [l('M7.5,11 L7.5,7.5 C7.5,1.5 16.5,1.5 16.5,5', K.stoneDark, 2.2), p('4.5,11 19.5,11 19.5,21.5 4.5,21.5', K.gold), p('12,11 19.5,11 19.5,21.5 12,21.5', K.goldDark), r(11, 14.5, 2, 4, K.dark)] },
  worker: {
    name: 'Travailleurs',
    shapes: [p('4,21.5 5,16 12,13.5 19,16 20,21.5', K.orange), c(12, 10.5, 4.2, K.skin), p('6.5,9 7.5,5 12,3.5 16.5,5 17.5,9', K.yellow), p('5.5,9 18.5,9 18.5,10.5 5.5,10.5', K.gold)],
  },
  up: { name: 'Amélioration', shapes: [p('12,2.5 21,12 15.5,12 15.5,21.5 8.5,21.5 8.5,12 3,12', K.green), p('12,2.5 21,12 15.5,12 15.5,21.5 12,21.5', K.greenDark)] },
  tree: {
    name: 'Forêt',
    shapes: [r(10.8, 17, 2.4, 5, K.woodDark), p('12,1.5 18,9 15,9 20,15 4,15 9,9 6,9', K.green), p('12,1.5 18,9 15,9 20,15 12,15', K.greenDark), p('3.5,18 20.5,18 19,15 5,15', K.green)],
  },
  flower: {
    name: 'Terre fertile',
    shapes: [
      ...[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i * Math.PI) / 3;
        return e(12 + Math.cos(a) * 5, 11 + Math.sin(a) * 5, 3.2, 3.2, K.white);
      }),
      c(12, 11, 3.5, K.yellow),
      l('12,16 12,22', K.greenDark, 1.6),
    ],
  },
  map: {
    name: 'Carte',
    shapes: [
      p('2,5 8,3 16,5 22,3 22,19 16,21 8,19 2,21', K.cream),
      p('8,3 16,5 16,21 8,19', PAL.parchment),
      p('4,9 7,8 8,12 5,14', K.green),
      p('17,10 20,8 21,13 18,15', K.green),
      l('M9,9 Q12,12 10,16', K.blue, 1.4),
      l('M14,8 L15.5,9.5 M15.5,8 L14,9.5', K.red, 1.2),
    ],
  },
  warning: { name: 'Attention', shapes: [p('12,2 22.5,20.5 1.5,20.5', K.yellow), p('12,2 22.5,20.5 12,20.5', K.gold), p('11,8 13,8 12.6,14.5 11.4,14.5', K.dark), c(12, 17.3, 1.2, K.dark)] },
  camp: { name: 'Camp de bandits', shapes: [p('2,20.5 12,3.5 22,20.5', K.red), p('12,3.5 22,20.5 12,20.5', K.redDark), p('9,20.5 12,12 15,20.5', K.dark)] },
  plate: {
    name: 'Famine',
    shapes: [
      c(12, 13, 7.5, K.white),
      c(12, 13, 4.5, palMix('parchment', 'frost', 0.5)),
      l('M2.5,3 L2.5,9 M4.5,3 L4.5,22', K.iron, 1.4),
      p('19.5,3 21.5,3 21.5,22 19.5,22 19.5,11 18.5,9', K.iron),
    ],
  },
  hand: { name: 'Main', shapes: hand(false) },
  handLeft: { name: 'Gauche', shapes: hand(false) },
  handRight: { name: 'Droite', shapes: hand(true) },
  scroll: {
    name: 'Chronique',
    shapes: [
      p('6,3 20,3 20,17 18,21 4,21 4,7', K.cream),
      p('4,7 6,3 8,7', PAL.parchment),
      e(19, 19, 2, 2, PAL.parchment),
      l('M8,9 L16,9 M8,12 L16,12 M8,15 L13,15', palMix('umber', 'straw', 0.5), 1.2),
    ],
  },
  pause: { name: 'Pause', shapes: [r(6, 4, 4, 16, K.white), r(14, 4, 4, 16, K.white)] },
  play: { name: 'Lecture', shapes: [p('7,3.5 20,12 7,20.5', K.white)] },
  fast: { name: 'Rapide', shapes: [p('2.5,5 12,12 2.5,19', K.white), p('12,5 21.5,12 12,19', K.white)] },
  skip: { name: 'Passer', shapes: [p('2.5,5 10.5,12 2.5,19', K.white), p('10.5,5 18.5,12 10.5,19', K.white), r(18.5, 5, 3, 14, K.white)] },
  slow: {
    name: 'Ralenti',
    shapes: [
      p('5,17 6.5,11 11,8 16,9 19,13 19.5,17', K.green),
      p('11,8 16,9 19,13 19.5,17 12.5,17', K.greenDark),
      p('19,13 21.5,11 23,13.5 20.5,16', PAL.sage),
      l('M7,17 L6.5,20 M16.5,17 L17,20', PAL.sage, 1.8),
    ],
  },
  box: { name: 'Stock', shapes: [p('3,8 12,4 21,8 21,18 12,22 3,18', palMix('wood', 'straw', 0.5)), p('12,12 21,8 21,18 12,22', palMix('brick', 'sage', 0.5)), p('3,8 12,4 21,8 12,12', palMix('ochre', 'parchment', 0.5)), l('M7.5,6 L16.5,10', palMix('umber', 'ochre', 0.5), 1.2)] },
  forbidden: { name: 'Interdit', shapes: [c(12, 12, 10, K.red), p('2,12 12,2 22,12 12,12', PAL.brick), r(5.5, 10, 13, 4, K.white)] },
  star: { name: 'Étoile', shapes: [p('12,1.5 14.8,8.5 22.5,9 16.5,14 18.5,21.5 12,17.3 5.5,21.5 7.5,14 1.5,9 9.2,8.5', K.gold), p('12,1.5 14.8,8.5 22.5,9 16.5,14 18.5,21.5 12,17.3', K.goldDark)] },
  starEmpty: { name: 'Étoile vide', shapes: [p('12,1.5 14.8,8.5 22.5,9 16.5,14 18.5,21.5 12,17.3 5.5,21.5 7.5,14 1.5,9 9.2,8.5', palMix('ink', 'stone', 0.5))] },
  drop: {
    name: 'Eau',
    shapes: [
      { d: 'M12,1.5C12,1.5 19.5,10 19.5,15A7.5,7.5 0 0,1 4.5,15C4.5,10 12,1.5 12,1.5Z', fill: K.blue },
      { d: 'M12,1.5C12,1.5 19.5,10 19.5,15A7.5,7.5 0 0,1 12,22.5Z', fill: K.blueDark },
      p('7.5,14.5 8.5,18 10.5,19.5 8,19 6.8,16.5', K.blueLight),
    ],
  },
  trophy: {
    name: 'Trophée',
    shapes: [
      l('M6,5 C1,5 2,12 7.5,12 M18,5 C23,5 22,12 16.5,12', K.goldDark, 1.6),
      p('6,3 18,3 17,11 12,15 7,11', K.gold),
      p('12,3 18,3 17,11 12,15', K.goldDark),
      r(10.8, 15, 2.4, 3.5, K.goldDark),
      p('7,18.5 17,18.5 18,22 6,22', K.woodDark),
    ],
  },
  question: { name: 'Inconnu', shapes: [c(12, 12, 10, PAL.woad), l('M8.5,9 C8.5,4.5 15.5,4.5 15.5,8.5 C15.5,11 12,11.5 12,14.5', K.white, 2.4), c(12, 18, 1.5, K.white)] },
  check: { name: 'Fait', shapes: [p('2.5,4 21.5,4 21.5,20.5 2.5,20.5', K.green), p('12,4 21.5,4 21.5,20.5 12,20.5', K.greenDark), l('6,12.5 10.5,16.5 18,8', K.white, 2.6)] },
  hourglass: {
    name: 'Sablier',
    shapes: [
      r(4.5, 2, 15, 2.5, K.woodDark),
      r(4.5, 19.5, 15, 2.5, K.woodDark),
      p('6,4.5 18,4.5 13,12 18,19.5 6,19.5 11,12', PAL.frost),
      p('8,6 16,6 12.6,11 11.4,11', K.wheat),
      p('12,14 16.5,19.5 7.5,19.5', K.wheat),
    ],
  },
  lightning: { name: 'Temps réel', shapes: [p('14,1.5 4.5,13.5 11,13.5 9,22.5 19.5,9.5 13,9.5', K.yellow), p('14,1.5 13,9.5 19.5,9.5 9,22.5 11.5,13', K.gold)] },
  calendar: {
    name: 'Jours',
    shapes: [p('3,5 21,5 21,21.5 3,21.5', K.white), p('3,5 21,5 21,9.5 3,9.5', K.red), r(6.5, 2.5, 2.2, 4.5, K.dark), r(15.3, 2.5, 2.2, 4.5, K.dark), ...[0, 1, 2].flatMap((i) => [r(6 + i * 4.5, 12, 3, 2.6, palMix('bone', 'stone', 0.5)), r(6 + i * 4.5, 16.5, 3, 2.6, palMix('bone', 'stone', 0.5))])],
  },
  crane: {
    name: 'Bâtiments construits',
    shapes: [
      p('6,22 6,3 8.5,3 8.5,22', K.orange),
      p('3,4 22,4 22,6.5 3,6.5', K.orange),
      l('M20,6.5 L20,13', K.dark, 1.2),
      r(17.5, 13, 5, 3.5, K.woodLight),
      p('2.5,22 12,22 12,19.5 2.5,19.5', K.stoneDark),
    ],
  },
  extinguisher: {
    name: 'Incendies éteints',
    shapes: [p('7,8 15,8 15,22 7,22', K.red), p('11,8 15,8 15,22 11,22', K.redDark), r(9.5, 5, 3, 3, K.dark), l('M12.5,6 L19,6 L21,9', K.dark, 1.6), r(8.5, 13, 5, 4, K.white)],
  },
  headset: {
    name: 'Réalité mixte',
    shapes: [l('M3,11 C3,3 21,3 21,11', K.dark, 1.6), p('2,9 22,9 22,17 15.5,17 12,14 8.5,17 2,17', palMix('umber', 'woad', 0.5)), p('4,11 10,11 10,15 4,15', K.blueLight), p('14,11 20,11 20,15 14,15', K.blueLight)],
  },
  point: {
    name: 'Pointer',
    shapes: [p('2,9.5 14,9.5 14,13 9.5,13 10.5,15 16,15 16.5,19.5 6,19.5 3.5,16.5', K.skin), p('14,9.5 21.5,9.5 21.5,12 14,12', K.skin), p('3.5,16.5 6,19.5 16.5,19.5 16,17', palMix('ochre', 'parchment', 0.5))],
  },
  tap: {
    name: 'Tapoter',
    shapes: [p('10,2 13,2 13,10 17.5,10.5 19,13 18.5,21.5 8,21.5 5.5,15 7,13.5 10,15.5', K.skin), p('8,21.5 18.5,21.5 18.8,18 9,18', palMix('ochre', 'parchment', 0.5))],
  },
  pin: { name: 'Ici', shapes: [l('12,13 12,22', K.dark, 1.6), c(12, 8, 6, K.red), p('12,2 18,8 12,14', K.redDark), c(10, 6.5, 1.6, palMix('parchment', 'brick', 0.5))] },
  triUp: { name: 'Monter', shapes: [p('12,4 21,19 3,19', K.white)] },
  triDown: { name: 'Descendre', shapes: [p('3,5 21,5 12,20', K.white)] },
  triLeft: { name: 'Précédent', shapes: [p('19,3.5 19,20.5 5,12', K.white)] },
  triRight: { name: 'Suivant', shapes: [p('5,3.5 19,12 5,20.5', K.white)] },
  undo: { name: 'Remettre', shapes: [l('M7,9 L16,9 C21,9 21,19 16,19 L9,19', K.white, 2.6), p('8.5,3.5 8.5,14.5 2.5,9', K.white)] },
  close: { name: 'Fermer', shapes: [p('3.5,6.5 6.5,3.5 12,9 17.5,3.5 20.5,6.5 15,12 20.5,17.5 17.5,20.5 12,15 6.5,20.5 3.5,17.5 9,12', K.red)] },
  chair: {
    name: 'Assis',
    shapes: [p('6,2.5 9,2.5 9,12 6,12', K.wood), p('5,11.5 19,11.5 19,14 5,14', K.woodLight), l('M6.5,14 L6.5,22 M17.5,14 L17.5,22', K.woodDark, 2), p('6,4.5 9,4.5 9,6.5 6,6.5', K.woodDark)],
  },
  person: { name: 'Debout', shapes: [c(12, 4.5, 3, K.skin), p('8,8.5 16,8.5 17,15.5 14.5,15.5 14,22 10,22 9.5,15.5 7,15.5', PAL.woad)] },
  sound: { name: 'Son', shapes: [p('3,9 8,9 14,3.5 14,20.5 8,15 3,15', K.white), l('M16.5,8.5 C19,10.5 19,13.5 16.5,15.5 M19,5.5 C24,9.5 24,14.5 19,18.5', K.white, 1.6)] },
  mute: { name: 'Muet', shapes: [p('3,9 8,9 14,3.5 14,20.5 8,15 3,15', K.white), l('M16.5,9 L22,15 M22,9 L16.5,15', K.red, 2)] },
  chart: { name: 'Performances', shapes: [p('2.5,2.5 4.5,2.5 4.5,19.5 21.5,19.5 21.5,21.5 2.5,21.5', K.white), l('6,16 10.5,11 14,13.5 20.5,5.5', K.green, 2.2), p('17.5,5 21,4.5 20.5,8', K.green)] },
  newGame: { name: 'Nouvelle partie', shapes: [p('2.5,2.5 21.5,2.5 21.5,21.5 2.5,21.5', K.blue), p('12,2.5 21.5,2.5 21.5,21.5 12,21.5', K.blueDark), p('10.5,6 13.5,6 13.5,10.5 18,10.5 18,13.5 13.5,13.5 13.5,18 10.5,18 10.5,13.5 6,13.5 6,10.5 10.5,10.5', K.white)] },
  bulb: { name: 'Astuce', shapes: [p('12,1.5 17,3.5 19,8.5 16,14 15.5,17 8.5,17 8,14 5,8.5 7,3.5', K.yellow), p('12,1.5 17,3.5 19,8.5 16,14 15.5,17 12,17', K.gold), r(8.5, 17.5, 7, 2, K.stoneDark), r(9.5, 20, 5, 2, K.stoneDark)] },
  controller: {
    name: 'Manettes',
    shapes: [p('2,9 6,6 18,6 22,9 22.5,16 20,19 16.5,16 7.5,16 4,19 1.5,16', palMix('umber', 'woad', 0.5)), r(5, 10, 5, 1.6, K.white), r(6.7, 8.3, 1.6, 5, K.white), c(16, 9.8, 1.3, K.green), c(18.5, 12.3, 1.3, K.red)],
  },
  pinch: { name: 'Pincer', shapes: [p('5,21.5 4,13 6.5,9.5 9,11 9,7 12,4 13.5,5.5 11,9.5 13,12 16,7.5 18,8.5 15.5,15 14,21.5', K.skin), p('13,12 16,7.5 18,8.5 15.5,15', palMix('ochre', 'parchment', 0.5))] },
  twoHands: { name: 'Deux mains', shapes: [p('1.5,20 2,11 4,7 6,7.5 5.5,11 7.5,4.5 9.5,5 9.5,12 10.5,20', K.skin), p('22.5,20 22,11 20,7 18,7.5 18.5,11 16.5,4.5 14.5,5 14.5,12 13.5,20', palMix('ochre', 'parchment', 0.5))] },
  trigger: { name: 'Gâchette', shapes: [p('6,3 16,3 19,8 17,21.5 11,21.5 10.5,12 6,10', palMix('umber', 'woad', 0.5)), p('10,11 6,13.5 6,16.5 10.5,15', K.gold), c(13.5, 6.5, 1.8, K.blueLight)] },
  grip: { name: 'Grip', shapes: [p('4,9 7,6.5 17,6.5 20,9 20,17 16,21 8,21 4,17', K.skin), p('4,13 20,13 20,17 16,21 8,21 4,17', palMix('ochre', 'parchment', 0.5)), l('M8,9 L8,13 M12,8.5 L12,13 M16,9 L16,13', palMix('parchment', 'brick', 0.5), 1)] },
  btnA: { name: 'Bouton A', shapes: [c(12, 12, 10, PAL.brick), l('M7.5,18 L12,5.5 L16.5,18 M9,14 L15,14', K.white, 2.2)] },
  btnB: { name: 'Bouton B', shapes: [c(12, 12, 10, PAL.woad), l('M8.5,5.5 L8.5,18.5 L13.5,18.5 C17.5,18.5 17.5,12 13.5,12 L8.5,12 M8.5,5.5 L13,5.5 C16.5,5.5 16.5,12 13,12', K.white, 2.1)] },
  btnX: { name: 'Bouton X', shapes: [c(12, 12, 10, PAL.moss), l('M8,7 L16,17 M16,7 L8,17', K.white, 2.4)] },
  stick: { name: 'Stick', shapes: [p('3,17 21,17 20,21.5 4,21.5', palMix('umber', 'woad', 0.5)), l('12,17 12,8', K.dark, 2.4), c(12, 6.5, 4, K.red), p('12,2.5 16,6.5 12,10.5', K.redDark)] },
  updown: { name: 'Hauteur', shapes: [p('12,1.5 18.5,8.5 5.5,8.5', K.white), p('12,22.5 18.5,15.5 5.5,15.5', K.white), r(10.6, 8.5, 2.8, 7, K.white)] },
  dice: { name: 'Hasard', shapes: [p('3,7 12,3 21,7 21,17 12,21.5 3,17', K.white), p('12,11 21,7 21,17 12,21.5', palMix('parchment', 'frost', 0.5)), p('3,7 12,3 21,7 12,11', PAL.bone), c(12, 7, 1.3, K.red), c(7, 13.5, 1.2, K.dark), c(16.5, 12.5, 1.2, K.dark), c(16.5, 17, 1.2, K.dark)] },
  mouse: { name: 'Souris', shapes: [p('6,8 8.5,3 15.5,3 18,8 18,17 15.5,21.5 8.5,21.5 6,17', K.white), p('6,9.5 18,9.5 18,8 15.5,3 12,3 12,9.5 6,9.5 6,8', palMix('parchment', 'frost', 0.5)), l('12,3 12,9.5', K.dark, 1.1)] },
} satisfies Record<string, IconDef>;
