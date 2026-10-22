import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { useGame } from './store/gameStore';
import './styles.css';

// En développement uniquement : accès au store depuis la console (tests, débogage)
if (import.meta.env.DEV) (window as unknown as { __game: typeof useGame }).__game = useGame;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
