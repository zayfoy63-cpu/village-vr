// Prénoms des villageois : prénoms médiévaux, parfois un surnom. Tirés d'un hachage stable (même
// villageois, même nom d'une partie à l'autre) : rien à sauvegarder.

import { hash2 } from './rng';

const MEN = [
  'Aubin', 'Bertrand', 'Guillaume', 'Thibaut', 'Gauthier', 'Enguerrand', 'Arnaud', 'Renaud', 'Hugues', 'Perrin',
  'Colin', 'Jehan', 'Mathurin', 'Gilles', 'Baudouin', 'Amaury', 'Raoul', 'Gervais', 'Bérenger', 'Eudes',
  'Foulques', 'Anselme', 'Clément', 'Martin', 'Josselin', 'Odon', 'Tancrède', 'Robin', 'Gautier', 'Lambert',
];

const WOMEN = [
  'Aliénor', 'Isabeau', 'Mahaut', 'Héloïse', 'Blanche', 'Jehanne', 'Ysabel', 'Perrine', 'Agnès', 'Béatrix',
  'Ermengarde', 'Aude', 'Clémence', 'Sibylle', 'Pernelle', 'Margot', 'Mélisende', 'Bertille', 'Adélaïde', 'Gisèle',
  'Oriane', 'Esclarmonde', 'Ide', 'Marguerite', 'Guillemette', 'Alix', 'Mabille', 'Ermessinde', 'Tiphaine', 'Edeline',
];

const NICK_M = ['le Roux', 'le Boiteux', 'le Jeune', 'le Vieux', 'Courtecuisse', 'le Bègue', 'Bonnefoy', 'le Bossu', 'Tête-de-Pioche', 'le Pieux'];
const NICK_F = ['la Rousse', 'la Brune', 'la Jeune', 'la Vieille', 'Bonnemain', 'la Sage', 'la Rieuse', 'Courtepaille', 'la Pieuse', 'Belle-Voix'];

/** Nom du villageois numéro `i` du village `seed` */
export function villagerName(i: number, seed: number): string {
  const woman = hash2(i, seed, 201) > 0.5;
  const list = woman ? WOMEN : MEN;
  const first = list[Math.floor(hash2(i, seed, 202) * list.length)];
  if (hash2(i, seed, 203) > 0.45) return first;
  const nicks = woman ? NICK_F : NICK_M;
  return `${first} ${nicks[Math.floor(hash2(i, seed, 204) * nicks.length)]}`;
}
