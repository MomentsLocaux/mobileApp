import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase/client';
import { isMissingSchemaError } from '@/utils/schema-missing';

export type AiNoticeKind = 'poster' | 'lumia';

/** Copy version stored with the server proof. Independent of LEGAL_POLICY_VERSION. */
export const AI_NOTICE_VERSION = '2026-09-23';

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

async function readLocalNotice(kind: AiNoticeKind, userId: string): Promise<boolean> {
  try {
    const seen = await AsyncStorage.getItem(keyFor(kind, userId));
    return seen === '1';
  } catch {
    return false;
  }
}

async function writeLocalNotice(kind: AiNoticeKind, userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(kind, userId), '1');
  } catch {
    // Local cache only.
  }
}

async function readServerNotice(kind: AiNoticeKind, userId: string): Promise<'yes' | 'no' | 'missing'> {
  const { data, error } = await supabase
    .from('ai_processing_notices')
    .select('kind')
    .eq('user_id', userId)
    .eq('kind', kind)
    .maybeSingle();
  if (error) {
    if (isMissingSchemaError(error)) return 'missing';
    console.warn('[legal] ai notice lookup skipped', error);
    return 'missing';
  }
  return data ? 'yes' : 'no';
}

async function writeServerNotice(kind: AiNoticeKind, userId: string): Promise<void> {
  const { error } = await supabase.from('ai_processing_notices').upsert(
    {
      user_id: userId,
      kind,
      accepted_at: new Date().toISOString(),
      notice_version: AI_NOTICE_VERSION,
    },
    { onConflict: 'user_id,kind' },
  );
  if (error && !isMissingSchemaError(error)) {
    console.warn('[legal] ai notice persist skipped', error);
  }
}

export function confirmAiProcessingNotice(
  kind: AiNoticeKind,
  userId: string | null | undefined,
): Promise<boolean> {
  return new Promise((resolve) => {
    const finish = async (accepted: boolean) => {
      if (accepted && userId) {
        await writeLocalNotice(kind, userId);
        await writeServerNotice(kind, userId);
      }
      resolve(accepted);
    };

    void (async () => {
      if (userId) {
        const server = await readServerNotice(kind, userId);
        if (server === 'yes') {
          await writeLocalNotice(kind, userId);
          resolve(true);
          return;
        }

        const local = await readLocalNotice(kind, userId);
        if (local) {
          if (server === 'no') await writeServerNotice(kind, userId);
          resolve(true);
          return;
        }
      }

      Alert.alert(TITLES[kind], MESSAGES[kind], [
        { text: 'Annuler', style: 'cancel', onPress: () => void finish(false) },
        { text: 'Continuer', onPress: () => void finish(true) },
      ]);
    })();
  });
}
