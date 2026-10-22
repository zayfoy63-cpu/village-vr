// Positions à l'écran des pastilles de parcelles, calculées dans la scène 3D (projection caméra)
// et lues par la couche HTML (ui/ParcelBadges) sans passer par React à chaque image.

export interface ScreenPoint {
  x: number;
  y: number;
  visible: boolean;
}

export const parcelScreen = new Map<number, ScreenPoint>();
