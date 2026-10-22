import type { FC } from 'react';
import type { BuildingTypeId } from '../../game/types';
import { Castle } from './Castle';
import { House } from './House';
import { Lumber } from './Lumber';
import { Market } from './Market';
import { Mill } from './Mill';
import { Quarry } from './Quarry';
import { Tower } from './Tower';

/**
 * Registre des modèles 3D par type de bâtiment.
 * null = rendu instancié ailleurs (les champs, voir Fields.tsx).
 */
export const MODELS: Record<BuildingTypeId, FC<{ id: number }> | null> = {
  castle: Castle,
  mill: Mill,
  house: House,
  field: null,
  lumber: Lumber,
  quarry: Quarry,
  market: Market,
  tower: Tower,
};
