import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  Extrapolate,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { X, MapPin, Calendar, Users, Tag, ChevronRight, Search } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { useSearchStore } from '@/store/searchStore';
import { MapboxService } from '@/services/mapbox.service';
import { useTaxonomy } from '@/hooks/useTaxonomy';
import { useTaxonomyStore } from '@/store/taxonomyStore';
import { DateRangePicker } from '@/components/DateRangePicker';
import type { DateRangeValue } from '@/types/eventDate.model';
import { useLocationStore } from '@/store';
import { EventsService } from '@/services/events.service';
import { buildFiltersFromSearch } from '@/utils/search-filters';
import { filterEvents } from '@/utils/filter-events';
import type { SearchState } from '@/store/searchStore';
import { buildSearchSummary } from '@/utils/search-summary';
import type { EventWithCreator } from '@/types/database';

type SectionKey = 'where' | 'when' | 'who' | 'what';
const BOTTOM_BAR_GUTTER = 120;

interface Props {
  onApply: () => void;
  placeholder?: string;
  hasLocation: boolean;
  applied: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

export const SearchBar: React.FC<Props> = ({
  onApply,
  placeholder = 'Rechercher un événement',
  hasLocation,
  applied,
  onExpandedChange,
}) => {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [activeSection, setActiveSection] = useState<SectionKey>('where');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ label: string; latitude: number; longitude: number; city: string; postalCode: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [showRangePicker, setShowRangePicker] = useState(false);
  const [searchCount, setSearchCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const barRef = useRef<View | null>(null);
  const whereInputRef = useRef<TextInput | null>(null);

  useTaxonomy();
  const categories = useTaxonomyStore((s) => s.categories);
  const subcategories = useTaxonomyStore((s) => s.subcategories);
  const tags = useTaxonomyStore((s) => s.tags);
  const { currentLocation } = useLocationStore();

  const {
    where,
    when,
    who,
    what,
    setWhere,
    setWhen,
    setWho,
    setWhat,
    sortBy,
    addHistory,
  } = useSearchStore();

  const progress = useSharedValue(0);
  const contentProgress = useSharedValue(0);
  const fromX = useSharedValue(0);
  const fromY = useSharedValue(0);
  const fromW = useSharedValue(0);
  const fromH = useSharedValue(0);

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
      radiusKm: where.radiusKm ?? 10,
    });
    setQuery('');
    setResults([]);
    addHistory(item.label);
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
      return Math.max(0, where.radiusKm);
    }
    if (where.location) return 10;
    return undefined;
  }, [where.location, where.radiusKm]);

  const searchCenter = useMemo(() => {
    if (where.location) {
      return { latitude: where.location.latitude, longitude: where.location.longitude };
    }
    if (where.radiusKm !== undefined && userCoords) {
      return userCoords;
    }
    return null;
  }, [where.location, where.radiusKm, userCoords]);

  const summaryText = useMemo(() => {
    if (!applied || !hasSearchCriteria) return undefined;
    return buildSearchSummary({ where, when, who, what, sortBy } as SearchState, categories, subcategories, tags);
  }, [applied, categories, hasSearchCriteria, sortBy, subcategories, tags, what, when, where, who]);

  const sectionSummary = useMemo(() => {
    const whereLabel = where.location?.label || (where.radiusKm ? 'À proximité' : 'Choisir un lieu');
    const whenLabel = includePast
      ? "N'importe quand"
      : when.startDate && when.endDate
        ? `${formatDate(when.startDate)} - ${formatDate(when.endDate)}`
        : when.startDate
          ? formatDate(when.startDate)
          : when.preset
            ? presetLabel(when.preset)
            : 'Flexible';
    const whoLabel = `${who.adults} adulte${who.adults > 1 ? 's' : ''}${
      who.children ? ` · ${who.children} enfant${who.children > 1 ? 's' : ''}` : ''
    }${who.babies ? ` · ${who.babies} bébé${who.babies > 1 ? 's' : ''}` : ''}`;
    const categoryLabel = what.categories.length
      ? categories.find((c) => c.id === what.categories[0])?.label
      : undefined;
    const subcategoryLabel = !categoryLabel && what.subcategories.length
      ? subcategories.find((s) => s.id === what.subcategories[0])?.label
      : undefined;
    const tagLabel = !categoryLabel && !subcategoryLabel && what.tags.length
      ? tags.find((t) => t.slug === what.tags[0])?.label || what.tags[0]
      : undefined;
    const whatLabel = categoryLabel || subcategoryLabel || tagLabel || 'Toutes catégories';
    return { whereLabel, whenLabel, whoLabel, whatLabel };
  }, [categories, includePast, subcategories, tags, what, when, where, who]);

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
    if (!hasSearchCriteria) {
      setSearchCount(null);
      setCountLoading(false);
      return;
    }

    setCountLoading(true);
    const timeout = setTimeout(async () => {
      try {
        let events: EventWithCreator[] = [];
        if (searchCenter && effectiveRadiusKm !== undefined) {
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
          events = uniqueIds.length ? await EventsService.getEventsByIds(uniqueIds) : [];
        } else {
          events = await EventsService.listEvents({ limit: 300, includePast });
        }
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

  const openExpanded = () => {
    if (!barRef.current) return;
    (barRef.current as any).measureInWindow((x: number, y: number, width: number, height: number) => {
      fromX.value = x;
      fromY.value = y;
      fromW.value = width;
      fromH.value = height;
      setOverlayVisible(true);
      onExpandedChange?.(true);
      progress.value = 0;
      contentProgress.value = 0;
      progress.value = withTiming(1, {
        duration: 300,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
      });
      contentProgress.value = withDelay(
        120,
        withTiming(1, { duration: 200, easing: Easing.out(Easing.ease) })
      );
      setTimeout(() => {
        whereInputRef.current?.focus();
      }, 60);
    });
  };

  const closeExpanded = () => {
    progress.value = withTiming(0, {
      duration: 220,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });
    contentProgress.value = withTiming(0, { duration: 120 });
    setTimeout(() => {
      setOverlayVisible(false);
      onExpandedChange?.(false);
    }, 240);
  };

  const barAnimatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolate.CLAMP),
  }));

  const overlayBoundsStyle = useAnimatedStyle(() => ({
    left: -fromX.value,
    top: -fromY.value,
    width: screenWidth,
    height: screenHeight,
  }));

  const containerStyle = useAnimatedStyle(() => {
    const left = interpolate(progress.value, [0, 1], [0, -fromX.value], Extrapolate.CLAMP);
    const top = interpolate(progress.value, [0, 1], [0, -fromY.value], Extrapolate.CLAMP);
    const width = interpolate(progress.value, [0, 1], [fromW.value, screenWidth], Extrapolate.CLAMP);
    const height = interpolate(progress.value, [0, 1], [fromH.value, screenHeight], Extrapolate.CLAMP);
    const radius = interpolate(progress.value, [0, 1], [999, 6], Extrapolate.CLAMP);
    return {
      left,
      top,
      width,
      height,
      borderRadius: radius,
    };
  });

  const sectionStyle0 = useAnimatedStyle(() => {
    const start = 0.15;
    const opacity = interpolate(contentProgress.value, [start, 1], [0, 1], Extrapolate.CLAMP);
    const translateY = interpolate(contentProgress.value, [start, 1], [8, 0], Extrapolate.CLAMP);
    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  const sectionStyle1 = useAnimatedStyle(() => {
    const start = 0.23;
    const opacity = interpolate(contentProgress.value, [start, 1], [0, 1], Extrapolate.CLAMP);
    const translateY = interpolate(contentProgress.value, [start, 1], [8, 0], Extrapolate.CLAMP);
    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  const sectionStyle2 = useAnimatedStyle(() => {
    const start = 0.31;
    const opacity = interpolate(contentProgress.value, [start, 1], [0, 1], Extrapolate.CLAMP);
    const translateY = interpolate(contentProgress.value, [start, 1], [8, 0], Extrapolate.CLAMP);
    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  const sectionStyle3 = useAnimatedStyle(() => {
    const start = 0.39;
    const opacity = interpolate(contentProgress.value, [start, 1], [0, 1], Extrapolate.CLAMP);
    const translateY = interpolate(contentProgress.value, [start, 1], [8, 0], Extrapolate.CLAMP);
    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  return (
    <View style={styles.wrapper}>
      <Animated.View style={[styles.collapsedRow, barAnimatedStyle]} ref={barRef}>
        <Pressable style={styles.searchPill} onPress={openExpanded}>
          <Search size={18} color={colors.neutral[500]} />
          <Text style={styles.searchText} numberOfLines={1}>
            {summaryText || placeholder}
          </Text>
        </Pressable>
      </Animated.View>

      {overlayVisible && (
        <Animated.View pointerEvents="auto" style={styles.overlayRoot}>
          <Animated.View style={[styles.backdrop, overlayStyle, overlayBoundsStyle]} />
          <Pressable style={[styles.backdropPressable, overlayBoundsStyle]} onPress={closeExpanded} />
          <Animated.View style={[styles.expandedContainer, containerStyle]}>
            <View style={[styles.expandedHeader, { paddingTop: insets.top + spacing.md }]}>
              <Text style={styles.expandedTitle}>Rechercher un événement</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={closeExpanded}>
                <X size={20} color={colors.neutral[700]} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.contentScroll}
              contentContainerStyle={[
                styles.content,
                { paddingBottom: insets.bottom + BOTTOM_BAR_GUTTER },
              ]}
            >
              <Animated.View style={sectionStyle0}>
                <SectionCard
                  title="Où"
                  summary={sectionSummary.whereLabel}
                  active={activeSection === 'where'}
                  icon={<MapPin size={18} color={colors.neutral[700]} />}
                  onPress={() => setActiveSection('where')}
                >
                  <TextInput
                    ref={whereInputRef}
                    placeholder="Ville, adresse ou lieu"
                    placeholderTextColor={colors.neutral[400]}
                    value={query}
                    onChangeText={setQuery}
                    style={styles.input}
                  />
                  <View style={styles.row}>
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
                    <TouchableOpacity
                      key={`${item.latitude}-${item.longitude}-${item.label}`}
                      style={styles.result}
                      onPress={() => handleSelectLocation(item)}
                    >
                      <MapPin size={16} color={colors.primary[600]} />
                      <Text style={styles.resultText}>{item.label}</Text>
                    </TouchableOpacity>
                  ))}
                </SectionCard>
              </Animated.View>

              <Animated.View style={sectionStyle1}>
                <SectionCard
                  title="Quand"
                  summary={sectionSummary.whenLabel}
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
              </Animated.View>

              <Animated.View style={sectionStyle2}>
                <SectionCard
                  title="Qui"
                  summary={sectionSummary.whoLabel}
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
                    onChange={(v) =>
                      setWho({
                        children: Math.max(0, v),
                        adults: Math.max(1, who.adults, v > 0 ? 1 : 0),
                      })
                    }
                  />
                  <CounterRow
                    label="Bébés"
                    subtitle="- de 2 ans"
                    value={who.babies}
                    onChange={(v) =>
                      setWho({
                        babies: Math.max(0, v),
                        adults: Math.max(1, who.adults, v > 0 ? 1 : 0),
                      })
                    }
                  />
                </SectionCard>
              </Animated.View>

              <Animated.View style={sectionStyle3}>
                <SectionCard
                  title="Catégorie"
                  summary={sectionSummary.whatLabel}
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
                </SectionCard>
              </Animated.View>
            </ScrollView>

            <View style={[styles.footer, { marginBottom: insets.bottom + BOTTOM_BAR_GUTTER }]}>
              <TouchableOpacity onPress={() => useSearchStore.getState().resetSearch()}>
                <Text style={styles.resetText}>Tout effacer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => {
                  onApply();
                  closeExpanded();
                }}
              >
                <Text style={styles.primaryText}>{countLabel}</Text>
                <ChevronRight size={16} color={colors.neutral[0]} />
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      )}
      <DateRangePicker
        open={showRangePicker}
        mode="range"
        value={rangeValue}
        onChange={handleRangeChange}
        onClose={() => setShowRangePicker(false)}
        context="search"
      />
    </View>
  );
};

const Chip = ({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) => (
  <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
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
  wrapper: {
    width: '100%',
    position: 'relative',
    overflow: 'visible',
  },
  collapsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    justifyContent: 'center',
  },
  searchPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[0],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.neutral[100],
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  searchText: {
    marginLeft: spacing.sm,
    color: colors.neutral[600],
    ...typography.body,
    flex: 1,
  },
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    overflow: 'visible',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  backdropPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  expandedContainer: {
    position: 'absolute',
    backgroundColor: colors.neutral[0],
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
    overflow: 'hidden',
  },
  expandedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  expandedTitle: {
    ...typography.subtitle,
    color: colors.neutral[800],
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  contentScroll: {
    flex: 1,
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
