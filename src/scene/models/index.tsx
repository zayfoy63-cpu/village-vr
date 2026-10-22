import type { FC } from 'react';
import type { BuildingTypeId } from '../../game/types';
import { Castle } from './Castle';
import { House } from './House';
import { Hut, Manor, Townhouse } from './Housing';
import { Lumber } from './Lumber';
import { Market } from './Market';
import { Mill } from './Mill';
import { Quarry } from './Quarry';
import { Tower } from './Tower';

export interface ModelProps {
  id: number;
  level: number;
}

/**
 * Registre des modèles 3D par type de bâtiment (reçoivent id et niveau).
 * null = rendu instancié ailleurs (les champs, voir Fields.tsx).
 */
export const MODELS: Record<BuildingTypeId, FC<ModelProps> | null> = {
  castle: Castle,
  mill: Mill,
  hut: Hut,
  house: House,
  townhouse: Townhouse,
  manor: Manor,
  field: null,
  lumber: Lumber,
  quarry: Quarry,
  market: Market,
  tower: Tower,
};
