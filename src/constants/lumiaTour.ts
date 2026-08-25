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

import { LUMIA_NAME, LUMIA_AVATAR_LOCAL } from '@/constants/lumia';

export { LUMIA_NAME, LUMIA_AVATAR_LOCAL };

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
      title: 'Tes favoris',
      body: 'Ce que tu aimes atterrit ici. Un cœur, et tu le retrouves quand tu veux.',
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
        body: 'Une question ? Je suis aussi là, l’icône étincelle. On se parle quand tu veux.',
        target: 'headerChat',
        href: '/(tabs)',
      });
    }

    steps.push({
      id: 'headerNotifications',
      title: 'Les notifications',
      body: 'La cloche, juste à côté. Rien d’important ne te passe sous le nez.',
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
