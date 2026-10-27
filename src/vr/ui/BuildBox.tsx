import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useRef, useState } from 'react';
import * as THREE from 'three';
import { BUILD_TABS, BUILDING_BY_ID, buildCost, buildingsInTab, type BuildTab } from '../../game/buildings';
import { RESOURCE_KEYS } from '../../game/config';
import { canAfford, conditionLabel, effectLabel, isUnlocked, workersLabel } from '../../game/rules';
import type { BuildingTypeId, Resources } from '../../game/types';
import { formatResources } from '../../game/events';
import { MODELS } from '../../scene/models';
import { Part } from '../../scene/models/Part';
import { useGame } from '../../store/gameStore';
import { VR_CONFIG } from '../config';
import { beginNew, dragState } from '../Drag';
import { feedback } from '../feedback';
import { BOX, boxCenter } from '../layout';
import { useVR } from '../store';
import { Button3D, FacePlayer, Label, Panel, THEME, textWidth } from './kit';
import { I } from '../../ui/icons';
import { PAL } from '../../palette';

// Rugosité commune aux bâtiments : ces pièces rejoignent les mêmes regroupements d'instances
const woodMat = new THREE.MeshStandardMaterial({ color: PAL.wood, roughness: 0.9, flatShading: true });
const woodDark = new THREE.MeshStandardMaterial({ color: PAL.umber, roughness: 0.9, flatShading: true });
const feltMat = new THREE.MeshStandardMaterial({ color: PAL.forest, roughness: 0.9, flatShading: true });
const dimMat = new THREE.MeshBasicMaterial({ color: PAL.slate, transparent: true, opacity: 0.42, depthWrite: false });
const hitMat = new THREE.MeshBasicMaterial({ visible: false });
const trashMat = new THREE.MeshBasicMaterial({ color: PAL.brick, transparent: true, opacity: 0.35, depthWrite: false });

/** Coût en clair : « [icône] 12 Bois, [icône] 4 Pierre » */
const costText = (c: Partial<Resources>) => (RESOURCE_KEYS.some((k) => c[k]) ? formatResources(c) : 'gratuit');

/** Un bâtiment miniature de la boîte : à saisir (pincement / gâchette / grip / clic-glisser) */
function Mini({ type, x, z, onHover }: { type: BuildingTypeId; x: number; z: number; onHover: (t: BuildingTypeId | null) => void }) {
  const Model = MODELS[type];
  const group = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  const unlocked = useGame((s) => isUnlocked(s.game, type));
  const affordable = useGame((s) => canAfford(s.game.resources, buildCost(type)));
  const held = useVR((s) => s.held?.type === type && s.held.kind === 'new');
  const input = useVR((s) => s.input);
  const size = VR_CONFIG.interact.miniSize;
  const hitR = (size * 0.9) / 2 + (input === 'hand' ? VR_CONFIG.ui.handPadding : 0.004);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const target = size * (hover && unlocked ? 1.35 : 1);
    const s = g.scale.x + (target - g.scale.x) * Math.min(1, dt * 14);
    g.scale.setScalar(s);
    g.position.y = BOX.h + (hover && unlocked ? 0.012 : 0.004);
    // Petite oscillation d'invitation sur ce qu'on peut prendre
    g.rotation.y = hover ? g.rotation.y + dt * 1.2 : g.rotation.y * 0.9;
  });

  if (!Model) return null;
  return (
    <group position={[x, 0, z]}>
      <group ref={group} scale={size} visible={!held}>
        <Model id={-1} level={1} />
      </group>
      {!unlocked && (
        <>
          <Part g="box" m={dimMat} p={[0, BOX.h + size * 0.45, 0]} s={[size * 0.95, size * 0.9, size * 0.95]} shadow={false} />
          <Label text={I.lock} size={0.03} position={[0, BOX.h + size * 1.05, size * 0.2]} />
        </>
      )}
      {unlocked && !affordable && <Label text={I.forbidden} size={0.022} position={[size * 0.5, BOX.h + size * 0.9, 0]} />}
      {/* Zone de saisie généreuse (invisible) */}
      <mesh
        position={[0, BOX.h + size * 0.42, 0]}
        material={hitMat}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setHover(true);
          onHover(type);
          if (unlocked) feedback('hover', e);
        }}
        onPointerOut={() => {
          setHover(false);
          onHover(null);
        }}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          // Un doigt qui touche la miniature l'inspecte seulement ; pincement, gâchette ou grip la saisissent
          if ((e as unknown as { pointerType?: string }).pointerType === 'touch') return;
          beginNew(e, type);
        }}
      >
        {/* Bas et large : un rayon rasant ne s'arrête pas sur la miniature de devant */}
        <cylinderGeometry args={[hitR, hitR, size * 0.8, 10]} />
      </mesh>
    </group>
  );
}

