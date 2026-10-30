import { useShallow } from 'zustand/react/shallow';
import {
  ADVANCED_RESOURCES,
  BASE_RESOURCES,
  MORALE,
  RESOURCE_META,
  dayInSeason,
  seasonOf,
  yearOf,
  DAYS_PER_SEASON,
} from '../game/config';
import type { Resources } from '../game/types';
import { difficultyOf } from '../game/difficulty';
import { severity } from '../game/events';
import { computeNet, hasModifier, injuredCount, housingCapacity, jobsCapacity, moraleFactor } from '../game/rules';
import { useGame } from '../store/gameStore';
import { I } from './icons';
import { Icon, RichText } from './icons/Icon';

const MODIFIER_LABELS = [
  { id: 'drought', label: `${I.cactus} Sécheresse` },
  { id: 'harshWinter', label: `${I.cold} Hiver rude` },
  { id: 'goodHarvest', label: `${I.sunflower} Bonne récolte` },
  { id: 'quarantine', label: `${I.mask} Quarantaine` },
  { id: 'blight', label: `${I.wilted} Récoltes malades` },
  { id: 'sheltered', label: `${I.house} Villageois à l'abri` },
] as const;

function moraleLook(m: number): { icon: string; cls: string; label: string } {
  if (m < MORALE.revoltBelow) return { icon: I.furious, cls: 'critical', label: 'Révolte imminente' };
  if (m < MORALE.leaveBelow) return { icon: I.angry, cls: 'bad', label: 'Des habitants partent chaque jour' };
  if (m < MORALE.lowProduction) return { icon: I.worried, cls: 'low', label: 'Production réduite' };
  if (m < 70) return { icon: I.smile, cls: 'ok', label: 'Correct' };
  return { icon: I.happy, cls: 'good', label: 'Excellent' };
}

/** Jauge de moral : faim, pertes et pillages la font baisser ; marchés, tours et réserves la soutiennent */
function MoraleGauge() {
  const morale = useGame((s) => Math.round(s.game.morale));
  const look = moraleLook(morale);
  const factor = moraleFactor(useGame.getState().game);
  const tip = [
    `Moral ${morale}/100 — ${look.label}`,
    factor < 1 ? `Production x${factor.toFixed(2)}` : '',
    `< ${MORALE.lowProduction} : production réduite · < ${MORALE.leaveBelow} : départs · < ${MORALE.revoltBelow} : révolte`,
    'Baisse : faim, morts, pillages, incendies, bâtiments abîmés, surpopulation',
    'Hausse : réserves de nourriture, marchés, tours de garde, victoires',
  ]
    .filter(Boolean)
    .join('\n');
  return (
    <div className={`hud-item morale ${look.cls}`} title={tip}>
      <span className="hud-icon"><RichText text={look.icon} /></span>
      <div className="morale-bar">
        <div className="morale-fill" style={{ width: `${morale}%` }} />
        <div className="morale-mark" style={{ left: `${MORALE.lowProduction}%` }} />
        <div className="morale-mark" style={{ left: `${MORALE.leaveBelow}%` }} />
      </div>
      <span className="hud-value">{morale}</span>
    </div>
  );
}

function ResourceItem({ k, value, net }: { k: keyof Resources; value: number; net: number }) {
  return (
    <div className="hud-item" title={RESOURCE_META[k].name}>
      <span className="hud-icon"><RichText text={RESOURCE_META[k].icon} /></span>
      <span className="hud-value">{Math.floor(value)}</span>
      {Math.abs(net) >= 0.05 && <span className={`hud-delta ${net < 0 ? 'neg' : 'pos'}`}>{signed(net)}/j</span>}
    </div>
  );
}

function signed(n: number) {
  const r = Math.round(n * 10) / 10;
  return r > 0 ? `+${r}` : `${r}`;
}

/** Bandeau du haut : ressources, population, jour et saison */
export function HUD() {
  // Les champs lus ne changent qu'une fois par jour ou à la construction : pas de rendu par image
  const data = useGame(
    useShallow((s) => ({
      resources: s.game.resources,
      population: s.game.population,
      buildings: s.game.buildings,
      day: s.game.day,
      modifiers: s.game.modifiers,
      discovered: s.game.discovered,
    })),
  );
  const game = useGame.getState().game;
  const injured = useGame((s) => injuredCount(s.game));
  const progress = useGame((s) => Math.floor(s.game.dayProgress * 50) / 50);
  const net = computeNet(game);
  const season = seasonOf(data.day);
  const capacity = housingCapacity(game);
  const jobs = jobsCapacity(game);
  const difficulty = difficultyOf(game);
  const graceLeft = Math.max(0, difficulty.graceDays - data.day + 1);
  const advanced = ADVANCED_RESOURCES.filter((k) => data.discovered.includes(k));

  return (
    <div className="hud">
      <div className="hud-group">
        {BASE_RESOURCES.map((k) => (
          <ResourceItem key={k} k={k} value={data.resources[k]} net={net[k]} />
        ))}
      </div>
      <div className="hud-group">
        <div className="hud-item" title="Population / places">
          <span className="hud-icon"><Icon id="people" /></span>
          <span className="hud-value">
            {data.population}/{capacity}
          </span>
        </div>
        {injured > 0 && (
          <div className="hud-item injured" title="Villageois blessés : ils ne travaillent pas pendant quelques jours">
            <span className="hud-icon"><Icon id="injured" /></span>
            <span className="hud-value">{injured}</span>
          </div>
        )}
        <MoraleGauge />
        <div className="hud-item" title="Travailleurs occupés / postes">
          <span className="hud-icon"><Icon id="worker" /></span>
          <span className="hud-value">
            {Math.min(data.population, jobs)}/{jobs}
          </span>
        </div>
      </div>
      <div className="hud-group hud-time">
        <div className="hud-item" title={`Année ${yearOf(data.day)}`}>
          <span className="hud-icon"><RichText text={season.icon} /></span>
          <span className="hud-value">
            {season.name} {dayInSeason(data.day)}/{DAYS_PER_SEASON}
          </span>
        </div>
        <div className="hud-item" title={`Danger : x${severity(game).toFixed(2)} (augmente à chaque saison)
Difficulté : ${difficulty.name} (score x${difficulty.scoreMult})${graceLeft > 0 ? `
Période de grâce : encore ${graceLeft} j` : ''}`}>
          <span className="hud-value">Jour {data.day}</span>
          <span className="hud-difficulty"><RichText text={difficulty.icon} /> {difficulty.name}{graceLeft > 0 ? ` · grâce ${graceLeft} j` : ''}</span>
          <div className="day-bar">
            <div className="day-bar-fill" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      </div>
      {MODIFIER_LABELS.some((m) => hasModifier(game, m.id)) && (
        <div className="hud-group">
          {MODIFIER_LABELS.filter((m) => hasModifier(game, m.id)).map((m) => (
            <span key={m.id} className="hud-mod">
              <RichText text={m.label} />
            </span>
          ))}
        </div>
      )}
      {advanced.length > 0 && (
        <div className="hud-group hud-advanced" title="Ressources avancées des chaînes de production">
          {advanced.map((k) => (
            <ResourceItem key={k} k={k} value={data.resources[k]} net={net[k]} />
          ))}
        </div>
      )}
    </div>
  );
}
