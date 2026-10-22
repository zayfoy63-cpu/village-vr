import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

async function boot() {
  // Tests sans casque : ?emulate=controller (manettes) ou ?emulate=hands (mains), avant la création du store XR
  const emulate = new URLSearchParams(location.search).get('emulate');
  if (emulate) await (await import('./vr/emulator')).installEmulator(emulate === 'hands' ? 'hands' : 'controller');
  const { App } = await import('./App');
  const { useGame } = await import('./store/gameStore');
  // Aperçu de l'interface 3D sur PC (tests et développement) : ?ui3d
  if (new URLSearchParams(location.search).has('ui3d')) (await import('./vr/store')).useVR.getState().setActive(true, true);

  // En développement uniquement : accès au store et aux modules de jeu depuis la console (tests, débogage)
  if (import.meta.env.DEV) {
    const w = window as unknown as Record<string, unknown>;
    w.__game = useGame;
    void import('./vr/store').then((m) => (w.__vr = m.useVR));
    void Promise.all([import('./game/events'), import('./game/stateUtils'), import('./game/realtime')]).then(([events, utils, realtime]) => {
      w.__events = events;
      w.__utils = utils;
      w.__realtime = realtime;
    });
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void boot();
