import type { AvatarConfig, AvatarStyles } from './avatar-options';
import { createAvatarConfig, decodeCustomAvatar } from '../utils/avatar-config';

export const AVATAR_PRESET_SCHEME = 'preset:';

export type AvatarHairStyle = AvatarStyles['hairStyle'];
export type AvatarEyes = AvatarStyles['eyes'];
export type AvatarMouth = AvatarStyles['mouth'];
export type AvatarFacialHair = AvatarStyles['facialHair'];
export type AvatarAccessory = AvatarStyles['accessory'];

export type AvatarPreset = {
  id: string;
  label: string;
  bg: string;
  skin: string;
  hair: string;
  hairStyle: AvatarHairStyle;
  eyes: AvatarEyes;
  mouth: AvatarMouth;
  shirt: string;
  accessory: AvatarAccessory;
  facialHair: AvatarFacialHair;
  faceShape?: AvatarConfig['faceShape'];
  nose?: AvatarConfig['nose'];
  ears?: AvatarConfig['ears'];
  eyeColor?: string;
  accessoryColor?: string;
};

export const AVATAR_PRESETS: readonly AvatarPreset[] = [
  {
    id: 'sauge',
    label: 'Portrait cheveux au carré',
    bg: '#D4EBD8',
    skin: '#F3C6A5',
    hair: '#3B2416',
    hairStyle: 'bob',
    eyes: 'round',
    mouth: 'smile',
    shirt: '#7CB518',
    accessory: 'none',
    facialHair: 'none',
  },
  {
    id: 'romarin',
    label: 'Portrait afro et boucles d’oreilles',
    bg: '#E8F5E9',
    skin: '#8D5524',
    hair: '#1A120C',
    hairStyle: 'afro',
    eyes: 'lashes',
    mouth: 'smile',
    shirt: '#243F34',
    accessory: 'earrings',
    facialHair: 'none',
  },
  {
    id: 'thym',
    label: 'Portrait lunettes et barbe de trois jours',
    bg: '#F4FBF6',
    skin: '#5C3A21',
    hair: '#1A120C',
    hairStyle: 'short',
    eyes: 'round',
    mouth: 'grin',
    shirt: '#C45C4A',
    accessory: 'glasses',
    facialHair: 'stubble',
  },
  {
    id: 'basilic',
    label: 'Portrait chignon et lunettes rondes',
    bg: '#D4EBD8',
    skin: '#F6D7B0',
    hair: '#8A3E12',
    hairStyle: 'bun',
    eyes: 'smiling',
    mouth: 'smile',
    shirt: '#B5DDBB',
    accessory: 'round-glasses',
    facialHair: 'none',
  },
  {
    id: 'menthe',
    label: 'Portrait cheveux ondulés',
    bg: '#E8F5E9',
    skin: '#C68642',
    hair: '#4A2C14',
    hairStyle: 'wavy',
    eyes: 'round',
    mouth: 'neutral',
    shirt: '#F4FBF6',
    accessory: 'none',
    facialHair: 'none',
  },
  {
    id: 'laurier',
    label: 'Portrait queue-de-cheval',
    bg: '#F4FBF6',
    skin: '#D4A574',
    hair: '#1A120C',
    hairStyle: 'ponytail',
    eyes: 'lashes',
    mouth: 'smile',
    shirt: '#7CB518',
    accessory: 'none',
    facialHair: 'none',
  },
  {
    id: 'myrte',
    label: 'Portrait locks',
    bg: '#D4EBD8',
    skin: '#5C3A21',
    hair: '#1A120C',
    hairStyle: 'locs',
    eyes: 'round',
    mouth: 'smile',
    shirt: '#243F34',
    accessory: 'none',
    facialHair: 'none',
  },
  {
    id: 'ciste',
    label: 'Portrait coupe pixie',
    bg: '#E8F5E9',
    skin: '#F6D7B0',
    hair: '#C9A227',
    hairStyle: 'pixie',
    eyes: 'smiling',
    mouth: 'grin',
    shirt: '#E0B44A',
    accessory: 'none',
    facialHair: 'none',
  },
  {
    id: 'genet',
    label: 'Portrait bouclés et casquette',
    bg: '#F4FBF6',
    skin: '#C68642',
    hair: '#2C1B12',
    hairStyle: 'curly',
    eyes: 'round',
    mouth: 'smile',
    shirt: '#C45C4A',
    accessory: 'cap',
    facialHair: 'none',
  },
  {
    id: 'chene',
    label: 'Portrait coupe courte et barbe',
    bg: '#D4EBD8',
    skin: '#D4A574',
    hair: '#3B2416',
    hairStyle: 'buzz',
    eyes: 'round',
    mouth: 'neutral',
    shirt: '#7CB518',
    accessory: 'none',
    facialHair: 'beard',
  },
  {
    id: 'hetre',
    label: 'Portrait cheveux longs',
    bg: '#E8F5E9',
    skin: '#F3C6A5',
    hair: '#5A3310',
    hairStyle: 'long',
    eyes: 'lashes',
    mouth: 'smile',
    shirt: '#B5DDBB',
    accessory: 'leaf',
    facialHair: 'none',
  },
  {
    id: 'saule',
    label: 'Portrait undercut et lunettes',
    bg: '#F4FBF6',
    skin: '#C68642',
    hair: '#1A120C',
    hairStyle: 'undercut',
    eyes: 'round',
    mouth: 'grin',
    shirt: '#243F34',
    accessory: 'glasses',
    facialHair: 'stubble',
  },
  {
    id: 'peuplier',
    label: 'Portrait chignon foncé',
    bg: '#D4EBD8',
    skin: '#8D5524',
    hair: '#1A120C',
    hairStyle: 'bun',
    eyes: 'smiling',
    mouth: 'smile',
    shirt: '#C45C4A',
    accessory: 'earrings',
    facialHair: 'none',
  },
  {
    id: 'tilleul',
    label: 'Portrait cheveux gris et lunettes rondes',
    bg: '#E8F5E9',
    skin: '#F6D7B0',
    hair: '#8A8F86',
    hairStyle: 'short',
    eyes: 'round',
    mouth: 'smile',
    shirt: '#F4FBF6',
    accessory: 'round-glasses',
    facialHair: 'mustache',
  },
  {
    id: 'aubepine',
    label: 'Portrait cheveux auburn ondulés',
    bg: '#F4FBF6',
    skin: '#E8B887',
    hair: '#8A3E12',
    hairStyle: 'wavy',
    eyes: 'lashes',
    mouth: 'smile',
    shirt: '#7CB518',
    accessory: 'none',
    facialHair: 'none',
  },
  {
    id: 'cornouiller',
    label: 'Portrait afro brun',
    bg: '#D4EBD8',
    skin: '#D4A574',
    hair: '#4A2C14',
    hairStyle: 'afro',
    eyes: 'round',
    mouth: 'grin',
    shirt: '#E0B44A',
    accessory: 'none',
    facialHair: 'none',
  },
  {
    id: 'noisetier',
    label: 'Portrait bonnet',
    bg: '#E8F5E9',
    skin: '#F3C6A5',
    hair: '#3B2416',
    hairStyle: 'bob',
    eyes: 'round',
    mouth: 'neutral',
    shirt: '#243F34',
    accessory: 'beanie',
    facialHair: 'none',
  },
  {
    id: 'sorbier',
    label: 'Portrait barbe et coupe courte',
    bg: '#F4FBF6',
    skin: '#5C3A21',
    hair: '#1A120C',
    hairStyle: 'buzz',
    eyes: 'round',
    mouth: 'smile',
    shirt: '#7CB518',
    accessory: 'none',
    facialHair: 'beard',
  },
  {
    id: 'aulne',
    label: 'Portrait cheveux longs et lunettes rondes',
    bg: '#D4EBD8',
    skin: '#C68642',
    hair: '#1A120C',
    hairStyle: 'long',
    eyes: 'smiling',
    mouth: 'smile',
    shirt: '#B5DDBB',
    accessory: 'round-glasses',
    facialHair: 'none',
  },
  {
    id: 'figuier',
    label: 'Portrait boucles rousses',
    bg: '#E8F5E9',
    skin: '#F6D7B0',
    hair: '#C45C4A',
    hairStyle: 'curly',
    eyes: 'lashes',
    mouth: 'grin',
    shirt: '#C45C4A',
    accessory: 'earrings',
    facialHair: 'none',
  },
] as const;

