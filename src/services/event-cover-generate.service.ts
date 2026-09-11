import { supabase } from '@/lib/supabase/client';
import { isCoverTone, type CoverTone } from '@/constants/cover-tone';

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
  subcategoryLabel?: string | null;
  city?: string | null;
  tags?: string[];
  tone?: CoverTone | null;
  referencePath?: string | null;
  draftId: string;
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
        subcategory: input.subcategoryLabel || '',
        city: input.city || '',
        tags: input.tags?.filter(Boolean) ?? [],
        tone: isCoverTone(input.tone) ? input.tone : 'sobre',
        reference_path: input.referencePath || '',
        draft_id: input.draftId,
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
