// État propre à la VR (hors logique de jeu) : mode d'interface, plateau, préférences, glisser-déposer.
// Les préférences sont gardées dans localStorage (try/catch) ; le reste est volatile.

import { create } from 'zustand';
import type { BuildTab } from '../game/buildings';
import type { BuildingTypeId } from '../game/types';
import { VR_CONFIG } from './config';

export type InputMode = 'controller' | 'hand' | 'none';
export type Hand = 'left' | 'right';

export interface Prefs {
  dominant: Hand;
  seated: boolean;
  showFps: boolean;
  tutorialDone: boolean;
  /** Le joueur a déjà posé le plateau au moins une fois (le tutoriel démarre alors) */
  sound: boolean;
}

const PREFS_KEY = 'village-vr-xr-prefs';
const DEFAULT_PREFS: Prefs = { dominant: 'right', seated: false, showFps: false, tutorialDone: false, sound: true };

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) } : { ...DEFAULT_PREFS };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    // stockage indisponible : préférences gardées pour la session seulement
  }
}

/** Objet actuellement tenu en main (glisser-déposer) */
export type Held =
  | { kind: 'new'; type: BuildingTypeId }
  | { kind: 'move'; id: number; type: BuildingTypeId; from: { x: number; z: number } }
  | null;

export interface Board {
  x: number;
  y: number;
  z: number;
  /** Rotation autour de la verticale (rad) : 0 = le joueur est du côté +z du plateau */
  yaw: number;
  scale: number;
}

export type Panel = 'chronicle' | 'settings' | null;

/**
 * Position du plateau mémorisée pour la session (onglet du navigateur) : en ressortant puis en
 * revenant en réalité mixte, le plateau retrouve sa place, verrouillé.
 */
const BOARD_KEY = 'village-vr-board';

function loadBoard(): Board | null {
  try {
    const raw = sessionStorage.getItem(BOARD_KEY);
    const b = raw ? (JSON.parse(raw) as Board) : null;
    return b && [b.x, b.y, b.z, b.yaw, b.scale].every(Number.isFinite) ? b : null;
  } catch {
    return null;
  }
}

export function saveBoard(b: Board) {
  try {
    sessionStorage.setItem(BOARD_KEY, JSON.stringify(b));
  } catch {
    // stockage indisponible : la position reste en mémoire pour cette session XR
  }
}

interface VRStore {
  /** Interface 3D active : session XR en cours, ou aperçu sur PC (?ui3d) */
  active: boolean;
  /** Aperçu de l'interface 3D sur PC (?ui3d) */
  pcPreview: boolean;
  /**
   * `placing` : le plateau est présenté devant le joueur (incliné, bords lumineux) en attendant qu'il
   * l'attrape et le pose ; `playing` : partie en cours
   */
  phase: 'placing' | 'playing';
  board: Board;
  /** Inclinaison actuelle du plateau vers le joueur (rad) : seulement pendant la présentation */
  tilt: number;
  /** Position verrouillée : les bords ne s'attrapent plus (verrouillé après chaque pose) */
  locked: boolean;
  /** Nombre de mains (ou manettes) qui tiennent le plateau par ses bords */
  grabbing: number;
  /** Zoom à deux mains en cours (pincements au-dessus du plateau) */
  zooming: boolean;
  /** Surface réelle détectée sous le plateau (hauteur du dessus, m) : null si aucune */
  surfaceY: number | null;
  /** Demande de recentrage (compteur, traité par la saisie du plateau) */
  recenterAsk: number;
  input: InputMode;
  handsLost: boolean;
  prefs: Prefs;
  boxOpen: boolean;
  boxTab: BuildTab;
  panel: Panel;
  held: Held;
  /** Menace annoncée dont la carte de préparation est ouverte (tapotée sur son drapeau) */
  focus: number | null;
  /** Fantôme de tutoriel : étape en cours (index dans VR_CONFIG.help.steps) */
  tutorialStep: number;
  /** Aide du poignet visible */
  wristHelp: boolean;
  fps: number;
  lowQuality: boolean;
  /** Mesures du rendu (dernière image) : appels de dessin, triangles, textures en mémoire */
  stats: RenderStats;

