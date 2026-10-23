import { useState } from 'react';
import { RESOURCE_META } from '../../game/config';
import { useHudModel } from '../../ui/hudModel';
import { FacePlayer, Label, Panel, Plate, THEME, textWidth } from './kit';
import { VR_CONFIG } from '../config';
import { useVR } from '../store';
import { I } from '../../ui/icons';

const TXT = VR_CONFIG.ui.text;

/** Objet ciblé seulement par les rayons et la souris (propriété de @pmndrs/pointer-events) */
const rayOnly = (o: unknown) => {
  if (o) (o as { pointerEventsType?: unknown }).pointerEventsType = { deny: ['grab', 'touch'] };
};

/** Une ressource : icône, valeur, variation du jour ; au survol de l'icône (si `name`), son nom en petit au-dessus */
function Chip({ x, icon, name, value, net, color }: { x: number; icon: string; name?: string; value: string; net?: number; color?: string }) {
  const [hover, setHover] = useState(false);
  return (
    <group position={[x, 0, 0]}>
      <Label text={icon} size={TXT * 1.2} position={[-0.045, 0.004, 0]} />
      {/* Zone de survol (invisible), juste la taille de l'icône. Rayons et souris seulement : une saisie
          (bandit qui passe devant le présentoir) ou un doigt qui vise un bouton voisin ne s'y arrêtent pas */}
      {name && (
        <mesh
          position={[-0.045, 0.004, 0.003]}
          userData={{ testId: `chip:${name}` }}
          ref={rayOnly}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHover(true);
          }}
          onPointerOut={() => setHover(false)}
        >
          <planeGeometry args={[0.04, 0.04]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      )}
      {hover && name && (
        <group position={[-0.045, 0.05, 0.004]}>
          <Plate width={textWidth(name, 0.022, 600) + 0.016} height={0.034} color={THEME.panelSolid} border={THEME.accent} radius={0.008} borderWidth={0.002} />
          <Label text={name} size={0.022} weight={600} color={THEME.accent} position={[0, 0, 0.001]} />
        </group>
      )}
      <Label text={value} size={TXT} color={color ?? THEME.text} position={[-0.02, 0.004, 0]} align="left" />
      {net !== undefined && Math.abs(net) >= 0.05 && (
        <Label text={`${net > 0 ? '+' : ''}${Math.round(net * 10) / 10}`} size={TXT * 0.6} color={net > 0 ? THEME.good : THEME.bad} position={[-0.02, -0.027, 0]} align="left" weight={600} />
      )}
    </group>
  );
}

/**
 * Présentoir des ressources, posé sur le bord du plateau (jamais flottant devant les yeux).
 * Rangée du haut : ressources ; rangée du bas : habitants, moral, saison.
 */
export function Hud3D({ z }: { z: number }) {
  const h = useHudModel();
  const showFps = useVR((s) => s.prefs.showFps);
  const fps = useVR((s) => s.fps);
  const low = useVR((s) => s.lowQuality);
  const stats = useVR((s) => s.stats);
  const chips = [...h.base, ...h.advanced];
  const w = Math.max(0.56, chips.length * 0.112 + 0.04);
  const half = w / 2;
  return (
    <FacePlayer position={[0, 0.07, z + 0.02]} tilt={0.5}>
      <Panel width={w} height={0.16}>
        <group position={[0, 0.036, 0]}>
          {chips.map((c, i) => (
            <Chip
              key={c.key}
              x={-half + 0.07 + i * ((w - 0.14) / Math.max(1, chips.length - 1))}
              icon={c.icon}
              name={RESOURCE_META[c.key].short}
              value={String(c.value)}
              net={c.net}
            />
          ))}
        </group>
        <group position={[0, -0.036, 0]}>
          <Chip x={-half + 0.08} icon={I.people} value={`${h.population}/${h.capacity}`} color={h.population > h.capacity ? THEME.warn : THEME.text} />
          <Chip x={-half + 0.2} icon={h.moraleIcon} value={String(h.morale)} color={h.morale < 40 ? THEME.bad : THEME.text} />
          <Chip x={-half + 0.31} icon={I.worker} value={`${h.working}/${h.jobs}`} />
          {h.injured > 0 && <Chip x={-half + 0.4} icon={I.injured} value={String(h.injured)} color={THEME.warn} />}
          <Label text={`${h.seasonIcon} ${h.seasonName} ${h.dayInSeason}/${h.daysPerSeason}`} size={TXT * 0.72} align="right" position={[half - 0.02, 0.014, 0]} />
          <Label text={`Jour ${h.day}`} size={TXT * 0.62} align="right" color={THEME.dim} position={[half - 0.02, -0.014, 0]} />
        </group>
        {showFps && (
          <Label
            text={`${fps} fps · ${stats.calls} appels · ${Math.round(stats.triangles / 1000)}k tri · ${stats.textures} tex${low ? ' · qualité réduite' : ''}`}
            size={0.018}
            color={fps < 60 ? THEME.bad : THEME.dim}
            position={[0, -0.108, 0]}
            weight={600}
          />
        )}
      </Panel>
    </FacePlayer>
  );
}
