// Store Zustand : relie la logique pure (game/) au rendu et à l'interface.

import { create } from 'zustand';
import { DAY_DURATION_SEC } from '../game/config';
import { randomSeed } from '../game/rng';
import { clearSave, loadGame, saveGame } from '../game/save';
import { advanceDay, createInitialState, placeBuilding, resolveTrade, upgradeBuilding } from '../game/simulation';
import type { BuildingTypeId, GameState } from '../game/types';

export type Speed = 0 | 1 | 2;

interface GameStore {
  game: GameState;
  speed: Speed;
  selected: BuildingTypeId | null;
  hover: { x: number; z: number } | null;
  /** Bâtiment dont le panneau d'information est ouvert */
  inspected: number | null;

  tick: (dtSec: number) => void;
  build: (x: number, z: number) => boolean;
  select: (type: BuildingTypeId | null) => void;
  inspect: (buildingId: number | null) => void;
  upgrade: (buildingId: number) => boolean;
  setHover: (tile: { x: number; z: number } | null) => void;
  setSpeed: (speed: Speed) => void;
  trade: (noticeId: number, option: number | null) => void;
  newGame: (seed?: number) => void;
}

const initial = loadGame() ?? createInitialState(randomSeed());
// Sauvegarde immédiate : un rechargement de page retrouve la même carte
saveGame(initial);

export const useGame = create<GameStore>((set, get) => ({
  game: initial,
  speed: 1,
  selected: null,
  hover: null,
  inspected: null,

  tick: (dt) => {
    const { game, speed } = get();
    if (speed === 0 || game.gameOver) return;
    // Bride dt pour éviter un saut énorme après un onglet en arrière-plan
    const progress = game.dayProgress + (Math.min(dt, 0.25) * speed) / DAY_DURATION_SEC;
    if (progress < 1) {
      set({ game: { ...game, dayProgress: progress } });
      return;
    }
    const next = advanceDay(game);
    saveGame(next);
    const inspected = get().inspected;
    set({
      game: next,
      selected: next.gameOver ? null : get().selected,
      // Ferme le panneau si le bâtiment a disparu (tempête)
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

  select: (type) => set({ selected: type, inspected: type ? null : get().inspected }),
  inspect: (buildingId) => set({ inspected: buildingId, selected: buildingId !== null ? null : get().selected }),
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

  trade: (noticeId, option) => {
    const next = resolveTrade(get().game, noticeId, option);
    saveGame(next);
    set({ game: next });
  },

  newGame: (seed) => {
    clearSave();
    const game = createInitialState(seed ?? randomSeed());
    saveGame(game);
    set({ game, selected: null, hover: null, inspected: null, speed: 1 });
  },
}));
