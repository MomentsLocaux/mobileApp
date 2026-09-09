import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type AiNoticeKind = 'poster' | 'lumia';

const TITLES: Record<AiNoticeKind, string> = {
  poster: 'Analyse par IA',
  lumia: 'Assistant Lumia',
};

const MESSAGES: Record<AiNoticeKind, string> = {
  poster:
    'La photo d’affiche est envoyée à un sous-traitant d’IA (OpenAI) pour préremplir le formulaire. Elle peut contenir des visages, des lieux ou d’autres informations. Elle n’est pas utilisée pour entraîner un modèle, sous réserve du contrat en vigueur. Tu relis ensuite avant envoi à la modération.',
  lumia:
    'Tes messages (et un court historique sur l’appareil) sont transmis temporairement à un sous-traitant d’IA (OpenAI) pour répondre. Ils ne sont pas enregistrés sur nos serveurs. Détails : Paramètres → Confidentialité.',
};

const keyFor = (kind: AiNoticeKind, userId: string) =>
  `ml.legal.ai-notice.${kind}.${userId}`;

export function confirmAiProcessingNotice(
  kind: AiNoticeKind,
  userId: string | null | undefined,
): Promise<boolean> {
  return new Promise((resolve) => {
    const finish = async (accepted: boolean) => {
      if (accepted && userId) {
        try {
          await AsyncStorage.setItem(keyFor(kind, userId), '1');
        } catch {
          // Local preference only.
        }
      }
      resolve(accepted);
    };

    void (async () => {
      if (userId) {
        try {
          const seen = await AsyncStorage.getItem(keyFor(kind, userId));
          if (seen === '1') {
            resolve(true);
            return;
          }
        } catch {
          // Show the alert if storage is unavailable.
        }
      }

      Alert.alert(TITLES[kind], MESSAGES[kind], [
        { text: 'Annuler', style: 'cancel', onPress: () => void finish(false) },
        { text: 'Continuer', onPress: () => void finish(true) },
      ]);
    })();
  });
}
