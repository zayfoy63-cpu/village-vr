// Kit d'interface 3D : tout est dessiné sur canvas (emojis et accents sans police externe), donc
// lisible sur fond de passthrough. Un seul jeu de composants pour tous les modes : chaque élément
// réagit pareil au clic souris, au rayon de manette, au pincement et au toucher du doigt.

import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { feedback } from '../feedback';
import { VR_CONFIG } from '../config';
import { useVR } from '../store';

/** Résolution des textures : pixels par mètre d'interface */
const PX_PER_M = 1600;
const FONT = "system-ui, 'Segoe UI', Roboto, 'Noto Sans', 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";

/** Palette très contrastée (lisible sur passthrough clair comme sombre) */
export const THEME = {
  panel: 'rgba(24, 16, 10, 0.93)',
  panelSolid: '#1c140d',
  border: '#ffd166',
  text: '#fff8e8',
  dim: '#b9a98f',
  accent: '#ffd166',
  good: '#7ee081',
  bad: '#ff7a6b',
  warn: '#ffb347',
  button: '#3a2a1a',
  buttonHover: '#5a4128',
  buttonActive: '#7a5a30',
  disabled: '#2a2118',
};

// ---------------------------------------------------------------------------
// Textures
// ---------------------------------------------------------------------------

const cache = new Map<string, THREE.CanvasTexture>();
const MAX_CACHE = 400;

type Draw = (g: CanvasRenderingContext2D, w: number, h: number) => void;

