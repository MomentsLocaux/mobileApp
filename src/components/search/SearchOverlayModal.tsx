import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Pressable,
  Animated,
} from 'react-native';
import { X, MapPin, Calendar, Users, Tag, ChevronRight } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography } from '../../constants/theme';
import { useSearchStore } from '../../store/searchStore';
import { MapboxService } from '../../services/mapbox.service';
import { useTaxonomy } from '@/hooks/useTaxonomy';
import { useTaxonomyStore } from '@/store/taxonomyStore';
import { DateRangePicker } from '@/components/DateRangePicker';
import type { DateRangeValue } from '@/types/eventDate.model';
import { useLocationStore } from '@/store';
import { EventsService } from '@/services/events.service';
import { buildFiltersFromSearch } from '@/utils/search-filters';
import { filterEvents } from '@/utils/filter-events';
import type { SearchState } from '../../store/searchStore';

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
  const anim = useRef(new Animated.Value(0)).current;
  useTaxonomy();
  const categories = useTaxonomyStore((s) => s.categories);
  const subcategories = useTaxonomyStore((s) => s.subcategories);
  const tags = useTaxonomyStore((s) => s.tags);
  const { currentLocation } = useLocationStore();
  const [searchCount, setSearchCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);

  const {
    where,
    when,
    who,
    what,
    setWhere,
    setWhen,
    setWho,
    setWhat,
    setSortBy,
    setSortOrder,
    sortBy,
    sortOrder,
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

  useEffect(() => {
    if (!visible) return;
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [anim, visible]);

  const handleSelectLocation = (item: typeof results[number]) => {
    setWhere({
      location: {
        latitude: item.latitude,
        longitude: item.longitude,
        label: item.label,
        city: item.city,
        postalCode: item.postalCode,
      },
      radiusKm: where.radiusKm ?? 10,
    });
    addHistory(item.label);
    setActiveSection('when');
  };

  const includePast = when.includePast ?? false;
  const userCoords = useMemo(() => {
    if (!currentLocation) return null;
    return {
      latitude: currentLocation.coords.latitude,
      longitude: currentLocation.coords.longitude,
    };
  }, [currentLocation]);

  const hasSearchCriteria = useMemo(() => {
    const hasWhere = !!where.location || !!where.radiusKm;
    const hasWhen = !!when.preset || !!when.startDate || !!when.endDate || includePast;
    const hasWhat = what.categories.length > 0 || what.subcategories.length > 0 || what.tags.length > 0;
    return hasWhere || hasWhen || hasWhat;
  }, [where.location, where.radiusKm, when.preset, when.startDate, when.endDate, includePast, what]);

  const effectiveRadiusKm = useMemo(() => {
    if (where.radiusKm !== undefined) {
      return where.radiusKm > 0 ? where.radiusKm : 10;
    }
    if (where.location) return 10;
    return undefined;
  }, [where.location, where.radiusKm]);

  const searchCenter = useMemo(() => {
    if (where.location) {
      return { latitude: where.location.latitude, longitude: where.location.longitude };
    }
    if (where.radiusKm && userCoords) {
      return userCoords;
    }
    return null;
  }, [where.location, where.radiusKm, userCoords]);

  const summary = useMemo(() => {
    const whereLabel = where.location?.label || 'Choisir un lieu';
    const whenLabel = includePast
      ? "N'importe quand"
      : when.startDate && when.endDate
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

  useEffect(() => {
    let cancelled = false;
    if (!hasSearchCriteria || !searchCenter || !effectiveRadiusKm) {
      setSearchCount(null);
      setCountLoading(false);
      return;
    }

    setCountLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const latDelta = effectiveRadiusKm / 111;
        const lonDelta =
          effectiveRadiusKm /
          (111 * Math.max(Math.cos((searchCenter.latitude * Math.PI) / 180), 0.1));
        const ne: [number, number] = [searchCenter.longitude + lonDelta, searchCenter.latitude + latDelta];
        const sw: [number, number] = [searchCenter.longitude - lonDelta, searchCenter.latitude - latDelta];

        const featureCollection = await EventsService.listEventsByBBox({
          ne,
          sw,
          limit: 300,
          includePast,
        });

        const ids =
          featureCollection?.features
            ?.map((f: any) => f?.properties?.id)
            .filter(Boolean) || [];
        const uniqueIds = Array.from(new Set(ids)) as string[];
        const events = uniqueIds.length ? await EventsService.getEventsByIds(uniqueIds) : [];
        const filters = buildFiltersFromSearch({ where, when, who, what } as SearchState, userCoords);
        const filteredEvents = filterEvents(events, filters, null);
        if (!cancelled) {
          setSearchCount(filteredEvents.length);
        }
      } catch (e) {
        if (!cancelled) {
          setSearchCount(0);
        }
      } finally {
        if (!cancelled) {
          setCountLoading(false);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [effectiveRadiusKm, hasSearchCriteria, includePast, searchCenter, userCoords, where, when, who, what]);

  const countLabel = countLoading
    ? 'Recherche...'
    : searchCount !== null
      ? `Voir les ${searchCount} évènement${searchCount > 1 ? 's' : ''}`
      : 'Rechercher';
  const footerLabel = countLabel;

  const backdropStyle = {
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
  };

  const cardStyle = {
    transform: [
      {
        translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }),
      },
      {
        scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }),
      },
    ],
  };

  return (
    <Modal visible={visible} animationType="none" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, backdropStyle]} />
        <Pressable style={styles.backdropPressable} onPress={onClose} />
        <Animated.View style={[styles.modal, cardStyle]}>
          <View style={styles.grabber} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Rechercher un évènement</Text>
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
                <Chip
                  label={`${where.location.label} ✕`}
                  active
                  onPress={() => setWhere({ location: undefined })}
                />
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
              <View style={styles.checkboxRow}>
                <TouchableOpacity
                  style={[styles.checkbox, includePast && styles.checkboxActive]}
                  onPress={() => {
                    if (includePast) {
                      setWhen({ includePast: false });
                      return;
                    }
                    setWhen({
                      includePast: true,
                      preset: undefined,
                      startDate: undefined,
                      endDate: undefined,
                    });
                  }}
                >
                  {includePast && <View style={styles.checkboxMark} />}
                </TouchableOpacity>
                <Text style={styles.checkboxLabel}>N&apos;importe quand</Text>
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
              <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>Tri</Text>
              <View style={styles.rowWrap}>
                <Chip
                  label="Pertinence"
                  active={sortBy === 'triage' || !sortBy}
                  onPress={() => setSortBy('triage')}
                />
                <Chip
                  label="Date"
                  active={sortBy === 'date'}
                  onPress={() => {
                    setSortBy('date');
                    if (!sortOrder) setSortOrder('asc');
                  }}
                />
                <Chip
                  label="Création"
                  active={sortBy === 'created'}
                  onPress={() => {
                    setSortBy('created');
                    if (!sortOrder) setSortOrder('desc');
                  }}
                />
                <Chip
                  label="Distance"
                  active={sortBy === 'distance'}
                  onPress={() => setSortBy('distance')}
                />
                <Chip
                  label="Popularité"
                  active={sortBy === 'popularity'}
                  onPress={() => setSortBy('popularity')}
                />
              </View>
              {(sortBy === 'date' || sortBy === 'created') && (
                <>
                  <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>Ordre</Text>
                  <View style={styles.rowWrap}>
                    <Chip
                      label="Ascendant"
                      active={sortOrder === 'asc'}
                      onPress={() => setSortOrder('asc')}
                    />
                    <Chip
                      label="Descendant"
                      active={sortOrder === 'desc'}
                      onPress={() => setSortOrder('desc')}
                    />
                  </View>
                </>
              )}
            </SectionCard>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity onPress={() => useSearchStore.getState().resetSearch()}>
              <Text style={styles.resetText}>Tout effacer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => {
                onApply();
                onClose();
              }}
            >
              <Text style={styles.primaryText}>{footerLabel}</Text>
              <ChevronRight size={16} color={colors.neutral[0]} />
            </TouchableOpacity>
          </View>
        </Animated.View>
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
    justifyContent: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  backdropPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  modal: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.xl,
    maxHeight: '88%',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },
  grabber: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.neutral[200],
    alignSelf: 'center',
    marginTop: spacing.sm,
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
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.neutral[400],
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[600],
  },
  checkboxMark: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: colors.primary[600],
  },
  checkboxLabel: {
    ...typography.bodySmall,
    color: colors.neutral[700],
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
