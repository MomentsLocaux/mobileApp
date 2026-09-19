import {
  AVATAR_COLOR_OPTIONS,
  AVATAR_OPTIONS,
  DEFAULT_AVATAR_CONFIG,
  type AvatarColorKey,
  type AvatarConfig,
  type AvatarStyleKey,
} from '../constants/avatar-options';

export const CUSTOM_AVATAR_SCHEME = 'avatar:v1:';
export const MAX_CUSTOM_AVATAR_LENGTH = 2048;
const STYLE_KEYS = Object.keys(AVATAR_OPTIONS) as AvatarStyleKey[];
const COLOR_KEYS = Object.keys(AVATAR_COLOR_OPTIONS) as AvatarColorKey[];

/** Accept only known styles and literal RGB colors, never SVG paint URLs or arbitrary data. */
function validateConfig(value: unknown): AvatarConfig | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const result: Record<string, string> = {};
  for (const key of STYLE_KEYS) {
    const item = candidate[key];
    if (typeof item !== 'string' || !AVATAR_OPTIONS[key].some((option) => option.value === item)) return null;
    result[key] = item;
  }
  for (const key of COLOR_KEYS) {
    const item = candidate[key];
    if (typeof item !== 'string' || !/^#[0-9a-f]{6}$/i.test(item)) return null;
    result[key] = item.toUpperCase();
  }
  // All required properties have been validated and extra fields are deliberately discarded.
  return result as AvatarConfig;
}

export function encodeCustomAvatar(config: AvatarConfig): string {
  const validated = validateConfig(config);
  if (!validated) throw new Error('Invalid avatar configuration');
  return `${CUSTOM_AVATAR_SCHEME}${encodeURIComponent(JSON.stringify(validated))}`;
}

export function decodeCustomAvatar(url?: string | null): AvatarConfig | null {
  if (!url || !url.startsWith(CUSTOM_AVATAR_SCHEME) || url.length > MAX_CUSTOM_AVATAR_LENGTH) return null;
  try {
    return validateConfig(JSON.parse(decodeURIComponent(url.slice(CUSTOM_AVATAR_SCHEME.length))));
  } catch {
    return null;
  }
}

export function createAvatarConfig(base: Partial<AvatarConfig> = {}): AvatarConfig {
  const config = { ...DEFAULT_AVATAR_CONFIG, ...base };
  // Keep the original accessory's palette when converting an existing preset.
  if (!base.accessoryColor) {
    config.accessoryColor = base.accessory === 'glasses' || base.accessory === 'round-glasses'
      ? '#1A3329'
      : base.accessory === 'cap' || base.accessory === 'beanie' || base.accessory === 'leaf'
        ? '#7CB518'
        : '#E0B44A';
  }
  return validateConfig(config) ?? { ...DEFAULT_AVATAR_CONFIG };
}

export function randomizeAvatar(): AvatarConfig {
  const config = { ...DEFAULT_AVATAR_CONFIG };
  const values: Record<string, string> = config;
  for (const [key, options] of Object.entries({ ...AVATAR_OPTIONS, ...AVATAR_COLOR_OPTIONS })) {
    values[key] = options[Math.floor(Math.random() * options.length)].value;
  }
  return config;
}
