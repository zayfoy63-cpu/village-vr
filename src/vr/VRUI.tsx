// Toute l'interface, en objets 3D autour du plateau. Les composants ne connaissent pas le mode
// d'entrée : ils ne réagissent qu'aux événements pointeur (souris, rayon, pincement, toucher).

import { VR_CONFIG } from './config';
import { useVR } from './store';
import { BuildBox } from './ui/BuildBox';
import { BuildingPanel3D } from './ui/BuildingPanel3D';
import { Bubbles3D, Cards3D, Threats3D } from './ui/Cards3D';
import { FeaturePanel3D, ParcelPanel3D, ParcelTags3D } from './ui/Land3D';
import { BoardRig3D } from './ui/BoardRig3D';
import { TableObjects } from './ui/TableObjects';
import { Tutorial3D } from './ui/Tutorial3D';
import { Hud3D } from './ui/Hud3D';

/** Demi-dimensions du plateau en mètres (repère de l'interface) */
export function useBoardHalf() {
  const scale = useVR((s) => s.board.scale);
  return { hw: 10 * scale, hd: 7 * scale };
}

export function VRUI() {
  const phase = useVR((s) => s.phase);
  const pcPreview = useVR((s) => s.pcPreview);
  const { hw, hd } = useBoardHalf();
  void hw;
  if (phase !== 'playing') return null;
  return (
    <group>
      <Hud3D z={hd + VR_CONFIG.ui.margin} />
      <BuildBox />
      <BuildingPanel3D />
      <Cards3D />
      <Threats3D />
      <Bubbles3D />
      <ParcelTags3D />
      <ParcelPanel3D />
      <FeaturePanel3D />
      <TableObjects />
      {!pcPreview && <BoardRig3D />}
      <Tutorial3D />
    </group>
  );
}
