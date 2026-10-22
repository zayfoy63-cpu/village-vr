import { useShallow } from 'zustand/react/shallow';
import { RESOURCE_KEYS, RESOURCE_META, dayInSeason, seasonOf, yearOf, DAYS_PER_SEASON } from '../game/config';
import { computeNet, hasModifier, housingCapacity, jobsCapacity } from '../game/rules';
import { useGame } from '../store/gameStore';

const MODIFIER_LABELS = [
  { id: 'drought', label: '🌵 Sécheresse' },
  { id: 'harshWinter', label: '🥶 Hiver rude' },
  { id: 'goodHarvest', label: '🌻 Bonne récolte' },
] as const;

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
        <div className="hud-item">
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
