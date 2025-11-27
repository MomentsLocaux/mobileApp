import React, { useMemo, useState } from 'react';
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

const ROLE_OPTIONS = [
  { value: 'denicheur', label: 'Explorateur', description: 'Je découvre et participe.' },
  { value: 'createur', label: 'Créateur', description: 'Je propose des moments.' },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { profile, user, refreshProfile } = useAuth();
  const [step, setStep] = useState(1);
  const fallbackDisplayName = useMemo(
    () => profile?.display_name || profile?.email || user?.email || '',
    [profile?.display_name, profile?.email, user?.email],
  );
  const [displayName, setDisplayName] = useState(fallbackDisplayName);
  const [bio, setBio] = useState(profile?.bio || '');
  const [role, setRole] = useState<string>(profile?.role || 'denicheur');
  const [city, setCity] = useState(profile?.city || '');
  const [region, setRegion] = useState(profile?.region || '');
  const [isLoading, setIsLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalSteps = 3;
  const canContinue =
    (step === 1 && !!displayName.trim()) ||
    (step === 2 && !!city.trim() && !!region.trim()) ||
    step === 3;

  const geocodeLocation = async () => {
    setError(null);
    const query = [city, region].filter(Boolean).join(' ');
    if (!query.trim()) return false;

    setLocationLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&countrycodes=fr&q=${encodeURIComponent(
          query,
        )}`,
        {
          headers: { 'User-Agent': 'LumoApp/1.0' },
        },
      );

      if (!response.ok) {
        setError('Impossible de valider cette localisation.');
        return false;
      }

      const results = await response.json();
      const first = Array.isArray(results) ? results[0] : null;
      if (!first || !first.address) {
        setError('Ville ou région introuvable en France.');
        return false;
      }

      const addr = first.address;
      setCity(addr.city || addr.town || addr.village || city);
      setRegion(addr.state || addr.county || region);
      return true;
    } catch (err) {
      setError('Impossible de géocoder cette localisation.');
      return false;
    } finally {
      setLocationLoading(false);
    }
  };

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
        <Text style={styles.subtitle}>
          Configurons votre profil en quelques étapes
        </Text>
        <Text style={styles.progressLabel}>
          Étape {step} / {totalSteps}
        </Text>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressStep, step >= 1 && styles.progressStepActive]} />
        <View style={[styles.progressStep, step >= 2 && styles.progressStepActive]} />
        <View style={[styles.progressStep, step >= 3 && styles.progressStepActive]} />
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
                style={[
                  styles.roleCard,
                  role === option.value && styles.roleCardSelected,
                ]}
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

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Ville</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex. Paris"
              value={city}
              onChangeText={setCity}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Région</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex. Île-de-France"
              value={region}
              onChangeText={setRegion}
              autoCapitalize="words"
            />
          </View>
        </View>
      )}

      {step === 3 && (
        <View style={styles.stepContainer}>
          <Text style={styles.stepTitle}>Ajoutez une bio (optionnel)</Text>

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
});
