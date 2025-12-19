import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { User, ChevronLeft } from 'lucide-react-native';
import { Button } from '../../components/ui';
import { colors, spacing, typography } from '../../constants/theme';
import { useAuth } from '../../hooks';
import { ProfileService } from '@/services/profile.service';
import { useImagePicker } from '@/hooks/useImagePicker';
import { supabase } from '@/lib/supabase/client';
import { MapboxService, type GeocodeResult } from '@/services/mapbox.service';

const ROLE_OPTIONS = [
  { value: 'denicheur', label: 'Explorateur', description: 'Je découvre et participe.' },
  { value: 'createur', label: 'Créateur', description: 'Je propose des moments.' },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { profile, user, refreshProfile } = useAuth();
  const { pickImage } = useImagePicker();

  const [step, setStep] = useState(1);
  const totalSteps = 4;

  const fallbackDisplayName = useMemo(
    () => profile?.display_name || profile?.email || user?.email || '',
    [profile?.display_name, profile?.email, user?.email],
  );

  const [displayName, setDisplayName] = useState(fallbackDisplayName);
  const [bio, setBio] = useState(profile?.bio || '');
  const [role, setRole] = useState<string>(profile?.role || 'denicheur');
  const [city, setCity] = useState(profile?.city || '');
  const [region, setRegion] = useState(profile?.region || '');
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
  const [error, setError] = useState<string | null>(null);

  const canContinue =
    (step === 1 && !!displayName.trim()) ||
    (step === 2 && !!selectedAddress) ||
    step === 3 ||
    step === 4;

  const searchAddress = useCallback(
    async (q: string) => {
      setError(null);
      setAddressSearch(q);
      if (!q.trim()) {
        setAddressResults([]);
        return;
      }
      setLocationLoading(true);
      try {
        const results = await MapboxService.search(q);
        setAddressResults(results);
      } catch (e) {
        setError('Impossible de chercher cette adresse.');
      } finally {
        setLocationLoading(false);
      }
    },
    [],
  );

  const geocodeLocation = async () => {
    if (!selectedAddress) return false;
    setCity(selectedAddress.city || selectedAddress.label);
    setRegion(selectedAddress.country || 'France');
    return true;
  };

  const uploadImage = useCallback(
    async (target: 'avatar' | 'cover') => {
      const asset = await pickImage({ allowsEditing: true });
      if (!asset?.uri) return;
      setIsLoading(true);
      try {
        const response = await fetch(asset.uri);
        const arrayBuffer = await response.arrayBuffer();
        const ext = asset.uri.split('.').pop() || 'jpg';
        const fileName = `${target}-${Date.now()}.${ext}`;
        const path = target === 'avatar' ? `avatars/${fileName}` : `covers/${fileName}`;
        const bucket = 'avatar'; // bucket déjà créé pour les avatars/covers
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
      } catch (e) {
        setError("Échec de l'upload, réessayez.");
      } finally {
        setIsLoading(false);
      }
    },
    [pickImage],
  );

  const handleComplete = async () => {
    if (!profile || !user) return;
    setError(null);

    setIsLoading(true);
    try {
      await ProfileService.updateProfile(profile.id, {
        display_name: displayName,
        bio: bio || null,
        role: role as any,
        city: city.trim(),
        region: region.trim(),
        avatar_url: avatarUrl || null,
        cover_url: coverUrl || null,
        facebook_url: facebook.trim() || null,
        instagram_url: instagram.trim() || null,
        tiktok_url: tiktok.trim() || null,
        onboarding_completed: true,
      });

      await refreshProfile();
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      setError(error instanceof Error ? error.message : 'Erreur de mise à jour du profil');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={20} color={colors.neutral[700]} />
          <Text style={styles.backText}>Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Bienvenue sur Lumo</Text>
        <Text style={styles.subtitle}>Configurons votre profil en quelques étapes</Text>
        <Text style={styles.progressLabel}>
          Étape {step} / {totalSteps}
        </Text>
      </View>

      <View style={styles.progressBar}>
        {[1, 2, 3, 4].map((idx) => (
          <View key={idx} style={[styles.progressStep, step >= idx && styles.progressStepActive]} />
        ))}
      </View>

      {step === 1 && (
        <View style={styles.stepContainer}>
          <Text style={styles.stepTitle}>Parlez-nous de vous</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nom d&apos;affichage</Text>
            <TextInput
              style={styles.input}
              placeholder="Comment voulez-vous être appelé ?"
              value={displayName}
              onChangeText={setDisplayName}
              maxLength={50}
            />
          </View>

          <View style={styles.roleOptions}>
            {ROLE_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[styles.roleCard, role === option.value && styles.roleCardSelected]}
                onPress={() => setRole(option.value)}
              >
                <View style={styles.roleIcon}>
                  <User
                    size={32}
                    color={role === option.value ? colors.primary[600] : colors.neutral[400]}
                  />
                </View>
                <Text style={styles.roleLabel}>{option.label}</Text>
                <Text style={styles.roleDescription}>{option.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {step === 2 && (
        <View style={styles.stepContainer}>
          <Text style={styles.stepTitle}>Où êtes-vous basé ?</Text>
          <Text style={styles.helper}>Recherche limitée à la France.</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Adresse ou ville</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex. 10 rue de Rivoli, Paris"
              value={addressSearch}
              onChangeText={searchAddress}
              autoCapitalize="none"
            />
          </View>
          {locationLoading && <Text style={styles.meta}>Recherche en cours...</Text>}
          <View style={styles.resultsContainer}>
            {addressResults.map((item) => (
              <TouchableOpacity
                key={`${item.latitude}-${item.longitude}-${item.label}`}
                style={[
                  styles.resultRow,
                  selectedAddress?.label === item.label && styles.resultRowActive,
                ]}
                onPress={() => setSelectedAddress(item)}
              >
                <Text style={styles.resultText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {selectedAddress ? (
            <View style={styles.selection}>
              <Text style={styles.meta}>Adresse sélectionnée :</Text>
              <Text style={styles.info}>{selectedAddress.label}</Text>
            </View>
          ) : null}
        </View>
      )}

      {step === 3 && (
        <View style={styles.stepContainer}>
          <Text style={styles.stepTitle}>Ajoutez vos visuels</Text>
          <View style={styles.uploadRow}>
            <TouchableOpacity style={styles.uploadCard} onPress={() => uploadImage('avatar')}>
              {avatarUrl ? (
                <ImagePreview uri={avatarUrl} label="Avatar" />
              ) : (
                <Text style={styles.uploadText}>Avatar</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.uploadCard} onPress={() => uploadImage('cover')}>
              {coverUrl ? (
                <ImagePreview uri={coverUrl} label="Cover" />
              ) : (
                <Text style={styles.uploadText}>Cover</Text>
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.helper}>Ces visuels pourront être modifiés plus tard.</Text>
        </View>
      )}

      {step === 4 && (
        <View style={styles.stepContainer}>
          <Text style={styles.stepTitle}>Réseaux & bio</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Instagram</Text>
            <TextInput
              style={styles.input}
              placeholder="@moncompte ou lien"
              value={instagram}
              onChangeText={setInstagram}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>TikTok</Text>
            <TextInput
              style={styles.input}
              placeholder="@moncompte ou lien"
              value={tiktok}
              onChangeText={setTiktok}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Facebook</Text>
            <TextInput
              style={styles.input}
              placeholder="URL ou page"
              value={facebook}
              onChangeText={setFacebook}
              autoCapitalize="none"
            />
          </View>

          <Text style={styles.stepTitle}>Bio (optionnel)</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Parlez de vous ou de vos événements..."
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={4}
              maxLength={200}
            />
          </View>
        </View>
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.buttonGroup}>
        {step > 1 && (
          <Button
            title="Retour"
            onPress={() => setStep((prev) => Math.max(1, prev - 1))}
            variant="outline"
            style={styles.buttonHalf}
            disabled={isLoading}
          />
        )}
        <Button
          title={step === totalSteps ? 'Valider' : 'Continuer'}
          onPress={async () => {
            if (step === 2) {
              const ok = await geocodeLocation();
              if (!ok) return;
            }
            if (step < totalSteps) {
              setStep((prev) => prev + 1);
            } else {
              handleComplete();
            }
          }}
          loading={isLoading || locationLoading}
          style={step > 1 ? styles.buttonHalf : undefined}
          disabled={!canContinue || isLoading || locationLoading}
        />
      </View>
    </ScrollView>
  );
}

const ImagePreview = ({ uri, label }: { uri: string; label: string }) => (
  <View style={styles.previewContainer}>
    <Text style={styles.uploadText}>{label}</Text>
    <Text style={styles.meta} numberOfLines={1}>
      {uri}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  content: {
    padding: spacing.lg,
  },
  header: {
    marginBottom: spacing.xl,
    marginTop: spacing.xl,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  backText: {
    ...typography.bodySmall,
    color: colors.neutral[700],
    fontWeight: '600',
  },
  title: {
    ...typography.h1,
    color: colors.neutral[900],
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.neutral[600],
    textAlign: 'center',
  },
  progressLabel: {
    ...typography.caption,
    color: colors.neutral[500],
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  progressBar: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  progressStep: {
    flex: 1,
    height: 4,
    backgroundColor: colors.neutral[200],
    borderRadius: 2,
  },
  progressStepActive: {
    backgroundColor: colors.primary[600],
  },
  stepContainer: {
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  stepTitle: {
    ...typography.h2,
    color: colors.neutral[900],
    marginBottom: spacing.md,
  },
  inputGroup: {
    gap: spacing.xs,
  },
  label: {
    ...typography.label,
    color: colors.neutral[700],
  },
  input: {
    ...typography.body,
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: 8,
    padding: spacing.md,
    color: colors.neutral[900],
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.error[600],
    marginTop: spacing.sm,
  },
  roleOptions: {
    gap: spacing.md,
  },
  roleCard: {
    backgroundColor: colors.neutral[0],
    borderWidth: 2,
    borderColor: colors.neutral[200],
    borderRadius: 12,
    padding: spacing.lg,
    alignItems: 'center',
  },
  roleCardSelected: {
    borderColor: colors.primary[600],
    backgroundColor: colors.primary[50],
  },
  roleIcon: {
    marginBottom: spacing.sm,
  },
  roleLabel: {
    ...typography.h3,
    color: colors.neutral[900],
    marginBottom: spacing.xs,
  },
  roleDescription: {
    ...typography.small,
    color: colors.neutral[600],
    textAlign: 'center',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  buttonHalf: {
    flex: 1,
  },
  helper: {
    ...typography.bodySmall,
    color: colors.neutral[600],
  },
  meta: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  info: {
    ...typography.body,
    color: colors.neutral[800],
  },
  resultRow: {
    paddingVertical: spacing.sm,
  },
  resultRowActive: {
    backgroundColor: colors.primary[50],
  },
  resultText: {
    ...typography.body,
    color: colors.neutral[800],
  },
  resultsContainer: {
    maxHeight: 200,
  },
  selection: {
    gap: spacing.xs,
  },
  uploadRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  uploadCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[0],
  },
  uploadText: {
    ...typography.body,
    color: colors.neutral[800],
    fontWeight: '600',
  },
  previewContainer: {
    alignItems: 'center',
    gap: spacing.xs,
  },
});
