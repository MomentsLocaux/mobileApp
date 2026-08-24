export type LumiaTourStepId = 'home' | 'map' | 'proposals' | 'community' | 'create';

export type LumiaTourStep = {
  id: LumiaTourStepId;
  title: string;
  body: string;
  /** Expo-router tab href, if the step should reveal a real screen behind the overlay. */
  href?: '/(tabs)' | '/(tabs)/map' | '/(tabs)/proposals';
};

export const LUMIA_NAME = 'Lumia';

export const LUMIA_INTRO =
  'Je suis Lumia. Après ton profil, je te fais un tour rapide de l’app — tu pourras le rejouer dans Paramètres.';

type BuildOpts = {
  isProfessionnel: boolean;
  eventCreate: boolean;
  socialPeers: boolean;
};

export function buildLumiaTourSteps(opts: BuildOpts): LumiaTourStep[] {
  const steps: LumiaTourStep[] = [
    {
      id: 'home',
      title: opts.isProfessionnel ? 'Ton tableau de bord' : 'L’accueil',
      body: opts.isProfessionnel
        ? 'Ici tu suis ta présence. Les moments près de toi restent à un tap.'
        : 'Ici je te montre les moments près de toi. C’est le point de départ après ton profil.',
      href: '/(tabs)',
    },
    {
      id: 'map',
      title: 'La carte',
      body: 'Tout ce qui se passe autour de toi, sur le territoire. Filtre, approche-toi, ouvre un moment.',
      href: '/(tabs)/map',
    },
  ];

  if (!opts.isProfessionnel) {
    steps.push({
      id: 'proposals',
      title: 'Les propositions',
      body: 'Je te glisse des idées à explorer. Swipe, garde, ou passe — à ton rythme.',
      href: '/(tabs)/proposals',
    });
  }

  if (opts.socialPeers) {
    steps.push({
      id: 'community',
      title: 'La communauté',
      body: 'Membres et profils : ouvre le menu (icône profil en bas à droite), puis « Membres ».',
      href: '/(tabs)',
    });
  }

  if (opts.eventCreate) {
    steps.push({
      id: 'create',
      title: 'Créer un moment',
      body: 'Quand tu veux publier, le bouton + au centre de la barre t’y emmène. Tu peux le laisser pour plus tard.',
      href: '/(tabs)',
    });
  }

  return steps;
}
