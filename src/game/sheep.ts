// Bergeries : laine, lait, fumier — et des moutons qu'il faut nourrir en hiver.
// Tous les réglages d'équilibrage des troupeaux sont ici ; production et coûts sont dans buildings.ts.

import { seasonEffect } from './seasons';
import { pushNotice } from './stateUtils';
import type { Building, GameState } from './types';
import { I } from '../ui/icons';

export const SHEEP = {
  /** Blé donné aux moutons par jour d'hiver, selon le niveau de la bergerie (index = niveau) */
  feed: [0, 0.6, 1.2, 1.8],
  /** Maigreur gagnée par jour d'hiver sans blé (0 = gras, 1 = squelettique) */
  leanGain: 0.25,
  /** Maigreur perdue par jour d'hiver nourri, et par jour hors hiver (ils broutent) */
  fedRecovery: 0.3,
  grazingRecovery: 0.2,
  /** Production perdue (laine, lait) quand le troupeau est squelettique */
  maxLoss: 0.7,
  /** Fumier : portée de la bergerie (cases) = base + par niveau au-dessus de 1 ; efficacité par niveau */
  manure: { radius: 2.2, radiusPerLevel: 0.4, strength: [0, 1, 1.4, 1.8] },
  /** Maigreur à partir de laquelle les moutons sont visiblement maigres (modèle 3D, avertissement) */
  thinFrom: 0.4,
};

/** Facteur de production d'une bergerie selon l'état de son troupeau */
export function leanFactor(b: Building): number {
  return 1 - SHEEP.maxLoss * Math.min(1, b.lean ?? 0);
}

/** Blé qu'il faut donner à cette bergerie aujourd'hui (0 hors hiver) */
export function feedNeed(state: GameState, b: Building): number {
  if (b.type !== 'sheepfold' || seasonEffect(state).crops > 0) return 0;
  return SHEEP.feed[Math.min(b.level, SHEEP.feed.length - 1)];
}

/** Blé mangé par tous les troupeaux aujourd'hui (HUD : bilan net) */
export function sheepFeedNeed(state: GameState): number {
  return state.buildings.reduce((sum, b) => sum + feedNeed(state, b), 0);
}

/** Efficacité du fumier d'une bergerie (0 si elle ne travaille pas ou est abîmée) */
export function manureStrength(b: Building): number {
  if (b.type !== 'sheepfold' || b.workers <= 0 || b.damaged || b.fire) return 0;
  return SHEEP.manure.strength[Math.min(b.level, SHEEP.manure.strength.length - 1)] * leanFactor(b);
}

export function manureRadius(b: Building): number {
  return SHEEP.manure.radius + SHEEP.manure.radiusPerLevel * (b.level - 1);
}

/** Fin de journée, après les repas du village : les moutons mangent s'il reste du blé, sinon ils maigrissent (mutation) */
export function feedSheep(state: GameState): void {
  const winter = seasonEffect(state).crops <= 0;
  let warned = false;
  for (const b of state.buildings) {
    if (b.type !== 'sheepfold') continue;
    const before = b.lean ?? 0;
    let lean = before;
    if (!winter) {
      lean -= SHEEP.grazingRecovery;
    } else {
      const need = feedNeed(state, b);
      if (state.resources.food >= need) {
        state.resources.food -= need;
        lean -= SHEEP.fedRecovery;
      } else {
        lean += SHEEP.leanGain;
      }
    }
    lean = Math.round(Math.max(0, Math.min(1, lean)) * 1000) / 1000;
    if (lean > 0) b.lean = lean;
    else delete b.lean;
    if (lean >= SHEEP.thinFrom && before < SHEEP.thinFrom) warned = true;
  }
  if (warned) {
    pushNotice(state, {
      kind: 'bad',
      icon: I.sheep,
      title: 'Moutons maigres',
      text: 'Faute de blé, les moutons maigrissent : moins de laine, moins de lait. Gardez de quoi les nourrir en hiver.',
    });
  }
}
