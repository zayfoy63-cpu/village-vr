// Types partagés par toute la logique de jeu (aucune dépendance React / Three).

import type { DifficultyId } from './config';

export type TileType = 'grass' | 'fertile' | 'forest' | 'rock' | 'water';

export interface GameMap {
  seed: number;
  width: number;
  height: number;
  /** Index = z * width + x */
  tiles: TileType[];
}

/** Ressources de base (food = blé) puis ressources avancées des chaînes de production */
export type ResourceKey =
  | 'food'
  | 'wood'
  | 'stone'
  | 'gold'
  | 'flour'
  | 'bread'
  | 'planks'
  | 'ironOre'
  | 'tools'
  | 'weapons'
  /** Laine des bergeries (future chaîne de vêtements contre le froid) */
  | 'wool';
export type Resources = Record<ResourceKey, number>;

export type BuildingTypeId =
  | 'castle'
  | 'mill'
  | 'hut'
  | 'house'
  | 'townhouse'
  | 'manor'
  | 'field'
  | 'lumber'
  | 'quarry'
  | 'market'
  | 'tower'
  | 'granary'
  | 'bakery'
  | 'sawmill'
  | 'mine'
  | 'forge'
  // Bâtiments liés aux mécaniques cachées (description volontairement vague)
  | 'dike'
  | 'well'
  | 'sheepfold'
  | 'herbalist'
  | 'palisade'
  | 'torch'
  /** Apparaît de lui-même après les premiers décès (non constructible) */
  | 'cemetery';

export interface Building {
  id: number;
  type: BuildingTypeId;
  x: number;
  z: number;
  /** Niveau d'amélioration (1 = construit) */
  level: number;
  /** Nombre de villageois actuellement affectés */
  workers: number;
  /** Jour de construction */
  builtDay: number;
  /** Endommagé (tempête, incendie, révolte…) : produit moins tant qu'il n'est pas réparé */
  damaged?: boolean;
  /** Mis à l'arrêt par le joueur (libère ses travailleurs) */
  paused?: boolean;
  /** Renforcé contre l'orage / la crue en cours */
  reinforced?: boolean;
  /** Incendie en cours */
  fire?: Fire;
  /** Temps de jeu de la pose (déplacement gratuit juste après) */
  placedT?: number;
  /** Soulevé par le joueur (VR) : production en pause jusqu'à la repose */
  moving?: boolean;
  /** Champ : épuisement du sol, 0 (sol neuf) → 1 (épuisé) */
  fatigue?: number;
  /** Mine : instabilité des galeries, 0 → 1 (effondrement) */
  instability?: number;
  /** Bergerie : maigreur du troupeau, 0 (gras) → 1 (squelettique) ; absente = gras */
  lean?: number;
}

/** Les temps sont en "temps de jeu" : jour + avancement (ex. 12.5 = milieu du jour 12) */
export interface Fire {
  start: number;
  /** Prochaine tentative de propagation */
  nextSpread: number;
  /** Destruction si le feu n'est pas éteint avant */
  destroyAt: number;
  /** Extinction en cours : fin prévue et villageois mobilisés */
  extinguishEnd?: number;
  crew?: number;
  /** Le feu a gagné un voisin */
  spread?: boolean;
}

export interface Point {
  x: number;
  z: number;
}

/**
 * Bandit en mouvement. Son trajet est entièrement déterminé à l'avance (bord → cible → bord),
 * ce qui permet de calculer sa position à tout instant sans simulation image par image.
 */
export interface Bandit {
  id: number;
  from: Point;
  target: Point;
  exit: Point;
  /** Bâtiment visé (-1 = château) */
  targetId: number;
  startT: number;
  arriveT: number;
  stealEndT: number;
  escapeT: number;
  /** Butin emporté (rempli à la fin du vol) */
  loot: Partial<Resources>;
  looted: boolean;
  status: 'active' | 'caught' | 'escaped';
  /** Moment de la capture ou de la fuite */
  endT?: number;
  /** Garde (ou villageois) lancé à sa poursuite */
  chasedBy?: number;
}

/** Garde (ou villageois) qui court intercepter un bandit, puis revient */
export interface Guard {
  id: number;
  banditId: number;
  /** Villageois sans tour : plus lent, peut être blessé */
  villager: boolean;
  towerId: number;
  from: Point;
  meet: Point;
  startT: number;
  meetT: number;
  backT: number;
  done: boolean;
}

