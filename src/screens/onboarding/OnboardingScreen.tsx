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
  Compass,
  Heart,
  ImagePlus,
  Landmark,
  MapPin,
  Megaphone,
  PlusCircle,
  SearchX,
  User,
  X,
} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { AppBackground, Button, MotionReveal } from '../../components/ui';
import { OnboardingTiersStep } from '@/components/onboarding/OnboardingTiersStep';
import { OnboardingEclaireurCtaStep } from '@/components/onboarding/OnboardingEclaireurCtaStep';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { Motion } from '@/constants/motion';
import { useAuth } from '../../hooks';
import { ProfileService } from '@/services/profile.service';
import { useImagePicker } from '@/hooks/useImagePicker';
import { supabase } from '@/lib/supabase/client';
import { MapboxService, type GeocodeResult } from '@/services/mapbox.service';
import { setHomeLocationFromCoords } from '@/services/push.service';
import { PREMIUM_PLANS } from '@/services/subscription.service';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAutoScrollOnFocus } from '@/hooks/useAutoScrollOnFocus';
import { haptics } from '@/utils/haptics';

type RoleValue = 'particulier' | 'professionnel' | 'institutionnel';
type StepId = 'welcome' | 'identity' | 'location' | 'avatar' | 'creator' | 'tiers' | 'eclairer';

const ROLE_OPTIONS: {
  value: RoleValue;
  label: string;
  description: string;
  icon: typeof User;
}[] = [
  {
    value: 'particulier',
    label: 'Découvreur',
    description: 'Vous explorez et participez aux moments près de chez vous.',
    icon: User,
  },
  {
    value: 'professionnel',
    label: 'Organisateur',
    description: 'Vous proposez des moments à votre public.',
    icon: Megaphone,
  },
  {
    value: 'institutionnel',
    label: 'Structure',
    description: 'Mairie, association, lieu culturel…',
    icon: Landmark,
  },
];

const VALUE_PROPS = [
  {
    icon: Compass,
    title: 'Découvrir',
    body: 'Les moments près de chez vous, sur la carte et dans le fil.',
  },
  {
    icon: Heart,
    title: 'Participer',
    body: 'Favoris, suivi de créateurs et check-in sur place.',
  },
  {
    icon: PlusCircle,
    title: 'Créer',
    body: 'Publiez un moment et soumettez-le pour validation.',
  },
] as const;

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
  const [role, setRole] = useState<RoleValue>(
    (profile?.role as RoleValue) || 'particulier',
  );
  const [addressSearch, setAddressSearch] = useState('');
  const [addressResults, setAddressResults] = useState<GeocodeResult[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<GeocodeResult | null>(null);
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [coverUrl, setCoverUrl] = useState(profile?.cover_url || '');
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

  const isCreatorRole = role === 'professionnel' || role === 'institutionnel';
  const isUploading = uploadTarget !== null;

  const steps: StepId[] = useMemo(() => {
    const profileSteps: StepId[] = isCreatorRole
      ? ['welcome', 'identity', 'location', 'avatar', 'creator']
      : ['welcome', 'identity', 'location', 'avatar'];
    return [...profileSteps, 'tiers', 'eclairer'];
  }, [isCreatorRole]);

  const stepId = steps[Math.min(stepIndex, steps.length - 1)];
  const totalSteps = steps.length;
  const isLastStep = stepIndex >= totalSteps - 1;
  const lastProfileStepId: StepId = isCreatorRole ? 'creator' : 'avatar';
  const isMarketingStep = stepId === 'tiers' || stepId === 'eclairer';
  const progressSteps = steps.filter(
    (id) => id !== 'welcome' && id !== 'tiers' && id !== 'eclairer',
  );

  const canContinue =
    stepId === 'welcome' ||
    (stepId === 'identity' && !!displayName.trim()) ||
    (stepId === 'location' && !!selectedAddress) ||
    stepId === 'avatar' ||
    stepId === 'creator' ||
    stepId === 'tiers' ||
    stepId === 'eclairer';

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

      await ProfileService.updateProfile(activeProfile.id, {
        display_name: displayName.trim(),
        bio: isCreatorRole ? bio.trim() || null : null,
        role,
        city: resolvedCity,
        region: resolvedRegion,
        avatar_url: avatarUrl || null,
        cover_url: isCreatorRole ? coverUrl || null : null,
        facebook_url: isCreatorRole ? facebook.trim() || null : null,
        instagram_url: isCreatorRole ? instagram.trim() || null : null,
        tiktok_url: isCreatorRole ? tiktok.trim() || null : null,
        onboarding_completed: true,
      });

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

    if (stepId === lastProfileStepId) {
      const saved = await persistProfile();
      if (!saved) return;
      haptics.light();
      setStepIndex((prev) => Math.min(prev + 1, totalSteps - 1));
      return;
    }

    if (stepId === 'eclairer') {
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

  /** Skip remaining profile extras and jump to marketing tiers. */
  const skipOptionalToTiers = async () => {
    haptics.selection();
    const saved = await persistProfile();
    if (!saved) return;
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
      ? 'Personnaliser mon profil'
      : stepId === 'tiers'
        ? 'Voir l’offre Éclaireur'
        : stepId === 'eclairer'
          ? 'Déverrouiller Éclaireur'
          : 'Continuer';

  const showSkip = stepId === 'avatar' || stepId === 'creator';
  const showContinueFree = isMarketingStep;
  const activeRoleDescription = ROLE_OPTIONS.find((option) => option.value === role)?.description;
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
                : 'Pour vous montrer ce qui se passe près de vous'}
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
          <View style={styles.stepContainer}>
            {VALUE_PROPS.map((item, idx) => {
              const Icon = item.icon;
              return (
                <MotionReveal key={item.title} delay={idx * Motion.stagger.content}>
                  <View style={styles.valueCard}>
                    <View style={styles.valueIcon}>
                      <Icon size={22} color={colors.brand.secondary} strokeWidth={2.2} />
                    </View>
                    <View style={styles.valueCopy}>
                      <Text style={styles.valueTitle}>{item.title}</Text>
                      <Text style={styles.valueBody}>{item.body}</Text>
                    </View>
                  </View>
                </MotionReveal>
              );
            })}
          </View>
        )}

        {stepId === 'identity' && (
          <MotionReveal key="identity" style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Qui êtes-vous ?</Text>
            <Text style={styles.helper}>Votre nom et la façon dont vous vous présentez.</Text>

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

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Je souhaite me présenter en tant que :</Text>
              <View style={styles.roleChips}>
                {ROLE_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const active = role === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.roleChip, active && styles.roleChipActive]}
                      onPress={() => {
                        haptics.selection();
                        setRole(option.value);
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
              {activeRoleDescription ? (
                <Text style={styles.roleHint}>{activeRoleDescription}</Text>
              ) : null}
              <Text style={styles.roleNote}>
                Quel que soit votre choix, vous pouvez tout faire : découvrir, participer et
                créer des moments. Ce choix personnalise simplement votre profil.
              </Text>
            </View>
          </MotionReveal>
        )}

        {stepId === 'location' && (
          <MotionReveal key="location" style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Où voulez-vous explorer ?</Text>
            <Text style={styles.helper}>Pour afficher les moments autour de vous.</Text>
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

        {stepId === 'tiers' ? <OnboardingTiersStep /> : null}

        {stepId === 'eclairer' ? (
          <OnboardingEclaireurCtaStep onUnlock={handleUnlockTease} />
        ) : null}

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
