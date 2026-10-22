// Bâtiments de transformation (chaînes de production) : boulangerie, scierie, mine, forge.

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import { Banner, Chimney, Spinner, TileRoof, Torch, Wheel } from './Decor';
import { Part } from './Part';

type V3 = [number, number, number];

/** Cheminées (coordonnées locales, non tournées) pour la fumée */
export const BAKERY_CHIMNEYS: Record<number, V3[]> = { 1: [[0.2, 0.92, -0.16]] };
export const FORGE_CHIMNEYS: Record<number, V3[]> = { 1: [[-0.24, 1.0, -0.22]], 2: [[-0.24, 1.12, -0.22], [0.26, 0.9, -0.26]] };

/** Lueur de four / foyer qui pulse */
function Glow({ p, s }: { p: V3; s: V3 }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.scale.y = 0.8 + Math.sin(clock.elapsedTime * 6 + p[0] * 10) * 0.2;
  });
  return (
    <group ref={ref} position={p}>
      <Part g="box" m="window" s={s} shadow={false} />
    </group>
  );
}

/** Boulangerie : maison enduite, grand four en pierre à la lueur orangée, enseigne-pain, paniers */
export function Bakery() {
  return (
    <group>
      <Part g="box" m="whitewash" p={[-0.06, 0.2, -0.06]} s={[0.58, 0.4, 0.48]} />
      {[-0.32, 0.2].map((x) => (
        <Part key={x} g="box" m="timber" p={[x, 0.2, 0.185]} s={[0.03, 0.4, 0.02]} shadow={false} />
      ))}
      <Part g="box" m="door" p={[-0.06, 0.12, 0.185]} s={[0.12, 0.24, 0.02]} shadow={false} />
      <Part g="box" m="window" p={[0.1, 0.26, 0.185]} s={[0.1, 0.08, 0.02]} shadow={false} />
      <TileRoof p={[-0.06, 0.4, -0.06]} w={0.68} h={0.3} d={0.58} />
      {/* Four à pain en dôme */}
      <group position={[0.3, 0, 0.22]}>
        <Part g="ball" m="stoneLight" p={[0, 0.1, 0]} s={[0.3, 0.26, 0.3]} />
        <Glow p={[0, 0.07, 0.14]} s={[0.1, 0.08, 0.02]} />
      </group>
      <Chimney p={BAKERY_CHIMNEYS[1][0]} h={0.34} />
      {/* Enseigne : un pain doré */}
      <Part g="box" m="timber" p={[-0.3, 0.36, 0.26]} s={[0.02, 0.02, 0.14]} shadow={false} />
      <Part g="ball" m="hay" p={[-0.3, 0.3, 0.32]} s={[0.12, 0.06, 0.07]} shadow={false} />
      {/* Paniers de pains */}
      {[-0.36, -0.22].map((x) => (
        <group key={x} position={[x, 0, 0.36]}>
          <Part g="cylinderLow" m="woodLight" p={[0, 0.04, 0]} s={[0.1, 0.08, 0.1]} />
          <Part g="ball" m="hay" p={[0, 0.09, 0]} s={[0.08, 0.04, 0.06]} shadow={false} />
        </group>
      ))}
    </group>
  );
}

function PlankStack({ p, n = 4 }: { p: V3; n?: number }) {
  return (
    <group position={p}>
      {Array.from({ length: n }, (_, i) => (
        <Part key={i} g="box" m="woodLight" p={[0, 0.02 + i * 0.035, 0]} s={[0.34, 0.03, 0.12]} r={[0, (i % 2) * 0.06, 0]} />
      ))}
    </group>
  );
}

