// Parcelles à vendre, camps de bandits et ruines : mêmes actions que sur PC, posées sur le plateau.

import { ALL_PARCELS, PARCELS, canBuyParcel, ownsParcel, parcelContents, parcelRect } from '../../game/parcels';
import { formatResources } from '../../game/events';
import { canAfford, defensePower } from '../../game/rules';
import { campStrength } from '../../game/simulation';
import { useGame } from '../../store/gameStore';
import { feedback } from '../feedback';
import { useVR } from '../store';
import { Button3D, FacePlayer, Label, Panel, THEME } from './kit';
import { I } from '../../ui/icons';

const toUI = (tx: number, tz: number, scale: number): [number, number] => [(tx - 10) * scale, (tz - 7) * scale];

/** Étiquette de prix au-dessus de chaque parcelle verrouillée (toucher pour la voir) */
export function ParcelTags3D() {
  const owned = useGame((s) => s.game.parcels.owned);
  const gold = useGame((s) => s.game.resources.gold);
  useGame((s) => s.game.population);
  const scale = useVR((s) => s.board.scale);
  const inspect = useGame((s) => s.inspectParcel);
  const game = useGame.getState().game;
  return (
    <group>
      {ALL_PARCELS.filter((r) => !owned.includes(r.id)).map((r) => {
        const check = canBuyParcel(game, r.id);
        const adjacent = check.reason !== 'Trop loin';
        const { counts, features } = parcelContents(game, r.id);
        const icons = [counts.forest ? `${I.tree}${counts.forest}` : '', counts.rock ? `${I.stone}${counts.rock}` : '', counts.fertile ? `${I.flower}${counts.fertile}` : '', features.some((f) => f.type === 'camp') ? I.camp : '', features.some((f) => f.type === 'ruins') ? I.manor : ''].filter(Boolean).join(' ');
        const [x, z] = toUI((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, scale);
        return (
          <FacePlayer key={r.id} position={[x, 0.09, z]} tilt={0.3}>
            <Button3D
              width={0.17}
              height={0.085}
              label={adjacent ? `${I.gold} ${check.price}` : I.lock}
              sub={icons}
              active={check.ok && gold >= check.price}
              onActivate={() => inspect(r.id)}
            />
          </FacePlayer>
        );
      })}
    </group>
  );
}

/** Panneau d'une parcelle à vendre */
export function ParcelPanel3D() {
  const id = useGame((s) => s.inspectedParcel);
  const owned = useGame((s) => s.game.parcels.owned);
  const game = useGame((s) => s.game);
  const scale = useVR((s) => s.board.scale);
  const close = useGame((s) => s.inspectParcel);
  const buy = useGame((s) => s.buyParcel);
  if (id === null || owned.includes(id)) return null;
  const r = parcelRect(id);
  const check = canBuyParcel(game, id);
  const { counts, features } = parcelContents(game, id);
  const camp = features.find((f) => f.type === 'camp');
  const ruins = features.find((f) => f.type === 'ruins');
  const [x, z] = toUI((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, scale);
  const content = [counts.forest ? `${I.tree} ${counts.forest}` : '', counts.rock ? `${I.stone} ${counts.rock}` : '', counts.fertile ? `${I.flower} ${counts.fertile}` : '', counts.water ? I.flood : '', counts.grass ? `${I.herb} ${counts.grass}` : ''].filter(Boolean).join('   ');
  const h = 0.22 + (camp || ruins ? 0.07 : 0);
  return (
    <FacePlayer position={[x, 0.2, z]} tilt={0.3}>
      <Panel width={0.42} height={h}>
        <Label text={`${I.map} Parcelle à vendre`} size={0.034} position={[0, h / 2 - 0.035, 0]} />
        <Label text={content} size={0.028} position={[0, h / 2 - 0.08, 0]} />
        {camp && <Label text={`${I.camp} Camp de bandits : attaques plus fréquentes`} size={0.021} color={THEME.bad} position={[0, h / 2 - 0.115, 0]} maxWidth={0.4} />}
        {ruins && <Label text={`${I.manor} Ruines : un trésor, mais un risque d'éboulement`} size={0.021} color={THEME.warn} position={[0, h / 2 - 0.115, 0]} maxWidth={0.4} />}
        <Label text={`${I.gold} ${check.price}${check.minPopulation ? `   ${I.people} ${check.minPopulation}` : ''}`} size={0.03} color={check.ok ? THEME.accent : THEME.bad} position={[0, -h / 2 + 0.085, 0]} />
        <Button3D
          width={0.26}
          height={0.065}
          icon={I.gold}
          label="Acheter"
          disabled={!check.ok}
          position={[0, -h / 2 + 0.04, 0.004]}
          onActivate={() => {
            if (buy(id)) feedback('drop');
          }}
        />
        <Button3D width={0.045} height={0.045} icon={I.close} position={[-0.18, h / 2 - 0.03, 0.004]} onActivate={() => close(null)} />
      </Panel>
    </FacePlayer>
  );
}

/** Panneau d'un camp de bandits (attaquer) ou de ruines (déblayer) */
export function FeaturePanel3D() {
  const feature = useGame((s) => s.game.features.find((f) => f.id === s.inspectedFeature && !f.cleared) ?? null);
  const game = useGame((s) => s.game);
  const scale = useVR((s) => s.board.scale);
  const close = useGame((s) => s.inspectFeature);
  const attack = useGame((s) => s.attackCamp);
  const clear = useGame((s) => s.clearRuins);
  if (!feature) return null;
  const owned = ownsParcel(game, feature.parcel);
  const isCamp = feature.type === 'camp';
  const enemy = campStrength(game, feature.strength);
  const power = Math.round((defensePower(game) * 2 + Math.min(game.population, 40) * 0.15) * 10) / 10;
  const [x, z] = toUI(feature.x + 1, feature.z + 1, scale);
  const h = 0.24;
  return (
    <FacePlayer position={[x, 0.2, z]} tilt={0.3}>
      <Panel width={0.42} height={h}>
        <Label text={isCamp ? `${I.camp} Camp de bandits` : `${I.manor} Ruines anciennes`} size={0.034} position={[0, h / 2 - 0.035, 0]} />
        {isCamp ? (
          <>
            <Label text={`${I.weapons} Camp ${enemy}   ${I.shield} Vous ${power}`} size={0.03} color={power >= enemy ? THEME.good : THEME.warn} position={[0, h / 2 - 0.08, 0]} />
            <Label text={`Butin : ${formatResources(feature.loot)}`} size={0.024} color={THEME.dim} position={[0, h / 2 - 0.115, 0]} />
          </>
        ) : (
          <>
            <Label text={`Trésor : ${formatResources(feature.loot)}`} size={0.028} color={THEME.good} position={[0, h / 2 - 0.08, 0]} />
            <Label text={`Coût : ${formatResources(PARCELS.ruins.clearCost)} · éboulement ${Math.round(PARCELS.ruins.collapseChance * 100)} %`} size={0.022} color={THEME.dim} position={[0, h / 2 - 0.115, 0]} maxWidth={0.4} />
          </>
        )}
        {!owned && <Label text="Achetez d'abord la parcelle" size={0.024} color={THEME.warn} position={[0, -h / 2 + 0.085, 0]} />}
        <Button3D
          width={0.3}
          height={0.065}
          icon={isCamp ? I.weapons : I.pickaxe}
          label={isCamp ? 'Attaquer le camp' : 'Déblayer'}
          disabled={!owned || (!isCamp && !canAfford(game.resources, PARCELS.ruins.clearCost))}
          position={[0, -h / 2 + 0.04, 0.004]}
          onActivate={() => (isCamp ? attack(feature.id) : clear(feature.id))}
        />
        <Button3D width={0.045} height={0.045} icon={I.close} position={[-0.18, h / 2 - 0.03, 0.004]} onActivate={() => close(null)} />
      </Panel>
    </FacePlayer>
  );
}
