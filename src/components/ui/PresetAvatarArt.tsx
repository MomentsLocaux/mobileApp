import React, { useId } from 'react';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import type { AvatarPreset } from '@/constants/avatar-presets';
import { colors } from '@/constants/theme';

type Props = {
  preset: AvatarPreset;
  size: number;
};

const INK = colors.brand.ink;
const PAPER = '#FFF9EC';
const GOLD = '#E0B44A';

// Pigment variations belong to the illustration, independently of UI surface tokens.
function shade(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  return `#${[num >> 16, (num >> 8) & 0xff, num & 0xff]
    .map((value) => Math.max(0, Math.min(255, value + amount)).toString(16).padStart(2, '0'))
    .join('')}`;
}

function HairBack({ preset }: { preset: AvatarPreset }) {
  const { hair, hairStyle } = preset;
  const outline = shade(hair, -18);
  const shapes = {
    bob: 'M20 49 C12 24 25 12 46 12 C72 9 83 29 76 51 L78 69 Q64 80 48 70 Q28 79 17 67 Z',
    afro: 'M16 57 C3 52 7 40 12 37 C3 25 15 16 24 18 C23 5 40 4 46 10 C55 1 70 6 72 16 C86 12 93 26 85 35 C96 44 88 57 80 58 C80 71 67 77 59 70 L30 71 C19 74 10 66 16 57 Z',
    curly: 'M20 59 C10 60 8 47 16 42 C5 33 15 21 23 22 C17 11 33 6 41 12 C47 2 61 7 65 14 C78 8 87 19 81 28 C94 32 90 45 81 48 C89 62 75 71 65 65 L31 69 Z',
    long: 'M20 42 C17 18 33 10 49 11 C71 9 80 24 77 45 L82 87 Q67 94 52 83 Q32 95 14 86 Z',
    wavy: 'M22 35 C18 18 34 10 48 12 C69 6 82 24 76 39 C88 50 73 57 82 69 C91 84 73 91 60 81 L33 85 C16 92 9 79 17 68 C7 54 24 50 22 35 Z',
    ponytail: 'M65 23 C90 17 79 43 86 56 C94 72 77 83 68 77 C80 62 65 55 73 40 L66 39 C54 46 29 47 22 38 C17 24 32 12 48 14 C56 13 64 16 65 23 Z',
    locs: 'M19 44 C10 33 17 16 28 18 C28 5 41 5 46 12 C51 1 64 6 65 14 C80 9 85 22 78 30 C89 36 84 51 77 56 L20 59 Z',
    bun: 'M35 24 C22 18 31 4 42 7 C54 0 68 10 62 23 C79 28 79 45 69 51 L25 49 C15 36 23 23 35 24 Z',
    undercut: 'M24 39 C17 28 28 14 43 15 C56 2 80 12 78 29 L69 48 L26 48 Z',
    pixie: 'M21 42 L17 29 L25 31 C24 16 37 10 46 15 C57 3 78 16 74 32 L78 35 L69 49 L25 48 Z',
    short: 'M23 41 C16 29 22 18 34 20 C37 9 49 11 54 16 C67 11 78 24 73 40 L68 48 L27 47 Z',
    buzz: 'M24 42 C21 23 34 18 48 18 C66 18 76 29 71 45 L65 51 L28 49 Z',
  };
  return <Path d={shapes[hairStyle]} fill={hair} stroke={outline} strokeWidth="1.8" strokeLinejoin="round" />;
}