function texture(key: string, w: number, h: number, draw: Draw): THREE.CanvasTexture {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(2, Math.min(2048, Math.ceil(w)));
  canvas.height = Math.max(2, Math.min(2048, Math.ceil(h)));
  const g = canvas.getContext('2d')!;
  draw(g, canvas.width, canvas.height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (cache.size >= MAX_CACHE) {
    const first = cache.keys().next().value as string;
    cache.get(first)?.dispose();
    cache.delete(first);
  }
  cache.set(key, tex);
  return tex;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

let measureCtx: CanvasRenderingContext2D | null = null;
function measure(font: string, text: string): number {
  measureCtx ??= document.createElement('canvas').getContext('2d')!;
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
}

function wrap(font: string, text: string, maxPx: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (line && measure(font, test) > maxPx) {
        out.push(line);
        line = word;
      } else line = test;
    }
    out.push(line);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Éléments de base
// ---------------------------------------------------------------------------

const RENDER = { bg: 10, text: 11 };

function basic(tex: THREE.Texture, opacity = 1) {
  return <meshBasicMaterial map={tex} transparent opacity={opacity} toneMapped={false} depthWrite={false} side={THREE.DoubleSide} />;
}

/** Texte (ou icône emoji) dessiné sur un plan. `size` = hauteur de police en mètres. */
export function Label({
  text,
  size = VR_CONFIG.ui.text,
  color = THEME.text,
  weight = 700,
  align = 'center',
  maxWidth,
  position,
  opacity = 1,
}: {
  text: string;
  size?: number;
  color?: string;
  weight?: number;
  align?: 'left' | 'center' | 'right';
  /** Largeur maximale en mètres : le texte passe à la ligne au-delà */
  maxWidth?: number;
  position?: [number, number, number];
  opacity?: number;
}) {
  const { tex, w, h } = useMemo(() => {
    const px = size * PX_PER_M;
    const font = `${weight} ${px}px ${FONT}`;
    const lines = maxWidth ? wrap(font, text, maxWidth * PX_PER_M) : text.split('\n');
    const lineH = px * 1.22;
    const width = Math.max(...lines.map((l) => measure(font, l))) + px * 0.3;
    const height = lines.length * lineH + px * 0.2;
    const tex = texture(`L|${text}|${px}|${color}|${weight}|${align}|${maxWidth ?? 0}`, width, height, (g, cw, ch) => {
      g.font = font;
      g.fillStyle = color;
      g.textBaseline = 'middle';
      g.textAlign = align;
      const x = align === 'left' ? px * 0.15 : align === 'right' ? cw - px * 0.15 : cw / 2;
      // Fin liseré sombre : lisible sur fond clair comme sombre
      g.lineJoin = 'round';
      g.lineWidth = px * 0.14;
      g.strokeStyle = 'rgba(15,10,5,0.75)';
      lines.forEach((l, i) => {
        const y = px * 0.1 + lineH * (i + 0.5);
        g.strokeText(l, x, y);
        g.fillText(l, x, y);
      });
      void ch;
    });
    return { tex, w: tex.image.width / PX_PER_M, h: tex.image.height / PX_PER_M };
  }, [text, size, color, weight, align, maxWidth]);
  // Le plan est décalé pour que `align` colle au bord gauche / droit de la position donnée
  const dx = align === 'left' ? w / 2 : align === 'right' ? -w / 2 : 0;
  return (
    <mesh position={[(position?.[0] ?? 0) + dx, position?.[1] ?? 0, position?.[2] ?? 0]} renderOrder={RENDER.text}>
      <planeGeometry args={[w, h]} />
      {basic(tex, opacity)}
    </mesh>
  );
}

/** Mesure du texte d'un Label (largeur en mètres) : pour dimensionner les panneaux */
export function textWidth(text: string, size: number = VR_CONFIG.ui.text, weight = 700): number {
  return (measure(`${weight} ${size * PX_PER_M}px ${FONT}`, text) + size * PX_PER_M * 0.3) / PX_PER_M;
}

/** Plaque arrondie (fond de panneau, bouton…) */
export function Plate({
  width,
  height,
  color = THEME.panel,
  border = THEME.border,
  radius = 0.012,
  borderWidth = 0.003,
  position,
  opacity = 1,
}: {
  width: number;
  height: number;
  color?: string;
  border?: string | null;
  radius?: number;
  borderWidth?: number;
  position?: [number, number, number];
  opacity?: number;
}) {
  const tex = useMemo(() => {
    const w = Math.min(1024, width * PX_PER_M);
    const h = (w * height) / width;
    const k = w / width;
    return texture(`P|${width.toFixed(3)}|${height.toFixed(3)}|${color}|${border}|${radius}|${borderWidth}`, w, h, (g, cw, ch) => {
      g.fillStyle = color;
      roundRect(g, 0, 0, cw, ch, radius * k);
      g.fill();
      if (border) {
        g.lineWidth = borderWidth * k;
        g.strokeStyle = border;
        roundRect(g, g.lineWidth / 2, g.lineWidth / 2, cw - g.lineWidth, ch - g.lineWidth, radius * k);
        g.stroke();
      }
    });
  }, [width, height, color, border, radius, borderWidth]);
  return (
    <mesh position={position} renderOrder={RENDER.bg}>
      <planeGeometry args={[width, height]} />
      {basic(tex, opacity)}
    </mesh>
  );
}

/** Panneau : plaque + contenu posé devant (z croissant) */
export function Panel({
  width,
  height,
  children,
  border = THEME.border,
  position,
  rotation,
}: {
  width: number;
  height: number;
  children?: ReactNode;
  border?: string | null;
  position?: [number, number, number];
  rotation?: [number, number, number];
}) {
  return (
    <group position={position} rotation={rotation}>
      <Plate width={width} height={height} border={border} />
      <group position={[0, 0, 0.002]}>{children}</group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Orientation vers le joueur
// ---------------------------------------------------------------------------

const _p = new THREE.Vector3();
const _c = new THREE.Vector3();

/**
 * Pivote toujours vers le joueur autour de la verticale (jamais accroché à la tête : le groupe
 * reste à sa place dans le monde). `tilt` incline légèrement le panneau vers l'arrière.
 */
export function FacePlayer({ children, tilt = VR_CONFIG.ui.tilt, position, lock }: { children: ReactNode; tilt?: number; position?: [number, number, number]; lock?: number }) {
  const ref = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    if (lock !== undefined) {
      g.rotation.set(-tilt, lock, 0, 'YXZ');
      return;
    }
    g.getWorldPosition(_p);
    camera.getWorldPosition(_c);
    // On travaille dans le repère du parent pour rester correct si le plateau pivote
    const parent = g.parent;
    if (parent) parent.worldToLocal(_c);
    const yaw = Math.atan2(_c.x - g.position.x, _c.z - g.position.z);
    g.rotation.set(-tilt, yaw, 0, 'YXZ');
  });
  return (
    <group ref={ref} position={position}>
      {children}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Boutons
// ---------------------------------------------------------------------------

export interface ButtonProps {
  width?: number;
  height?: number;
  icon?: string;
  label?: string;
  /** Petit texte sous le libellé (coût, détail) */
  sub?: string;
  onActivate?: (e: ThreeEvent<MouseEvent>) => void;
  disabled?: boolean;
  /** Mis en avant (sélectionné, onglet actif) */
  active?: boolean;
  danger?: boolean;
  locked?: boolean;
  position?: [number, number, number];
  /** Le bouton lui-même ne fait rien mais réagit au survol (infobulle…) */
  onHover?: (hover: boolean) => void;
}

/**
 * Bouton 3D : surbrillance + léger agrandissement au survol, petit « tap » à l'appui, son et
 * vibration. La zone sensible dépasse le dessin (tolérance en mode mains).
 */
export function Button3D({ width = 0.14, height = 0.07, icon, label, sub, onActivate, disabled, active, danger, locked, position, onHover }: ButtonProps) {
  const [hover, setHover] = useState(false);
  const group = useRef<THREE.Group>(null);
  const press = useRef(0);
  const input = useVR((s) => s.input);
  const pad = input === 'hand' ? VR_CONFIG.ui.handPadding : 0.004;

  const tex = useMemo(() => {
    const w = Math.min(768, width * PX_PER_M);
    const h = (w * height) / width;
    const k = w / width;
    const bg = disabled ? THEME.disabled : danger ? (hover ? '#8a2f25' : '#5e211b') : active ? THEME.buttonActive : hover ? THEME.buttonHover : THEME.button;
    const border = disabled ? '#5a4d3d' : active || hover ? THEME.accent : danger ? THEME.bad : '#c9a24e';
    return texture(`B|${width}|${height}|${icon}|${label}|${sub}|${bg}|${border}|${locked}`, w, h, (g, cw, ch) => {
      g.fillStyle = bg;
      roundRect(g, 0, 0, cw, ch, 0.014 * k);
      g.fill();
      g.lineWidth = 0.004 * k;
      g.strokeStyle = border;
      roundRect(g, g.lineWidth / 2, g.lineWidth / 2, cw - g.lineWidth, ch - g.lineWidth, 0.014 * k);
      g.stroke();
      g.textBaseline = 'middle';
      g.textAlign = 'center';
      const fg = disabled ? '#8a7d6a' : THEME.text;
      const hasText = !!label;
      const iconSize = Math.min(ch * (hasText ? (sub ? 0.46 : 0.5) : 0.62), cw * 0.6);
      if (icon) {
        g.font = `${iconSize}px ${FONT}`;
        g.fillStyle = fg;
        g.globalAlpha = disabled ? 0.55 : 1;
        g.fillText(icon, cw / 2, hasText ? ch * (sub ? 0.3 : 0.34) : ch / 2);
        g.globalAlpha = 1;
      }
      if (label) {
        const fs = Math.min(ch * (icon ? 0.24 : 0.4), cw * 0.16);
        g.font = `700 ${fs}px ${FONT}`;
        g.fillStyle = fg;
        g.fillText(label, cw / 2, icon ? ch * (sub ? 0.65 : 0.76) : sub ? ch * 0.38 : ch / 2, cw * 0.92);
      }
      if (sub) {
        g.font = `600 ${ch * 0.17}px ${FONT}`;
        g.fillStyle = disabled ? '#8a7d6a' : THEME.dim;
        g.fillText(sub, cw / 2, ch * 0.88, cw * 0.94);
      }
      if (locked) {
        g.font = `${ch * 0.34}px ${FONT}`;
        g.fillText('🔒', cw * 0.8, ch * 0.28);
      }
    });
  }, [width, height, icon, label, sub, disabled, active, danger, locked, hover]);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    press.current = Math.max(0, press.current - dt * 6);
    const target = (hover && !disabled ? VR_CONFIG.ui.hoverGrow : 1) - press.current * 0.1;
    const s = g.scale.x + (target - g.scale.x) * Math.min(1, dt * 18);
    g.scale.setScalar(s);
    g.position.z = hover && !disabled ? 0.006 : 0;
  });

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (hover) return;
    setHover(true);
    onHover?.(true);
    if (!disabled) feedback('hover', e);
  };
  const out = () => {
    setHover(false);
    onHover?.(false);
  };
  return (
    <group position={position}>
      <group ref={group}>
        <mesh renderOrder={RENDER.bg + 1}>
          <planeGeometry args={[width, height]} />
          {basic(tex)}
        </mesh>
        {/* Zone sensible agrandie (invisible) */}
        <mesh
          position={[0, 0, 0.003]}
          userData={{ testId: label ?? icon }}
          onPointerOver={over}
          onPointerOut={out}
          onClick={(e) => {
            e.stopPropagation();
            if (disabled) {
              feedback('error', e);
              return;
            }
            press.current = 1;
            feedback('click', e);
            onActivate?.(e);
          }}
        >
          <planeGeometry args={[width + pad * 2, height + pad * 2]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

/** Ferme le panneau quand le joueur ne le regarde plus pendant `VR_CONFIG.ui.panelAutoCloseSec` */
export function useAutoClose(open: boolean, close: () => void, anchor: React.RefObject<{ getWorldPosition: (target: THREE.Vector3) => THREE.Vector3 } | null>) {
  const camera = useThree((s) => s.camera);
  const away = useRef(0);
  useEffect(() => {
    away.current = 0;
  }, [open]);
  useFrame((_, dt) => {
    const a = anchor.current;
    if (!open || !a) return;
    a.getWorldPosition(_p);
    camera.getWorldPosition(_c);
    const toAnchor = _p.sub(_c).normalize();
    const look = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    // Le regard est « ailleurs » au-delà de ~60° du panneau
    away.current = look.dot(toAnchor) < 0.5 ? away.current + dt : 0;
    if (away.current > VR_CONFIG.ui.panelAutoCloseSec) {
      away.current = 0;
      close();
    }
  });
}
