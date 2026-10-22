import { useGame } from '../store/gameStore';

function countdown(arriveDay: number, day: number): string {
  const d = arriveDay - day;
  if (d <= 0) return 'aujourd\'hui';
  if (d === 1) return 'demain';
  return `dans ${d} j`;
}

/** Petite liste des événements annoncés, avec leur compte à rebours */
export function ThreatList() {
  const notices = useGame((s) => s.game.notices);
  const threats = notices.filter((n) => n.threat && !n.threat.done);
  const day = useGame((s) => s.game.day);
  if (!threats.length) return null;
  const sorted = [...threats].sort((a, b) => a.threat!.arriveDay - b.threat!.arriveDay);
  return (
    <div className="threat-list">
      <div className="threat-head">⚠️ Menaces à venir</div>
      {sorted.map((n) => {
        const d = n.threat!.arriveDay - day;
        return (
          <div key={n.id} className={`threat-item ${d <= 1 ? 'soon' : ''}`} title={n.text}>
            <span className="threat-icon">{n.icon}</span>
            <span className="threat-title">{n.title}</span>
            <span className="threat-time">{countdown(n.threat!.arriveDay, day)}</span>
            {n.choice && !n.choice.resolved && <span className="threat-prep" title="Une préparation est possible">🛠️</span>}
          </div>
        );
      })}
    </div>
  );
}
