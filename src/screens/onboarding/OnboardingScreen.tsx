import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ChevronLeft,
  Building2,
  Compass,
  ImagePlus,
  Briefcase,
  MapPin,
  PlusCircle,
  SearchX,
  User,
  X,
} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { AppBackground, Button, MotionReveal } from '../../components/ui';
import { OnboardingTiersStep } from '@/components/onboarding/OnboardingTiersStep';
import { OnboardingEclaireurCtaStep } from '@/components/onboarding/OnboardingEclaireurCtaStep';
import { OnboardingThemesStep } from '@/components/onboarding/OnboardingThemesStep';
import { OnboardingWelcomeStep } from '@/components/onboarding/OnboardingWelcomeStep';
import {
  OnboardingCreateWhyStep,
  type CreateIntent,
} from '@/components/onboarding/OnboardingCreateWhyStep';
import {
  OnboardingConnectorStep,
  type ConnectorDraft,
} from '@/components/onboarding/OnboardingConnectorStep';
import { OnboardingModeHintStep } from '@/components/onboarding/OnboardingModeHintStep';
import { DiffuseurService } from '@/services/diffuseur.service';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import {
  ACCOUNT_KIND_OPTIONS,
  PRO_SUBTYPE_OPTIONS,
  type AccountKind,
  type ProSubtype,
} from '@/constants/accountIdentity';
import { roleForAccountKind } from '@/utils/accountIdentity';
import { useAuth } from '../../hooks';
import { ProfileService } from '@/services/profile.service';
import { PreferencesService } from '@/services/preferences.service';
import { useImagePicker } from '@/hooks/useImagePicker';
import { supabase } from '@/lib/supabase/client';
import { MapboxService, type GeocodeResult } from '@/services/mapbox.service';
import { setHomeLocationFromCoords } from '@/services/push.service';
import { PREMIUM_PLANS } from '@/services/subscription.service';
import type { CategoryVisualSlug } from '@/constants/category-visuals';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAutoScrollOnFocus } from '@/hooks/useAutoScrollOnFocus';
import { haptics } from '@/utils/haptics';
import { features } from '@/config/features';

type StepId =
  | 'welcome'
  | 'identity'
  | 'create_why'
  | 'create_themes'
  | 'location'
  | 'themes'
  | 'avatar'
  | 'creator'
  | 'connector'
  | 'tiers'
  | 'eclairer'
  | 'mode_hint';

const ACCOUNT_KIND_ICONS: Record<AccountKind, typeof User> = {
  particulier: User,
  professionnel: Briefcase,
};

const SEARCH_MIN_CHARS = 2;
const SEARCH_DEBOUNCE_MS = 300;

