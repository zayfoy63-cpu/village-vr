import { useRef } from 'react';
import type * as THREE from 'three';
import { BUILDING_BY_ID } from '../../game/buildings';
import { DAMAGED_FACTOR, RESOURCE_KEYS, RESOURCE_META } from '../../game/config';
import { canAfford, canUpgrade, chainReport, effectLabel, nominalProduction, repairCost, simulateProduction, statsOf } from '../../game/rules';
import type { Building, Resources } from '../../game/types';
import { useGame } from '../../store/gameStore';
import { feedback } from '../feedback';
import { useVR } from '../store';
import { Button3D, FacePlayer, Label, Panel, THEME, textWidth, useAutoClose } from './kit';
import { I } from '../../ui/icons';

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

  // Ligne d'état : feu, dégâts, puis la raison exacte de l'arrêt ou de la marche réduite
  const report = chainReport(game, b, run);
  let status: { text: string; color: string } | null = null;
  if (b.fire) status = { text: `${I.fire} En feu ! Tapotez les flammes`, color: THEME.bad };
  else if (b.damaged) status = { text: `${I.hammer} Endommagé (production x${DAMAGED_FACTOR})`, color: THEME.warn };
  else if (report.stop) {
    const bad = report.stop.kind === 'input' || report.stop.kind === 'workers';
    status = { text: `${I.forbidden} ${report.stop.text}`, color: bad ? THEME.bad : THEME.dim };
  } else if (report.slow) status = { text: `${I.worker} ${report.slow}`, color: THEME.warn };
  // Stock d'entrée et production en cours (transformateurs et producteurs)
  const flow = [
    report.inputs.length ? `Entrée ${report.inputs.map((i) => `${RESOURCE_META[i.key].icon} ${i.have} (${i.perDay}/j)`).join(' ')}` : '',
    stats.produces ? (report.outputs.length ? `En cours ${report.outputs.map((o) => `+${o.perDay} ${RESOURCE_META[o.key].icon}/j`).join(' ')}` : 'En cours : rien') : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const buttons: React.ReactNode[] = [];
  if (b.fire && b.fire.extinguishEnd === undefined)
    buttons.push(<Button3D key="fire" width={0.15} height={0.065} icon={I.drop} label="Éteindre" onActivate={() => extinguish(b.id)} />);
  if (b.damaged && !b.fire)
    buttons.push(
      <Button3D key="rep" width={0.15} height={0.065} icon={I.hammer} label="Réparer" sub={costText(rc)} disabled={!canAfford(game.resources, rc)} onActivate={() => repair(b.id)} />,
    );
  if (hasUpgrade && !b.fire)
    buttons.push(
      <Button3D
        key="up"
        width={0.15}
        height={0.065}
        icon={I.up}
        label="Améliorer"
        seal
        sub={check.locked ? I.lock : check.next ? costText(check.next.cost) : ''}
        disabled={!check.ok}
        onActivate={() => {
          if (upgrade(b.id)) feedback('drop');
        }}
      />,
    );
  if (stats.workers && !b.fire)
    buttons.push(
      <Button3D key="pause" width={0.15} height={0.065} icon={b.paused ? I.play : I.pause} label={b.paused ? 'Relancer' : 'Arrêter'} onActivate={() => togglePause(b.id)} />,
    );
  const title = `${def.icon} ${def.name} · niv. ${b.level}`;
  // Largeur : les boutons, et le titre entre la croix (à gauche) et les travailleurs (à droite)
  const w = Math.max(0.34, buttons.length * 0.16 + 0.06, textWidth(title, 0.034) + (stats.workers ? 0.19 : 0.12));
  // Lignes longues : elles passent à la ligne, le panneau grandit d'autant (aucun chevauchement)
  const lines = (text: string, size: number) => Math.max(1, Math.ceil(textWidth(text, size) / (w - 0.05)));
  const curLines = lines(current, 0.026);
  const stLines = status ? lines(status.text, 0.024) : 0;
  const flowLines = flow ? lines(flow, 0.022) : 0;
  const extraCur = (curLines - 1) * 0.032;
  const flowH = flow ? 0.04 + (flowLines - 1) * 0.026 : 0;
  const h = 0.2 + extraCur + flowH + (status ? 0.045 + (stLines - 1) * 0.029 : 0);
  return (
    <Panel width={w} height={h}>
      <Label title text={title} size={0.036} position={[0, h / 2 - 0.035, 0]} />
      <Label text={current} size={0.026} color={THEME.accent} position={[0, h / 2 - 0.075 - extraCur / 2, 0]} maxWidth={w - 0.05} />
      {stats.workers ? <Label text={`${I.worker} ${b.workers}/${stats.workers}`} size={0.026} position={[w / 2 - 0.06, h / 2 - 0.035, 0]} /> : null}
      {flow && <Label text={flow} size={0.022} weight={600} color={THEME.text} position={[0, h / 2 - 0.108 - extraCur - ((flowLines - 1) * 0.026) / 2, 0]} maxWidth={w - 0.05} />}
      {status && (
        <Label text={status.text} size={0.024} color={status.color} position={[0, h / 2 - 0.112 - extraCur - flowH - ((stLines - 1) * 0.029) / 2, 0]} maxWidth={w - 0.05} />
      )}
      <group position={[0, -h / 2 + 0.05, 0.004]}>
        {buttons.map((btn, i) => (
          <group key={i} position={[(i - (buttons.length - 1) / 2) * 0.16, 0, 0]}>
            {btn}
          </group>
        ))}
      </group>
      <Button3D width={0.045} height={0.045} icon={I.close} position={[-w / 2 + 0.03, h / 2 - 0.03, 0.004]} onActivate={() => inspect(null)} />
    </Panel>
  );
}

