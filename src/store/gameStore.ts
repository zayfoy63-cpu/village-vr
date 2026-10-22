// Store Zustand : relie la logique pure (game/) au rendu et à l'interface.

import { create } from 'zustand';
import { loadChronicle, mergeChronicle, saveChronicle, type Chronicle } from './chronicle';
import { loadSettings, saveSettings, type Settings } from './settings';
import { DAY_DURATION_SEC } from '../game/config';
import { randomSeed } from '../game/rng';
import { clearSave, loadGame, saveGame } from '../game/save';
import { catchScout, extinguishFire, protectCrops, reinforceBuilding, sendGuard, shelterVillagers } from '../game/hazards';
import {
  attackCamp as attackCampSim,
  buyParcel as buyParcelSim,
  clearRuins as clearRuinsSim,
  advanceTime,
  createInitialState,
  placeBuilding,
  repairBuilding,
  togglePause as togglePauseSim,
  resolveChoice,
  upgradeBuilding,
} from '../game/simulation';
import type { BuildingTypeId, GameState } from '../game/types';

export type Speed = 0 | 0.5 | 1 | 2;

interface GameStore {
  game: GameState;
  speed: Speed;
  settings: Settings;
  /** Chronique du village (toutes parties confondues) */
  chronicle: Chronicle;
  /** Vitesse à reprendre après une pause automatique (null = pas de pause auto en cours) */
  resumeSpeed: Speed | null;
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
  setSettings: (patch: Partial<Settings>) => void;
  choose: (noticeId: number, optionId: string) => void;
  extinguish: (buildingId: number) => boolean;
  repair: (buildingId: number) => boolean;
  togglePause: (buildingId: number) => boolean;
  /** Clic sur un bandit : un garde part l'intercepter */
  chase: (banditId: number) => boolean;
  reinforce: (buildingId: number) => boolean;
  /** Clic sur la silhouette au bord de la carte */
  catchScout: () => boolean;
  shelter: () => boolean;
  protectCrops: () => boolean;
  /** Petit message éphémère (action impossible, etc.) */
  toast: { text: string; at: number } | null;
  showToast: (text: string) => void;
  newGame: (seed?: number) => void;
}

/** Identifiants des cartes à choix encore sans réponse */
export function openChoiceIds(game: GameState): number[] {
  return game.notices.filter((n) => n.choice && !n.choice.resolved && !n.choice.realtime).map((n) => n.id);
}

function hasNewChoice(before: GameState, after: GameState): boolean {
  if (after.notices === before.notices) return false;
  const old = new Set(openChoiceIds(before));
  return openChoiceIds(after).some((id) => !old.has(id));
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
    settings: loadSettings(),
    chronicle: loadChronicle(),
    resumeSpeed: null,
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
      // Pause automatique : une nouvelle carte à choix vient d'apparaître
      if (get().settings.autoPause && hasNewChoice(game, next)) {
        set({ speed: 0, resumeSpeed: get().resumeSpeed ?? speed });
      }
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
    // Un changement de vitesse manuel annule la reprise automatique
    setSpeed: (speed) => set({ speed, resumeSpeed: null }),
    setSettings: (patch) => {
      const settings = { ...get().settings, ...patch };
      saveSettings(settings);
      set({ settings });
    },

    choose: (noticeId, optionId) => {
      const ok = apply(resolveChoice(get().game, noticeId, optionId));
      // Plus aucune décision en attente : on reprend à la vitesse d'avant la pause automatique
      const resume = get().resumeSpeed;
      if (ok && resume !== null && !openChoiceIds(get().game).length) set({ speed: resume, resumeSpeed: null });
      return ok;
    },
    extinguish: (buildingId) => apply(extinguishFire(get().game, buildingId)),
    repair: (buildingId) => apply(repairBuilding(get().game, buildingId)),
    togglePause: (buildingId) => apply(togglePauseSim(get().game, buildingId)),
    chase: (banditId) => {
      const res = sendGuard(get().game, banditId);
      if (!res.state) {
        if (res.reason) get().showToast(res.reason);
        return false;
      }
      return apply(res.state);
    },
    reinforce: (buildingId) => {
      const ok = apply(reinforceBuilding(get().game, buildingId));
      if (!ok) get().showToast('Impossible de renforcer : pas assez de bois ?');
      return ok;
    },
    shelter: () => apply(shelterVillagers(get().game)),
    catchScout: () => {
      const res = catchScout(get().game);
      if (!res.state) {
        if (res.reason) get().showToast(res.reason);
        return false;
      }
      return apply(res.state);
    },
    protectCrops: () => apply(protectCrops(get().game)),
    toast: null,
    showToast: (text) => set({ toast: { text, at: Date.now() } }),

    newGame: (seed) => {
      clearSave();
      const game = createInitialState(seed ?? randomSeed());
      saveGame(game);
      set({
        game,
        selected: null,
        hover: null,
        inspected: null,
        inspectedParcel: null,
        inspectedFeature: null,
        speed: 1,
        resumeSpeed: null,
      });
    },
  };
});

// Chronique : chaque page gagnée pendant la partie est reportée dans la mémoire du village
useGame.subscribe((s, prev) => {
  if (s.game.mech.chronicle === prev.game.mech.chronicle) return;
  const { next, added, completed } = mergeChronicle(s.chronicle, s.game);
  if (!added.length && !completed.length) return;
  saveChronicle(next);
  useGame.setState({ chronicle: next });
  s.showToast(added.length ? '📜 Une page s\'ajoute à la Chronique du village…' : '📜 Une page de la Chronique se complète.');
});
