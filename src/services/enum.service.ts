import { supabase } from '@/lib/supabase/client';
import { FALLBACK_TYPOLOGY, setEventTypology, type TypologyItem } from '@/constants/eventTypology';
import type { EventCategory } from '@/types/database';

type RawEnumValue = {
  id: string;
  slug: string;
  icon: string | null;
  color: string | null;
  position: number | null;
  enum_value_translations: { locale: string; label: string }[];
};

export const EnumService = {
  async fetchEventTypology(locale: 'fr' | 'en' = 'fr'): Promise<TypologyItem[]> {
    try {
      const { data: enumType, error: typeError } = await supabase
        .from('enum_types')
        .select('id')
        .eq('key', 'event_typology')
        .maybeSingle();
      if (typeError || !enumType?.id) {
        setEventTypology(FALLBACK_TYPOLOGY);
        return FALLBACK_TYPOLOGY;
      }

      const { data, error } = await supabase
        .from('enum_values')
        .select('id, slug, icon, color, position, enum_value_translations(label, locale)')
        .eq('enum_type_id', enumType.id)
        .order('position', { ascending: true });

      if (error) throw error;

      const mapped: TypologyItem[] =
        (data as RawEnumValue[] | null)?.map((row) => ({
          value: row.slug as EventCategory,
          icon: row.icon || 'circle',
          color: row.color || '#cccccc',
          position: row.position ?? 0,
          translations: {
            fr: row.enum_value_translations.find((t) => t.locale === 'fr')?.label || row.slug,
            en:
              row.enum_value_translations.find((t) => t.locale === 'en')?.label ||
              row.enum_value_translations.find((t) => t.locale !== 'fr')?.label ||
              row.slug,
          },
        })) ?? [];

      if (mapped.length > 0) {
        setEventTypology(mapped);
        return mapped;
      }

      setEventTypology(FALLBACK_TYPOLOGY);
      return FALLBACK_TYPOLOGY;
    } catch (e) {
      console.warn('fetchEventTypology', e);
      setEventTypology(FALLBACK_TYPOLOGY);
      return FALLBACK_TYPOLOGY;
    }
  },
};
