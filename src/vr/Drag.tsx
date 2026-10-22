// Glisser-déposer des bâtiments : un seul mécanisme pour la souris (aperçu PC), le rayon d'une manette
// (gâchette ou grip) et le pincement d'une main. Le geste commence sur un objet (boîte, bâtiment posé),
// puis suit le pointeur jusqu'au relâchement.

import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { BUILDING_BY_ID, buildCost } from '../game/buildings';
import { formatResources } from '../game/events';
import { canMoveTo, moveCost } from '../game/moves';
import { canAfford, canPlace, isUnlocked } from '../game/rules';
import { MODELS } from '../scene/models';
import { useGame } from '../store/gameStore';
import { VR_CONFIG } from './config';
import { feedback } from './feedback';
import { boardFrame, boardTopY, tileToWorldPos, worldToTile, worldToUI } from './frame';
import { insideBox } from './layout';
import { pointOnHorizontalPlane, samplePointer } from './pointers';
import { useVR, type Held } from './store';

interface Drag {
  pointerId: number;
  held: NonNullable<Held>;
  startedAt: number;
}

let drag: Drag | null = null;
/** Instant de la fin du dernier glisser : un « clic » juste après un dépôt n'est pas un tap */
export let lastDragEnd = 0;
/** Vrai quand le geste en cours est au-dessus de la boîte (elle s'illumine : déposer = détruire) */
export const dragState = { overBox: false };

export const isDragging = () => drag !== null;

/** Démarre le geste pour un bâtiment neuf (pioché dans la boîte) */
export function beginNew(e: ThreeEvent<PointerEvent>, type: keyof typeof BUILDING_BY_ID): boolean {
  const g = useGame.getState().game;
  if (drag || g.gameOver) return false;
  if (!isUnlocked(g, type)) {
    feedback('error', e);
    return false;
  }
  if (!canAfford(g.resources, buildCost(type))) {
    feedback('error', e);
    useGame.getState().showToast(`Il manque : ${formatResources(buildCost(type))}`);
    return false;
  }
  start(e, { kind: 'new', type });
  return true;
}

/** Démarre le geste pour un bâtiment déjà posé (le soulever pour le déplacer ou le détruire) */
export function beginMove(e: ThreeEvent<PointerEvent>, id: number): boolean {
  const g = useGame.getState();
  const b = g.game.buildings.find((x) => x.id === id);
  if (drag || !b || !BUILDING_BY_ID[b.type].buildable || b.fire) return false;
  if (!g.lift(id)) return false;
  start(e, { kind: 'move', id, type: b.type, from: { x: b.x, z: b.z } });
  return true;
}

function start(e: ThreeEvent<PointerEvent>, held: NonNullable<Held>) {
  drag = { pointerId: e.pointerId, held, startedAt: performance.now() };
  useVR.getState().setHeld(held);
  useGame.getState().select(held.type);
  feedback('grab', e);
}

function finish() {
  drag = null;
  dragState.overBox = false;
  lastDragEnd = performance.now();
  useVR.getState().setHeld(null);
  useGame.getState().select(null);
  useGame.getState().setHover(null);
}

/** Annule le geste en cours (session quittée, casque retiré) : le bâtiment soulevé revient à sa place */
export function cancelDrag() {
  if (!drag) return;
  if (drag.held.kind === 'move') useGame.getState().cancelLift(drag.held.id);
  finish();
}

const _top = new THREE.Vector3();
const _tmp = new THREE.Vector3();

/** Le geste en cours, évalué à chaque image ; affiche aussi le bâtiment tenu en main */
export function DragController() {
  const visual = useRef<THREE.Group>(null);
  const held = useVR((s) => s.held);
  const Model = held ? MODELS[held.type] : null;

  useFrame((state) => {
    const v = visual.current;
    if (!drag) {
      if (v) v.visible = false;
      return;
    }
    const sample = samplePointer(state, drag.pointerId);
    const vr = useVR.getState();
    if (!sample) {
      cancelDrag();
      return;
    }
    const f = boardFrame();
    const top = boardTopY(f);

    // Où le pointeur touche le plateau
    const plane = pointOnHorizontalPlane(sample, top, _top);
    const reach = sample.dir ? true : sample.origin.y - top < 0.3;
    const tile = plane && reach ? worldToTile(plane, f) : null;

    // Au-dessus de la boîte ?
    let overBox = false;
    if (plane) {
      const u = worldToUI(plane, f, _tmp);
      overBox = insideBox(u.x, u.z, vr.prefs.dominant, vr.board.scale);
    }
    dragState.overBox = overBox && drag.held.kind === 'move';

    const game = useGame.getState();
    game.setHover(tile && !overBox ? tile : null);

    // Le bâtiment suit la main (caché quand il est aimanté sur une case : l'aperçu vert / rouge le montre)
    if (v) {
      const snapped = !!tile && !overBox;
      v.visible = !snapped;
      if (!snapped) {
        if (sample.dir && plane) v.position.copy(plane).y += VR_CONFIG.interact.holdLift * f.us;
        else v.position.copy(sample.origin).y += VR_CONFIG.interact.holdLift * 0.5 * f.us;
        v.scale.setScalar(VR_CONFIG.interact.miniSize * 1.15 * f.us);
        v.rotation.y += 0.02;
      }
    }

    if (sample.down) return;

    // Relâché : poser, déplacer, détruire ou annuler
    const h = drag.held;
    const g = game.game;
    if (h.kind === 'new') {
      if (tile && canPlace(g, h.type, tile.x, tile.z).ok && game.build(tile.x, tile.z)) feedback('drop');
      else {
        feedback('error');
        if (tile) game.showToast(canPlace(g, h.type, tile.x, tile.z).reason ?? 'Impossible ici');
      }
    } else {
      const b = g.buildings.find((x) => x.id === h.id);
      if (!b) {
        finish();
        return;
      }
      if (tile && !overBox && tile.x === h.from.x && tile.z === h.from.z) {
        // Reposé au même endroit : rien ne change (et rien n'est payé)
        game.cancelLift(h.id);
        feedback('click');
      } else if (overBox) {
        if (game.demolish(h.id)) feedback('drop');
        else game.cancelLift(h.id);
      } else if (tile && canMoveTo(g, b, tile.x, tile.z).ok && canAfford(g.resources, moveCost(g, b))) {
        if (!game.drop(h.id, tile.x, tile.z)) game.cancelLift(h.id);
        else feedback('drop');
      } else {
        game.cancelLift(h.id);
        feedback('error');
        if (tile) {
          const cost = moveCost(g, b);
          game.showToast(canMoveTo(g, b, tile.x, tile.z).reason ?? (canAfford(g.resources, cost) ? 'Impossible ici' : `Il manque : ${formatResources(cost)}`));
        }
      }
    }
    finish();
  });

  return (
    <group ref={visual} visible={false}>
      {Model && <Model id={-1} level={1} />}
    </group>
  );
}

/** Position monde du centre d'une case (aides pour les panneaux et bulles) */
export { tileToWorldPos };
