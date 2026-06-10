import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Pressable,
  Image,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  Easing,
  Extrapolate,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { X, MapPin, Calendar, Tag, ChevronRight, Search } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { Motion, createEnterTiming, createExitTiming } from '@/constants/motion';
import { getCategoryColor, getCategoryTextColor } from '@/constants/categories';
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
import {
  hasSearchCriteria as checkSearchCriteria,
  PROXIMITY_RADIUS_KM,
  resolveEffectiveRadiusKm,
  resolveSearchCenter,
  SEARCH_FETCH_LIMIT,
} from '@/utils/search-helpers';
import type { EventWithCreator } from '@/types/database';
import { CommunityService } from '@/services/community.service';
import type { CommunityMember } from '@/types/community';

type SectionKey = 'where' | 'when' | 'what';
const BOTTOM_BAR_GUTTER = 120;

type ChipTone = {
  inactiveBackgroundColor?: string;
  inactiveTextColor?: string;
  inactiveBorderColor?: string;
  activeBackgroundColor?: string;
  activeTextColor?: string;
  activeBorderColor?: string;
};

interface Props {
  onApply: () => void;
  placeholder?: string;
  hasLocation: boolean;
  applied: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  enableCommunitySearch?: boolean;
}

export const SearchBar: React.FC<Props> = ({
  onApply,
  placeholder = 'Rechercher un événement',
  hasLocation,
  applied,
  onExpandedChange,
  enableCommunitySearch = false,
}) => {
  const router = useRouter();
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
  const [searchMode, setSearchMode] = useState<'events' | 'members'>('events');
  const [memberQuery, setMemberQuery] = useState('');
  const [memberCity, setMemberCity] = useState('');
  const [memberResults, setMemberResults] = useState<CommunityMember[]>([]);
  const [memberLoading, setMemberLoading] = useState(false);
  const barRef = useRef<View | null>(null);
  const whereInputRef = useRef<TextInput | null>(null);
  const memberInputRef = useRef<TextInput | null>(null);

  useTaxonomy();
  const categories = useTaxonomyStore((s) => s.categories);
  const subcategories = useTaxonomyStore((s) => s.subcategories);
  const tags = useTaxonomyStore((s) => s.tags);
  const { currentLocation } = useLocationStore();

  const {
    where,
    when,
    what,
    setWhere,
    setWhen,
    setWhat,
    sortBy,
    sortOrder,
    setSortBy,
    setSortOrder,
    addHistory,
    commitSearch,
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

  const searchSlice = useMemo(() => ({ where, when, what }), [where, when, what]);
  const hasSearchCriteria = useMemo(() => checkSearchCriteria(searchSlice), [searchSlice]);
  const effectiveRadiusKm = useMemo(
    () => resolveEffectiveRadiusKm(where, userCoords),
    [where, userCoords]
  );
  const searchCenter = useMemo(() => resolveSearchCenter(where, userCoords), [where, userCoords]);
  const displayedRadiusKm = where.radiusKm ?? effectiveRadiusKm ?? PROXIMITY_RADIUS_KM;

  const summaryText = useMemo(() => {
    if (!applied || !hasSearchCriteria) return undefined;
    return buildSearchSummary({ where, when, who: { adults: 1, children: 0, babies: 0 }, what, sortBy } as SearchState, categories, subcategories, tags);
  }, [applied, categories, hasSearchCriteria, sortBy, subcategories, tags, what, when, where]);

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
    const categoryLabel = what.categories.length
      ? categories.find((c) => c.id === what.categories[0])?.label
      : undefined;
    const subcategoryLabel = !categoryLabel && what.subcategories.length
      ? subcategories.find((s) => s.id === what.subcategories[0])?.label
      : undefined;
    const tagLabel = !categoryLabel && !subcategoryLabel && what.tags.length
      ? tags.find((t) => t.slug === what.tags[0])?.label || what.tags[0]
      : undefined;
    const extras: string[] = [];
    if (what.categories.length > 1) extras.push(`+${what.categories.length - 1} cat.`);
    if (what.subcategories.length) extras.push(`${what.subcategories.length} sous-cat.`);
    if (what.tags.length) extras.push(`${what.tags.length} tag${what.tags.length > 1 ? 's' : ''}`);
    const baseWhatLabel = categoryLabel || subcategoryLabel || tagLabel || 'Toutes catégories';
    const whatLabel = extras.length ? `${baseWhatLabel} · ${extras.join(', ')}` : baseWhatLabel;
    return { whereLabel, whenLabel, whatLabel };
  }, [categories, includePast, subcategories, tags, what, when, where]);

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
    if (searchMode !== 'events') {
      setSearchCount(null);
      setCountLoading(false);
      return;
    }
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
            limit: SEARCH_FETCH_LIMIT,
            includePast,
          });

          const ids =
            featureCollection?.features
              ?.map((f: any) => f?.properties?.id)
              .filter(Boolean) || [];
          const uniqueIds = Array.from(new Set(ids)) as string[];
          events = uniqueIds.length ? await EventsService.getEventsByIds(uniqueIds) : [];
        } else {
          events = await EventsService.listEvents({ limit: SEARCH_FETCH_LIMIT, includePast });
        }
        const filters = buildFiltersFromSearch({ where, when, who: { adults: 1, children: 0, babies: 0 }, what } as SearchState, userCoords);
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
  }, [effectiveRadiusKm, hasSearchCriteria, includePast, searchCenter, searchMode, userCoords, where, when, what]);

  useEffect(() => {
    let cancelled = false;
    if (searchMode !== 'members') {
      setMemberResults([]);
      setMemberLoading(false);
      return;
    }
    const hasQuery = !!memberQuery.trim() || !!memberCity.trim();
    if (!hasQuery) {
      setMemberResults([]);
      return;
    }
    setMemberLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await CommunityService.searchMembers({
          query: memberQuery.trim(),
          city: memberCity.trim(),
          limit: 12,
        });
        if (!cancelled) {
          setMemberResults(res);
        }
      } catch (err) {
        if (!cancelled) {
          setMemberResults([]);
        }
      } finally {
        if (!cancelled) {
          setMemberLoading(false);
        }
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [memberCity, memberQuery, searchMode]);

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
      progress.value = withTiming(1, createEnterTiming(Motion.duration.normal));
      contentProgress.value = withDelay(
        Motion.duration.micro,
        withTiming(1, createEnterTiming(Motion.duration.fast))
      );
      setTimeout(() => {
        if (searchMode === 'members') {
          memberInputRef.current?.focus();
        } else {
          whereInputRef.current?.focus();
        }
      }, 60);
    });
  };

  const closeExpanded = () => {
    progress.value = withTiming(0, createExitTiming(Motion.duration.fast));
    contentProgress.value = withTiming(0, { duration: Motion.duration.micro });
    setTimeout(() => {
      setOverlayVisible(false);
      onExpandedChange?.(false);
    }, Motion.duration.fast);
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

  const collapsedLabel =
    summaryText ||
    (enableCommunitySearch && searchMode === 'members' ? 'Rechercher un membre' : placeholder);

  return (
    <View style={styles.wrapper}>
      <Animated.View style={[styles.collapsedRow, barAnimatedStyle]} ref={barRef}>
        <Pressable style={styles.searchPill} onPress={openExpanded}>
          <Search size={18} color={colors.brand.textSecondary} />
          <Text style={styles.searchText} numberOfLines={1}>
            {collapsedLabel}
          </Text>
        </Pressable>
      </Animated.View>

      {overlayVisible && (
        <Animated.View pointerEvents="auto" style={styles.overlayRoot}>
          <Animated.View style={[styles.backdrop, overlayStyle, overlayBoundsStyle]} />
          <Pressable style={[styles.backdropPressable, overlayBoundsStyle]} onPress={closeExpanded} />
          <Animated.View style={[styles.expandedContainer, containerStyle]}>
            <View style={[styles.expandedHeader, { paddingTop: insets.top + spacing.md }]}>
              <View>
                <Text style={styles.expandedTitle}>
                  {searchMode === 'members' ? 'Rechercher un membre' : 'Rechercher un événement'}
                </Text>
                {enableCommunitySearch && (
                  <View style={styles.modeSwitch}>
                    <TouchableOpacity
                      style={[styles.modePill, searchMode === 'events' && styles.modePillActive]}
                      onPress={() => setSearchMode('events')}
                    >
                      <Text style={[styles.modeText, searchMode === 'events' && styles.modeTextActive]}>
                        Événements
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modePill, searchMode === 'members' && styles.modePillActive]}
                      onPress={() => setSearchMode('members')}
                    >
                      <Text style={[styles.modeText, searchMode === 'members' && styles.modeTextActive]}>
                        Membres
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={closeExpanded}>
                <X size={20} color={colors.brand.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.contentScroll}
              contentContainerStyle={[
                styles.content,
                { paddingBottom: insets.bottom + BOTTOM_BAR_GUTTER },
              ]}
            >
              {searchMode === 'members' ? (
                <View style={styles.memberPanel}>
                  <Text style={styles.memberLabel}>Nom</Text>
                  <TextInput
                    ref={memberInputRef}
                    placeholder="Rechercher un membre"
                    placeholderTextColor={colors.brand.textSecondary}
                    value={memberQuery}
                    onChangeText={setMemberQuery}
                    style={styles.input}
                  />
                  <Text style={styles.memberLabel}>Ville</Text>
                  <TextInput
                    placeholder="Ville"
                    placeholderTextColor={colors.brand.textSecondary}
                    value={memberCity}
                    onChangeText={setMemberCity}
                    style={styles.input}
                  />

                  {memberLoading ? <Text style={styles.meta}>Recherche...</Text> : null}
                  {!memberLoading && (memberQuery.trim() || memberCity.trim()) && memberResults.length === 0 ? (
                    <Text style={styles.meta}>Aucun membre trouvé</Text>
                  ) : null}

                  {memberResults.map((member) => (
                    <TouchableOpacity
                      key={member.user_id}
                      style={styles.memberResult}
                      onPress={() => {
                        closeExpanded();
                        router.push(`/community/${member.user_id}` as any);
                      }}
                    >
                      {member.avatar_url ? (
                        <Image source={{ uri: member.avatar_url }} style={styles.memberAvatar} />
                      ) : (
                        <View style={styles.memberAvatarPlaceholder} />
                      )}
                      <View style={styles.memberMeta}>
                        <Text style={styles.memberName}>{member.display_name}</Text>
                        <Text style={styles.memberCity}>{member.city || 'Ville inconnue'}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <>
                  <Animated.View style={sectionStyle0}>
                    <SectionCard
                      title="Où"
                      summary={sectionSummary.whereLabel}
                      active={activeSection === 'where'}
                      icon={<MapPin size={18} color={colors.brand.textSecondary} />}
                      onPress={() => setActiveSection('where')}
                    >
                      <TextInput
                        ref={whereInputRef}
                        placeholder="Ville, adresse ou lieu"
                        placeholderTextColor={colors.brand.textSecondary}
                        value={query}
                        onChangeText={setQuery}
                        style={styles.input}
                      />
                      <View style={styles.row}>
                        <Chip
                          label="À proximité"
                          active={where.radiusKm !== undefined && !where.location}
                          onPress={() => {
                            if (!hasLocation) return;
                            const isActive = where.radiusKm !== undefined && !where.location;
                            setWhere({
                              location: undefined,
                              radiusKm: isActive ? undefined : PROXIMITY_RADIUS_KM,
                            });
                          }}
                        />
                        {where.location?.label && (
                          <Chip
                            label={`${where.location.label} ✕`}
                            active
                            onPress={() => setWhere({ location: undefined })}
                          />
                        )}
                      </View>
                      {!hasLocation ? (
                        <Text style={styles.meta}>Activez la localisation pour rechercher à proximité.</Text>
                      ) : null}
                      {(where.location || where.radiusKm !== undefined) && (
                        <View style={styles.sliderRow}>
                          <Text style={styles.meta}>Dans un rayon de {displayedRadiusKm} km</Text>
                          <View style={styles.counterControls}>
                            <TouchableOpacity
                              style={styles.counterBtn}
                              onPress={() =>
                                setWhere({
                                  radiusKm: Math.max(5, (where.radiusKm ?? displayedRadiusKm) - 5),
                                })
                              }
                            >
                              <Text style={styles.counterBtnText}>-</Text>
                            </TouchableOpacity>
                            <Text style={styles.counterValue}>{displayedRadiusKm}</Text>
                            <TouchableOpacity
                              style={styles.counterBtn}
                              onPress={() =>
                                setWhere({
                                  radiusKm: Math.min(50, (where.radiusKm ?? displayedRadiusKm) + 5),
                                })
                              }
                            >
                              <Text style={styles.counterBtnText}>+</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                      {loading && <Text style={styles.meta}>Recherche...</Text>}
                      {!loading && query.trim() && results.length === 0 ? (
                        <Text style={styles.meta}>Aucun lieu trouvé — vérifiez l&apos;orthographe.</Text>
                      ) : null}
                      {results.map((item) => (
                        <TouchableOpacity
                          key={`${item.latitude}-${item.longitude}-${item.label}`}
                          style={styles.result}
                          onPress={() => handleSelectLocation(item)}
                        >
                          <MapPin size={16} color={colors.brand.secondary} />
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
                              onPress={() => {
                                setWhere({ location: undefined });
                                setQuery(h);
                              }}
                            >
                              <Text style={styles.resultText}>{h}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </SectionCard>
                  </Animated.View>

                  <Animated.View style={sectionStyle1}>
                    <SectionCard
                      title="Quand"
                      summary={sectionSummary.whenLabel}
                      active={activeSection === 'when'}
                      icon={<Calendar size={18} color={colors.brand.textSecondary} />}
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
                      title="Quoi"
                      summary={sectionSummary.whatLabel}
                      active={activeSection === 'what'}
                      icon={<Tag size={18} color={colors.brand.textSecondary} />}
                      onPress={() => setActiveSection('what')}
                    >
                      <Text style={styles.sectionLabel}>Nom de l&apos;événement</Text>
                      <TextInput
                        placeholder="Ex: marché, concert, expo"
                        placeholderTextColor={colors.brand.textSecondary}
                        value={what.query || ''}
                        onChangeText={(value) => setWhat({ query: value })}
                        style={styles.input}
                      />
                      <Text style={styles.sectionLabel}>Catégories</Text>
                      <View style={styles.rowWrap}>
                        {categories.map((cat) => {
                          const categoryColor = getCategoryColor(cat.id);
                          const categoryTextColor = getCategoryTextColor(cat.id);
                          return (
                            <Chip
                              key={cat.id}
                              label={cat.label}
                              active={what.categories.includes(cat.id)}
                              tone={{
                                inactiveBackgroundColor: withAlpha(categoryColor, '1A'),
                                inactiveBorderColor: withAlpha(categoryColor, '33'),
                                inactiveTextColor: categoryColor,
                                activeBackgroundColor: categoryColor,
                                activeBorderColor: categoryColor,
                                activeTextColor: categoryTextColor,
                              }}
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
                          );
                        })}
                      </View>
                      {what.categories.length > 0 && (
                        <>
                          <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>Sous-catégories</Text>
                          <View style={styles.rowWrap}>
                            {subcategories
                              .filter((sub) => what.categories.includes(sub.category_id))
                              .map((sub) => {
                                const categoryColor = getCategoryColor(sub.category_id);
                                const categoryTextColor = getCategoryTextColor(sub.category_id);
                                return (
                                  <Chip
                                    key={sub.id}
                                    label={sub.label}
                                    active={what.subcategories.includes(sub.id)}
                                    tone={{
                                      inactiveBackgroundColor: withAlpha(categoryColor, '1A'),
                                      inactiveBorderColor: withAlpha(categoryColor, '33'),
                                      inactiveTextColor: categoryColor,
                                      activeBackgroundColor: categoryColor,
                                      activeBorderColor: categoryColor,
                                      activeTextColor: categoryTextColor,
                                    }}
                                    onPress={() => {
                                      const exists = what.subcategories.includes(sub.id);
                                      const next = exists
                                        ? what.subcategories.filter((s) => s !== sub.id)
                                        : [...what.subcategories, sub.id];
                                      setWhat({ subcategories: next });
                                    }}
                                  />
                                );
                              })}
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
                              const next = exists
                                ? what.tags.filter((t) => t !== tag.slug)
                                : [...what.tags, tag.slug];
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
                        <Chip label="Date début" active={sortBy === 'date'} onPress={() => { setSortBy('date'); if (!sortOrder) setSortOrder('asc'); }} />
                        <Chip label="Date fin" active={sortBy === 'endDate'} onPress={() => { setSortBy('endDate'); if (!sortOrder) setSortOrder('asc'); }} />
                        <Chip label="Date création" active={sortBy === 'created'} onPress={() => { setSortBy('created'); if (!sortOrder) setSortOrder('desc'); }} />
                        <Chip
                          label="Distance"
                          active={sortBy === 'distance'}
                          onPress={() => {
                            if (!hasLocation) return;
                            setSortBy('distance');
                          }}
                        />
                        <Chip label="Popularité" active={sortBy === 'popularity'} onPress={() => setSortBy('popularity')} />
                      </View>
                      {!hasLocation && sortBy === 'distance' ? (
                        <Text style={styles.meta}>Le tri par distance nécessite la localisation.</Text>
                      ) : null}
                      {(sortBy === 'date' || sortBy === 'endDate' || sortBy === 'created') && (
                        <>
                          <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>Ordre</Text>
                          <View style={styles.rowWrap}>
                            <Chip label="Ascendant" active={sortOrder === 'asc'} onPress={() => setSortOrder('asc')} />
                            <Chip label="Descendant" active={sortOrder === 'desc'} onPress={() => setSortOrder('desc')} />
                          </View>
                        </>
                      )}
                    </SectionCard>
                  </Animated.View>
                </>
              )}
            </ScrollView>

            {searchMode === 'events' ? (
              <View style={{ marginBottom: insets.bottom + BOTTOM_BAR_GUTTER }}>
                {searchCount === 0 && !countLoading && hasSearchCriteria ? (
                  <Text style={styles.zeroHint}>
                    Aucun résultat — élargissez le rayon, incluez les passés ou retirez des filtres.
                  </Text>
                ) : null}
                <View style={styles.footer}>
                  <TouchableOpacity onPress={() => useSearchStore.getState().resetSearch()}>
                    <Text style={styles.resetText}>Tout effacer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={() => {
                      commitSearch();
                      onApply();
                      closeExpanded();
                    }}
                  >
                    <Text style={styles.primaryText}>{countLabel}</Text>
                    <ChevronRight size={16} color={colors.brand.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={[styles.footer, { marginBottom: insets.bottom + BOTTOM_BAR_GUTTER }]}>
                <TouchableOpacity
                  onPress={() => {
                    setMemberQuery('');
                    setMemberCity('');
                    setMemberResults([]);
                  }}
                >
                  <Text style={styles.resetText}>Tout effacer</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryBtn} onPress={closeExpanded}>
                  <Text style={styles.primaryText}>Fermer</Text>
                  <ChevronRight size={16} color={colors.brand.primary} />
                </TouchableOpacity>
              </View>
            )}
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

const Chip = ({
  label,
  active,
  onPress,
  tone,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  tone?: ChipTone;
}) => {
  const isActive = !!active;
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        active && styles.chipActive,
        tone?.inactiveBackgroundColor ? { backgroundColor: tone.inactiveBackgroundColor } : null,
        tone?.inactiveBorderColor ? { borderColor: tone.inactiveBorderColor, borderWidth: 1 } : null,
        isActive && tone?.activeBackgroundColor ? { backgroundColor: tone.activeBackgroundColor } : null,
        isActive && tone?.activeBorderColor ? { borderColor: tone.activeBorderColor, borderWidth: 1 } : null,
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.chipText,
          active && styles.chipTextActive,
          tone?.inactiveTextColor ? { color: tone.inactiveTextColor } : null,
          isActive && tone?.activeTextColor ? { color: tone.activeTextColor } : null,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

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

const withAlpha = (hexColor: string, alphaHex: string) => `${hexColor}${alphaHex}`;

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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: colors.brand.surface,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  searchText: {
    marginLeft: spacing.sm,
    color: colors.brand.textSecondary,
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
    backgroundColor: colors.brand.primary,
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
    color: colors.brand.text,
  },
  closeBtn: {
    width: 32,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modeSwitch: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  modePill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modePillActive: {
    backgroundColor: colors.brand.secondary,
    borderColor: colors.brand.secondary,
  },
  modeText: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontWeight: '600',
  },
  modeTextActive: {
    color: colors.brand.primary,
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
    backgroundColor: colors.brand.surface,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardActive: {
    backgroundColor: colors.brand.surface,
    borderWidth: 1,
    borderColor: 'rgba(43,191,227,0.42)',
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
    color: colors.brand.text,
  },
  cardSummary: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
  cardContent: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    color: colors.brand.text,
    ...typography.body,
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  chipActive: {
    backgroundColor: colors.brand.secondary,
    borderWidth: 1,
    borderColor: colors.brand.secondary,
  },
  chipText: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
  chipTextActive: {
    color: colors.brand.primary,
    fontWeight: '700',
  },
  sliderRow: {
    width: '100%',
  },
  meta: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  resultText: {
    ...typography.body,
    color: colors.brand.text,
    flex: 1,
  },
  memberPanel: {
    gap: spacing.sm,
  },
  memberLabel: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
  memberResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.surface,
  },
  memberAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  memberMeta: {
    flex: 1,
  },
  memberName: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '600',
  },
  memberCity: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  counterLabel: {
    ...typography.body,
    color: colors.brand.text,
  },
  dateBoxFull: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.08)',
    gap: spacing.xs,
  },
  dateValue: {
    ...typography.body,
    color: colors.brand.text,
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
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  counterBtnText: {
    ...typography.body,
    color: colors.brand.text,
  },
  counterValue: {
    ...typography.body,
    color: colors.brand.text,
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
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: 'rgba(43,191,227,0.16)',
    borderColor: colors.brand.secondary,
  },
  checkboxMark: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: colors.brand.secondary,
  },
  checkboxLabel: {
    ...typography.bodySmall,
    color: colors.brand.text,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
  history: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  zeroHint: {
    ...typography.caption,
    color: colors.brand.secondary,
    marginBottom: spacing.sm,
    marginHorizontal: spacing.lg,
    textAlign: 'center',
    backgroundColor: colors.brand.primary,
    paddingTop: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: colors.brand.primary,
  },
  resetText: {
    ...typography.body,
    color: colors.brand.secondary,
    textDecorationLine: 'underline',
  },
  primaryBtn: {
    backgroundColor: colors.brand.secondary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  primaryText: {
    ...typography.bodyBold,
    color: colors.brand.primary,
  },
});
