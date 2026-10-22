import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { XR, useXR } from '@react-three/xr';
import { useEffect, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { nightLevel } from '../game/seasons';
import { useGame } from '../store/gameStore';
import { Bandits } from './Bandits';
import { Buildings } from './Buildings';
import { FireFx } from './FireFx';
import { GameClock } from './GameClock';
import { Ghost, Selection } from './Ghost';
import { Nature } from './Nature';
import { Parcels } from './Parcels';
import { PartPools } from './PartPools';
import { Smoke } from './Smoke';
import { StatusAlerts } from './StatusAlerts';
import { Table } from './Table';
import { Terrain } from './Terrain';
import { Villagers } from './Villagers';
import { Hints } from './Hints';
import { Flood, Rain, Reinforcements, Snowfall, Storm } from './Weather';
import { DevHook } from '../vr/DevHook';
import { PerfMonitor } from '../vr/Perf';
import { WristHelp } from '../vr/ui/WristHelp';
import { UIBatch } from '../vr/ui/UIBatch';
import { DragController } from '../vr/Drag';
import { Placement } from '../vr/Placement';
import { SessionControl } from '../vr/Session';
import { VRRig } from '../vr/VRRig';
import { VR_CONFIG } from '../vr/config';
import { useVR } from '../vr/store';
import { xrStore } from './xr';

const BG = '#2a1e17';

/**
 * Groupe racine du monde : taille réelle sur PC ; en réalité mixte (ou en aperçu ?ui3d), le plateau et
 * toute l'interface 3D vivent dans VRRig.
 */
function WorldRoot({ children }: { children: ReactNode }) {
  const vr = useVR((s) => s.active);
  return vr ? <VRRig world={children} /> : <group>{children}</group>;
}

/** Tient le store VR au courant de la session XR (mode, pause quand le casque est retiré) */
function XRSync() {
  const mode = useXR((s) => s.mode);
  const pc = useVR((s) => s.pcPreview);
  const setActive = useVR((s) => s.setActive);
  useEffect(() => {
    if (!pc) setActive(mode !== null);
  }, [mode, pc, setActive]);
  return null;
}

/** Maillage unique de l'interface 3D : seulement en réalité mixte (ou aperçu ?ui3d) */
function VRBatch() {
  const vr = useVR((s) => s.active);
  return vr ? <UIBatch /> : null;
}

function PcControls() {
  const inXR = useXR((s) => s.mode !== null);
  // Aperçu 3D sur PC : pas de rotation de caméra pendant qu'on tient un bâtiment
  const holding = useVR((s) => s.held !== null);
  if (inXR) return null;
  return (
    <OrbitControls
      makeDefault
      enabled={!holding}
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
  const plinthOnly = useVR((s) => s.active && !s.pcPreview);
  return (
    // La clé sur la seed remonte tout le monde à chaque nouvelle partie ; les groupes nommés servent
    // aux mesures de performance (appels de dessin par élément de la scène)
    <group key={map.seed}>
      <group name="Table"><Table width={map.width} height={map.height} plinthOnly={plinthOnly} /></group>
      <group name="Terrain"><Terrain map={map} /></group>
      <group name="Nature"><Nature map={map} /></group>
      <group name="Parcels"><Parcels map={map} /></group>
      <group name="Buildings"><Buildings buildings={buildings} map={map} /></group>
      <group name="Villagers"><Villagers buildings={buildings} map={map} /></group>
      <group name="Smoke"><Smoke buildings={buildings} map={map} /></group>
      <group name="FireFx"><FireFx buildings={buildings} map={map} /></group>
      <group name="StatusAlerts"><StatusAlerts buildings={buildings} map={map} /></group>
      <group name="Bandits"><Bandits map={map} /></group>
      <group name="Flood"><Flood map={map} /></group>
      <group name="Storm"><Storm map={map} /></group>
      <group name="Reinforcements"><Reinforcements map={map} /></group>
      <group name="Snowfall"><Snowfall map={map} /></group>
      <group name="Rain"><Rain map={map} /></group>
      <group name="Hints"><Hints map={map} /></group>
      <group name="Ghost"><Ghost /></group>
      <group name="Selection"><Selection /></group>

    </group>
  );
}

/** Fond sombre et brouillard sur PC ; rien en réalité mixte (on voit la vraie pièce) */
function Backdrop() {
  const ar = useXR((s) => s.mode === 'immersive-ar');
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    if (ar) {
      scene.background = null;
      scene.fog = null;
    } else {
      scene.background = new THREE.Color(BG);
      scene.fog = new THREE.Fog(BG, 45, 110);
    }
  }, [ar, scene]);
  return null;
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
      <XR store={xrStore}>
        <Backdrop />
        <XRSync />
        <SessionControl />
        <Placement />
        <DragController />
        <DevHook />
        <PerfMonitor />
        <WristHelp />
        <GameClock />
        <Lights />
        <PartPools />
        <VRBatch />
        <WorldRoot>
          <World />
        </WorldRoot>
        <PcControls />
      </XR>
    </Canvas>
  );
}

