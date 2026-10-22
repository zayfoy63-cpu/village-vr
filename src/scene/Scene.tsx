import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { XR, useXR } from '@react-three/xr';
import type { ReactNode } from 'react';
import { useGame } from '../store/gameStore';
import { Bandits } from './Bandits';
import { Buildings } from './Buildings';
import { FireFx } from './FireFx';
import { GameClock } from './GameClock';
import { Ghost, Selection } from './Ghost';
import { Nature } from './Nature';
import { Parcels } from './Parcels';
import { Smoke } from './Smoke';
import { StatusAlerts } from './StatusAlerts';
import { Table } from './Table';
import { Terrain } from './Terrain';
import { Villagers } from './Villagers';
import { Flood, Reinforcements, Snowfall, Storm } from './Weather';
import { VR_WORLD_SCALE, xrStore } from './xr';

const BG = '#2a1e17';

/** Groupe racine du monde : taille réelle sur PC, maquette sur table en VR */
function WorldRoot({ children }: { children: ReactNode }) {
  const inVR = useXR((s) => s.mode === 'immersive-vr');
  return inVR ? (
    <group scale={VR_WORLD_SCALE} position={[0, 0.95, -0.7]}>
      {children}
    </group>
  ) : (
    <group>{children}</group>
  );
}

function PcControls() {
  const inVR = useXR((s) => s.mode !== null);
  if (inVR) return null;
  return (
    <OrbitControls
      makeDefault
      target={[0, 0, 0]}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      minDistance={7}
      maxDistance={38}
      maxPolarAngle={1.3}
      minPolarAngle={0.25}
    />
  );
}

function World() {
  const map = useGame((s) => s.game.map);
  const buildings = useGame((s) => s.game.buildings);
  return (
    // La clé sur la seed remonte tout le monde à chaque nouvelle partie
    <group key={map.seed}>
      <Table width={map.width} height={map.height} />
      <Terrain map={map} />
      <Nature map={map} />
      <Parcels map={map} />
      <Buildings buildings={buildings} map={map} />
      <Villagers buildings={buildings} map={map} />
      <Smoke buildings={buildings} map={map} />
      <FireFx buildings={buildings} map={map} />
      <StatusAlerts buildings={buildings} map={map} />
      <Bandits map={map} />
      <Flood map={map} />
      <Storm map={map} />
      <Reinforcements map={map} />
      <Snowfall map={map} />
      <Ghost />
      <Selection />
    </group>
  );
}

export function Scene() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 14, 16], fov: 45, near: 0.1, far: 300 }}
      gl={{ antialias: true }}
      onContextMenu={(e) => e.preventDefault()}
      onPointerMissed={() => useGame.getState().setHover(null)}
    >
      <color attach="background" args={[BG]} />
      <fog attach="fog" args={[BG, 45, 110]} />
      <XR store={xrStore}>
        <GameClock />
        <hemisphereLight args={['#ffe6c2', '#5a3d26', 0.9]} />
        <ambientLight intensity={0.15} color="#ffd9a8" />
        <directionalLight
          position={[10, 18, 9]}
          intensity={2.4}
          color="#ffd39b"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0004}
          shadow-normalBias={0.02}
          shadow-radius={4}
          shadow-camera-left={-15}
          shadow-camera-right={15}
          shadow-camera-top={13}
          shadow-camera-bottom={-13}
          shadow-camera-near={1}
          shadow-camera-far={60}
        />
        <pointLight position={[-14, 8, -10]} intensity={60} color="#ff9a52" distance={40} />
        <WorldRoot>
          <World />
        </WorldRoot>
        <PcControls />
      </XR>
    </Canvas>
  );
}
