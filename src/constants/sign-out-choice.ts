/** Copy and mapping for SCRUM-71 — logout is not account deletion. */

export const SIGN_OUT_CHOICE = {
  title: 'Déconnexion',
  message:
    'Votre compte n’est pas supprimé. « Garder cet appareil » permet de revenir plus vite (Face ID / Touch ID). « Oublier cet appareil » retire la session de ce téléphone.',
  cancel: 'Annuler',
  keepDevice: 'Garder cet appareil',
  forgetDevice: 'Oublier cet appareil',
} as const;

export type SignOutChoice = 'keep-device' | 'forget-device';

export function signOutModeForChoice(choice: SignOutChoice): 'soft' | 'full' {
  return choice === 'forget-device' ? 'full' : 'soft';
}
