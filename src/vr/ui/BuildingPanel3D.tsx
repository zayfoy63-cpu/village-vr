import { useRef } from 'react';
import type * as THREE from 'three';
import { BUILDING_BY_ID } from '../../game/buildings';
import { DAMAGED_FACTOR, RESOURCE_KEYS, RESOURCE_META } from '../../game/config';
import { canAfford, canUpgrade, effectLabel, isCapped, nominalProduction, repairCost, simulateProduction, statsOf } from '../../game/rules';
import type { Building, Resources } from '../../game/types';
import { useGame } from '../../store/gameStore';
import { feedback } from '../feedback';
import { useVR } from '../store';
import { Button3D, FacePlayer, Label, Panel, THEME, useAutoClose } from './kit';

const costText = (c: Partial<Resources>) => RESOURCE_KEYS.filter((k) => c[k]).map((k) => `${c[k]}${RESOURCE_META[k].icon}`).join(' ');

/**
 * Petit panneau au-dessus du bâtiment tapoté : niveau, travailleurs, production, Améliorer, Réparer.
 * Se ferme tout seul quand on regarde ailleurs ou qu'on tapote à côté.
 */
export function BuildingPanel3D() {
  const id = useGame((s) => s.inspected);
  const building = useGame((s) => s.game.buildings.find((b) => b.id === s.inspected) ?? null);
  const scale = useVR((s) => s.board.scale);
  const inspect = useGame((s) => s.inspect);
  const anchor = useRef<THREE.Group>(null);
  useAutoClose(id !== null, () => inspect(null), anchor);
  if (!building) return null;
  const size = BUILDING_BY_ID[building.type].size;
  // Position dans le repère de l'interface : au-dessus de la case (1 case = `scale` mètre)
  const x = (building.x + size / 2 - 10) * scale;
  const z = (building.z + size / 2 - 7) * scale;
  return (
    <group position={[x, 0.033 + 0.05 * size + 0.1, z]}>
      <FacePlayer tilt={0.35}>
        <group ref={anchor}>
          <Content building={building} />
        </group>
      </FacePlayer>
    </group>
  );
}

function Content({ building: b }: { building: Building }) {
  const game = useGame((s) => s.game);
  const upgrade = useGame((s) => s.upgrade);
  const repair = useGame((s) => s.repair);
  const extinguish = useGame((s) => s.extinguish);
  const togglePause = useGame((s) => s.togglePause);
  const inspect = useGame((s) => s.inspect);
  const def = BUILDING_BY_ID[b.type];
  const stats = statsOf(b);
  const check = canUpgrade(game, b);
  const run = simulateProduction(game).status.get(b.id);
  const current = effectLabel(stats, nominalProduction(game, b)) || def.description;
  const hasUpgrade = !!check.next;
  const rc = repairCost(b);

  // Ligne d'état : feu, dégâts, arrêt, manque de matière ou de travailleurs
  let status: { text: string; color: string } | null = null;
  if (b.fire) status = { text: '🔥 En feu ! Tapotez les flammes', color: THEME.bad };
  else if (b.damaged) status = { text: `🔨 Endommagé (production x${DAMAGED_FACTOR})`, color: THEME.warn };
  else if (b.paused) status = { text: '⏸ À l\'arrêt', color: THEME.dim };
  else if (isCapped(game, b)) status = { text: '📦 Stock plein : en pause', color: THEME.dim };
  else if (run?.blocked === 'input') status = { text: `⛔ Manque ${run.missing.map((k) => RESOURCE_META[k].icon).join(' ')}`, color: THEME.bad };
  else if (stats.workers && b.workers < stats.workers) status = { text: `👷 Il manque ${stats.workers - b.workers} travailleur(s)`, color: THEME.warn };

  const buttons: React.ReactNode[] = [];
  if (b.fire && b.fire.extinguishEnd === undefined)
    buttons.push(<Button3D key="fire" width={0.15} height={0.065} icon="💧" label="Éteindre" onActivate={() => extinguish(b.id)} />);
  if (b.damaged && !b.fire)
    buttons.push(
      <Button3D key="rep" width={0.15} height={0.065} icon="🔨" label="Réparer" sub={costText(rc)} disabled={!canAfford(game.resources, rc)} onActivate={() => repair(b.id)} />,
    );
  if (hasUpgrade && !b.fire)
    buttons.push(
      <Button3D
        key="up"
        width={0.15}
        height={0.065}
        icon="⬆️"
        label="Améliorer"
        sub={check.locked ? '🔒' : check.next ? costText(check.next.cost) : ''}
        disabled={!check.ok}
        onActivate={() => {
          if (upgrade(b.id)) feedback('drop');
        }}
      />,
    );
  if (stats.workers && !b.fire)
    buttons.push(
      <Button3D key="pause" width={0.15} height={0.065} icon={b.paused ? '▶️' : '⏸'} label={b.paused ? 'Relancer' : 'Arrêter'} onActivate={() => togglePause(b.id)} />,
    );
  const w = Math.max(0.34, buttons.length * 0.16 + 0.06);
  const h = 0.2 + (status ? 0.045 : 0);
  return (
    <Panel width={w} height={h}>
      <Label text={`${def.icon} ${def.name} · niv. ${b.level}`} size={0.034} position={[0, h / 2 - 0.035, 0]} />
      <Label text={current} size={0.026} color={THEME.accent} position={[0, h / 2 - 0.075, 0]} maxWidth={w - 0.05} />
      {stats.workers ? <Label text={`👷 ${b.workers}/${stats.workers}`} size={0.026} position={[w / 2 - 0.06, h / 2 - 0.035, 0]} /> : null}
      {status && <Label text={status.text} size={0.024} color={status.color} position={[0, h / 2 - 0.112, 0]} maxWidth={w - 0.05} />}
      <group position={[0, -h / 2 + 0.05, 0.004]}>
        {buttons.map((btn, i) => (
          <group key={i} position={[(i - (buttons.length - 1) / 2) * 0.16, 0, 0]}>
            {btn}
          </group>
        ))}
      </group>
      <Button3D width={0.045} height={0.045} icon="✖️" position={[-w / 2 + 0.03, h / 2 - 0.03, 0.004]} onActivate={() => inspect(null)} />
    </Panel>
  );
}