/** Scierie : long hangar ouvert, scie circulaire animée sur un banc, bille de bois, piles de planches */
export function Sawmill() {
  return (
    <group>
      {/* Hangar sur poteaux */}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => <Part key={`${sx}${sz}`} g="box" m="timber" p={[sx * 0.36, 0.2, sz * 0.2]} s={[0.04, 0.4, 0.04]} />),
      )}
      <TileRoof p={[0, 0.4, 0]} w={0.56} h={0.22} d={0.86} rotY={Math.PI / 2} />
      {/* Banc de sciage avec scie qui tourne et bille de bois */}
      <Part g="box" m="woodLight" p={[0, 0.1, 0]} s={[0.6, 0.06, 0.14]} />
      <Part g="cylinderLow" m="woodRaw" p={[-0.12, 0.17, 0]} s={[0.09, 0.32, 0.09]} r={[0, 0, Math.PI / 2]} />
      <Spinner p={[0.12, 0.17, 0]} axis="z" speed={8}>
        <Part g="cylinder" m="stoneLight" s={[0.18, 0.012, 0.18]} r={[Math.PI / 2, 0, 0]} />
      </Spinner>
      <PlankStack p={[0.18, 0, 0.34]} n={5} />
      <PlankStack p={[-0.2, 0, 0.34]} n={3} />
      {/* Grumes en attente */}
      {[0, 1, 2].map((i) => (
        <Part key={i} g="cylinderLow" m="woodRaw" p={[-0.3 + i * 0.12, 0.05, -0.34]} s={[0.1, 0.4, 0.1]} r={[Math.PI / 2, 0, 0]} />
      ))}
    </group>
  );
}

/** Mine de fer : butte rocheuse, entrée étayée de poutres, rails et wagonnet de minerai, lanterne */
/**
 * Mine de fer. Niv. 2 : seconde galerie, terril, treuil. Niv. 3 : chevalement en bois et lanterne.
 */
export function Mine({ level = 1 }: { level?: number }) {
  return (
    <group>
      {level >= 2 && (
        <>
          {/* Seconde galerie et terril */}
          <Part g="box" m="ironDark" p={[0.3, 0.1, 0.12]} s={[0.16, 0.2, 0.04]} shadow={false} />
          <Part g="box" m="woodRaw" p={[0.3, 0.21, 0.14]} s={[0.22, 0.03, 0.05]} />
          <Part g="cone6" m="stoneDark" p={[0.36, 0.08, 0.36]} s={[0.22, 0.16, 0.22]} />
          <Spinner p={[0.18, 0.36, 0.08]} axis="x" speed={1.2}>
            <Wheel r={0.07} m="woodRaw" spokes={4} />
          </Spinner>
        </>
      )}
      {level >= 3 && (
        <group position={[-0.3, 0, 0.05]}>
          {/* Chevalement */}
          {[-0.08, 0.08].map((x) => (
            <Part key={x} g="box" m="timber" p={[x, 0.3, 0]} s={[0.03, 0.6, 0.03]} r={[0, 0, x > 0 ? -0.15 : 0.15]} />
          ))}
          <Part g="box" m="timber" p={[0, 0.58, 0]} s={[0.22, 0.03, 0.04]} />
          <Spinner p={[0, 0.62, 0]} axis="z" speed={2}>
            <Wheel r={0.08} m="ironDark" spokes={4} />
          </Spinner>
          <Torch p={[0.14, 0.02, 0.1]} />
        </group>
      )}
      <Part g="rock" m="stoneDark" p={[0, 0.2, -0.18]} s={[0.9, 0.5, 0.6]} />
      <Part g="rock" m="stone" p={[0.3, 0.14, -0.05]} s={[0.4, 0.32, 0.4]} />
      {/* Entrée étayée */}
      <Part g="box" m="ironDark" p={[-0.08, 0.13, 0.1]} s={[0.22, 0.26, 0.04]} shadow={false} />
      <Part g="box" m="woodRaw" p={[-0.2, 0.14, 0.13]} s={[0.04, 0.28, 0.04]} />
      <Part g="box" m="woodRaw" p={[0.04, 0.14, 0.13]} s={[0.04, 0.28, 0.04]} />
      <Part g="box" m="woodRaw" p={[-0.08, 0.29, 0.13]} s={[0.3, 0.04, 0.05]} />
      {/* Rails */}
      {[-0.13, -0.03].map((x) => (
        <Part key={x} g="box" m="ironDark" p={[x, 0.012, 0.32]} s={[0.015, 0.012, 0.42]} shadow={false} />
      ))}
      {[0.16, 0.26, 0.36, 0.46].map((z) => (
        <Part key={z} g="box" m="woodRaw" p={[-0.08, 0.006, z]} s={[0.16, 0.012, 0.03]} shadow={false} />
      ))}
      {/* Wagonnet chargé de minerai rougeâtre */}
      <group position={[-0.08, 0, 0.36]}>
        <Part g="box" m="woodLight" p={[0, 0.07, 0]} s={[0.14, 0.08, 0.16]} />
        <Part g="rock" m="roofTileDark" p={[0, 0.13, 0]} s={0.09} shadow={false} />
      </group>
      <Part g="rock" m="roofTileDark" p={[0.3, 0.05, 0.3]} s={0.12} shadow={false} />
      <Torch p={[0.1, 0.02, 0.18]} />
    </group>
  );
}