function HairFront({ preset }: { preset: AvatarPreset }) {
  const { hair, hairStyle, accessory } = preset;
  if (accessory === 'beanie' || accessory === 'cap') return null;
  const highlight = shade(hair, 28);
  if (hairStyle === 'afro' || hairStyle === 'curly') {
    return (
      <G fill={hair}>
        <Circle cx="26" cy="31" r="9" />
        <Circle cx="36" cy="25" r="10" />
        <Circle cx="49" cy="23" r="10" />
        <Circle cx="62" cy="27" r="9" />
        <Circle cx="70" cy="35" r="7" />
        <Path d="M21 26 Q23 20 29 22 M37 17 Q43 13 47 17 M60 19 Q66 18 69 24" stroke={highlight} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </G>
    );
  }
  if (hairStyle === 'locs') {
    return (
      <G stroke={shade(hair, -12)} strokeWidth="1.2" fill={hair}>
        {[{ x: 23, y: 20, h: 24, r: 18 }, { x: 33, y: 12, h: 24, r: 25 }, { x: 44, y: 10, h: 24, r: 30 }, { x: 55, y: 12, h: 23, r: 32 }, { x: 65, y: 19, h: 23, r: 26 }].map(({ x, y, h, r }) => (
          <G key={x} transform={`rotate(${r} ${x + 4} ${y + h / 2})`}>
            <Rect x={x} y={y} width="9" height={h} rx="4.5" />
            <Path d={`M${x + 3} ${y + 5} v${h - 12}`} stroke={highlight} strokeWidth="1.5" strokeLinecap="round" />
          </G>
        ))}
        <Path d="M28 31 L34 34" stroke={GOLD} strokeWidth="3" />
      </G>
    );
  }
  const fronts = {
    bob: 'M23 43 C17 24 31 15 48 16 C66 12 80 27 73 47 L65 37 L61 27 C51 39 37 38 28 35 L27 47 Z',
    long: 'M23 50 C18 25 32 15 48 15 C68 12 79 29 72 51 L66 44 L63 27 C55 36 40 37 30 35 L28 51 Z',
    wavy: 'M23 47 C14 28 30 13 48 16 C63 10 78 25 73 44 L67 46 Q72 33 61 26 C56 37 42 41 30 34 L28 49 Z',
    ponytail: 'M23 44 C17 25 34 17 49 18 C65 17 77 29 72 43 L67 43 L63 29 Q47 39 28 34 L28 45 Z',
    bun: 'M24 45 C15 26 34 20 49 21 C66 19 77 31 71 45 L67 39 L63 30 Q45 40 28 33 L28 45 Z',
    undercut: 'M24 43 L24 31 C30 16 47 24 55 15 C68 10 79 16 73 29 C62 40 42 36 30 31 L28 43 Z',
    pixie: 'M24 43 L21 30 C32 18 46 25 54 14 C69 10 77 20 72 29 C62 40 48 35 39 29 L30 37 L28 44 Z',
    short: 'M24 44 L23 32 Q27 22 36 26 C41 15 48 22 54 21 Q69 19 72 35 L68 44 L65 31 Q47 39 29 32 L28 44 Z',
    buzz: 'M24 43 C20 24 34 21 48 21 C64 20 75 31 71 44 L66 40 L64 31 Q46 28 30 32 L28 43 Z',
  };
  return (
    <>
      <Path d={fronts[hairStyle]} fill={hair} />
      {hairStyle !== 'buzz' && (
        <Path d={hairStyle === 'bun' ? 'M38 13 Q47 8 54 14 M31 28 Q45 32 56 25' : 'M29 27 Q37 20 46 25 M48 26 Q58 25 63 21'} stroke={highlight} strokeWidth="2.2" fill="none" strokeLinecap="round" />
      )}
    </>
  );
}

function Face({ preset }: { preset: AvatarPreset }) {
  const { eyes, mouth, skin, hair } = preset;
  return (
    <>
      <G fill="#DF795D" opacity={0.3}>
        <Ellipse cx="33" cy="56" rx="5" ry="3" />
        <Ellipse cx="64" cy="56" rx="5" ry="3" />
      </G>
      <G stroke={shade(hair, -12)} strokeWidth="2.6" strokeLinecap="round" fill="none">
        <Path d="M33 39 Q38 36 42 39" />
        <Path d="M55 38 Q60 35 65 39" />
      </G>
      {eyes === 'smiling' ? (
        <G stroke={INK} strokeWidth="2.5" strokeLinecap="round" fill="none">
          <Path d="M33 47 Q38 40 43 47" />
          <Path d="M55 47 Q60 40 65 47" />
        </G>
      ) : (
        <>
          <Ellipse cx="38" cy="46" rx="4" ry="5" fill={PAPER} />
          <Ellipse cx="60" cy="46" rx="4" ry="5" fill={PAPER} />
          <Ellipse cx="39" cy="46.5" rx="2.8" ry="3.8" fill={INK} />
          <Ellipse cx="61" cy="46.5" rx="2.8" ry="3.8" fill={INK} />
          <Circle cx="39.7" cy="45" r="1" fill={PAPER} />
          <Circle cx="61.7" cy="45" r="1" fill={PAPER} />
          {eyes === 'lashes' && (
            <Path d="M34 43 L32 41 M37 41 L36 39 M57 42 L55 40 M61 41 L61 39" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
          )}
        </>
      )}
      <Path d="M48 47 L46 54 Q49 56 52 53" stroke={shade(skin, -38)} strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {mouth === 'grin' ? (
        <>
          <Path d="M39 59 Q49 62 59 58 C58 70 41 72 39 59 Z" fill={INK} />
          <Path d="M41 60 Q49 63 57 60 L56 63 Q49 66 42 63 Z" fill={PAPER} />
          <Path d="M46 68 Q50 64 54 67 Q50 70 46 68" fill="#E68C79" />
        </>
      ) : (
        <Path d={mouth === 'neutral' ? 'M43 61 Q49 64 55 60' : 'M40 60 Q49 69 58 59'} stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />
      )}
    </>
  );
}

