import { Linking } from 'react-native';
import type { ContactIntent } from '@/constants/contact';
import { DIFFUSEUR_CONTACT_PATH, DIFFUSEUR_OFFER_URL } from '@/constants/website';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type DiffuseurContactPrefill = {
  name?: string | null;
  email?: string | null;
  eventTitle?: string | null;
};

export function buildDiffuseurContactMessage(eventTitle?: string | null): string {
  const title = eventTitle?.trim();
  if (title) {
    return (
      `Bonjour,\n\n` +
      `Je vous contacte depuis l’application Moments Locaux au sujet de « ${title} ». ` +
      `Je souhaite parler de la publication de mes événements (Moments Diffuseur).`
    );
  }
  return (
    `Bonjour,\n\n` +
    `Je vous contacte depuis l’application Moments Locaux. ` +
    `Je souhaite parler de la publication de mes événements (Moments Diffuseur).`
  );
}

export function buildDiffuseurContactUrl(prefill?: DiffuseurContactPrefill): string {
  const params = new URLSearchParams();
  params.set('intent', 'diffuseur');
  const name = prefill?.name?.trim();
  if (name) params.set('name', name.slice(0, 120));
  const email = prefill?.email?.trim();
  if (email && EMAIL_PATTERN.test(email)) params.set('email', email.slice(0, 254));
  params.set('message', buildDiffuseurContactMessage(prefill?.eventTitle).slice(0, 5000));
  return `${DIFFUSEUR_CONTACT_PATH}?${params.toString()}#contact-form`;
}

export async function openDiffuseurContact(prefill?: DiffuseurContactPrefill): Promise<void> {
  await Linking.openURL(buildDiffuseurContactUrl(prefill));
}

export async function openDiffuseurOffer(): Promise<void> {
  await Linking.openURL(DIFFUSEUR_OFFER_URL);
}

export type ContactFormPrefill = {
  intent: ContactIntent;
  name?: string | null;
  email?: string | null;
  message?: string | null;
};

export function buildContactFormUrl(prefill: ContactFormPrefill): string {
  const params = new URLSearchParams();
  params.set('intent', prefill.intent);
  const name = prefill.name?.trim();
  if (name) params.set('name', name.slice(0, 120));
  const email = prefill.email?.trim();
  if (email && EMAIL_PATTERN.test(email)) params.set('email', email.slice(0, 254));
  const message = prefill.message?.trim();
  if (message) params.set('message', message.slice(0, 5000));
  return `${DIFFUSEUR_CONTACT_PATH}?${params.toString()}#contact-form`;
}

export async function openContactForm(prefill: ContactFormPrefill): Promise<void> {
  await Linking.openURL(buildContactFormUrl(prefill));
}
