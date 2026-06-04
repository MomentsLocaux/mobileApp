import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Input, ScreenHeader } from '../../components/ui';
import { useAuth } from '../../hooks';
import { colors, spacing, typography } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
    legalAccepted?: string;
  }>({});

  const validate = () => {
    const newErrors: {
      email?: string;
      password?: string;
      confirmPassword?: string;
      legalAccepted?: string;
    } = {};

    if (!email) {
      newErrors.email = 'Email requis';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Email invalide';
    }

    if (!password) {
      newErrors.password = 'Mot de passe requis';
    } else if (password.length < 6) {
      newErrors.password = 'Minimum 6 caractères';
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Les mots de passe ne correspondent pas';
    }

    if (!legalAccepted) {
      newErrors.legalAccepted = 'Vous devez accepter les CGU et la politique de confidentialité';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;

    const response = await signUp(email, password);
    if (!response) {
      Alert.alert('Erreur', "Impossible de créer le compte. Vérifiez votre email et réessayez.");
      return;
    }

    const alreadyRegistered =
      typeof response.error === 'string' &&
      response.error.toLowerCase().includes('already registered');

    // Supabase retourne souvent session null + user non confirmé => success true, mais require email
    const requiresEmailConfirmation = response.success && !response.session;

    if (requiresEmailConfirmation || alreadyRegistered) {
      Alert.alert(
        'Vérification requise',
        'Un email de confirmation vous a été envoyé. Validez votre adresse puis connectez-vous.',
        [{ text: 'OK', onPress: () => router.replace('/auth/login') }]
      );
      return;
    }

    if (!response.success) {
      Alert.alert(
        'Erreur',
        response.error || "Impossible de créer le compte. Vérifiez votre email et réessayez."
      );
      return;
    }

    Alert.alert('Compte créé', 'Votre compte a été créé avec succès !', [
      { text: 'OK', onPress: () => router.replace('/(tabs)') },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <ScreenHeader title="" onBack={() => router.back()} />
          <Text style={styles.title}>Créer un compte</Text>
          <Text style={styles.subtitle}>Rejoignez la communauté Moments Locaux</Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Email"
            placeholder="votre@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            error={errors.email}
          />

          <Input
            label="Mot de passe"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password-new"
            error={errors.password}
          />

          <Input
            label="Confirmer le mot de passe"
            placeholder="••••••••"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoComplete="password-new"
            error={errors.confirmPassword}
          />

          <TouchableOpacity
            style={styles.consentRow}
            activeOpacity={0.85}
            onPress={() => setLegalAccepted((value) => !value)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: legalAccepted }}
          >
            <View style={[styles.checkbox, legalAccepted && styles.checkboxChecked]}>
              {legalAccepted ? <Ionicons name="checkmark" size={14} color={colors.brand.background} /> : null}
            </View>
            <Text style={styles.consentText}>
              J’accepte les{' '}
              <Text style={styles.inlineLink} onPress={() => router.push('/settings/legal/cgu' as any)}>
                CGU
              </Text>{' '}
              et la{' '}
              <Text style={styles.inlineLink} onPress={() => router.push('/settings/privacy/policy' as any)}>
                politique de confidentialité
              </Text>
              .
            </Text>
          </TouchableOpacity>
          {errors.legalAccepted ? <Text style={styles.errorText}>{errors.legalAccepted}</Text> : null}

          <Button
            title="S'inscrire"
            onPress={handleRegister}
            loading={isLoading}
            fullWidth
            style={styles.registerButton}
          />

          <View style={styles.footer}>
            <Text style={styles.footerText}>Déjà un compte ? </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.link}>Se connecter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor: colors.neutral[50], // Removed for global background
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h1,
    color: colors.brand.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.brand.textSecondary,
  },
  form: {
    width: '100%',
  },
  registerButton: {
    marginTop: spacing.md,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.brand.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: colors.brand.secondary,
    borderColor: colors.brand.secondary,
  },
  consentText: {
    ...typography.bodySmall,
    flex: 1,
    color: colors.brand.textSecondary,
    lineHeight: 20,
  },
  inlineLink: {
    color: colors.brand.secondary,
    fontWeight: '700',
  },
  errorText: {
    ...typography.caption,
    color: colors.error[500],
    marginTop: spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  footerText: {
    ...typography.body,
    color: colors.brand.textSecondary,
  },
  link: {
    ...typography.body,
    color: colors.brand.secondary,
    fontWeight: '600',
  },
});
