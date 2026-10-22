// Store Zustand : relie la logique pure (game/) au rendu et à l'interface.

import { create } from 'zustand';
import { DAY_DURATION_SEC } from '../game/config';
import { randomSeed } from '../game/rng';
import { clearSave, loadGame, saveGame } from '../game/save';
import { extinguishFire, fightBandit } from '../game/hazards';
import {
  attackCamp as attackCampSim,
  buyParcel as buyParcelSim,
  clearRuins as clearRuinsSim,
  advanceTime,
  createInitialState,
  placeBuilding,
  repairBuilding,
  resolveChoice,
  upgradeBuilding,
} from '../game/simulation';
import type { BuildingTypeId, GameState } from '../game/types';

export type Speed = 0 | 1 | 2;

interface GameStore {
  game: GameState;
  speed: Speed;
  selected: BuildingTypeId | null;
  hover: { x: number; z: number } | null;
  /** Bâtiment dont le panneau d'information est ouvert */
  inspected: number | null;
  /** Parcelle verrouillée dont le panneau d'achat est ouvert */
  inspectedParcel: number | null;
  /** Danger (camp, ruines) dont le panneau est ouvert */
  inspectedFeature: number | null;

  tick: (dtSec: number) => void;
  build: (x: number, z: number) => boolean;
  select: (type: BuildingTypeId | null) => void;
  inspect: (buildingId: number | null) => void;
  inspectParcel: (parcelId: number | null) => void;
  inspectFeature: (featureId: number | null) => void;
  buyParcel: (parcelId: number) => boolean;
  clearRuins: (featureId: number) => boolean;
  attackCamp: (featureId: number) => boolean;
  upgrade: (buildingId: number) => boolean;
  setHover: (tile: { x: number; z: number } | null) => void;
  setSpeed: (speed: Speed) => void;
  choose: (noticeId: number, optionId: string) => void;
  extinguish: (buildingId: number) => boolean;
  repair: (buildingId: number) => boolean;
  fight: (banditIndex: number) => boolean;
  newGame: (seed?: number) => void;
}

const initial = loadGame() ?? createInitialState(randomSeed());
// Sauvegarde immédiate : un rechargement de page retrouve la même carte
saveGame(initial);

export const useGame = create<GameStore>((set, get) => {
  /** Applique le résultat d'une action joueur (null = refusée) */
  const apply = (next: GameState | null): boolean => {
    if (!next || next === get().game) return false;
    saveGame(next);
    set({ game: next });
    return true;
  };
  return {
    game: initial,
    speed: 1,
    selected: null,
    hover: null,
    inspected: null,
    inspectedParcel: null,
    inspectedFeature: null,

    tick: (dt) => {
      const { game, speed } = get();
      if (speed === 0 || game.gameOver) return;
      // Bride dt pour éviter un saut énorme après un onglet en arrière-plan
      const next = advanceTime(game, (Math.min(dt, 0.25) * speed) / DAY_DURATION_SEC);
      if (next === game) return;
      const structural = next.day !== game.day || next.buildings !== game.buildings || next.notices !== game.notices;
      if (structural) saveGame(next);
      const inspected = get().inspected;
      set({
        game: next,
        selected: next.gameOver ? null : get().selected,
        // Ferme le panneau si le bâtiment a disparu (tempête, incendie…)
        inspected: inspected !== null && next.buildings.some((b) => b.id === inspected) ? inspected : null,
      });
    },

    build: (x, z) => {
      const { game, selected } = get();
      if (!selected) return false;
      const next = placeBuilding(game, selected, x, z);
      if (!next) return false;
      saveGame(next);
      set({ game: next });
      return true;
    },

    select: (type) =>
      set(type ? { selected: type, inspected: null, inspectedParcel: null, inspectedFeature: null } : { selected: null }),
    inspect: (buildingId) =>
      set({ inspected: buildingId, inspectedParcel: null, inspectedFeature: null, selected: buildingId !== null ? null : get().selected }),
    inspectParcel: (parcelId) => set({ inspectedParcel: parcelId, inspected: null, inspectedFeature: null }),
    inspectFeature: (featureId) =>
      set({ inspectedFeature: featureId, inspected: null, inspectedParcel: null, selected: featureId !== null ? null : get().selected }),
    buyParcel: (parcelId) => {
      const ok = apply(buyParcelSim(get().game, parcelId));
      if (ok) set({ inspectedParcel: null });
      return ok;
    },
    clearRuins: (featureId) => {
      const ok = apply(clearRuinsSim(get().game, featureId));
      if (ok) set({ inspectedFeature: null });
      return ok;
    },
    attackCamp: (featureId) => apply(attackCampSim(get().game, featureId)),
    upgrade: (buildingId) => {
      const next = upgradeBuilding(get().game, buildingId);
      if (!next) return false;
      saveGame(next);
      set({ game: next });
      return true;
    },
    setHover: (tile) => {
      const h = get().hover;
      if (h === tile || (h && tile && h.x === tile.x && h.z === tile.z)) return;
      set({ hover: tile });
    },
    setSpeed: (speed) => set({ speed }),

    choose: (noticeId, optionId) => apply(resolveChoice(get().game, noticeId, optionId)),
    extinguish: (buildingId) => apply(extinguishFire(get().game, buildingId)),
    repair: (buildingId) => apply(repairBuilding(get().game, buildingId)),
    fight: (banditIndex) => apply(fightBandit(get().game, banditIndex)),

    newGame: (seed) => {
      clearSave();
      const game = createInitialState(seed ?? randomSeed());
      saveGame(game);
      set({ game, selected: null, hover: null, inspected: null, inspectedParcel: null, inspectedFeature: null, speed: 1 });
    },
  };
});
