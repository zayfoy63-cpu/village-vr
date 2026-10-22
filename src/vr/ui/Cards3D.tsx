// Événements : cartes debout sur la table (une seule à la fois, les autres font la queue), drapeaux des
// menaces plantés au bord du plateau, bulles non bloquantes au-dessus des bâtiments concernés.

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RESOURCE_KEYS, RESOURCE_META } from '../../game/config';
import { canAfford } from '../../game/rules';
import type { Notice, Resources } from '../../game/types';
import { Part } from '../../scene/models/Part';
import { useGame } from '../../store/gameStore';
import { VR_CONFIG } from '../config';
import { feedback } from '../feedback';
import { boardHalf } from '../layout';
import { useVR } from '../store';
import { Button3D, FacePlayer, Label, Panel, THEME, textWidth } from './kit';

const costText = (c: Partial<Resources>) => RESOURCE_KEYS.filter((k) => c[k]).map((k) => `${c[k]}${RESOURCE_META[k].icon}`).join(' ');

const isOpen = (n: Notice) => !!n.choice && !n.choice.resolved;

/** Carte en cours : choix bloquant d'abord, puis événement en temps réel, puis menace ouverte par le joueur */
export function Cards3D() {
  const notices = useGame((s) => s.game.notices);
  const resources = useGame((s) => s.game.resources);
  const focus = useVR((s) => s.focus);
  const scale = useVR((s) => s.board.scale);
  const choose = useGame((s) => s.choose);
  const open = notices.filter(isOpen);
  const blocking = open.filter((n) => !n.threat && !n.choice!.realtime);
  const realtime = open.filter((n) => !n.threat && n.choice!.realtime);
  const focused = focus !== null ? open.find((n) => n.id === focus) : undefined;
  const current = focused ?? blocking[0] ?? realtime[0];
  const queued = blocking.length + realtime.length - (current && !current.threat ? 1 : 0);
  const seen = useRef<number | null>(null);
  useEffect(() => {
    // Un petit signal quand une nouvelle carte arrive
    if (current && seen.current !== current.id) feedback('event');
    seen.current = current?.id ?? null;
  }, [current]);
  if (!current) return null;

  const { hd } = boardHalf(scale);
  const c = current.choice!;
  const w = VR_CONFIG.ui.cardWidth;
  const textLines = Math.max(1, Math.ceil(textWidth(current.text, 0.026) / (w - 0.05)));
  const optH = 0.1;
  const h = 0.085 + textLines * 0.034 + c.options.length * (optH + 0.012) + 0.03;
  const isRT = !!c.realtime;
  const accent = current.kind === 'bad' || current.kind === 'threat' ? THEME.bad : current.kind === 'good' ? THEME.good : THEME.accent;
  const top = h / 2;
  return (
    <FacePlayer position={[0, 0.004, hd + 0.3]} tilt={0.8}>
      <group position={[0, h / 2, 0]}>
        <Panel width={w} height={h} border={accent}>
          <Label text={`${current.icon} ${current.title}`} size={0.036} position={[0, top - 0.04, 0]} />
          <Label text={current.text} size={0.026} weight={600} maxWidth={w - 0.05} position={[0, top - 0.075 - (textLines * 0.034) / 2 + 0.01, 0]} />
          {isRT ? (
            <Label text="⚡ Le jeu continue" size={0.02} color={THEME.warn} position={[w / 2 - 0.09, top - 0.04, 0]} />
          ) : (
            <Label text="⏸ Le jeu attend" size={0.02} color={THEME.dim} position={[w / 2 - 0.09, top - 0.04, 0]} />
          )}
          {c.options.map((o, i) => {
            const affordable = !o.cost || canAfford(resources, o.cost);
            const effects = (o.effects ?? []).map((e) => `${e.icon}${e.text}`).join('  ');
            const sub = [o.cost ? costText(o.cost) : '', effects].filter(Boolean).join('   ');
            return (
              <Button3D
                key={o.id}
                width={w - 0.04}
                height={optH}
                label={o.label}
                sub={sub || o.detail}
                active={o.id === c.defaultId}
                disabled={!affordable}
                position={[0, -top + 0.03 + (c.options.length - 1 - i) * (optH + 0.012) + optH / 2, 0.004]}
                onActivate={() => {
                  choose(current.id, o.id);
                  useVR.getState().setFocus(null);
                }}
              />
            );
          })}
          {queued > 0 && <Label text={`+${queued} en attente`} size={0.02} color={THEME.dim} position={[0, -top - 0.02, 0]} />}
          {focused && (
            <Button3D width={0.05} height={0.05} icon="✖️" position={[-w / 2 + 0.035, top - 0.035, 0.004]} onActivate={() => useVR.getState().setFocus(null)} />
          )}
        </Panel>
      </group>
    </FacePlayer>
  );
}

const poleMat = new THREE.MeshStandardMaterial({ color: '#6b4a2b', roughness: 0.9, flatShading: true });
const flagUrgent = new THREE.MeshBasicMaterial({ color: '#e23b2e' });
const flagSoon = new THREE.MeshBasicMaterial({ color: '#e8902a' });

const EDGE_DIR: [number, number][] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

function daysLabel(arriveDay: number, day: number) {
  const d = arriveDay - day;
  return d <= 0 ? 'Auj.' : d === 1 ? 'Demain' : `J-${d}`;
}

