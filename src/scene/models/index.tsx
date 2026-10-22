import type { FC } from 'react';
import type { BuildingTypeId } from '../../game/types';
import { Castle } from './Castle';
import { Bakery, Forge, Mine, Sawmill } from './Craft';
import { FieldDecor } from './FieldDecor';
import { Granary } from './Granary';
import { House } from './House';
import { Hut, Manor, Townhouse } from './Housing';
import { Lumber } from './Lumber';
import { Market } from './Market';
import { Mill } from './Mill';
import { Quarry } from './Quarry';
import { Tower } from './Tower';
import { Cemetery, Dike, Herbalist, Palisade, Sheepfold, Torches, Well } from './Hidden';

export interface ModelProps {
  id: number;
  level: number;
}

/**
 * Registre des modèles 3D par type de bâtiment (reçoivent id et niveau).
 * Les champs sont rendus en instancing (Fields.tsx) ; FieldDecor n'ajoute que le décor des niveaux 2 et 3.
 */
export const MODELS: Record<BuildingTypeId, FC<ModelProps> | null> = {
  castle: Castle,
  mill: Mill,
  hut: Hut,
  house: House,
  townhouse: Townhouse,
  manor: Manor,
  field: FieldDecor,
  lumber: Lumber,
  quarry: Quarry,
  market: Market,
  tower: Tower,
  granary: Granary,
  bakery: Bakery,
  sawmill: Sawmill,
  mine: Mine,
  forge: Forge,
  dike: Dike,
  well: Well,
  sheepfold: Sheepfold,
  herbalist: Herbalist,
  palisade: Palisade,
  torch: Torches,
  cemetery: Cemetery,
};
