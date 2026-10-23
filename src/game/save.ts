// Sauvegarde automatique dans localStorage (toujours protégée par try/catch).

import { BUILDING_BY_ID, maxLevel, unlockKey } from './buildings';
import { ALL_PARCELS } from './parcels';
import { BASE_RESOURCES, MORALE, RESOURCE_KEYS, SAVE_KEY, SAVE_VERSION, START_RESOURCES } from './config';
import { emptyMech } from './mechanics/common';
import { applyUnlocks } from './simulation';
import type { GameState } from './types';
import { deepLegacyToIcons } from './legacyIcons';

export function saveGame(state: GameState): void {
  try {
    if (state.gameOver) {
      localStorage.removeItem(SAVE_KEY);
      return;
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // Stockage indisponible (navigation privée, quota…) : on joue sans sauvegarde.
  }
}

/**
 * Met à niveau une sauvegarde d'une version précédente.
 * v1 → v2 : niveaux de bâtiments, déblocages, compteur d'améliorations.
 * v2 → v3 : moral, événements annoncés, raids, incendies ; les anciennes offres de marchand sont closes.
 * v3 → v4 : parcelles (les anciennes parties possèdent toute la carte).
 * v4 → v5 : chaînes de production (farine, pain, planches, minerai, outils, armes).
 * v5 → v6 : bandits / orage / crue en temps réel, blessés.
 * v6 → v7 : saisons, météo et mécaniques cachées (forêt intacte, sols neufs, aucune page de Chronique).
 * Renvoie null si la sauvegarde est inutilisable.
 */
export function migrate(data: GameState): GameState | null {
  if (!data || typeof data !== 'object' || !data.map?.tiles || !Array.isArray(data.buildings)) return null;
  const version = typeof data.version === 'number' ? data.version : 1;
  if (version > SAVE_VERSION) return null;
  const s: GameState = { ...data };
  // Bâtiments : types inconnus retirés, niveau borné
  s.buildings = data.buildings
    .filter((b) => b && BUILDING_BY_ID[b.type])
    .map((b) => {
      // Un bâtiment soulevé (VR) quand la partie s'est arrêtée est reposé là où il était
      const { moving: _moving, ...rest } = b;
      void _moving;
      return { ...rest, level: Math.max(1, Math.min(maxLevel(b.type), Number(b.level) || 1)) };
    });
  const defaults = { maxPopulation: 0, buildingsBuilt: 0, upgrades: 0, eventsSurvived: 0, banditsKilled: 0, firesPutOut: 0 };
  s.stats = { ...defaults, ...(data.stats as Partial<GameState['stats']>) };
  // Les anciennes cartes "trade" (v2) ne sont plus interactives : on les garde comme simple historique
  // Les textes des anciennes versions contiennent des emojis : convertis en icônes dessinées
  s.notices = (Array.isArray(data.notices) ? data.notices : []).map((n) => {
    const { trade: _old, ...rest } = n as typeof n & { trade?: unknown };
    void _old;
    return deepLegacyToIcons(rest);
  });
  s.nextNoticeId = Number(data.nextNoticeId) || s.notices.reduce((m, n) => Math.max(m, n.id + 1), 1);
  s.morale = typeof data.morale === 'number' ? data.morale : MORALE.start;
  s.pending = Array.isArray(data.pending) ? data.pending : [];
  s.nextPendingId = Number(data.nextPendingId) || 1;
  // v5 → v6 : bandits, orage et crue en temps réel (l'ancien format d'attaque est abandonné)
  s.raid = data.raid && Array.isArray((data.raid as { bandits?: unknown }).bandits) ? data.raid : null;
  s.storm = data.storm ?? null;
  s.flood = data.flood ?? null;
  s.injuries = Array.isArray(data.injuries) ? data.injuries : [];
  s.floodUntil = Number(data.floodUntil) || 0;
  // v6 → v7 : mécaniques cachées
  const fresh = emptyMech(data.map.tiles.length);
  const old = (data.mech ?? {}) as Partial<GameState['mech']>;
  s.mech = { ...fresh, ...old, memo: { ...(old.memo ?? {}) }, chronicle: { ...fresh.chronicle, ...(old.chronicle ?? {}) } };
  if (!Array.isArray(s.mech.forest) || s.mech.forest.length !== data.map.tiles.length) s.mech.forest = fresh.forest;
  // v3 → v4 : parcelles. Une ancienne partie garde toute sa carte (tout est déjà possédé), sans danger.
  if (!data.parcels || !Array.isArray(data.parcels.owned)) {
    s.parcels = { owned: ALL_PARCELS.map((p) => p.id), bought: 0 };
  }
  s.features = Array.isArray(data.features) ? data.features : [];
  // v4 → v5 : chaînes de production (nouvelles ressources à 0, ressources découvertes)
  s.resources = { ...START_RESOURCES, ...(data.resources as Partial<GameState['resources']>) };
  for (const k of RESOURCE_KEYS) s.resources[k] = Number(s.resources[k]) || 0;
  s.discovered = Array.isArray(data.discovered)
    ? data.discovered
    : RESOURCE_KEYS.filter((k) => BASE_RESOURCES.includes(k) || s.resources[k] > 0);
  delete (s as GameState & { nextEventDay?: number }).nextEventDay;
  s.modifiers = Array.isArray(data.modifiers) ? data.modifiers : [];
  if (!Array.isArray(s.unlocked)) {
    // Anciennes parties : on accorde silencieusement ce que la situation actuelle débloque
    // (et tout type déjà présent sur la carte reste constructible).
    s.unlocked = [...new Set(s.buildings.filter((b) => BUILDING_BY_ID[b.type].buildable).map((b) => unlockKey(b.type, 1)))];
    applyUnlocks(s, false);
  }
  s.version = SAVE_VERSION;
  return s;
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = migrate(JSON.parse(raw) as GameState);
    if (!data || data.gameOver) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignoré
  }
}