export const AVATAR_PRESET_BY_ID: ReadonlyMap<string, AvatarPreset> = new Map(
  AVATAR_PRESETS.map((preset) => [preset.id, preset]),
);

export function encodePresetAvatarUrl(id: string): string {
  return `${AVATAR_PRESET_SCHEME}${id}`;
}

export function parsePresetAvatarId(url?: string | null): string | null {
  if (!url || !url.startsWith(AVATAR_PRESET_SCHEME)) return null;
  const id = url.slice(AVATAR_PRESET_SCHEME.length).trim();
  return id || null;
}

export function getAvatarPreset(url?: string | null): AvatarPreset | null {
  const id = parsePresetAvatarId(url);
  if (!id) return null;
  return AVATAR_PRESET_BY_ID.get(id) ?? null;
}

export function isPresetAvatarUrl(url?: string | null): boolean {
  return getAvatarPreset(url) !== null;
}

/** One resolver for all illustrated avatars; photo URLs continue through Image. */
export function getIllustratedAvatar(url?: string | null): AvatarPreset | null {
  const preset = getAvatarPreset(url);
  if (preset) return preset;
  const custom = decodeCustomAvatar(url);
  return custom ? { ...custom, id: 'custom-v1', label: 'Avatar personnalisé' } : null;
}

export function getEditableAvatarConfig(url?: string | null): AvatarConfig {
  return createAvatarConfig(getIllustratedAvatar(url) ?? AVATAR_PRESETS[0]);
}

export function isRemoteAvatarUrl(url?: string | null): boolean {
  if (!url) return false;
  return /^(https?:|file:|content:|data:|blob:|ph:|assets-library:)/i.test(url);
}

export function hasRenderableAvatar(url?: string | null): boolean {
  return getIllustratedAvatar(url) !== null || isRemoteAvatarUrl(url);
}
