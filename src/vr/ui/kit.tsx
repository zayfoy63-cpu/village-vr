// Kit d'interface 3D : textes, icônes et fonds viennent d'un atlas de caractères unique et sont
// dessinés en un seul maillage (uiBatch) ; lisible sur fond de passthrough. Un seul jeu de composants pour tous les modes : chaque élément
// réagit pareil au clic souris, au rayon de manette, au pincement et au toucher du doigt.

import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { feedback } from '../feedback';
import { VR_CONFIG } from '../config';
import { useVR } from '../store';
import { lineWidth } from './atlas';
import { Builder, addItem, removeItem, rgba, type Tris, type UIItem } from './uiBatch';
import { I } from '../../ui/icons';


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
// Éléments de base : tout passe par le maillage unique de l'interface (uiBatch) et l'atlas de
// caractères partagé. Chaque élément ne rend ici qu'un repère invisible (groupe vide).
// ---------------------------------------------------------------------------

/** Panneau englobant : son repère sert de profondeur commune à tout son contenu */
type RootRef = { current: unknown };
const PanelRoot = createContext<RootRef | null>(null);

/** Déclare les triangles d'un élément (reconstruits quand `build` change) ; renvoie le repère */
function useUIItem(layer: 0 | 1, build: () => Tris, ownRoot?: RootRef) {
  const ref = useRef<THREE.Group>(null);
  const item = useRef<UIItem | null>(null);
  const parentRoot = useContext(PanelRoot);
  const root = ownRoot ?? parentRoot;
  useLayoutEffect(() => {
    const it = addItem(ref.current as never, layer, build, root as never);
    item.current = it;
    return () => {
      removeItem(it);
      item.current = null;
    };
    // L'élément est créé une fois ; `build` est mis à jour ci-dessous
  }, [layer, root]);
  useLayoutEffect(() => {
    const it = item.current;
    if (!it || it.build === build) return;
    it.build = build;
    it.dirty = true;
  }, [build]);
  return ref;
}

function wrap(text: string, size: number, weight: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (line && lineWidth(test, weight) * size > maxWidth) {
        out.push(line);
        line = word;
      } else line = test;
    }
    out.push(line);
  }
  return out;
}

/** Texte (avec icônes du jeu). `size` = hauteur de police en mètres. Fin liseré sombre : lisible sur tout fond. */
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
  const build = useMemo(
    () => () => {
      const b = new Builder();
      const lines = maxWidth ? wrap(text, size, weight, maxWidth) : text.split('\n');
      const lineH = size * 1.22;
      const total = lines.length * lineH + size * 0.2;
      const c = rgba(color, opacity);
      lines.forEach((l, i) => {
        const y = total / 2 - (size * 0.1 + lineH * (i + 0.5));
        // Ancrage comme avant : bord gauche / droit du texte à `position` (marge de 0.15 em)
        const x = align === 'left' ? size * 0.15 : align === 'right' ? -size * 0.15 : 0;
        b.text(l, { size, color: c, weight, outline: true, x, y, align, iconAlpha: opacity });
      });
      return b.done();
    },
    [text, size, color, weight, align, maxWidth, opacity],
  );
  const ref = useUIItem(1, build);
  return <group ref={ref} position={position} />;
}

/** Mesure du texte d'un Label (largeur en mètres) : pour dimensionner les panneaux */
export function textWidth(text: string, size: number = VR_CONFIG.ui.text, weight = 700): number {
  return (lineWidth(text, weight) + 0.3) * size;
}

/** Plaque arrondie (fond de panneau) */
export function Plate({
  width,
  height,
  color = THEME.panel,
  border = THEME.border,
  radius = 0.012,
  borderWidth = 0.003,
  position,
  opacity = 1,
  root,
}: {
  width: number;
  height: number;
  color?: string;
  border?: string | null;
  radius?: number;
  borderWidth?: number;
  position?: [number, number, number];
  opacity?: number;
  /** Panneau auquel appartient ce fond (tri de profondeur commun) */
  root?: RootRef;
}) {
  const build = useMemo(
    () => () => {
      const b = new Builder();
      b.plate(width, height, radius, rgba(color, opacity), border ? rgba(border, opacity) : null, borderWidth);
      return b.done();
    },
    [width, height, color, border, radius, borderWidth, opacity],
  );
  const ref = useUIItem(0, build, root);
  return <group ref={ref} position={position} />;
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
  const self = useRef<THREE.Group>(null);
  return (
    <group ref={self} position={position} rotation={rotation}>
      <PanelRoot.Provider value={self}>
        <Plate width={width} height={height} border={border} root={self} />
        <group position={[0, 0, 0.002]}>{children}</group>
      </PanelRoot.Provider>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Orientation vers le joueur
// ---------------------------------------------------------------------------

const _p = new THREE.Vector3();
const _c = new THREE.Vector3();
const _look = new THREE.Vector3();

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

  const build = useMemo(
    () => () => {
      const w = width;
      const h = height;
      const bg = disabled ? THEME.disabled : danger ? (hover ? '#8a2f25' : '#5e211b') : active ? THEME.buttonActive : hover ? THEME.buttonHover : THEME.button;
      const border = disabled ? '#5a4d3d' : active || hover ? THEME.accent : danger ? THEME.bad : '#c9a24e';
      const b = new Builder();
      b.plate(w, h, 0.014, rgba(bg), rgba(border), 0.004);
      // Mise en page en proportions du bouton (positions mesurées depuis le haut)
      const fg = rgba(disabled ? '#8a7d6a' : THEME.text);
      const hasText = !!label;
      const top = (k: number) => h / 2 - h * k;
      if (icon) {
        const size = Math.min(h * (hasText ? (sub ? 0.46 : 0.5) : 0.62), w * 0.6);
        b.text(icon, { size, color: fg, weight: 400, outline: false, x: 0, y: hasText ? top(sub ? 0.3 : 0.34) : 0, align: 'center', iconAlpha: disabled ? 0.55 : 1 });
      }
      if (label) {
        const size = Math.min(h * (icon ? 0.24 : 0.4), w * 0.16);
        const y = icon ? top(sub ? 0.65 : 0.76) : sub ? top(0.38) : 0;
        b.text(label, { size, color: fg, weight: 700, outline: false, x: 0, y, align: 'center', squeeze: w * 0.92 });
      }
      if (sub) {
        b.text(sub, { size: h * 0.17, color: rgba(disabled ? '#8a7d6a' : THEME.dim), weight: 600, outline: false, x: 0, y: top(0.88), align: 'center', squeeze: w * 0.94 });
      }
      if (locked) b.text(I.lock, { size: h * 0.34, color: fg, weight: 400, outline: false, x: w * 0.3, y: top(0.28), align: 'center' });
      return b.done();
    },
    [width, height, icon, label, sub, disabled, active, danger, locked, hover],
  );
  const visual = useUIItem(1, build);

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
        <group ref={visual} />
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
          <meshBasicMaterial visible={false} side={THREE.DoubleSide} />
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
    const look = _look.set(0, 0, -1).applyQuaternion(camera.quaternion);
    // Le regard est « ailleurs » au-delà de ~60° du panneau
    away.current = look.dot(toAnchor) < 0.5 ? away.current + dt : 0;
    if (away.current > VR_CONFIG.ui.panelAutoCloseSec) {
      away.current = 0;
      close();
    }
  });
}