/**
 * Forge. Niv. 1 : atelier de pierre, foyer rougeoyant, enclume, cheminée.
 * Niv. 2 : armurerie en plus (râtelier d'armes, bouclier, bannière, seconde cheminée).
 */
export function Forge({ level = 1 }: { level?: number }) {
  return (
    <group>
      <Part g="box" m="stone" p={[-0.08, 0.2, -0.12]} s={[0.56, 0.4, 0.44]} />
      <TileRoof p={[-0.08, 0.4, -0.12]} w={0.64} h={0.24} d={0.52} m="roofSlate" />
      {/* Forge ouverte : foyer et soufflet */}
      <Part g="box" m="stoneDark" p={[-0.08, 0.1, 0.13]} s={[0.26, 0.2, 0.08]} />
      <Glow p={[-0.08, 0.14, 0.175]} s={[0.16, 0.08, 0.02]} />
      <Part g="box" m="woodRaw" p={[0.12, 0.08, 0.15]} s={[0.1, 0.06, 0.08]} shadow={false} />
      <Chimney p={FORGE_CHIMNEYS[level >= 2 ? 2 : 1][0]} h={level >= 2 ? 0.5 : 0.4} />
      {/* Enclume */}
      <group position={[0.2, 0, 0.3]}>
        <Part g="cylinderLow" m="woodRaw" p={[0, 0.05, 0]} s={[0.1, 0.1, 0.1]} />
        <Part g="box" m="ironDark" p={[0, 0.12, 0]} s={[0.14, 0.05, 0.07]} />
      </group>
      {/* Outils et barres de fer */}
      <Part g="box" m="ironDark" p={[-0.34, 0.03, 0.3]} s={[0.18, 0.02, 0.03]} r={[0, 0.4, 0]} shadow={false} />
      <Part g="box" m="ironDark" p={[-0.3, 0.05, 0.36]} s={[0.18, 0.02, 0.03]} r={[0, -0.2, 0]} shadow={false} />
      {level >= 2 && (
        <>
          {/* Armurerie : annexe, râtelier d'armes, bouclier */}
          <group position={[0.3, 0, -0.18]}>
            <Part g="box" m="stoneLight" p={[0, 0.15, 0]} s={[0.26, 0.3, 0.3]} />
            <TileRoof p={[0, 0.3, 0]} w={0.32} h={0.16} d={0.36} />
            <Chimney p={[FORGE_CHIMNEYS[2][1][0] - 0.3, FORGE_CHIMNEYS[2][1][1], FORGE_CHIMNEYS[2][1][2] + 0.18]} h={0.3} />
          </group>
          <group position={[0.4, 0, 0.12]}>
            <Part g="box" m="timber" p={[0, 0.12, 0]} s={[0.03, 0.24, 0.2]} />
            {[-0.06, 0, 0.06].map((z) => (
              <Part key={z} g="box" m="stoneLight" p={[0.02, 0.16, z]} s={[0.01, 0.22, 0.015]} shadow={false} />
            ))}
          </group>
          <Part g="cylinder" m="cloth" p={[0.43, 0.2, 0.32]} s={[0.14, 0.02, 0.14]} r={[0, 0, Math.PI / 2]} shadow={false} />
          <Banner p={[-0.42, 0, 0.38]} h={0.55} m="cloth" />
        </>
      )}
      {/* Roue à aiguiser */}
      <Spinner p={[-0.36, 0.1, 0.16]} axis="x" speed={level >= 2 ? 4 : 2}>
        <Wheel r={0.07} m="stoneLight" spokes={4} />
      </Spinner>
    </group>
  );
}
