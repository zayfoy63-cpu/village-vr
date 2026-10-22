import { useShallow } from 'zustand/react/shallow';
import { MORALE, RESOURCE_KEYS, RESOURCE_META, dayInSeason, seasonOf, yearOf, DAYS_PER_SEASON } from '../game/config';
import { severity } from '../game/events';
import { computeNet, hasModifier, housingCapacity, jobsCapacity, moraleFactor } from '../game/rules';
import { useGame } from '../store/gameStore';

const MODIFIER_LABELS = [
  { id: 'drought', label: '🌵 Sécheresse' },
  { id: 'harshWinter', label: '🥶 Hiver rude' },
  { id: 'goodHarvest', label: '🌻 Bonne récolte' },
  { id: 'quarantine', label: '😷 Quarantaine' },
  { id: 'blight', label: '🥀 Récoltes malades' },
] as const;

function moraleLook(m: number): { emoji: string; cls: string; label: string } {
  if (m < MORALE.revoltBelow) return { emoji: '🤬', cls: 'critical', label: 'Révolte imminente' };
  if (m < MORALE.leaveBelow) return { emoji: '😠', cls: 'bad', label: 'Des habitants partent chaque jour' };
  if (m < MORALE.lowProduction) return { emoji: '😟', cls: 'low', label: 'Production réduite' };
  if (m < 70) return { emoji: '🙂', cls: 'ok', label: 'Correct' };
  return { emoji: '😄', cls: 'good', label: 'Excellent' };
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
      <span className="hud-icon">{look.emoji}</span>
      <div className="morale-bar">
        <div className="morale-fill" style={{ width: `${morale}%` }} />
        <div className="morale-mark" style={{ left: `${MORALE.lowProduction}%` }} />
        <div className="morale-mark" style={{ left: `${MORALE.leaveBelow}%` }} />
      </div>
      <span className="hud-value">{morale}</span>
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
    })),
  );
  const game = useGame.getState().game;
  const progress = useGame((s) => Math.floor(s.game.dayProgress * 50) / 50);
  const net = computeNet(game);
  const season = seasonOf(data.day);
  const capacity = housingCapacity(game);
  const jobs = jobsCapacity(game);

  return (
    <div className="hud">
      <div className="hud-group">
        {RESOURCE_KEYS.map((k) => (
          <div key={k} className="hud-item" title={RESOURCE_META[k].name}>
            <span className="hud-icon">{RESOURCE_META[k].icon}</span>
            <span className="hud-value">{Math.floor(data.resources[k])}</span>
            {Math.abs(net[k]) >= 0.05 && (
              <span className={`hud-delta ${net[k] < 0 ? 'neg' : 'pos'}`}>{signed(net[k])}/j</span>
            )}
          </div>
        ))}
      </div>
      <div className="hud-group">
        <div className="hud-item" title="Population / places">
          <span className="hud-icon">👥</span>
          <span className="hud-value">
            {data.population}/{capacity}
          </span>
        </div>
        <MoraleGauge />
        <div className="hud-item" title="Travailleurs occupés / postes">
          <span className="hud-icon">🛠️</span>
          <span className="hud-value">
            {Math.min(data.population, jobs)}/{jobs}
          </span>
        </div>
      </div>
      <div className="hud-group hud-time">
        <div className="hud-item" title={`Année ${yearOf(data.day)}`}>
          <span className="hud-icon">{season.icon}</span>
          <span className="hud-value">
            {season.name} {dayInSeason(data.day)}/{DAYS_PER_SEASON}
          </span>
        </div>
        <div className="hud-item" title={`Danger : x${severity(data.day).toFixed(2)} (augmente à chaque saison)`}>
          <span className="hud-value">Jour {data.day}</span>
          <div className="day-bar">
            <div className="day-bar-fill" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      </div>
      {MODIFIER_LABELS.some((m) => hasModifier(game, m.id)) && (
        <div className="hud-group">
          {MODIFIER_LABELS.filter((m) => hasModifier(game, m.id)).map((m) => (
            <span key={m.id} className="hud-mod">
              {m.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