function FacialHair({ preset }: { preset: AvatarPreset }) {
  const { facialHair, hair } = preset;
  if (facialHair === 'none') return null;
  if (facialHair === 'mustache') {
    return <Path d="M48 56 C43 52 40 55 38 59 Q44 62 49 58 Q55 61 59 57 C54 56 53 53 48 56 Z" fill={hair} />;
  }
  if (facialHair === 'stubble') {
    return (
      <G stroke={hair} strokeWidth="1" strokeLinecap="round" opacity={0.5}>
        <Path d="M31 56 l1 2 M33 61 l1 2 M36 65 l1 2 M41 69 l1 2 M47 70 v2 M53 70 l-1 2 M59 67 l-1 2 M64 63 l-1 2 M67 57 l-1 2" />
      </G>
    );
  }
  return (
    <>
      <Path d="M27 49 L32 56 Q36 59 39 56 Q49 51 59 55 L65 54 L70 48 C70 66 62 76 49 77 C35 76 27 65 27 49 Z M39 58 Q37 69 49 69 Q62 69 59 57 Q49 54 39 58 Z" fill={hair} fillRule="evenodd" />
      <Path d="M34 62 l2 4 M39 69 l3 2 M57 71 l4 -3" stroke={shade(hair, 24)} strokeWidth="1.6" strokeLinecap="round" />
    </>
  );
}

function Accessory({ preset }: { preset: AvatarPreset }) {
  const { accessory } = preset;
  if (accessory === 'earrings') {
    return (
      <G fill="none" stroke={GOLD} strokeWidth="3">
        <Ellipse cx="24" cy="58" rx="3.5" ry="5" />
        <Ellipse cx="73" cy="58" rx="3.5" ry="5" />
      </G>
    );
  }
  if (accessory === 'glasses' || accessory === 'round-glasses') {
    return (
      <G stroke={INK} strokeWidth="2.3" fill="none">
        <Path d="M25 44 L30 45 M46 46 Q49 44 52 46 M69 44 L73 43" />
        {accessory === 'round-glasses' ? (
          <>
            <Circle cx="38" cy="46" r="8.5" />
            <Circle cx="61" cy="46" r="8.5" />
          </>
        ) : (
          <>
            <Rect x="29" y="40" width="18" height="13" rx="4" />
            <Rect x="52" y="40" width="18" height="13" rx="4" />
          </>
        )}
        <Path d="M33 43 l3 -1 M56 43 l3 -1" stroke={PAPER} strokeWidth="1.5" strokeLinecap="round" />
      </G>
    );
  }
  if (accessory === 'cap') {
    return (
      <>
        <Path d="M22 33 C20 8 63 5 70 28 L71 35 Q48 27 22 36 Z" fill={colors.brand.primary} stroke={INK} strokeWidth="1.5" />
        <Path d="M25 32 C47 23 66 27 83 37 Q73 46 56 35 Q39 31 25 36 Z" fill={colors.brand.secondary} stroke={INK} strokeWidth="1.5" />
        <Path d="M46 14 Q39 21 41 28" stroke={PAPER} strokeOpacity={0.3} strokeWidth="1.5" fill="none" />
        <Circle cx="51" cy="11" r="2.5" fill={colors.brand.secondary} />
      </>
    );
  }
  if (accessory === 'beanie') {
    return (
      <>
        <Path d="M22 33 C21 17 30 10 48 10 C65 9 75 20 73 36 Z" fill={colors.brand.primary} stroke={INK} strokeWidth="1.5" />
        <Path d="M31 28 Q30 20 35 16 M41 27 L42 14 M52 27 L52 14 M63 29 Q65 22 59 16" stroke={PAPER} strokeOpacity={0.22} strokeWidth="2" fill="none" strokeLinecap="round" />
        <Path d="M22 30 Q48 25 73 32 L73 41 Q48 35 22 40 Z" fill={colors.brand.secondary} stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
        <Rect x="55" y="31" width="8" height="7" rx="1.5" fill={PAPER} transform="rotate(5 59 34)" />
      </>
    );
  }
  if (accessory === 'leaf') {
    return (
      <G>
        <Path d="M64 87 Q60 77 71 77 Q74 85 64 87" fill={colors.brand.secondary} stroke={INK} strokeWidth="1" />
        <Path d="M64 88 L69 81" stroke={INK} strokeWidth="1" strokeLinecap="round" />
      </G>
    );
  }
  return null;
}