/** Drapeau planté au bord du plateau, du côté d'où vient la menace, avec son compte à rebours */
function Flag({ notice, edge, slot, count }: { notice: Notice; edge: number | undefined; slot: number; count: number }) {
  const scale = useVR((s) => s.board.scale);
  const day = useGame((s) => s.game.day);
  const hasPrep = !!notice.choice && !notice.choice.resolved;
  const [info, setInfo] = useState(false);
  const { hw, hd } = boardHalf(scale);
  const [dx, dz] = edge !== undefined ? EDGE_DIR[((edge % 4) + 4) % 4] : [0, 1];
  // Sans direction (hiver rude, épidémie…) : drapeau sur le bord avant-gauche, à côté du présentoir
  const off = (slot - (count - 1) / 2) * 0.13;
  const x = edge === undefined ? -hw + 0.1 + slot * 0.13 : dx !== 0 ? dx * (hw + 0.03) : off;
  const z = edge === undefined ? hd + 0.05 : dz !== 0 ? dz * (hd + 0.03) : off;
  const left = daysLabel(notice.threat!.arriveDay, day);
  const urgent = notice.threat!.arriveDay - day <= 1;
  return (
    <group position={[x, 0, z]}>
      <Part g="cylinderLow" m={poleMat} p={[0, 0.07, 0]} s={[0.008, 0.14, 0.008]} shadow={false} />
      <Part g="box" m={urgent ? flagUrgent : flagSoon} p={[0.03, 0.12, 0]} s={[0.06, 0.04, 0.002]} shadow={false} />
      <FacePlayer position={[0, 0.2, 0]} tilt={0.2}>
        <group>
          <Button3D
            width={0.15}
            height={0.075}
            icon={notice.icon}
            label={left}
            active={urgent}
            onActivate={() => {
              if (hasPrep) useVR.getState().setFocus(notice.id);
              else setInfo((v) => !v);
            }}
          />
          {info && (
            <Panel width={0.4} height={0.14} position={[0, 0.12, 0.004]}>
              <Label text={notice.title} size={0.03} position={[0, 0.04, 0]} />
              <Label text={notice.text} size={0.02} weight={600} maxWidth={0.37} position={[0, -0.015, 0]} />
            </Panel>
          )}
        </group>
      </FacePlayer>
    </group>
  );
}

/** Menaces à venir : un drapeau par événement annoncé */
export function Threats3D() {
  const pending = useGame((s) => s.game.pending);
  const notices = useGame((s) => s.game.notices);
  const items = pending
    .map((p) => ({ p, n: notices.find((x) => x.id === p.noticeId) }))
    .filter((x): x is { p: (typeof pending)[number]; n: Notice } => !!x.n?.threat && !x.n.threat.done);
  const byEdge = new Map<string, number>();
  return (
    <group>
      {items.map(({ p, n }) => {
        const key = String(p.params.edge ?? 'x');
        const slot = byEdge.get(key) ?? 0;
        byEdge.set(key, slot + 1);
        const count = items.filter((x) => String(x.p.params.edge ?? 'x') === key).length;
        return <Flag key={p.id} notice={n} edge={p.params.edge} slot={slot} count={count} />;
      })}
    </group>
  );
}

interface Bubble {
  id: number;
  until: number;
  notice: Notice;
}

/** Notifications non bloquantes : petites bulles qui disparaissent seules, au-dessus du bâtiment concerné */
export function Bubbles3D() {
  const notices = useGame((s) => s.game.notices);
  const scale = useVR((s) => s.board.scale);
  const { hd } = boardHalf(scale);
  const seen = useRef(new Set<number>());
  const first = useRef(true);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);

  useEffect(() => {
    const now = performance.now();
    const fresh: Bubble[] = [];
    for (const n of notices) {
      if (seen.current.has(n.id)) continue;
      seen.current.add(n.id);
      // Au chargement d'une partie, les anciennes notifications ne reviennent pas
      if (first.current || n.choice || n.threat) continue;
      fresh.push({ id: n.id, until: now + VR_CONFIG.ui.bubbleSec * 1000, notice: n });
      if (n.kind === 'bad') feedback('event');
    }
    first.current = false;
    if (fresh.length) setBubbles((b) => [...b, ...fresh].slice(-2));
  }, [notices]);

  useEffect(() => {
    if (!bubbles.length) return;
    const t = setInterval(() => setBubbles((b) => b.filter((x) => x.until > performance.now())), 500);
    return () => clearInterval(t);
  }, [bubbles.length]);

  return (
    <group>
      {bubbles.map((b, i) => {
        const n = b.notice;
        const at = n.at;
        const x = at ? (at.x + 0.5 - 10) * scale : 0;
        // Sans bâtiment concerné : au-dessus du fond du plateau, loin de la carte d'événement et du pupitre
        const z = at ? (at.z + 0.5 - 7) * scale : -hd - 0.05;
        const y = at ? 0.2 + (i % 3) * 0.06 : 0.3 + i * 0.105;
        const color = n.kind === 'bad' ? THEME.bad : n.kind === 'good' ? THEME.good : THEME.accent;
        const text = n.text.length > 70 ? `${n.text.slice(0, 68)}…` : n.text;
        return (
          <FacePlayer key={b.id} position={[x, y, z]} tilt={0.1}>
            <Panel width={0.36} height={0.09} border={color}>
              <Label text={`${n.icon} ${n.title}`} size={0.026} position={[0, 0.022, 0]} />
              <Label text={text} size={0.017} weight={600} color={THEME.dim} maxWidth={0.34} position={[0, -0.02, 0]} />
            </Panel>
          </FacePlayer>
        );
      })}
    </group>
  );
}
