// Persisted v1 option values are stable identifiers: do not rename or remove them.
export const AVATAR_OPTIONS = {
  faceShape: [
    { value: 'oval', label: 'Ovale' },
    { value: 'round', label: 'Rond' },
    { value: 'square', label: 'Carré' },
    { value: 'heart', label: 'Cœur' },
  ],
  eyes: [
    { value: 'round', label: 'Ronds' },
    { value: 'almond', label: 'En amande' },
    { value: 'smiling', label: 'Souriants' },
    { value: 'lashes', label: 'Avec cils' },
    { value: 'wink', label: 'Clin d’œil' },
  ],
  mouth: [
    { value: 'smile', label: 'Sourire' },
    { value: 'grin', label: 'Grand sourire' },
    { value: 'neutral', label: 'Discret' },
    { value: 'open', label: 'Surpris' },
  ],
  nose: [
    { value: 'rounded', label: 'Arrondi' },
    { value: 'small', label: 'Petit' },
    { value: 'broad', label: 'Large' },
  ],
  ears: [
    { value: 'regular', label: 'Classiques' },
    { value: 'small', label: 'Petites' },
    { value: 'large', label: 'Grandes' },
  ],
  hairStyle: [
    { value: 'bob', label: 'Carré' },
    { value: 'afro', label: 'Afro' },
    { value: 'short', label: 'Courts' },
    { value: 'bun', label: 'Chignon' },
    { value: 'wavy', label: 'Ondulés' },
    { value: 'ponytail', label: 'Queue-de-cheval' },
    { value: 'locs', label: 'Locks' },
    { value: 'pixie', label: 'Pixie' },
    { value: 'curly', label: 'Bouclés' },
    { value: 'buzz', label: 'Ras' },
    { value: 'long', label: 'Longs' },
    { value: 'undercut', label: 'Undercut' },
    { value: 'bald', label: 'Sans cheveux' },
  ],
  facialHair: [
    { value: 'none', label: 'Aucune' },
    { value: 'stubble', label: 'Barbe courte' },
    { value: 'beard', label: 'Barbe' },
    { value: 'mustache', label: 'Moustache' },
  ],
  accessory: [
    { value: 'none', label: 'Aucun' },
    { value: 'glasses', label: 'Lunettes carrées' },
    { value: 'round-glasses', label: 'Lunettes rondes' },
    { value: 'earrings', label: 'Créoles' },
    { value: 'cap', label: 'Casquette' },
    { value: 'beanie', label: 'Bonnet' },
    { value: 'leaf', label: 'Broche feuille' },
  ],
} as const;

export type AvatarStyleKey = keyof typeof AVATAR_OPTIONS;
export type AvatarStyles = {
  [Key in AvatarStyleKey]: (typeof AVATAR_OPTIONS)[Key][number]['value'];
};

export const AVATAR_COLOR_OPTIONS = {
  skin: [
    { value: '#F6D7B0', label: 'Ivoire' }, { value: '#F3C6A5', label: 'Pêche' },
    { value: '#E8B887', label: 'Sable' }, { value: '#D4A574', label: 'Miel' },
    { value: '#C68642', label: 'Caramel' }, { value: '#8D5524', label: 'Cuivré' },
    { value: '#754A33', label: 'Brun' }, { value: '#5C3A21', label: 'Cacao' },
    { value: '#3D281E', label: 'Ébène' },
  ],
  hair: [
    { value: '#1A120C', label: 'Noir' }, { value: '#2C1B12', label: 'Brun profond' },
    { value: '#3B2416', label: 'Châtain foncé' }, { value: '#4A2C14', label: 'Châtain' },
    { value: '#5A3310', label: 'Noisette' }, { value: '#8A3E12', label: 'Auburn' },
    { value: '#C45C4A', label: 'Roux' }, { value: '#C9A227', label: 'Blond' },
    { value: '#8A8F86', label: 'Gris' }, { value: '#E5DFCF', label: 'Argent' },
    { value: '#79609A', label: 'Prune' }, { value: '#CB718D', label: 'Rose' },
  ],
  eyeColor: [
    { value: '#1A3329', label: 'Sombres' }, { value: '#65402B', label: 'Marron' },
    { value: '#578256', label: 'Verts' }, { value: '#507EAC', label: 'Bleus' },
    { value: '#858B96', label: 'Gris' },
  ],
  shirt: [
    { value: '#7CB518', label: 'Feuille' }, { value: '#243F34', label: 'Forêt' },
    { value: '#B5DDBB', label: 'Menthe' }, { value: '#C45C4A', label: 'Terracotta' },
    { value: '#E0B44A', label: 'Ocre' }, { value: '#F4FBF6', label: 'Crème' },
    { value: '#628CAF', label: 'Bleu' }, { value: '#AC83A0', label: 'Mauve' },
  ],
  accessoryColor: [
    { value: '#1A3329', label: 'Encre' }, { value: '#7CB518', label: 'Feuille' },
    { value: '#E0B44A', label: 'Doré' }, { value: '#C45C4A', label: 'Terracotta' },
    { value: '#628CAF', label: 'Bleu' }, { value: '#AC83A0', label: 'Mauve' },
  ],
  bg: [
    { value: '#D4EBD8', label: 'Sauge' }, { value: '#E8F5E9', label: 'Menthe' },
    { value: '#F4FBF6', label: 'Clair' }, { value: '#F5E6CB', label: 'Sable' },
    { value: '#F1D9CF', label: 'Pêche' }, { value: '#DDE8F2', label: 'Ciel' },
    { value: '#E8DEF0', label: 'Lavande' },
  ],
} as const;

export type AvatarColorKey = keyof typeof AVATAR_COLOR_OPTIONS;
export type AvatarConfig = AvatarStyles & Record<AvatarColorKey, string>;

export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  faceShape: 'oval', eyes: 'round', mouth: 'smile', nose: 'rounded', ears: 'regular',
  hairStyle: 'bob', facialHair: 'none', accessory: 'none',
  skin: '#F3C6A5', hair: '#3B2416', eyeColor: '#1A3329', shirt: '#7CB518',
  accessoryColor: '#E0B44A', bg: '#D4EBD8',
};
