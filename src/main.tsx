import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { useGame } from './store/gameStore';
import './styles.css';

// En développement uniquement : accès au store et aux modules de jeu depuis la console (tests, débogage)
if (import.meta.env.DEV) {
  const w = window as unknown as Record<string, unknown>;
  w.__game = useGame;
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