export function PresetAvatarArt({ preset, size }: Props) {
  // Unique paint-server IDs also keep repeated presets safe in web lists.
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const clip = `avatar-clip-${id}`;
  const skin = `avatar-skin-${id}`;
  const shirt = `avatar-shirt-${id}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" accessibilityLabel={preset.label}>
      <Defs>
        <ClipPath id={clip}><Circle cx="48" cy="48" r="48" /></ClipPath>
        <LinearGradient id={skin} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={shade(preset.skin, 18)} />
          <Stop offset="65%" stopColor={preset.skin} />
          <Stop offset="100%" stopColor={shade(preset.skin, -12)} />
        </LinearGradient>
        <LinearGradient id={shirt} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={shade(preset.shirt, 14)} />
          <Stop offset="100%" stopColor={shade(preset.shirt, -22)} />
        </LinearGradient>
      </Defs>
      <G clipPath={`url(#${clip})`}>
        <Circle cx="48" cy="48" r="48" fill={preset.bg} />
        <Circle cx="31" cy="32" r="34" fill={PAPER} opacity={0.4} />
        <Path d="M0 78 Q45 59 96 77 V96 H0 Z" fill={colors.brand.secondary} opacity={0.09} />
        <HairBack preset={preset} />
        <Path d="M10 99 L14 88 C18 76 32 75 40 73 H56 C69 75 80 78 83 88 L87 99 Z" fill={`url(#${shirt})`} stroke={shade(preset.shirt, -34)} strokeWidth="1.6" />
        <Path d="M39 66 L39 76 Q48 87 57 76 L57 66" fill={shade(preset.skin, -12)} stroke={shade(preset.skin, -38)} strokeWidth="1.4" />
        <Path d="M39 70 Q48 77 57 70 L57 73 Q48 80 39 74 Z" fill={shade(preset.skin, -34)} opacity={0.4} />
        <Path d="M34 77 Q47 96 63 78" stroke={shade(preset.shirt, -34)} strokeWidth="2.8" fill="none" strokeLinecap="round" />
        <Path d="M25 88 L23 96 M72 88 L74 96" stroke={shade(preset.shirt, -34)} strokeWidth="1.6" strokeLinecap="round" />
        <Ellipse cx="25" cy="49" rx="6" ry="8" fill={preset.skin} stroke={shade(preset.skin, -32)} strokeWidth="1.3" />
        <Ellipse cx="72" cy="49" rx="6" ry="8" fill={preset.skin} stroke={shade(preset.skin, -32)} strokeWidth="1.3" />
        <Path d="M23 47 Q27 45 27 52 M74 47 Q70 45 70 52" stroke={shade(preset.skin, -36)} strokeWidth="1.4" fill="none" strokeLinecap="round" />
        <Path d="M26 39 C26 25 37 21 49 21 C63 21 71 29 71 41 L69 56 C67 69 57 75 48 75 C37 75 28 67 27 55 Z" fill={`url(#${skin})`} stroke={shade(preset.skin, -34)} strokeWidth="1.3" />
        <FacialHair preset={preset} />
        <Face preset={preset} />
        <HairFront preset={preset} />
        <Accessory preset={preset} />
      </G>
    </Svg>
  );
}