  setActive: (active: boolean, pcPreview?: boolean) => void;
  setPhase: (phase: 'placing' | 'playing') => void;
  setBoard: (patch: Partial<Board>) => void;
  setLocked: (v: boolean) => void;
  recenter: () => void;
  setInput: (input: InputMode) => void;
  setHandsLost: (v: boolean) => void;
  setPrefs: (patch: Partial<Prefs>) => void;
  toggleBox: (open?: boolean) => void;
  setBoxTab: (tab: BuildTab) => void;
  setPanel: (panel: Panel) => void;
  setHeld: (held: Held) => void;
  setFocus: (id: number | null) => void;
  advanceTutorial: () => void;
  skipTutorial: () => void;
  setWristHelp: (v: boolean) => void;
  setFps: (fps: number, low: boolean, stats?: RenderStats) => void;
}

export interface RenderStats {
  calls: number;
  triangles: number;
  textures: number;
}

export const useVR = create<VRStore>((set, get) => ({
  active: false,
  pcPreview: false,
  phase: 'placing',
  board: { x: 0, y: 0.9, z: -0.7, yaw: 0, scale: VR_CONFIG.board.scale },
  tilt: 0,
  locked: false,
  grabbing: 0,
  zooming: false,
  surfaceY: null,
  recenterAsk: 0,
  input: 'none',
  handsLost: false,
  prefs: loadPrefs(),
  boxOpen: true,
  boxTab: 'housing',
  panel: null,
  held: null,
  focus: null,
  tutorialStep: 0,
  wristHelp: false,
  fps: 72,
  lowQuality: false,
  stats: { calls: 0, triangles: 0, textures: 0 },

  setActive: (active, pcPreview = false) => {
    // Plateau déjà posé pendant cette session : il retrouve sa place, verrouillé
    const saved = !pcPreview && active ? loadBoard() : null;
    set({
      active,
      pcPreview,
      phase: pcPreview || saved ? 'playing' : 'placing',
      tilt: 0,
      locked: !!saved,
      grabbing: 0,
      zooming: false,
      surfaceY: null,
      ...(saved ? { board: saved } : {}),
    });
  },
  setPhase: (phase) => set({ phase }),
  setBoard: (patch) => set({ board: { ...get().board, ...patch } }),
  setLocked: (locked) => (get().locked === locked ? undefined : set({ locked })),
  recenter: () => set({ recenterAsk: get().recenterAsk + 1 }),
  setInput: (input) => (get().input === input ? undefined : set({ input })),
  setHandsLost: (handsLost) => (get().handsLost === handsLost ? undefined : set({ handsLost })),
  setPrefs: (patch) => {
    const prefs = { ...get().prefs, ...patch };
    savePrefs(prefs);
    set({ prefs });
  },
  toggleBox: (open) => set({ boxOpen: open ?? !get().boxOpen }),
  setBoxTab: (boxTab) => set({ boxTab }),
  setPanel: (panel) => set({ panel }),
  setHeld: (held) => set({ held }),
  setFocus: (focus) => (get().focus === focus ? undefined : set({ focus })),
  advanceTutorial: () => {
    const next = get().tutorialStep + 1;
    if (next >= VR_CONFIG.help.steps.length) get().skipTutorial();
    else set({ tutorialStep: next });
  },
  skipTutorial: () => get().setPrefs({ tutorialDone: true }),
  setWristHelp: (wristHelp) => (get().wristHelp === wristHelp ? undefined : set({ wristHelp })),
  setFps: (fps, lowQuality, stats) => set(stats ? { fps, lowQuality, stats } : { fps, lowQuality }),
}));

/** Conversion case du jeu → mètres (repère du plateau, origine au centre) */
export const TILE_M = 1;