const SUN = new THREE.Color('#ffd39b');
const MOON = new THREE.Color('#8fa6d8');
const GRAY_SKY = new THREE.Color('#c9cfd6');

/** Lumières : soleil qui baisse et bleuit la nuit (plus tôt en hiver), ciel voilé les jours de pluie */
function Lights() {
  const sun = useRef<THREE.DirectionalLight>(null);
  const sky = useRef<THREE.HemisphereLight>(null);
  const warm = useRef<THREE.PointLight>(null);
  // Ombres : carte plus petite en réalité mixte, supprimées si le rythme tombe sous le seuil
  const vr = useVR((s) => s.active);
  const low = useVR((s) => s.lowQuality);
  const shadowSize: number = VR_CONFIG.perf.shadowMap;
  const shadows = !(vr && (low || shadowSize === 0));
  const mapSize = vr ? shadowSize || 512 : 2048;
  // Zone d'ombre : en VR, limitée au plateau (plus de détail pour la même taille de carte)
  const ext = vr ? VR_CONFIG.perf.shadowExtent : { x: 15, y: 13 };
  useEffect(() => {
    const light = sun.current;
    if (!light) return;
    const cam = light.shadow.camera;
    cam.left = -ext.x;
    cam.right = ext.x;
    cam.top = ext.y;
    cam.bottom = -ext.y;
    cam.updateProjectionMatrix();
    // Nouvelle taille de carte : l'ancienne est libérée, three la recrée à la bonne taille
    light.shadow.mapSize.set(mapSize, mapSize);
    light.shadow.map?.dispose();
    light.shadow.map = null;
  }, [mapSize, ext.x, ext.y]);
  useFrame(() => {
    const g = useGame.getState().game;
    // Réalité mixte : la nuit n'assombrit que très peu (on garde la pièce lisible)
    const vrOn = useVR.getState().active;
    const night = nightLevel(g.day, g.dayProgress) * (vrOn ? VR_CONFIG.perf.nightDim : 1);
    const grey = g.mech.rain || g.storm ? 1 : 0;
    if (sun.current) {
      sun.current.intensity = 2.4 * (1 - 0.75 * night) * (1 - 0.35 * grey);
      sun.current.color.copy(SUN).lerp(MOON, night).lerp(GRAY_SKY, grey * 0.4 * (1 - night));
    }
    if (sky.current) sky.current.intensity = 0.9 * (1 - 0.55 * night);
    if (warm.current) warm.current.intensity = 60 * (1 - 0.7 * night);
  });
  return (
    <>
      <hemisphereLight ref={sky} args={['#ffe6c2', '#5a3d26', 0.9]} />
      <ambientLight intensity={0.15} color="#ffd9a8" />
      <directionalLight
        ref={sun}
        position={[10, 18, 9]}
        intensity={2.4}
        color="#ffd39b"
        castShadow={shadows}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={4}
        shadow-camera-near={1}
        shadow-camera-far={60}
      />
      <pointLight ref={warm} position={[-14, 8, -10]} intensity={60} color="#ff9a52" distance={40} />
    </>
  );
}
