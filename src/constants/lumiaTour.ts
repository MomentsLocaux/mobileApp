export type LumiaTourStepId =
  | 'home'
  | 'proposals'
  | 'map'
  | 'favorites'
  | 'menu'
  | 'headerProfile'
  | 'headerChat'
  | 'headerNotifications'
  | 'closing';

/** Control to spotlight for a given step. */
export type LumiaTourTargetId =
  | 'home'
  | 'proposals'
  | 'map'
  | 'favorites'
  | 'menu'
  | 'headerProfile'
  | 'headerChat'
  | 'headerNotifications';

export type LumiaTourTargetRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: number;
};

export type LumiaTourHref = '/(tabs)' | '/(tabs)/map' | '/(tabs)/proposals' | '/(tabs)/favorites';

export type LumiaTourStep = {
  id: LumiaTourStepId;
  title: string;
  body: string;
  /** Real UI control to reveal through the overlay. Omit for the closing beat. */
  target?: LumiaTourTargetId;
  href?: LumiaTourHref;
};

import { LUMIA_AVATAR_LOCAL, LUMIA_NAME, LUMIA_TOUR_LOCAL } from '@/constants/lumia';

export { LUMIA_AVATAR_LOCAL, LUMIA_NAME, LUMIA_TOUR_LOCAL };

export const LUMIA_INTRO =
  'Je suis Lumia. Après ton profil, je te fais un tour rapide de l’app — tu pourras le rejouer dans Paramètres.';

export const LUMIA_TOUR_TARGET_RADIUS: Record<LumiaTourTargetId, number> = {
  home: 20,
  proposals: 20,
  map: 20,
  favorites: 20,
  menu: 20,
  headerProfile: 20,
  headerChat: 20,
  headerNotifications: 20,
};

const LUMIA_TOUR_TAB_TARGETS = new Set<LumiaTourTargetId>([
  'home',
  'proposals',
  'map',
  'favorites',
  'menu',
]);

const LUMIA_TOUR_HEADER_TARGETS = new Set<LumiaTourTargetId>([
  'headerProfile',
  'headerChat',
  'headerNotifications',
]);

export function isLumiaTourTabTarget(id: LumiaTourTargetId | null | undefined): id is LumiaTourTargetId {
  return !!id && LUMIA_TOUR_TAB_TARGETS.has(id);
}

export function isLumiaTourHeaderTarget(id: LumiaTourTargetId | null | undefined): id is LumiaTourTargetId {
  return !!id && LUMIA_TOUR_HEADER_TARGETS.has(id);
}

/**
 * Android does not punch a spotlight hole (window coordinates drift from the icon).
 * The scrim stops before the chrome that owns the icon, and the icon is highlighted in place.
 */
export function lumiaTourAndroidScrimInsets(
  target: LumiaTourTargetId | null | undefined,
  opts: { tabBarHeight: number; headerClearance: number },
): { top: number; bottom: number } {
  if (isLumiaTourTabTarget(target)) {
    return { top: 0, bottom: Math.max(0, opts.tabBarHeight) };
  }
  if (isLumiaTourHeaderTarget(target)) {
    return { top: Math.max(0, opts.headerClearance), bottom: 0 };
  }
  return { top: 0, bottom: 0 };
}

type BuildOpts = {
  isProfessionnel: boolean;
  lumiaChat: boolean;
};

export function buildLumiaTourSteps(opts: BuildOpts): LumiaTourStep[] {
  const steps: LumiaTourStep[] = [
    {
      id: 'home',
      title: opts.isProfessionnel ? 'Ton tableau de bord' : 'L’accueil',
      body: opts.isProfessionnel
        ? 'Ici tu suis ta présence. Les moments près de toi restent à un tap.'
        : 'Ici je te montre les moments près de toi. C’est le point de départ.',
      target: 'home',
      href: '/(tabs)',
    },
  ];

  if (!opts.isProfessionnel) {
    steps.push({
      id: 'proposals',
      title: 'Les propositions',
      body: 'Je te glisse des idées à explorer. Swipe, garde, ou passe — à ton rythme.',
      target: 'proposals',
      href: '/(tabs)/proposals',
    });
  }

  steps.push({
    id: 'map',
    title: 'La carte',
    body: 'Tout ce qui se passe autour de toi, sur le territoire. Filtre, approche-toi, ouvre un moment.',
    target: 'map',
    href: '/(tabs)/map',
  });

  if (!opts.isProfessionnel) {
    steps.push({
      id: 'favorites',
      title: 'Ton agenda',
      body: 'Les moments que tu notes atterrissent ici, semaine par semaine. Un cœur, et tu les retrouves.',
      target: 'favorites',
      href: '/(tabs)/favorites',
    });
  }

  steps.push({
    id: 'menu',
    title: 'Le menu',
    body: 'En bas à droite : paramètres, communauté, et le reste de l’app. Un tap et c’est ouvert.',
    target: 'menu',
    href: '/(tabs)',
  });

  if (!opts.isProfessionnel) {
    steps.push({
      id: 'headerProfile',
      title: 'Ton profil',
      body: 'En haut à gauche, c’est toi. Tap pour voir et modifier ton profil.',
      target: 'headerProfile',
      href: '/(tabs)',
    });

    if (opts.lumiaChat) {
      steps.push({
        id: 'headerChat',
        title: 'Moi, en haut à droite',
        body: 'Une question ? Ce petit portrait, c’est moi. Tap dessus et on se parle quand tu veux.',
        target: 'headerChat',
        href: '/(tabs)',
      });
    }

    steps.push({
      id: 'headerNotifications',
      title: 'Les notifications',
      body: 'La cloche, en haut à droite. Rien d’important ne te passe sous le nez.',
      target: 'headerNotifications',
      href: '/(tabs)',
    });
  }

  steps.push({
    id: 'closing',
    title: 'À toi de jouer',
    body: 'Explore, glisse, ouvre des moments. L’app est à toi — et je ne suis jamais loin si tu te perds.',
    href: '/(tabs)',
  });

  return steps;
}
