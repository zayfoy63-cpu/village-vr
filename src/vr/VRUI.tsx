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
      <group name="UI:Hud3D"><Hud3D z={hd + VR_CONFIG.ui.margin} /></group>
      <group name="UI:BuildBox"><BuildBox /></group>
      <group name="UI:BuildingPanel3D"><BuildingPanel3D /></group>
      <group name="UI:Cards3D"><Cards3D /></group>
      <group name="UI:Threats3D"><Threats3D /></group>
      <group name="UI:Bubbles3D"><Bubbles3D /></group>
      <group name="UI:ParcelTags3D"><ParcelTags3D /></group>
      <group name="UI:ParcelPanel3D"><ParcelPanel3D /></group>
      <group name="UI:FeaturePanel3D"><FeaturePanel3D /></group>
      <group name="UI:TableObjects"><TableObjects /></group>
      {!pcPreview && <group name="UI:BoardRig3D"><BoardRig3D /></group>}
      <group name="UI:Tutorial3D"><Tutorial3D /></group>
    </group>
  );
}
