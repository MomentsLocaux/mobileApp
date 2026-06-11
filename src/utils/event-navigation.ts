import { Alert } from 'react-native';
import type { Router } from 'expo-router';
import type { EventWithCreator } from '@/types/database';

export const EVENT_ITINERARY_LABEL = "J'y vais";

type RouterLike = Pick<Router, 'push'>;

export function openEventNavigationOptions(
  event: EventWithCreator,
  router: RouterLike,
  options: { onOpenExternalNavigation: () => void }
): void {
  Alert.alert(
    EVENT_ITINERARY_LABEL,
    'Choisissez comment ouvrir l’itinéraire.',
    [
      {
        text: 'Voir sur la map Moments Locaux',
        onPress: () => router.push(`/(tabs)/map?focus=${event.id}` as any),
      },
      {
        text: "Ouvrir dans l'application de navigation",
        onPress: options.onOpenExternalNavigation,
      },
      { text: 'Annuler', style: 'cancel' },
    ]
  );
}
