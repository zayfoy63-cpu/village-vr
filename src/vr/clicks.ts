// Un « clic » qui termine un glisser de caméra (souris) n'est pas un vrai clic. En XR, `delta` n'existe pas
// (les pointeurs de manette ou de main ne glissent pas la caméra) : on l'ignore.

export function wasCameraDrag(e: { delta: number }): boolean {
  try {
    return e.delta > 6;
  } catch {
    return false;
  }
}
