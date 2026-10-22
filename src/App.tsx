import { Scene } from './scene/Scene';
import { useGame } from './store/gameStore';
import { BuildBar } from './ui/BuildBar';
import { BuildingPanel } from './ui/BuildingPanel';
import { CrisisBanner } from './ui/CrisisBanner';
import { FeaturePanel, ParcelPanel } from './ui/LandPanel';
import { ParcelBadges } from './ui/ParcelBadges';
import { EventCards } from './ui/EventCards';
import { GameOver } from './ui/GameOver';
import { HUD } from './ui/HUD';
import { TimeControls } from './ui/TimeControls';
import { VRButton } from './ui/VRButton';

function SeedPanel() {
  const seed = useGame((s) => s.game.seed);
  const newGame = useGame((s) => s.newGame);
  return (
    <div className="seed-panel">
      <span title="Chaque seed génère une carte unique">🎲 Seed : {seed}</span>
      <button
        onClick={() => {
          if (confirm('Abandonner cette partie et en commencer une nouvelle ?')) newGame();
        }}
      >
        Nouvelle partie
      </button>
      <VRButton />
    </div>
  );
}

export function App() {
  const seed = useGame((s) => s.game.seed);
  return (
    <div className="app">
      <Scene />
      <ParcelBadges />
      <div className="ui-layer">
        <div className="top-row">
          <SeedPanel />
          <HUD />
          <TimeControls />
        </div>
        <CrisisBanner />
        <EventCards key={seed} />
        <BuildBar />
        <BuildingPanel />
        <ParcelPanel />
        <FeaturePanel />
        <div className="help">🖱️ Glisser : tourner · Molette : zoom · Clic sur un bâtiment : détails · 1-6 : construire · Tab : onglet · Espace : pause</div>
        <GameOver />
      </div>
    </div>
  );
}
