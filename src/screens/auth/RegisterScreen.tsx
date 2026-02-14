import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Input, colors, spacing, typography } from '@/components/ui/v2';
import { AuthLayout } from '@/components/ui/v2/templates/AuthLayout';
import { useAuth } from '@/hooks';

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const validate = () => {
    const newErrors: {
      email?: string;
      password?: string;
      confirmPassword?: string;
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
    <AuthLayout
      title="Créer un compte"
      subtitle="Rejoignez la communauté Moments Locaux"
      contentContainerStyle={styles.content}
    >
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

        <Button
          title="S'inscrire"
          onPress={handleRegister}
          loading={isLoading}
          fullWidth
          style={styles.registerButton}
          accessibilityRole="button"
        />

        <View style={styles.footer}>
          <Text style={styles.footerText}>Déjà un compte ? </Text>
          <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
            <Text style={styles.link}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: 'center',
  },
  form: {
    gap: spacing.md,
    width: '100%',
  },
  registerButton: {
    marginTop: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  footerText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  link: {
    ...typography.bodyStrong,
    color: colors.primary,
    fontWeight: '700',
  },
});
