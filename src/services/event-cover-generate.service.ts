import { supabase } from '@/lib/supabase/client';

const EDGE_FUNCTION = 'generate-event-cover';

export type GenerateEventCoverSuccess = {
  ok: true;
  cover_url: string;
  storage_path: string;
};

export type GenerateEventCoverFailure = {
  ok: false;
  code?: string;
  message: string;
};

export type GenerateEventCoverInput = {
  title: string;
  description?: string | null;
  categoryLabel?: string | null;
  city?: string | null;
};

export async function generateEventCover(
  input: GenerateEventCoverInput,
): Promise<GenerateEventCoverSuccess | GenerateEventCoverFailure> {
  const { data, error } = await supabase.functions.invoke<GenerateEventCoverSuccess | GenerateEventCoverFailure>(
    EDGE_FUNCTION,
    {
      body: {
        title: input.title,
        description: input.description || '',
        category: input.categoryLabel || '',
        city: input.city || '',
      },
    },
  );

  if (error) {
    const response = (error as { context?: Response }).context;
    if (response) {
      try {
        const payload = (await response.json()) as GenerateEventCoverFailure;
        if (payload?.message) return payload;
      } catch {
        // ignore
      }
    }
    return {
      ok: false,
      code: 'service_error',
      message: 'Génération indisponible pour le moment. Ajoute une photo à la place.',
    };
  }

  if (data?.ok === true && data.cover_url) return data;
  const failure = data as GenerateEventCoverFailure | null;
  return {
    ok: false,
    code: failure?.code ?? 'service_error',
    message: failure?.message ?? 'Génération indisponible pour le moment. Ajoute une photo à la place.',
  };
}
