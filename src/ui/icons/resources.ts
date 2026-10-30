// Icônes des ressources (nom au survol : PC infobulle, VR petit libellé)

import type { IconId } from './index';

export const RESOURCE_ICON: Record<string, IconId> = {
  food: 'wheat',
  wood: 'wood',
  stone: 'stone',
  gold: 'gold',
  flour: 'flour',
  bread: 'bread',
  planks: 'planks',
  ironOre: 'ironOre',
  tools: 'tools',
  weapons: 'weapons',
  wool: 'wool',
};

export const RESOURCE_ICON_IDS = new Set<IconId>(Object.values(RESOURCE_ICON));
