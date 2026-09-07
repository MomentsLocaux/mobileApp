import { supabase } from '@/lib/supabase/client';

export const DiffuseurLeadService = {
  async submit(params: { email?: string | null; city?: string | null; message: string }): Promise<void> {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('Authentification requise');
    const message = params.message.trim();
    if (message.length < 10) throw new Error('Précisez votre besoin en quelques mots.');

    const { error } = await supabase.from('diffuseur_interest_leads' as never).insert({
      user_id: userId,
      email: params.email?.trim() || null,
      city: params.city?.trim() || null,
      message,
    } as never);
    if (error) throw new Error(error.message || 'Envoi impossible');
  },
};