export interface Raid {
  bandits: Bandit[];
  guards: Guard[];
  nextGuardId: number;
  /** Prochaine vérification des gardes automatiques des tours */
  nextCheckT: number;
  /** Carte ransom / combat associée (temps réel, ne met pas en pause) */
  noticeId?: number;
  report: { caught: number; escaped: number; lost: Partial<Resources>; recovered: Partial<Resources>; reward: number; injured: number };
}

/** Orage qui traverse la carte */
export interface Storm {
  /** Début de la traversée (avant : le nuage se forme au bord de la carte) */
  startT: number;
  /** Centre au début, direction (unitaire), vitesse (cases / jour), rayon (cases) */
  from: Point;
  dir: Point;
  speed: number;
  radius: number;
  endT: number;
  /** Moment où le nuage atteint la carte (fin de la préparation) */
  arriveT: number;
  /** Bâtiments déjà touchés (dégâts tirés une seule fois) */
  rolled: number[];
  nextCheckT: number;
  nextLightningT: number;
  /** Éclairs récents (pour l'affichage) */
  strikes: { x: number; z: number; t: number }[];
  /** Dégâts causés (bilan affiché à la fin) */
  hits: string[];
  shelter: boolean;
  cropsProtected: boolean;
}

/** Crue : l'eau monte jusqu'au pic, puis redescend */
export interface Flood {
  startT: number;
  peakT: number;
  endT: number;
  protected: boolean;
  /** Bâtiments menacés (au bord de l'eau) */
  threatened: number[];
  resolved: boolean;
  /** Bâtiments au bord de l'eau protégés par une digue */
  saved?: number[];
}

/** Mécaniques cachées, découvertes en jouant (voir game/mechanics) */
export type MechanicId =
  | 'flood'
  | 'soil'
  | 'cold'
  | 'fire'
  | 'rats'
  | 'disease'
  | 'scout'
  | 'deforestation'
  | 'wolves'
  | 'mine';

/** Éclaireur bandit immobile au bord de la carte, quelques jours avant une attaque */
export interface Scout {
  pendingId: number;
  x: number;
  z: number;
  /** Poursuite lancée par le joueur : départ, point de départ et capture */
  chase?: { from: Point; startT: number; meetT: number };
}

/** Meute de loups sortie de la forêt pendant une nuit d'hiver */
export interface WolfPack {
  count: number;
  from: Point;
  /** Point où la meute s'arrête : la cible, ou la limite de la lumière si elle est protégée */
  to: Point;
  targetId: number;
  startT: number;
  arriveT: number;
  leaveT: number;
  repelled: boolean;
  resolved: boolean;
}

export interface MechState {
  /** Météo du jour (tirée selon la saison) */
  rain: boolean;
  rainStreak: number;
  /** Gonflement de la rivière, 0 → 1 (crue) */
  river: number;
  /** Santé de la forêt par case (index = z * largeur + x ; 1 = intacte, 0 = rasée) */
  forest: number[];
  /** Jours d'hiver consécutifs sans bois de chauffage */
  cold: number;
  /** Jours sans bois de chauffage pendant l'hiver en cours */
  coldThisWinter: number;
  /** Maladie qui couve, 0 → 1 */
  sickness: number;
  /** Rats installés près des réserves (jours d'exposition) */
  rats: number;
  scout: Scout | null;
  wolves: WolfPack | null;
  /** Morts depuis le début de la partie (tombes du cimetière) */
  deaths: number;
  /** Compteurs internes des mécaniques (jours consécutifs, maxima…) */
  memo: Record<string, number>;
  /** Pages de la Chronique gagnées pendant cette partie */
  chronicle: { struck: MechanicId[]; solved: MechanicId[] };
}

/** Villageois blessés : ne travaillent pas jusqu'au jour indiqué */
export interface Injury {
  count: number;
  untilDay: number;
}

export type ModifierId = 'drought' | 'harshWinter' | 'goodHarvest' | 'quarantine' | 'blight' | 'sheltered';

export interface Modifier {
  id: ModifierId;
  /** Dernier jour (inclus) où le modificateur s'applique */
  untilDay: number;
}

export type NoticeKind = 'good' | 'bad' | 'info' | 'trade' | 'threat';

