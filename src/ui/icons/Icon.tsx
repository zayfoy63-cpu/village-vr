// Icônes dans l'interface PC : SVG en ligne, à la taille du texte. Les ressources affichent leur
// nom au survol (infobulle).

import { Fragment, memo, type CSSProperties } from 'react';
import { ICON_DEFS, ICON_OUTLINE, ICON_TOKEN, iconOf, type IconId } from './index';
import { RESOURCE_ICON_IDS } from './resources';

export const Icon = memo(function Icon({ id, size = '1.2em', title, style }: { id: IconId; size?: string | number; title?: string; style?: CSSProperties }) {
  const def = ICON_DEFS[id];
  // Infobulle : explicite, sinon le nom pour les icônes de ressources
  const tip = title ?? (RESOURCE_ICON_IDS.has(id) ? def.name : undefined);
  return (
    <svg className="ico" viewBox="0 0 24 24" width={size} height={size} role="img" aria-label={def.name} style={style}>
      {tip && <title>{tip}</title>}
      {def.shapes.map((s, i) =>
        s.fill === 'none' ? (
          <Fragment key={i}>
            <path d={s.d} fill="none" stroke={ICON_OUTLINE} strokeWidth={(s.w ?? 2) + 1.4} strokeLinecap="round" strokeLinejoin="round" />
            <path d={s.d} fill="none" stroke={s.stroke ?? ICON_OUTLINE} strokeWidth={s.w ?? 2} strokeLinecap="round" strokeLinejoin="round" />
          </Fragment>
        ) : (
          <path key={i} d={s.d} fill={s.fill} stroke={ICON_OUTLINE} strokeWidth={1.1} strokeLinejoin="round" />
        ),
      )}
    </svg>
  );
});

/** Texte qui peut contenir des jetons d'icônes (`I.wood`…) : chaque jeton devient une icône SVG */
export function RichText({ text }: { text: string | number | null | undefined }) {
  if (text === null || text === undefined) return null;
  const s = String(text);
  if (!s.match(ICON_TOKEN)) return <>{s}</>;
  const parts: React.ReactNode[] = [];
  let last = 0;
  s.replace(ICON_TOKEN, (ch, at: number) => {
    if (at > last) parts.push(s.slice(last, at));
    const id = iconOf(ch);
    if (id) parts.push(<Icon key={at} id={id} />);
    last = at + 1;
    return ch;
  });
  if (last < s.length) parts.push(s.slice(last));
  // Un seul élément : reste d'un bloc dans les conteneurs flex
  return <span className="rich">{parts}</span>;
}