export default function OnboardingScreen() {
  const router = useRouter();
  const { replay } = useLocalSearchParams<{ replay?: string }>();
  const isReplay = replay === '1' || replay === 'true';
  const { profile, user, refreshProfile } = useAuth();
  const { pickImage } = useImagePicker();
  const insets = useSafeAreaInsets();
  const { scrollViewRef, registerFieldRef, handleInputFocus, handleScroll } = useAutoScrollOnFocus();

  const fallbackDisplayName = useMemo(
    () => profile?.display_name || profile?.email || user?.email || '',
    [profile?.display_name, profile?.email, user?.email],
  );

  const [stepIndex, setStepIndex] = useState(0);
  const [displayName, setDisplayName] = useState(fallbackDisplayName);
  const [bio, setBio] = useState(profile?.bio || '');
  const [accountKind, setAccountKind] = useState<AccountKind>(() => {
    if (
      features.diffuseur &&
      (profile?.role === 'professionnel' || profile?.role === 'institutionnel')
    ) {
      return 'professionnel';
    }
    return 'particulier';
  });
  const [proSubtype, setProSubtype] = useState<ProSubtype | null>(
    (profile?.pro_subtype as ProSubtype | null | undefined) ?? null,
  );
  /** B2C only: discover + create. Never créateur pur. Gated by FEATURE_EVENT_CREATE. */
  const [particulierAlsoCreates, setParticulierAlsoCreates] = useState(
    features.eventCreate &&
      Boolean(profile?.can_create) &&
      profile?.role === 'particulier',
  );
  const [addressSearch, setAddressSearch] = useState('');
  const [addressResults, setAddressResults] = useState<GeocodeResult[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<GeocodeResult | null>(null);
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [coverUrl, setCoverUrl] = useState(profile?.cover_url || '');
  const [themeSlugs, setThemeSlugs] = useState<string[]>([]);
  const [createThemeSlugs, setCreateThemeSlugs] = useState<string[]>([]);
  const [createIntent, setCreateIntent] = useState<CreateIntent | null>(null);
  const [connectorDraft, setConnectorDraft] = useState<ConnectorDraft>({ status: 'none' });
  const [facebook, setFacebook] = useState(profile?.facebook_url || '');
  const [instagram, setInstagram] = useState(profile?.instagram_url || '');
  const [tiktok, setTiktok] = useState(profile?.tiktok_url || '');

  const [isLoading, setIsLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<'avatar' | 'cover' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeq = useRef(0);
  const profilePersisted = useRef(false);

  const isProfessionnel = features.diffuseur && accountKind === 'professionnel';
  const canCreate =
    features.eventCreate &&
    (isProfessionnel || (accountKind === 'particulier' && particulierAlsoCreates));
  const isUploading = uploadTarget !== null;

  const visibleAccountKinds = useMemo(
    () =>
      features.diffuseur
        ? ACCOUNT_KIND_OPTIONS
        : ACCOUNT_KIND_OPTIONS.filter((o) => o.value === 'particulier'),
    [],
  );

  const steps: StepId[] = useMemo(() => {
    if (isProfessionnel) {
      return ['welcome', 'identity', 'location', 'avatar', 'creator', 'connector'];
    }
    const marketingTail: StepId[] = features.offers
      ? ['tiers', 'eclairer']
      : features.eventCreate
        ? []
        : [];
    if (particulierAlsoCreates && features.eventCreate) {
      return [
        'welcome',
        'identity',
        'create_why',
        'location',
        'themes',
        'create_themes',
        'avatar',
        'creator',
        ...(features.offers ? (['tiers', 'eclairer', 'mode_hint'] as StepId[]) : (['mode_hint'] as StepId[])),
      ];
    }
    return ['welcome', 'identity', 'location', 'themes', 'avatar', ...marketingTail];
  }, [isProfessionnel, particulierAlsoCreates]);

  const stepId = steps[Math.min(stepIndex, steps.length - 1)];
  const totalSteps = steps.length;
  const isLastStep = stepIndex >= totalSteps - 1;
  const lastProfileStepId: StepId = isProfessionnel
    ? 'connector'
    : particulierAlsoCreates
      ? 'creator'
      : 'avatar';
  const isMarketingStep =
    stepId === 'tiers' || stepId === 'eclairer' || stepId === 'mode_hint';
  const progressSteps = steps.filter(
    (id) =>
      id !== 'welcome' && id !== 'tiers' && id !== 'eclairer' && id !== 'mode_hint',
  );

  const identityReady =
    !!displayName.trim() &&
    (accountKind === 'particulier' || (accountKind === 'professionnel' && !!proSubtype));

  const canContinue =
    stepId === 'welcome' ||
    (stepId === 'identity' && identityReady) ||
    (stepId === 'create_why' && !!createIntent) ||
    stepId === 'create_themes' ||
    (stepId === 'location' && !!selectedAddress) ||
    stepId === 'themes' ||
    stepId === 'avatar' ||
    stepId === 'creator' ||
    stepId === 'connector' ||
    stepId === 'tiers' ||
    stepId === 'eclairer' ||
    stepId === 'mode_hint';

  const persistThemes = async () => {
    if (!user?.id) return;
    try {
      await PreferencesService.updateMine(user.id, {
        preferred_category_slugs: themeSlugs,
      });
    } catch (err) {
      console.warn('preferred_category_slugs not saved during onboarding', err);
    }
  };

  const toggleThemeSlug = (slug: CategoryVisualSlug) => {
    setThemeSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  };

  const toggleCreateThemeSlug = (slug: CategoryVisualSlug) => {
    setCreateThemeSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  };

  useEffect(() => {
    if (!profile && user) {
      refreshProfile();
    }
  }, [profile, refreshProfile, user]);

  useEffect(() => {
    if (!displayName.trim() && fallbackDisplayName.trim()) {
      setDisplayName(fallbackDisplayName);
    }
  }, [displayName, fallbackDisplayName]);

  useEffect(() => {
    if (stepIndex >= steps.length) {
      setStepIndex(steps.length - 1);
    }
  }, [stepIndex, steps.length]);

  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    [],
  );

  const handleSearchChange = useCallback((query: string) => {
    setError(null);
    setAddressSearch(query);
    setSelectedAddress(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);

    if (query.trim().length < SEARCH_MIN_CHARS) {
      setAddressResults([]);
      setLocationLoading(false);
      return;
    }

    setLocationLoading(true);
    searchTimer.current = setTimeout(async () => {
      const seq = ++searchSeq.current;
      try {
        const results = await MapboxService.search(query, {
          types: 'place,locality,neighborhood',
        });
        if (seq !== searchSeq.current) return;
        setAddressResults(results);
      } catch {
        if (seq === searchSeq.current) setError('Impossible de chercher ce lieu.');
      } finally {
        if (seq === searchSeq.current) setLocationLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  const handleSelectLocation = useCallback((item: GeocodeResult) => {
    haptics.selection();
    Keyboard.dismiss();
    setSelectedAddress(item);
    setAddressSearch(item.label);
    setAddressResults([]);
  }, []);

  const uploadImage = useCallback(
    async (target: 'avatar' | 'cover') => {
      if (!user?.id) {
        setError('Connexion requise pour téléverser une image.');
        return;
      }

      const asset = await pickImage({ allowsEditing: true });
      if (!asset?.uri) return;
      setError(null);
      setUploadTarget(target);
      try {
        const response = await fetch(asset.uri);
        const arrayBuffer = await response.arrayBuffer();
        const ext = asset.uri.split('.').pop() || 'jpg';
        const fileName = `${target}-${Date.now()}.${ext}`;
        const path =
          target === 'avatar'
            ? `avatars/${user.id}/${fileName}`
            : `profile-covers/${user.id}/${fileName}`;
        const bucket = process.env.EXPO_PUBLIC_SUPABASE_AVATAR_BUCKET || 'avatar';
        const contentType =
          response.headers.get('content-type') ||
          (ext.toLowerCase() === 'png' ? 'image/png' : 'image/jpeg');
        const { error: uploadError } = await supabase.storage.from(bucket).upload(path, arrayBuffer, {
          contentType,
          upsert: true,
        });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        if (target === 'avatar') setAvatarUrl(data.publicUrl);
        else setCoverUrl(data.publicUrl);
        haptics.light();
      } catch {
        setError("Échec de l'upload, réessayez.");
      } finally {
        setUploadTarget(null);
      }
    },
    [pickImage, user?.id],
  );

  const finishToHome = () => {
    haptics.success();
    router.replace('/(tabs)');
  };

  const persistProfile = async (): Promise<boolean> => {
    if (!user) return false;
    if (profilePersisted.current && profile?.onboarding_completed) return true;

    setError(null);
    setIsLoading(true);
    try {
      const activeProfile = profile || (await refreshProfile());
      if (!activeProfile) {
        setError('Profil indisponible, réessayez dans quelques secondes.');
        return false;
      }

      const resolvedCity =
        selectedAddress?.city ||
        selectedAddress?.label.split(',')[0] ||
        profile?.city ||
        '';
      const resolvedRegion = selectedAddress?.region || profile?.region || 'France';

      const basePayload = {
        display_name: displayName.trim(),
        bio: canCreate ? bio.trim() || null : null,
        role: roleForAccountKind(accountKind),
        city: resolvedCity,
        region: resolvedRegion,
        avatar_url: avatarUrl || null,
        cover_url: canCreate ? coverUrl || null : null,
        facebook_url: canCreate ? facebook.trim() || null : null,
        instagram_url: canCreate ? instagram.trim() || null : null,
        tiktok_url: canCreate ? tiktok.trim() || null : null,
        onboarding_completed: true,
      };

      const identityPayload: {
        can_create: boolean;
        active_mode: 'discover' | 'create';
        pro_subtype: ProSubtype | null;
        create_intent?: CreateIntent | null;
        creator_category_slugs?: string[];
      } = {
        can_create: canCreate,
        active_mode: isProfessionnel ? 'create' : 'discover',
        pro_subtype: isProfessionnel ? proSubtype : null,
      };

      if (!isProfessionnel && particulierAlsoCreates) {
        identityPayload.create_intent = createIntent;
        identityPayload.creator_category_slugs = createThemeSlugs;
      }

      try {
        await ProfileService.updateProfile(activeProfile.id, {
          ...basePayload,
          ...identityPayload,
        });
      } catch (identityErr) {
        // Migration columns may be absent — persist core fields.
        console.warn(
          'Identity columns unavailable; saving profile without can_create/pro_subtype',
          identityErr,
        );
        try {
          await ProfileService.updateProfile(activeProfile.id, {
            ...basePayload,
            can_create: canCreate,
            active_mode: isProfessionnel ? 'create' : 'discover',
            pro_subtype: isProfessionnel ? proSubtype : null,
          });
        } catch {
          await ProfileService.updateProfile(activeProfile.id, basePayload);
        }
      }

      if (isProfessionnel) {
        try {
          const org = await DiffuseurService.ensureMyOrganization({
            displayName: displayName.trim(),
            proSubtype,
          });
          if (org && connectorDraft.status !== 'none') {
            await DiffuseurService.updateConnector(org.id, connectorDraft);
          }
        } catch (orgErr) {
          console.warn('Diffuseur org/connector not saved during onboarding', orgErr);
        }
      }

      await refreshProfile();
      profilePersisted.current = true;
      return true;
    } catch (err) {
      console.error('Error completing onboarding:', err);
      setError(err instanceof Error ? err.message : 'Erreur de mise à jour du profil');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const goNext = async () => {
    setError(null);
    if (stepId === 'location') {
      if (!selectedAddress) return;
      setLocationLoading(true);
      try {
        const ok = await setHomeLocationFromCoords(
          selectedAddress.latitude,
          selectedAddress.longitude,
        );
        if (!ok) console.warn('home_location not saved during onboarding');
      } finally {
        setLocationLoading(false);
      }
    }

    if (stepId === 'themes') {
      await persistThemes();
      // Décision 5 : préremplir create_themes depuis thèmes découverte si vide
      if (particulierAlsoCreates && createThemeSlugs.length === 0 && themeSlugs.length > 0) {
        setCreateThemeSlugs([...themeSlugs]);
      }
    }

    if (stepId === lastProfileStepId) {
      const saved = await persistProfile();
      if (!saved) return;
      // MVP: avatar is often the last step (no offers/marketing tail).
      // Advancing stepIndex would clamp to the same page and look like Continuer is broken.
      if (isProfessionnel || isLastStep) {
        finishToHome();
        return;
      }
      haptics.light();
      setStepIndex((prev) => Math.min(prev + 1, totalSteps - 1));
      return;
    }

    if (stepId === 'eclairer' || stepId === 'mode_hint') {
      if (stepId === 'eclairer' && particulierAlsoCreates) {
        haptics.light();
        setStepIndex((prev) => Math.min(prev + 1, totalSteps - 1));
        return;
      }
      finishToHome();
      return;
    }

    if (isLastStep) {
      finishToHome();
      return;
    }

    haptics.light();
    setStepIndex((prev) => Math.min(prev + 1, totalSteps - 1));
  };

  const goBack = () => {
    if (stepIndex <= 0) return;
    haptics.selection();
    setStepIndex((prev) => Math.max(0, prev - 1));
  };

  const exitReplay = () => {
    haptics.selection();
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
  };

  /** Skip remaining profile extras and jump to marketing tiers (or finish pro). */
  const skipOptionalToTiers = async () => {
    haptics.selection();
    if (stepId === 'themes') {
      setThemeSlugs([]);
      try {
        if (user?.id) {
          await PreferencesService.updateMine(user.id, { preferred_category_slugs: [] });
        }
      } catch (err) {
        console.warn('preferred_category_slugs clear failed', err);
      }
      setStepIndex((prev) => Math.min(prev + 1, totalSteps - 1));
      return;
    }
    if (stepId === 'create_themes') {
      setStepIndex((prev) => Math.min(prev + 1, totalSteps - 1));
      return;
    }
    if (stepId === 'connector') {
      const saved = await persistProfile();
      if (!saved) return;
      finishToHome();
      return;
    }
    const saved = await persistProfile();
    if (!saved) return;
    if (isProfessionnel) {
      finishToHome();
      return;
    }
    const tiersIndex = steps.indexOf('tiers');
    setStepIndex(tiersIndex >= 0 ? tiersIndex : totalSteps - 1);
  };

  const continueFree = async () => {
    haptics.selection();
    if (!profilePersisted.current) {
      const saved = await persistProfile();
      if (!saved) return;
    }
    finishToHome();
  };

  const handleUnlockTease = (plan: 'monthly' | 'annual') => {
    haptics.light();
    Toast.show({
      type: 'info',
      text1: 'Achats in-app bientôt disponibles',
      text2: `Offre Éclaireur ${PREMIUM_PLANS[plan].label} — intégration store en cours.`,
    });
    finishToHome();
  };

  const primaryTitle =
    stepId === 'welcome'
      ? 'Continuer'
      : stepId === 'connector'
        ? connectorDraft.status === 'none'
          ? 'Continuer sans connecteur'
          : 'Terminer'
        : stepId === 'mode_hint'
          ? 'Entrer dans Moments Locaux'
          : stepId === 'tiers'
            ? 'Voir l’offre Éclaireur'
            : stepId === 'eclairer'
              ? 'Déverrouiller Éclaireur'
              : isLastStep
                ? 'C’est parti'
                : 'Continuer';

  const showSkip =
    stepId === 'themes' ||
    stepId === 'create_themes' ||
    stepId === 'avatar' ||
    stepId === 'creator' ||
    stepId === 'connector';
  const showContinueFree = isMarketingStep;
  const activeKindDescription = ACCOUNT_KIND_OPTIONS.find(
    (option) => option.value === accountKind,
  )?.description;
  const activeSubtypeDescription = PRO_SUBTYPE_OPTIONS.find(
    (option) => option.value === proSubtype,
  )?.description;
  const showNoResults =
    stepId === 'location' &&
    !locationLoading &&
    !selectedAddress &&
    addressSearch.trim().length >= SEARCH_MIN_CHARS &&
    addressResults.length === 0;

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.top}
    >
      <AppBackground />
      <ScrollView
        ref={scrollViewRef}
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md, paddingBottom: spacing.xl + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {isReplay ? (
          <View style={styles.replayTopBar}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={exitReplay}
              accessibilityRole="button"
              accessibilityLabel="Quitter l'onboarding"
              hitSlop={12}
            >
              <X size={20} color={colors.brand.text} />
              <Text style={styles.closeText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {stepId === 'welcome' ? (
          <MotionReveal style={styles.welcomeHeader}>
            <Text style={styles.welcomeTitle}>
              {isReplay ? 'Revoir Moments Locaux' : 'Bienvenue sur\nMoments Locaux'}
            </Text>
            <Text style={styles.welcomeSubtitle}>
              {isReplay
                ? 'Reprenez les étapes de configuration de votre profil'
                : features.diffuseur
                  ? 'Pour vous montrer ce qui se passe près de vous'
                  : 'Ici on ne vend pas de ticket, on crée du lien avec le monde qui nous entoure'}
            </Text>
          </MotionReveal>
        ) : isMarketingStep ? (
          <View style={styles.stepHeader}>
            <View style={styles.stepHeaderRow}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={goBack}
                accessibilityRole="button"
                accessibilityLabel="Revenir à l'étape précédente"
              >
                <ChevronLeft size={20} color={colors.brand.text} />
                <Text style={styles.backText}>Retour</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={continueFree}
                accessibilityRole="button"
                accessibilityLabel="Continuer gratuitement"
                hitSlop={12}
              >
                <X size={20} color={colors.brand.text} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.stepHeader}>
            <View style={styles.stepHeaderRow}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={goBack}
                accessibilityRole="button"
                accessibilityLabel="Revenir à l'étape précédente"
              >
                <ChevronLeft size={20} color={colors.brand.text} />
                <Text style={styles.backText}>Retour</Text>
              </TouchableOpacity>
              <Text style={styles.progressLabel}>
                Étape {Math.max(1, progressSteps.indexOf(stepId) + 1)} / {progressSteps.length}
              </Text>
            </View>
            <View style={styles.progressBar}>
              {progressSteps.map((id, idx) => (
                <View
                  key={id}
                  style={[
                    styles.progressStep,
                    progressSteps.indexOf(stepId) >= idx && styles.progressStepActive,
                  ]}
                />
              ))}
            </View>
          </View>
        )}

        {stepId === 'welcome' && (
          <MotionReveal key="welcome" style={styles.stepContainer}>
            <OnboardingWelcomeStep
              preferredKind={accountKind}
              onSelectKind={(kind) => {
                if (!features.diffuseur && kind === 'professionnel') return;
                setAccountKind(kind);
                if (kind === 'particulier') {
                  setProSubtype(null);
                } else if (!proSubtype) {
                  setProSubtype('independant');
                }
              }}
              showProfessionnel={features.diffuseur}
            />
          </MotionReveal>
        )}

        {stepId === 'identity' && (
          <MotionReveal key="identity" style={styles.stepContainer}>
            <Text style={styles.stepTitle}>
              {features.diffuseur ? 'Qui êtes-vous ?' : 'Comment vous appeler ?'}
            </Text>
            <Text style={styles.helper}>
              {features.diffuseur
                ? 'Particulier ou Professionnel — puis, si besoin, votre typologie.'
                : 'Ce nom apparaît auprès des autres membres.'}
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nom d&apos;affichage</Text>
              <TextInput
                style={styles.input}
                placeholder="Comment voulez-vous être appelé ?"
                placeholderTextColor={colors.brand.textSecondary}
                value={displayName}
                onChangeText={setDisplayName}
                maxLength={50}
                returnKeyType="done"
                accessibilityLabel="Nom d'affichage"
                ref={registerFieldRef('displayName')}
                onFocus={() => handleInputFocus('displayName')}
              />
            </View>

            {features.diffuseur ? (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Je suis :</Text>
                <View style={styles.roleChips}>
                  {visibleAccountKinds.map((option) => {
                    const Icon = ACCOUNT_KIND_ICONS[option.value];
                    const active = accountKind === option.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[styles.roleChip, active && styles.roleChipActive]}
                        onPress={() => {
                          haptics.selection();
                          setAccountKind(option.value);
                          if (option.value === 'particulier') {
                            setProSubtype(null);
                          } else if (!proSubtype) {
                            setProSubtype('independant');
                          }
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`${option.label}. ${option.description}`}
                      >
                        <Icon
                          size={15}
                          color={active ? colors.brand.primary : colors.brand.textSecondary}
                          strokeWidth={2.2}
                        />
                        <Text style={[styles.roleChipLabel, active && styles.roleChipLabelActive]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {activeKindDescription ? (
                  <Text style={styles.roleHint}>{activeKindDescription}</Text>
                ) : null}
              </View>
            ) : null}

            {accountKind === 'particulier' && features.eventCreate ? (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Sur Moments Locaux, je veux :</Text>
                <TouchableOpacity
                  style={[
                    styles.intentRow,
                    !particulierAlsoCreates && styles.intentRowActive,
                  ]}
                  onPress={() => {
                    haptics.selection();
                    setParticulierAlsoCreates(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: !particulierAlsoCreates }}
                >
                  <Compass
                    size={18}
                    color={
                      !particulierAlsoCreates
                        ? colors.brand.primary
                        : colors.brand.textSecondary
                    }
                  />
                  <View style={styles.intentCopy}>
                    <Text
                      style={[
                        styles.intentTitle,
                        !particulierAlsoCreates && styles.intentTitleActive,
                      ]}
                    >
                      Découvrir uniquement
                    </Text>
                    <Text style={styles.roleHint}>
                      Carte, fil, favoris — sans créer d&apos;événements.
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.intentRow,
                    particulierAlsoCreates && styles.intentRowActive,
                  ]}
                  onPress={() => {
                    haptics.selection();
                    setParticulierAlsoCreates(true);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: particulierAlsoCreates }}
                >
                  <PlusCircle
                    size={18}
                    color={
                      particulierAlsoCreates
                        ? colors.brand.primary
                        : colors.brand.textSecondary
                    }
                  />
                  <View style={styles.intentCopy}>
                    <Text
                      style={[
                        styles.intentTitle,
                        particulierAlsoCreates && styles.intentTitleActive,
                      ]}
                    >
                      Découvrir et créer
                    </Text>
                    <Text style={styles.roleHint}>
                      Vous restez découvreur, avec la possibilité de publier des moments.
                    </Text>
                  </View>
                </TouchableOpacity>
                <Text style={styles.roleNote}>
                  Pas de profil « créateur seul » : la découverte reste toujours disponible.
                </Text>
              </View>
            ) : null}

            {features.diffuseur && accountKind === 'professionnel' ? (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Type de professionnel</Text>
                <View style={styles.roleChips}>
                  {PRO_SUBTYPE_OPTIONS.map((option) => {
                    const active = proSubtype === option.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[styles.roleChip, active && styles.roleChipActive]}
                        onPress={() => {
                          haptics.selection();
                          setProSubtype(option.value);
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`${option.label}. ${option.description}`}
                      >
                        <Building2
                          size={15}
                          color={active ? colors.brand.primary : colors.brand.textSecondary}
                          strokeWidth={2.2}
                        />
                        <Text
                          style={[styles.roleChipLabel, active && styles.roleChipLabelActive]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {activeSubtypeDescription ? (
                  <Text style={styles.roleHint}>{activeSubtypeDescription}</Text>
                ) : null}
                <Text style={styles.roleNote}>
                  Pour découvrir et check-in en tant que participant, créez un compte
                  Particulier séparé. Ce compte Professionnel sert à diffuser.
                </Text>
              </View>
            ) : null}
          </MotionReveal>
        )}

        {stepId === 'create_why' && (
          <MotionReveal key="create_why" style={styles.stepContainer}>
            <OnboardingCreateWhyStep value={createIntent} onChange={setCreateIntent} />
          </MotionReveal>
        )}

        {stepId === 'location' && (
          <MotionReveal key="location" style={styles.stepContainer}>
            <Text style={styles.stepTitle}>
              {isProfessionnel ? 'Où êtes-vous basé ?' : 'Où voulez-vous explorer ?'}
            </Text>
            <Text style={styles.helper}>
              {isProfessionnel
                ? 'Pour ancrer vos publications sur le territoire.'
                : 'Pour afficher les moments autour de vous.'}
            </Text>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Ville ou quartier</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex. Lyon, Bastille, Nantes…"
                placeholderTextColor={colors.brand.textSecondary}
                value={addressSearch}
                onChangeText={handleSearchChange}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Rechercher une ville ou un quartier"
                ref={registerFieldRef('addressSearch')}
                onFocus={() => handleInputFocus('addressSearch')}
              />
            </View>
            {locationLoading && !selectedAddress ? (
              <View style={styles.searchStatus}>
                <ActivityIndicator size="small" color={colors.brand.secondary} />
                <Text style={styles.meta}>Recherche en cours…</Text>
              </View>
            ) : null}
            {addressResults.length > 0 ? (
              <View style={styles.resultsContainer}>
                {addressResults.map((item) => (
                  <TouchableOpacity
                    key={`${item.latitude}-${item.longitude}-${item.label}`}
                    style={styles.resultRow}
                    onPress={() => handleSelectLocation(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Choisir ${item.label}`}
                  >
                    <MapPin size={16} color={colors.brand.secondary} />
                    <Text style={styles.resultText}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            {showNoResults ? (
              <View style={styles.searchStatus}>
                <SearchX size={16} color={colors.brand.textSecondary} />
                <Text style={styles.meta}>Aucun lieu trouvé, essayez une autre orthographe.</Text>
              </View>
            ) : null}
            {selectedAddress ? (
              <View style={styles.selection}>
                <MapPin size={16} color={colors.brand.secondary} />
                <View style={styles.selectionCopy}>
                  <Text style={styles.meta}>Lieu sélectionné</Text>
                  <Text style={styles.info}>{selectedAddress.label}</Text>
                </View>
              </View>
            ) : null}
          </MotionReveal>
        )}

        {stepId === 'themes' && (
          <MotionReveal key="themes" style={styles.stepContainer}>
            <OnboardingThemesStep
              selected={themeSlugs}
              onToggle={toggleThemeSlug}
              title="Ce que tu aimes découvrir"
              subtitle="Ces thèmes nourrissent ton fil et tes notifs. Tu pourras les modifier plus tard. Tu peux passer."
            />
          </MotionReveal>
        )}

        {stepId === 'create_themes' && (
          <MotionReveal key="create_themes" style={styles.stepContainer}>
            <OnboardingThemesStep
              selected={createThemeSlugs}
              onToggle={toggleCreateThemeSlug}
              title="Ce que tu vas proposer"
              subtitle="Catégories de tes futurs moments (préremplies depuis ce que tu aimes découvrir). Différent de tes goûts perso — tu peux ajuster ou passer."
            />
          </MotionReveal>
        )}

        {stepId === 'avatar' && (
          <MotionReveal key="avatar" style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Ajoutez une photo</Text>
            <Text style={styles.helper}>Optionnel — vous pourrez la modifier plus tard.</Text>
            <TouchableOpacity
              style={styles.avatarUpload}
              onPress={() => uploadImage('avatar')}
              disabled={isUploading}
              accessibilityRole="button"
              accessibilityLabel="Choisir une photo de profil"
            >
              {uploadTarget === 'avatar' ? (
                <View style={styles.avatarPlaceholder}>
                  <ActivityIndicator color={colors.brand.secondary} />
                </View>
              ) : avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarPreview} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <User size={30} color={colors.brand.secondary} />
                  <Text style={styles.uploadText}>Choisir une photo</Text>
                </View>
              )}
            </TouchableOpacity>
            {avatarUrl && uploadTarget !== 'avatar' ? (
              <Text style={styles.avatarHint}>Touchez la photo pour la remplacer.</Text>
            ) : null}
          </MotionReveal>
        )}

        {stepId === 'creator' && (
          <MotionReveal key="creator" style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Profil créateur</Text>
            <Text style={styles.helper}>
              Optionnel — complétez maintenant ou plus tard depuis votre profil.
            </Text>

            <TouchableOpacity
              style={styles.coverUpload}
              onPress={() => uploadImage('cover')}
              disabled={isUploading}
              accessibilityRole="button"
              accessibilityLabel="Ajouter une image de couverture"
            >
              {uploadTarget === 'cover' ? (
                <ActivityIndicator color={colors.brand.secondary} />
              ) : coverUrl ? (
                <Image source={{ uri: coverUrl }} style={styles.coverPreview} />
              ) : (
                <View style={styles.coverPlaceholder}>
                  <ImagePlus size={20} color={colors.brand.secondary} />
                  <Text style={styles.uploadText}>Ajouter une cover</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Bio</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Présentez votre activité en quelques mots…"
                placeholderTextColor={colors.brand.textSecondary}
                value={bio}
                onChangeText={setBio}
                multiline
                numberOfLines={4}
                maxLength={200}
                accessibilityLabel="Bio"
                ref={registerFieldRef('bio')}
                onFocus={() => handleInputFocus('bio')}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Instagram</Text>
              <TextInput
                style={styles.input}
                placeholder="@moncompte ou lien"
                placeholderTextColor={colors.brand.textSecondary}
                value={instagram}
                onChangeText={setInstagram}
                autoCapitalize="none"
                accessibilityLabel="Instagram"
                ref={registerFieldRef('instagram')}
                onFocus={() => handleInputFocus('instagram')}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>TikTok</Text>
              <TextInput
                style={styles.input}
                placeholder="@moncompte ou lien"
                placeholderTextColor={colors.brand.textSecondary}
                value={tiktok}
                onChangeText={setTiktok}
                autoCapitalize="none"
                accessibilityLabel="TikTok"
                ref={registerFieldRef('tiktok')}
                onFocus={() => handleInputFocus('tiktok')}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Facebook</Text>
              <TextInput
                style={styles.input}
                placeholder="URL ou page"
                placeholderTextColor={colors.brand.textSecondary}
                value={facebook}
                onChangeText={setFacebook}
                autoCapitalize="none"
                accessibilityLabel="Facebook"
                ref={registerFieldRef('facebook')}
                onFocus={() => handleInputFocus('facebook')}
              />
            </View>
          </MotionReveal>
        )}

        {stepId === 'connector' && (
          <MotionReveal key="connector" style={styles.stepContainer}>
            <OnboardingConnectorStep
              proSubtype={proSubtype}
              value={connectorDraft}
              onChange={setConnectorDraft}
            />
          </MotionReveal>
        )}

        {stepId === 'tiers' ? <OnboardingTiersStep /> : null}

        {stepId === 'eclairer' ? (
          <OnboardingEclaireurCtaStep onUnlock={handleUnlockTease} />
        ) : null}

        {stepId === 'mode_hint' && (
          <MotionReveal key="mode_hint" style={styles.stepContainer}>
            <OnboardingModeHintStep />
          </MotionReveal>
        )}

        {error ? (
          <Text style={styles.errorText} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        <View style={styles.buttonGroup}>
          {showSkip ? (
            <Button
              title="Passer"
              onPress={skipOptionalToTiers}
              variant="outline"
              size="sm"
              style={styles.footerButton}
              disabled={isLoading || isUploading}
              accessibilityLabel="Passer et continuer"
            />
          ) : null}
          {showContinueFree ? (
            <Button
              title="Continuer gratuitement"
              onPress={continueFree}
              variant="outline"
              size="sm"
              style={styles.footerButton}
              disabled={isLoading}
              accessibilityLabel="Continuer gratuitement"
            />
          ) : null}
          <Button
            title={primaryTitle}
            onPress={
              stepId === 'eclairer' ? () => handleUnlockTease('annual') : goNext
            }
            size="sm"
            loading={isLoading || (stepId === 'location' && locationLoading && !!selectedAddress)}
            style={
              stepId === 'eclairer'
                ? [styles.footerButton, styles.premiumCta]
                : styles.footerButton
            }
            disabled={!canContinue || isLoading || isUploading}
            accessibilityLabel={primaryTitle}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: colors.brand.primary,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  replayTopBar: {
    alignItems: 'flex-end',
    marginBottom: spacing.sm,
  },
  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.xs,
  },
  closeText: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '600',
  },
  welcomeHeader: {
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  welcomeTitle: {
    ...typography.h1,
    color: colors.brand.text,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    ...typography.body,
    color: colors.brand.textSecondary,
    textAlign: 'center',
  },
  stepHeader: {
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  stepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
  },
  backText: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '600',
  },
  progressLabel: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
  progressBar: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  progressStep: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 2,
  },
  progressStepActive: {
    backgroundColor: colors.brand.secondary,
  },
  stepContainer: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  stepTitle: {
    ...typography.h3,
    color: colors.brand.text,
  },
  inputGroup: {
    gap: spacing.xs,
  },
  label: {
    ...typography.label,
    color: colors.brand.text,
  },
  input: {
    ...typography.body,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    color: colors.brand.text,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.error[500],
    marginTop: spacing.sm,
  },
  valueCard: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'flex-start',
  },
  valueIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(43, 191, 227, 0.14)',
  },
  valueCopy: {
    flex: 1,
    gap: 4,
  },
  valueTitle: {
    ...typography.h6,
    color: colors.brand.text,
  },
  valueBody: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    lineHeight: 20,
  },
  roleChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  roleChipActive: {
    borderColor: colors.brand.secondary,
    backgroundColor: colors.brand.secondary,
  },
  roleChipLabel: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.brand.text,
  },
  roleChipLabelActive: {
    color: colors.brand.primary,
    fontWeight: '700',
  },
  roleHint: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    marginTop: spacing.xs,
  },
  roleNote: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  intentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginTop: spacing.sm,
  },
  intentRowActive: {
    borderColor: 'rgba(43,191,227,0.45)',
    backgroundColor: 'rgba(43,191,227,0.12)',
  },
  intentCopy: {
    flex: 1,
    gap: 2,
  },
  intentTitle: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.brand.text,
  },
  intentTitleActive: {
    color: colors.brand.primary,
    fontWeight: '700',
  },
  buttonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  footerButton: {
    flex: 1,
    minHeight: 48,
    maxHeight: 48,
  },
  premiumCta: {
    backgroundColor: colors.brand.premium,
  },
  helper: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
  },
  meta: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
  info: {
    ...typography.body,
    color: colors.brand.text,
  },
  searchStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  resultsContainer: {
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  resultText: {
    ...typography.bodySmall,
    color: colors.brand.text,
    flex: 1,
  },
  selection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(43,191,227,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(43,191,227,0.3)',
  },
  selectionCopy: {
    flex: 1,
    gap: 2,
  },
  avatarUpload: {
    alignSelf: 'center',
    width: 132,
    height: 132,
    borderRadius: 66,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  avatarPreview: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  avatarHint: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    textAlign: 'center',
  },
  coverUpload: {
    height: 120,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  coverPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  coverPreview: {
    width: '100%',
    height: '100%',
  },
  uploadText: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '600',
  },
});
