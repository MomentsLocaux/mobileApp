import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { X, MapPin, Calendar, Users, Tag, ChevronRight } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography } from '../../constants/theme';
import { useSearchStore } from '../../store/searchStore';
import { MapboxService } from '../../services/mapbox.service';
import { useTaxonomy } from '@/hooks/useTaxonomy';
import { useTaxonomyStore } from '@/store/taxonomyStore';
import { DateRangePicker } from '@/components/DateRangePicker';
import type { DateRangeValue } from '@/types/eventDate.model';

type SectionKey = 'where' | 'when' | 'who' | 'what';

interface Props {
  visible: boolean;
  onClose: () => void;
  onApply: () => void;
}

export const SearchOverlayModal: React.FC<Props> = ({ visible, onClose, onApply }) => {
  const [activeSection, setActiveSection] = useState<SectionKey>('where');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ label: string; latitude: number; longitude: number; city: string; postalCode: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [showRangePicker, setShowRangePicker] = useState(false);
  useTaxonomy();
  const categories = useTaxonomyStore((s) => s.categories);
  const subcategories = useTaxonomyStore((s) => s.subcategories);
  const tags = useTaxonomyStore((s) => s.tags);

  const {
    where,
    when,
    who,
    what,
    setWhere,
    setWhen,
    setWho,
    setWhat,
    addHistory,
  } = useSearchStore();

  useEffect(() => {
    let cancelled = false;
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const timeout = setTimeout(async () => {
      const res = await MapboxService.search(query);
      if (!cancelled) {
        setResults(res);
        setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query]);

  const handleSelectLocation = (item: typeof results[number]) => {
    setWhere({
      location: {
        latitude: item.latitude,
        longitude: item.longitude,
        label: item.label,
        city: item.city,
        postalCode: item.postalCode,
      },
      radiusKm: undefined,
    });
    addHistory(item.label);
    setActiveSection('when');
  };

  const summary = useMemo(() => {
    const whereLabel = where.location?.label || 'Choisir un lieu';
    const whenLabel =
      when.startDate && when.endDate
        ? `${formatDate(when.startDate)} - ${formatDate(when.endDate)}`
        : when.preset
          ? presetLabel(when.preset)
          : 'Je suis flexible';
    const whoLabel = `${who.adults} adultes${who.children ? ` · ${who.children} enfants` : ''}${who.babies ? ` · ${who.babies} bébés` : ''}`;
    const categoryCount = (what.categories?.length || 0) + (what.subcategories?.length || 0);
    const tagCount = what.tags.length;
    const whatLabel =
      categoryCount > 0 || tagCount > 0
        ? `${categoryCount} catégories, ${tagCount} tags`
        : 'Type d’évènement';
    return { whereLabel, whenLabel, whoLabel, whatLabel };
  }, [where, when, who, what]);

  const rangeValue: DateRangeValue = {
    startDate: when.startDate || null,
    endDate: when.endDate || null,
  };

  const handleRangeChange = (range: DateRangeValue) => {
    setWhen({
      startDate: range.startDate || undefined,
      endDate: range.endDate || undefined,
      preset: undefined,
    });
  };

  const isLastSection = activeSection === 'what';
  const isFirstSection = activeSection === 'where';

  const footerLabel = isFirstSection ? 'Rechercher' : isLastSection ? 'Rechercher' : 'Suivant';

  const goNext = () => {
    if (activeSection === 'where') {
      onApply();
      onClose();
      return;
    }
    if (activeSection === 'when') {
      setActiveSection('who');
    } else if (activeSection === 'who') {
      setActiveSection('what');
    } else {
      onApply();
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Rechercher un moment</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={22} color={colors.neutral[700]} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <SectionCard
              title="Où"
              summary={summary.whereLabel}
              active={activeSection === 'where'}
              icon={<MapPin size={18} color={colors.neutral[700]} />}
              onPress={() => setActiveSection('where')}
            >
              <TextInput
                placeholder="Ville, adresse ou lieu"
                placeholderTextColor={colors.neutral[400]}
                value={query}
                onChangeText={setQuery}
                style={styles.input}
              />
              <View style={styles.row}>
                <Chip
                  label="À proximité"
                  active={!!where.radiusKm}
                  onPress={() =>
                    setWhere({
                      radiusKm: where.radiusKm ? undefined : 40,
                    })
                  }
                />
                {where.location?.label && (
                  <Chip label={where.location.label} active />
                )}
              </View>
              <View style={styles.sliderRow}>
                <Text style={styles.meta}>Dans un rayon de {where.radiusKm ?? 0} km</Text>
                <View style={styles.counterControls}>
                  <TouchableOpacity
                    style={styles.counterBtn}
                    onPress={() =>
                      setWhere({
                        radiusKm: Math.max(0, (where.radiusKm ?? 0) - 5),
                      })
                    }
                  >
                    <Text style={styles.counterBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.counterValue}>{where.radiusKm ?? 0}</Text>
                  <TouchableOpacity
                    style={styles.counterBtn}
                    onPress={() =>
                      setWhere({
                        radiusKm: Math.min(50, (where.radiusKm ?? 0) + 5),
                      })
                    }
                  >
                    <Text style={styles.counterBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {loading && <Text style={styles.meta}>Recherche...</Text>}
              {results.map((item) => (
                <TouchableOpacity key={`${item.latitude}-${item.longitude}-${item.label}`} style={styles.result} onPress={() => handleSelectLocation(item)}>
                  <MapPin size={16} color={colors.primary[600]} />
                  <Text style={styles.resultText}>{item.label}</Text>
                </TouchableOpacity>
              ))}
              {where.history.length > 0 && (
                <View style={styles.history}>
                  <Text style={styles.meta}>Recherches récentes</Text>
                  {where.history.map((h) => (
                    <TouchableOpacity
                      key={h}
                      style={styles.result}
                      onPress={() =>
                        setWhere({
                          location: undefined,
                          radiusKm: undefined,
                        }) || setQuery(h)
                      }
                    >
                      <Text style={styles.resultText}>{h}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </SectionCard>

            <SectionCard
              title="Quand"
              summary={summary.whenLabel}
              active={activeSection === 'when'}
              icon={<Calendar size={18} color={colors.neutral[700]} />}
              onPress={() => setActiveSection('when')}
            >
              <View style={styles.row}>
                {(['today', 'tomorrow', 'weekend'] as const).map((preset) => (
                  <Chip
                    key={preset}
                    label={presetLabel(preset)}
                    active={when.preset === preset}
                    onPress={() => {
                      const nextPreset = when.preset === preset ? undefined : preset;
                      setWhen({
                        preset: nextPreset,
                        startDate: undefined,
                        endDate: undefined,
                      });
                    }}
                  />
                ))}
              </View>
              <TouchableOpacity style={styles.dateBoxFull} onPress={() => setShowRangePicker(true)}>
                <Text style={styles.meta}>Date(s)</Text>
                <Text style={styles.dateValue}>
                  {when.startDate
                    ? when.endDate
                      ? `${formatDate(when.startDate)} - ${formatDate(when.endDate)}`
                      : formatDate(when.startDate)
                    : 'Choisir'}
                </Text>
              </TouchableOpacity>
            </SectionCard>
            <DateRangePicker
              open={showRangePicker}
              mode="range"
              value={rangeValue}
              onChange={handleRangeChange}
              onClose={() => setShowRangePicker(false)}
              context="search"
            />

            <SectionCard
              title="Qui"
              summary={summary.whoLabel}
              active={activeSection === 'who'}
              icon={<Users size={18} color={colors.neutral[700]} />}
              onPress={() => setActiveSection('who')}
            >
              <CounterRow
                label="Adultes"
                subtitle="13 ans et plus"
                value={who.adults}
                onChange={(v) => setWho({ adults: Math.max(1, v) })}
              />
              <CounterRow
                label="Enfants"
                subtitle="2 à 12 ans"
                value={who.children}
                onChange={(v) => setWho({ children: Math.max(0, v), adults: Math.max(1, who.adults, v > 0 ? 1 : 0) })}
              />
              <CounterRow
                label="Bébés"
                subtitle="- de 2 ans"
                value={who.babies}
                onChange={(v) => setWho({ babies: Math.max(0, v), adults: Math.max(1, who.adults, v > 0 ? 1 : 0) })}
              />
            </SectionCard>

            <SectionCard
              title="Quoi"
              summary={summary.whatLabel}
              active={activeSection === 'what'}
              icon={<Tag size={18} color={colors.neutral[700]} />}
              onPress={() => setActiveSection('what')}
            >
              <Text style={styles.sectionLabel}>Catégories</Text>
              <View style={styles.rowWrap}>
                {categories.map((cat) => (
                  <Chip
                    key={cat.id}
                    label={cat.label}
                    active={what.categories.includes(cat.id)}
                    onPress={() => {
                      const exists = what.categories.includes(cat.id);
                      const next = exists
                        ? what.categories.filter((c) => c !== cat.id)
                        : [...what.categories, cat.id];
                      const filteredSubs = (what.subcategories || []).filter((s) => {
                        const sub = subcategories.find((sc) => sc.id === s);
                        return sub ? next.includes(sub.category_id) : false;
                      });
                      setWhat({ categories: next, subcategories: filteredSubs });
                    }}
                  />
                ))}
              </View>
              {what.categories.length > 0 && (
                <>
                  <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>Sous-catégories</Text>
                  <View style={styles.rowWrap}>
                    {subcategories
                      .filter((sub) => what.categories.includes(sub.category_id))
                      .map((sub) => (
                        <Chip
                          key={sub.id}
                          label={sub.label}
                          active={what.subcategories.includes(sub.id)}
                          onPress={() => {
                            const exists = what.subcategories.includes(sub.id);
                            const next = exists
                              ? what.subcategories.filter((s) => s !== sub.id)
                              : [...what.subcategories, sub.id];
                            setWhat({ subcategories: next });
                          }}
                        />
                      ))}
                  </View>
                </>
              )}
              <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>Tags</Text>
              <View style={styles.rowWrap}>
                {tags.map((tag) => (
                  <Chip
                    key={tag.id}
                    label={tag.label}
                    active={what.tags.includes(tag.slug)}
                    onPress={() => {
                      const exists = what.tags.includes(tag.slug);
                      const next = exists ? what.tags.filter((t) => t !== tag.slug) : [...what.tags, tag.slug];
                      setWhat({ tags: next });
                    }}
                  />
                ))}
              </View>
            </SectionCard>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity onPress={() => useSearchStore.getState().resetSearch()}>
              <Text style={styles.resetText}>Tout effacer</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={goNext}>
              <Text style={styles.primaryText}>{footerLabel}</Text>
              <ChevronRight size={16} color={colors.neutral[0]} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const Chip = ({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) => (
  <TouchableOpacity
    style={[styles.chip, active && styles.chipActive]}
    onPress={onPress}
  >
    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
  </TouchableOpacity>
);

const CounterRow = ({
  label,
  subtitle,
  value,
  onChange,
}: {
  label: string;
  subtitle?: string;
  value: number;
  onChange: (v: number) => void;
}) => (
  <View style={styles.counterRow}>
    <View>
      <Text style={styles.counterLabel}>{label}</Text>
      {subtitle && <Text style={styles.meta}>{subtitle}</Text>}
    </View>
    <View style={styles.counterControls}>
      <TouchableOpacity style={styles.counterBtn} onPress={() => onChange(Math.max(0, value - 1))}>
        <Text style={styles.counterBtnText}>-</Text>
      </TouchableOpacity>
      <Text style={styles.counterValue}>{value}</Text>
      <TouchableOpacity style={styles.counterBtn} onPress={() => onChange(value + 1)}>
        <Text style={styles.counterBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  </View>
);

const SectionCard: React.FC<{
  title: string;
  summary?: string;
  active?: boolean;
  icon?: React.ReactNode;
  onPress: () => void;
  children: React.ReactNode;
}> = ({ title, summary, active, icon, onPress, children }) => (
  <View style={[styles.card, active && styles.cardActive]}>
    <TouchableOpacity style={styles.cardHeader} onPress={onPress}>
      <View style={styles.cardTitleRow}>
        {icon}
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      {!active && summary ? <Text style={styles.cardSummary}>{summary}</Text> : null}
    </TouchableOpacity>
    {active && <View style={styles.cardContent}>{children}</View>}
  </View>
);

const presetLabel = (preset: 'today' | 'tomorrow' | 'weekend') => {
  switch (preset) {
    case 'today':
      return "Aujourd'hui";
    case 'tomorrow':
      return 'Demain';
    case 'weekend':
      return 'Ce week-end';
    default:
      return 'Flexible';
  }
};

const formatDate = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  modalTitle: {
    ...typography.subtitle,
    color: colors.neutral[800],
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  card: {
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral[50],
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  cardActive: {
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardTitle: {
    ...typography.body,
    color: colors.neutral[800],
  },
  cardSummary: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  cardContent: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  input: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
  },
  chipActive: {
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[500],
  },
  chipText: {
    ...typography.caption,
    color: colors.neutral[700],
  },
  chipTextActive: {
    color: colors.primary[700],
  },
  sliderRow: {
    width: '100%',
  },
  meta: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  resultText: {
    ...typography.body,
    color: colors.neutral[800],
    flex: 1,
  },
  history: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  dateBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.md,
    padding: spacing.sm,
  },
  dateBoxFull: {
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    backgroundColor: colors.neutral[0],
    gap: spacing.xs,
  },
  dateValue: {
    ...typography.body,
    color: colors.neutral[800],
    fontWeight: '700',
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  counterLabel: {
    ...typography.body,
    color: colors.neutral[800],
  },
  counterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  counterBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBtnText: {
    ...typography.body,
    color: colors.neutral[700],
  },
  counterValue: {
    ...typography.body,
    minWidth: 20,
    textAlign: 'center',
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.neutral[600],
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderColor: colors.neutral[100],
    backgroundColor: colors.neutral[0],
  },
  resetText: {
    ...typography.body,
    color: colors.primary[600],
    textDecorationLine: 'underline',
  },
  primaryBtn: {
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  primaryText: {
    ...typography.bodyBold,
    color: colors.neutral[0],
  },
});
