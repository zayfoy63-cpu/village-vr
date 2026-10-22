// Émulation d'un Meta Quest 3 (IWER, le moteur de l'extension « Immersive Web Emulator »).
// Chargée seulement avec ?emulate=controller|hands dans l'URL : sert aux tests sans casque.
// Le runtime est installé AVANT la création du store XR (voir main.tsx).

import { XRDevice, metaQuest3 } from 'iwer';
import { SyntheticEnvironmentModule } from '@iwer/sem';

export type EmulatorMode = 'controller' | 'hands';

export async function installEmulator(mode: EmulatorMode): Promise<XRDevice> {
  const device = new XRDevice(metaQuest3);
  device.primaryInputMode = mode === 'hands' ? 'hand' : 'controller';
  device.ipd = 0.063;
  // Le Chromium de test expose déjà un WebXR natif sans runtime : on force l'installation
  device.installRuntime({ forceInstall: true });
  device.installSEM(SyntheticEnvironmentModule as never);
  device.sem?.loadDefaultEnvironment('living_room');
  // Tête à 1,6 m, regardant vers -z (comme un joueur debout devant sa table)
  device.position.set(0, 1.6, 0);
  (window as unknown as Record<string, unknown>).__xrDevice = device;
  return device;
}
