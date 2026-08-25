import { supabase } from '@/lib/supabase/client';
import type { PosterExtractFailure, PosterExtractResult, PosterExtractSuccess } from '@/types/poster-extract';
import { normalizePosterImageForVision } from '@/utils/normalize-poster-image';

const EDGE_FUNCTION = 'suggest-event-from-poster';
const POSTER_UPLOAD_BUCKET = 'event-media';

export type UploadPosterImageResult = {
  storagePath: string;
  publicUrl: string;
};

/** Upload poster image to Storage as JPEG (reused as event cover). */
export async function uploadPosterImage(
  userId: string,
  localUri: string,
  _mimeType?: string,
): Promise<UploadPosterImageResult> {
  // Always JPEG: OpenAI vision rejects HEIC and other non-listed formats.
  const normalized = await normalizePosterImageForVision(localUri);
  const response = await fetch(normalized.uri);
  const arrayBuffer = await response.arrayBuffer();
  const fileName = `poster-${Date.now()}.${normalized.ext}`;
  const filePath = `event-covers/${userId}/${fileName}`;

  const { error: uploadError } = await supabase.storage.from(POSTER_UPLOAD_BUCKET).upload(filePath, arrayBuffer, {
    contentType: normalized.mimeType,
    upsert: true,
  });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(POSTER_UPLOAD_BUCKET).getPublicUrl(filePath);
  return { storagePath: filePath, publicUrl: data.publicUrl };
}

async function parseEdgeError(error: unknown): Promise<PosterExtractFailure | null> {
  const response = (error as { context?: Response })?.context;
  if (!response) return null;
  try {
    const payload = (await response.json()) as PosterExtractFailure;
    if (payload?.message) return payload;
  } catch {
    // ignore
  }
  return null;
}

/** Call vision edge function with a public image URL. */
export async function extractEventFromPosterImage(imageUrl: string): Promise<PosterExtractResult> {
  const { data, error } = await supabase.functions.invoke<PosterExtractSuccess | PosterExtractFailure>(
    EDGE_FUNCTION,
    { body: { image_url: imageUrl } },
  );

  if (error) {
    const parsed = await parseEdgeError(error);
    if (parsed) return parsed;
    return {
      ok: false,
      code: 'service_error',
      message: 'Analyse indisponible pour le moment. Tu peux saisir l’événement manuellement.',
    };
  }

  if (!data) {
    return {
      ok: false,
      code: 'service_error',
      message: 'Analyse indisponible pour le moment. Tu peux saisir l’événement manuellement.',
    };
  }

  if (data.ok === true && data.detected_event) {
    return data;
  }

  const failure = data as PosterExtractFailure;
  return {
    ok: false,
    code: failure.code ?? 'service_error',
    message:
      failure.message ??
      'Analyse indisponible pour le moment. Tu peux saisir l’événement manuellement.',
    detected_event: failure.detected_event,
    warnings: failure.warnings,
    quota: failure.quota,
  };
}

/** Upload then analyze — primary mobile path (SCRUM-108). */
export async function uploadAndExtractEventFromPoster(
  userId: string,
  localUri: string,
  mimeType?: string,
): Promise<
  | { ok: true; upload: UploadPosterImageResult; extraction: PosterExtractSuccess }
  | { ok: false; upload?: UploadPosterImageResult; result: PosterExtractFailure }
> {
  let upload: UploadPosterImageResult;
  try {
    upload = await uploadPosterImage(userId, localUri, mimeType);
  } catch {
    return {
      ok: false,
      result: {
        ok: false,
        code: 'service_error',
        message: 'Impossible de téléverser l’image. Réessaie ou saisis manuellement.',
      },
    };
  }

  const extraction = await extractEventFromPosterImage(upload.publicUrl);
  if (extraction.ok) {
    return { ok: true, upload, extraction };
  }

  return { ok: false, upload, result: extraction };
}
