import { features } from '@/config/features';

export type LumiaHelpHit = {
  id: string;
  score: number;
  answer: string;
  preferHelp: boolean;
};

type HelpArticle = {
  id: string;
  keywords: string[];
  answer: string;
  enabled?: () => boolean;
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
}

const HOW_TO_CUES =
  /\b(comment|comment faire|ou (est|sont|trouver)|cest quoi|ca sert|aide-moi|explique|utiliser|fonctionn|parametr|reglage|autorisation|signaler|supprim(er)? (mon )?compte)\b/;

const ARTICLES: HelpArticle[] = [
  {
    id: 'home',
    keywords: ['accueil', 'home', 'fil', 'feed', 'liste', 'moments'],
    answer:
      'L’accueil montre les moments près de toi. Tu filtres par statut, dates et thèmes, puis tu ouvres une carte d’événement pour le détail.',
  },
  {
    id: 'map',
    keywords: ['carte', 'map', 'carte', 'geoloc', 'autour', 'territoire', 'pin', 'marqueur'],
    answer:
      'Ouvre l’onglet Carte (icône carte en bas). Tu vois les moments sur le territoire, tu filtres, tu tapes un point pour le détail. La poignée en bas liste aussi les résultats.',
  },
  {
    id: 'search',
    keywords: ['recherch', 'filtre', 'tri', 'rayon', 'search'],
    answer:
      'La barre de recherche (accueil ou carte) combine lieu, dates et thèmes. Les filtres s’additionnent : tu peux garder « à venir » et chercher un mot-clé.',
  },
  {
    id: 'favorites',
    keywords: ['favori', 'coeur', 'aimer', 'sauvegard'],
    answer:
      'Pour garder un moment : le cœur sur la carte ou la fiche. Retrouve-les dans l’onglet Favoris (icône cœur en bas).',
  },
  {
    id: 'proposals',
    keywords: ['proposition', 'swipe', 'idee', 'wand'],
    answer:
      'L’onglet Propositions (baguette) te glisse des idées à explorer. Tu peux garder, passer, ou ouvrir le détail. Ce n’est pas une billetterie.',
  },
  {
    id: 'profile',
    keywords: ['profil', 'avatar', 'nom', 'affichage', 'bio'],
    answer:
      'L’icône en bas à droite ouvre le menu, puis ton profil. Pour modifier nom, photo ou infos : Paramètres → Modifier le profil.',
  },
  {
    id: 'settings',
    keywords: ['parametr', 'reglage', 'settings', 'notification', 'permission', 'autorisation'],
    answer:
      'Menu profil (bas droite) → Paramètres. Tu gères notifications, autorisations, confidentialité, et tu peux revoir la config de ton profil.',
  },
  {
    id: 'notifications',
    keywords: ['notif', 'alerte', 'push', 'cloche'],
    answer:
      'La cloche en haut de l’accueil ouvre tes notifications. Pour la fréquence et les thèmes : Paramètres → Gérer les notifications.',
  },
  {
    id: 'account',
    keywords: ['compte', 'connexion', 'deconnexion', 'logout', 'supprim', 'rgpd', 'export', 'donnee'],
    answer:
      'Connexion / déconnexion : menu profil. Suppression de compte, CGU et confidentialité : Paramètres → Confidentialité & données.',
  },
  {
    id: 'report',
    keywords: ['signaler', 'signalement', 'bug', 'report', 'abus', 'moderation'],
    answer:
      'Tu peux signaler un événement, un commentaire ou un profil depuis leur écran (menu ⋯). Pour un bug d’app : écran Bug / support (menu). La modération admin n’est pas dans l’app mobile.',
  },
  {
    id: 'community',
    keywords: ['communaute', 'membre', 'suivre', 'follow', 'ami'],
    answer:
      'Les membres se trouvent dans le menu profil → Membres. Tu peux chercher et suivre des profils. L’invite d’amis passe par le partage de lien, sans accès à tes contacts.',
    enabled: () => features.socialPeers,
  },
  {
    id: 'create',
    keywords: ['creer', 'publier', 'organiser', 'bouton plus'],
    answer: features.eventCreate
      ? 'Pour publier un moment, le bouton + au centre de la barre ouvre le parcours de création.'
      : 'Pour l’instant l’app est centrée sur la découverte : pas de publication. Tu explores l’accueil, la carte et les favoris.',
  },
  {
    id: 'lumia',
    keywords: ['lumia', 'chatbot', 'assistant', 'chat', 'toi'],
    answer:
      'Je t’aide à utiliser Moments Locaux et à trouver des moments déjà publiés. Je n’invente pas d’événements, je ne vends pas de tickets, et je ne parle pas à ta place aux autres membres.',
  },
];

export function matchAppHelp(query: string): LumiaHelpHit | null {
  const hay = normalize(query);
  if (!hay) return null;

  let best: { article: HelpArticle; score: number } | null = null;
  for (const article of ARTICLES) {
    if (article.enabled && !article.enabled()) continue;
    const score = article.keywords.reduce(
      (sum, keyword) => (hay.includes(normalize(keyword)) ? sum + 1 : sum),
      0,
    );
    if (score > 0 && (!best || score > best.score)) {
      best = { article, score };
    }
  }

  if (!best) return null;

  const howTo = HOW_TO_CUES.test(hay);

  return {
    id: best.article.id,
    score: best.score,
    answer: best.article.answer,
    preferHelp: howTo || best.score >= 2,
  };
}
