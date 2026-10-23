import { Scene } from './scene/Scene';
import { useGame } from './store/gameStore';
import { useVR } from './vr/store';
import { BuildBar } from './ui/BuildBar';
import { BuildingPanel } from './ui/BuildingPanel';
import { BanditMarkers } from './ui/BanditMarkers';
import { ChronicleButton } from './ui/Chronicle';
import { CrisisBanner } from './ui/CrisisBanner';
import { EventFlash, Toast } from './ui/EventFlash';
import { FeaturePanel, ParcelPanel } from './ui/LandPanel';
import { ParcelBadges } from './ui/ParcelBadges';
import { SettingsButton } from './ui/Settings';
import { ThreatList } from './ui/ThreatList';
import { EventCards } from './ui/EventCards';
import { GameOver } from './ui/GameOver';
import { HUD } from './ui/HUD';
import { TimeControls } from './ui/TimeControls';
import { VRButton } from './ui/VRButton';
import { Icon } from './ui/icons/Icon';

function SeedPanel() {
  const seed = useGame((s) => s.game.seed);
  const newGame = useGame((s) => s.newGame);
  return (
    <div className="seed-panel">
      <span title="Chaque seed génère une carte unique"><Icon id="dice" /> Seed : {seed}</span>
      <button
        onClick={() => {
          if (confirm('Abandonner cette partie et en commencer une nouvelle ?')) newGame();
        }}
      >
        Nouvelle partie
      </button>
      <ChronicleButton />
      <SettingsButton />
      <VRButton />
    </div>
  );
}

export function App() {
  const seed = useGame((s) => s.game.seed);
  // Aperçu de l'interface 3D sur PC (?ui3d) : l'interface HTML est masquée
  const ui3d = useVR((s) => s.pcPreview);
  return (
    <div className={`app ${ui3d ? 'ui3d' : ''}`}>
      <Scene />
      <ParcelBadges />
      <BanditMarkers />
      <EventFlash />
      <div className="ui-layer">
        <div className="top-row">
          <SeedPanel />
          <HUD />
          <TimeControls />
        </div>
        <ThreatList />
        <CrisisBanner />
        <Toast />
        <EventCards key={seed} />
        <BuildBar />
        <BuildingPanel />
        <ParcelPanel />
        <FeaturePanel />
        <div className="help"><Icon id="mouse" /> Glisser : tourner · Molette : zoom · Clic sur un bâtiment : détails · 1-6 : construire · Tab : onglet · Espace : pause · Clic sur un bandit : envoyer les gardes</div>
        <GameOver />
      </div>
    </div>
  );
}
