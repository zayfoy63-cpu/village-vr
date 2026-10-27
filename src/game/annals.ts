// Annales du village : les événements marquants reçoivent un nom, comme dans une chronique de
// clocher (« Le Grand Feu de l'an 2 », « L'Hiver des Loups »). Noms tirés d'un hachage stable de
// la partie et du jour. Champ facultatif de la sauvegarde (les anciennes parties commencent vides).

import { SEASONS, seasonOf, yearOf } from './config';
import { hash2 } from './rng';
import type { GameState } from './types';
import { I } from '../ui/icons';

export interface Annal {
  day: number;
  icon: string;
  name: string;
  /** Une phrase du chroniqueur */
  line: string;
}

/** Événements dignes des annales, et façons de les nommer ({an} : année, {saison} : saison) */
const NAMES: Record<string, { icon: string; names: string[]; lines: string[] }> = {
  fire: {
    icon: I.fire,
    names: ['Le Grand Feu de l\'an {an}', 'La Nuit des Braises', 'L\'Incendie de {saison}', 'Le Jour où le Chaume brûla'],
    lines: ['On fit la chaîne avec des seaux jusqu\'au matin.', 'Les anciens montrent encore les poutres noircies.'],
  },
  bandits: {
    icon: I.dagger,
    names: ['La Venue des Rôdeurs', 'Le Pillage de {saison}', 'Les Loups à deux Pattes', 'L\'Alerte de l\'an {an}'],
    lines: ['La cloche sonna trois fois avant l\'aube.', 'On compta les poules le lendemain, et il en manquait.'],
  },
  invasion: {
    icon: I.weapons,
    names: ['La Grande Invasion de l\'an {an}', 'Le Siège de {saison}', 'L\'Année des Bannières Noires'],
    lines: ['Jamais le village n\'avait vu tant de lances à la fois.'],
  },
  storm: {
    icon: I.storm,
    names: ['La Grande Tempête de l\'an {an}', 'Le Vent Fou de {saison}', 'L\'Orage des Toits Envolés'],
    lines: ['Le vent arracha les bardeaux comme des feuilles mortes.'],
  },
  harshWinter: {
    icon: I.winter,
    names: ['L\'Hiver des Loups', 'Le Grand Gel de l\'an {an}', 'L\'Hiver où l\'on mangea les semences'],
    lines: ['La rivière gela si fort qu\'on la traversa à pied.'],
  },
  epidemic: {
    icon: I.sick,
    names: ['La Fièvre de {saison}', 'Le Mal des Volets Clos', 'La Fièvre de l\'an {an}'],
    lines: ['On brûla des herbes dans chaque maison.'],
  },
  plague: {
    icon: I.skull,
    names: ['La Grande Peste de l\'an {an}', 'L\'Année des Cloches', 'Le Mal Noir'],
    lines: ['Les cloches sonnèrent plus souvent que de coutume.'],
  },
  greatFamine: {
    icon: I.wheat,
    names: ['La Grande Disette de l\'an {an}', 'L\'Année du Grain Pourri', 'La Faim de {saison}'],
    lines: ['On racla le fond des greniers jusqu\'à la dernière poignée.'],
  },
  drought: {
    icon: I.summer,
    names: ['La Sécheresse de l\'an {an}', 'Les Puits à Sec de {saison}'],
    lines: ['Le blé jaunit avant d\'avoir mûri.'],
  },
  goodHarvest: {
    icon: I.wheat,
    names: ['La Belle Moisson de l\'an {an}', 'L\'Année des Greniers Pleins', 'La Récolte Bénie'],
    lines: ['On chanta jusque tard dans les granges.'],
  },
  refugees: {
    icon: I.people,
    names: ['L\'Arrivée des Exilés', 'Les Réfugiés de {saison}'],
    lines: ['Des visages inconnus, la poussière de la route aux souliers.'],
  },
};

const SEASON_OF: Record<string, string> = { spring: 'printemps', summer: 'l\'été', autumn: 'l\'automne', winter: 'l\'hiver' };

/** Inscrit un événement marquant dans les annales (une seule fois par jour et par événement) */
export function recordAnnal(state: GameState, eventId: string) {
  const def = NAMES[eventId];
  if (!def) return;
  const annals = (state.annals ??= []);
  const day = state.day;
  if (annals.some((a) => a.day === day && a.icon === def.icon)) return;
  const k = hash2(day, eventId.length * 31 + annals.length, state.seed);
  let name = def.names[Math.floor(k * def.names.length)];
  // Un même nom ne revient pas deux fois : sinon on le date
  if (annals.some((a) => a.name.startsWith(name.replace(/\{.*$/, '')))) name = def.names[0];
  const season = seasonOf(day);
  name = name.replace('{an}', String(yearOf(day))).replace('{saison}', SEASON_OF[season.id] ?? SEASONS[0].name);
  const line = def.lines[Math.floor(hash2(day, 7, state.seed) * def.lines.length)];
  annals.push({ day, icon: def.icon, name, line });
}
