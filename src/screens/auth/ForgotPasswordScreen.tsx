import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { AppBackground, Button, Input, ScreenHeader } from '@/components/ui';
import { AuthService } from '@/services/auth.service';
import { colors, spacing, typography } from '@/constants/theme';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const validate = () => {
    if (!email) {
      setError('Email requis');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Email invalide');
      return false;
    }
    setError(undefined);
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    const response = await AuthService.requestPasswordReset(email);
    setLoading(false);

    if (!response.success) {
      Alert.alert('Erreur', response.error || 'Impossible d’envoyer l’email');
      return;
    }

    Alert.alert(
      'Email envoyé',
      'Si un compte existe pour cet email, vous recevrez un lien pour réinitialiser votre mot de passe.',
      [{ text: 'OK', onPress: () => router.replace('/auth/login') }],
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppBackground />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <ScreenHeader title="" onBack={() => router.back()} />
          <Text style={styles.title}>Mot de passe oublié</Text>
          <Text style={styles.subtitle}>
            Saisissez votre email : nous vous enverrons un lien de réinitialisation.
          </Text>
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
            error={error}
          />

          <Button title="Envoyer le lien" onPress={handleSubmit} loading={loading} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.brand.primary,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h2,
    color: colors.brand.text,
    marginTop: spacing.md,
  },
  subtitle: {
    ...typography.body,
    color: colors.brand.textSecondary,
    marginTop: spacing.sm,
  },
  form: {
    gap: spacing.md,
  },
});