/** Infobulle d'un bâtiment : nom, coût, effet, condition de déblocage */
function Info({ type, z }: { type: BuildingTypeId; z: number }) {
  const def = BUILDING_BY_ID[type];
  const game = useGame((s) => s.game);
  const unlocked = isUnlocked(game, type);
  const cost = buildCost(type);
  const lvl = def.levels[0];
  const lines = [effectLabel(lvl), workersLabel(lvl)].filter(Boolean).join('  ');
  const sub = unlocked ? costText(cost) : `${I.lock} ${conditionLabel(lvl.unlock)}`;
  const w = Math.max(0.3, textWidth(def.name, 0.034) + 0.12, textWidth(lines || def.description, 0.024) + 0.05);
  return (
    <FacePlayer position={[0, 0.16, z]} tilt={0.3}>
      <Panel width={w} height={lines ? 0.15 : 0.13}>
        <Label title text={`${def.icon} ${def.name}`} size={0.036} position={[0, 0.045, 0]} />
        <Label text={sub} size={0.03} color={unlocked ? (canAfford(game.resources, cost) ? THEME.accent : THEME.bad) : THEME.warn} position={[0, 0.005, 0]} />
        <Label text={lines || def.description} size={0.02} color={THEME.dim} weight={600} position={[0, -0.04, 0]} maxWidth={w - 0.03} />
      </Panel>
    </FacePlayer>
  );
}

/**
 * Boîte de bâtiments miniatures posée à côté du plateau, rangée par onglets.
 * Saisir une miniature et la poser sur une case ; remettre un bâtiment ici le détruit (remboursement partiel).
 */
export function BuildBox() {
  const open = useVR((s) => s.boxOpen);
  const tab = useVR((s) => s.boxTab);
  const dominant = useVR((s) => s.prefs.dominant);
  const scale = useVR((s) => s.board.scale);
  const setTab = useVR((s) => s.setBoxTab);
  const toggle = useVR((s) => s.toggleBox);
  const held = useVR((s) => s.held);
  const game = useGame((s) => s.game);
  const [hovered, setHovered] = useState<BuildingTypeId | null>(null);
  const trash = useRef<THREE.Mesh>(null);
  const c = boxCenter(dominant, scale);

  // L'onglet Artisanat n'apparaît qu'une fois un de ses bâtiments débloqué
  const tabs = BUILD_TABS.filter((t) => !t.hiddenUntilUnlocked || buildingsInTab(t.id).some((d) => isUnlocked(game, d.id)));
  const current: BuildTab = tabs.some((t) => t.id === tab) ? tab : tabs[0].id;
  const items = buildingsInTab(current);

  useFrame(({ clock }) => {
    if (trash.current) {
      const on = dragState.overBox && held?.kind === 'move';
      trash.current.visible = on;
      if (on) (trash.current.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(clock.elapsedTime * 8) * 0.1;
    }
  });

  if (!open) {
    return (
      <group position={[c.x, 0, c.z]}>
        <Button3D width={0.12} height={0.12} icon={I.box} label="Boîte" position={[0, 0.06, 0.05]} onActivate={() => toggle(true)} />
      </group>
    );
  }
  const cols = 3;
  const slot = (i: number): [number, number] => [(-1 + (i % cols)) * 0.105, -0.04 + Math.floor(i / cols) * 0.115 - 0.02];
  return (
    <group position={[c.x, 0, c.z]}>
      {/* Plateau de la boîte : bois, fond de feutre, rebords */}
      <Part g="box" m={woodMat} p={[0, BOX.h / 2 - 0.004, 0]} s={[BOX.w, BOX.h - 0.008, BOX.d]} shadow={false} />
      <Part g="box" m={feltMat} p={[0, BOX.h - 0.003, -0.02]} s={[BOX.w - 0.03, 0.004, BOX.d - 0.1]} shadow={false} />
      {[-1, 1].map((s) => (
        <Part key={s} g="box" m={woodDark} p={[s * (BOX.w / 2 - 0.006), BOX.h + 0.008, 0]} s={[0.012, 0.024, BOX.d]} shadow={false} />
      ))}
      <Part g="box" m={woodDark} p={[0, BOX.h + 0.008, -BOX.d / 2 + 0.006]} s={[BOX.w, 0.024, 0.012]} shadow={false} />
      {/* Zone « détruire » : s'illumine quand on y tient un bâtiment déjà posé */}
      <mesh ref={trash} material={trashMat} position={[0, BOX.h + 0.006, -0.02]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <planeGeometry args={[BOX.w - 0.03, BOX.d - 0.1]} />
      </mesh>
      {held?.kind === 'move' && <Label text={`${I.undo} Ici : remettre dans la boîte`} size={0.022} position={[0, BOX.h + 0.03, -0.12]} color={THEME.warn} />}

      {/* Onglets le long du bord avant, inclinés vers le joueur */}
      <group position={[0, BOX.h + 0.012, BOX.d / 2 - 0.03]} rotation={[-0.9, 0, 0]}>
        {tabs.map((t, i) => (
          <Button3D
            key={t.id}
            width={0.062}
            height={0.058}
            icon={t.icon}
            active={t.id === current}
            position={[(i - (tabs.length - 1) / 2) * 0.067, 0, 0]}
            onActivate={() => setTab(t.id)}
          />
        ))}
        <Button3D width={0.05} height={0.05} icon={I.close} position={[BOX.w / 2 - 0.035, 0.06, 0]} onActivate={() => toggle(false)} />
      </group>
      <Label text={BUILD_TABS.find((t) => t.id === current)?.label ?? ''} size={0.02} color={THEME.dim} position={[0, BOX.h + 0.022, -BOX.d / 2 + 0.03]} />

      {/* Miniatures */}
      {items.map((d, i) => {
        const [x, z] = slot(i);
        return <Mini key={d.id} type={d.id} x={x} z={z} onHover={setHovered} />;
      })}
      {hovered && !held && <Info type={hovered} z={-0.02} />}
    </group>
  );
}
