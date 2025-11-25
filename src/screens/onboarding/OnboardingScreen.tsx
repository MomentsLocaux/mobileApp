import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { User } from 'lucide-react-native';
import { Button } from '../../components/ui';
import { colors, spacing, typography } from '../../constants/theme';
import { useAuth } from '../../hooks';
import { ProfileService } from '@/services/profile.service';

const ROLE_OPTIONS = [
  { value: 'denicheur', label: 'Dénicheur', description: 'Je veux découvrir des événements' },
  { value: 'createur', label: 'Créateur', description: 'Je veux créer et partager des événements' },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [role, setRole] = useState<string>(profile?.role || 'denicheur');
  const [isLoading, setIsLoading] = useState(false);

  const handleComplete = async () => {
    if (!profile) return;

    setIsLoading(true);
    try {
      await ProfileService.updateProfile(profile.id, {
        display_name: displayName,
        bio: bio || null,
        role: role as any,
        onboarding_completed: true,
      });

      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error completing onboarding:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Bienvenue sur Lumo</Text>
        <Text style={styles.subtitle}>
          Configurons votre profil en quelques étapes
        </Text>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressStep, step >= 1 && styles.progressStepActive]} />
        <View style={[styles.progressStep, step >= 2 && styles.progressStepActive]} />
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

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Bio (optionnel)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Quelques mots sur vous..."
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={4}
              maxLength={200}
            />
          </View>

          <Button
            title="Suivant"
            onPress={() => setStep(2)}
            disabled={!displayName.trim()}
            fullWidth
          />
        </View>
      )}

      {step === 2 && (
        <View style={styles.stepContainer}>
          <Text style={styles.stepTitle}>Quel est votre profil ?</Text>

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

          <View style={styles.buttonGroup}>
            <Button
              title="Précédent"
              onPress={() => setStep(1)}
              variant="outline"
              style={styles.buttonHalf}
            />
            <Button
              title="Terminer"
              onPress={handleComplete}
              loading={isLoading}
              style={styles.buttonHalf}
            />
          </View>
        </View>
      )}
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
