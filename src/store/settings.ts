// Réglages du joueur (préférences locales à ce navigateur, protégées par try/catch).

export interface Settings {
  /** Met le jeu en pause quand une carte d'événement à choix apparaît */
  autoPause: boolean;
}

const KEY = 'village-vr-settings';
export const DEFAULT_SETTINGS: Settings = { autoPause: true };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // stockage indisponible : réglage gardé pour la session seulement
  }
}