/** Paramètres libres d'un événement (force, quantités…), sauvegardables */
export type EventParams = Record<string, number>;

/** Conséquence affichée sur une option : icône + texte court, colorée selon le ton */
export interface ChoiceEffect {
  icon: string;
  text: string;
  tone: 'good' | 'bad' | 'neutral';
}

export interface ChoiceOption {
  id: string;
  label: string;
  detail: string;
  /** Coût payé si l'option est choisie (option grisée si impossible) */
  cost?: Partial<Resources>;
  /** Conséquences résumées (icônes + chiffres) */
  effects?: ChoiceEffect[];
}

export interface NoticeChoice {
  eventId: string;
  options: ChoiceOption[];
  /** Option appliquée si le joueur ne répond pas à temps */
  defaultId: string;
  /** Temps de jeu limite pour répondre */
  expiresT: number;
  params: EventParams;
  resolved: boolean;
  picked?: string;
  /** Événement en temps réel : ne déclenche pas la pause automatique */
  realtime?: boolean;
}

/** Événement annoncé à l'avance (compte à rebours) */
export interface PendingEvent {
  id: number;
  eventId: string;
  arriveDay: number;
  params: EventParams;
  noticeId: number;
}

export interface Notice {
  id: number;
  day: number;
  kind: NoticeKind;
  icon: string;
  title: string;
  text: string;
  /** Carte à choix (bandits, épidémie, marchand…) */
  choice?: NoticeChoice;
  /** Menace annoncée : jour d'arrivée (la carte reste affichée jusque-là) */
  threat?: { arriveDay: number; done: boolean };
  /** Case concernée (la bulle VR s'affiche au-dessus du bâtiment) */
  at?: { x: number; z: number };
}

/** Danger posé sur une parcelle : camp de bandits ou ruines (occupe des cases tant qu'il n'est pas réglé) */
export interface ParcelFeature {
  id: number;
  parcel: number;
  type: 'camp' | 'ruins';
  x: number;
  z: number;
  w: number;
  h: number;
  cleared: boolean;
  /** Force du camp (0 pour des ruines) */
  strength: number;
  /** Butin / trésor récupéré quand on règle le danger */
  loot: Partial<Resources>;
}

export interface GameStats {
  maxPopulation: number;
  buildingsBuilt: number;
  upgrades: number;
  eventsSurvived: number;
  banditsKilled: number;
  firesPutOut: number;
}

export interface GameState {
  version: number;
  seed: number;
  /** Niveau de difficulté choisi au lancement (les anciennes parties sont en Normal) */
  difficulty: DifficultyId;
  /** État interne du PRNG, sauvegardé pour rester déterministe */
  rngState: number;
  map: GameMap;
  resources: Resources;
  population: number;
  buildings: Building[];
  nextBuildingId: number;
  /** Jour courant (commence à 1) */
  day: number;
  /** Avancement du jour courant, 0..1 */
  dayProgress: number;
  modifiers: Modifier[];
  notices: Notice[];
  nextNoticeId: number;
  /** Clés de déblocage acquises (voir unlockKey) : définitives une fois obtenues */
  unlocked: string[];
  /** Moral des habitants, 0..100 */
  morale: number;
  /** Événements annoncés à venir */
  pending: PendingEvent[];
  nextPendingId: number;
  /** Attaque de bandits en cours sur la carte */
  raid: Raid | null;
  /** Crue en cours (affichage) jusqu'à ce temps de jeu */
  floodUntil: number;
  storm: Storm | null;
  flood: Flood | null;
  injuries: Injury[];
  /** Saisons, météo et mécaniques cachées */
  mech: MechState;
  /** Parcelles possédées (ids, voir parcels.ts) et nombre d'achats effectués */
  parcels: { owned: number[]; bought: number };
  /** Dangers des parcelles (camps de bandits, ruines) */
  features: ParcelFeature[];
  /** Ressources déjà découvertes (le HUD n'affiche que celles-ci) */
  discovered: ResourceKey[];
  stats: GameStats;
  gameOver: boolean;
  /** Annales : événements marquants nommés (facultatif : absent des anciennes sauvegardes) */
  annals?: { day: number; icon: string; name: string; line: string }[];
}

export interface PlacementCheck {
  ok: boolean;
  reason?: string;
}
