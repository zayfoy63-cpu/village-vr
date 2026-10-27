import { useVillagerHover } from '../scene/villagerHover';

/** Nom du villageois sous la souris, écrit à la plume à côté du curseur */
export function VillagerTip() {
  const hover = useVillagerHover((s) => s.hover);
  const x = useVillagerHover((s) => s.x);
  const y = useVillagerHover((s) => s.y);
  if (!hover) return null;
  return (
    <div className="villager-tip" style={{ left: x + 14, top: y - 10 }}>
      {hover.name}
    </div>
  );
}
