import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { AppBackground, Button, Input, ScreenHeader } from '@/components/ui';
import { AuthService } from '@/services/auth.service';
import { completeAuthRedirectFromUrl } from '@/services/oauth.service';
import { useAuthStore } from '@/state/auth';
import { colors, spacing, typography } from '@/constants/theme';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string | string[]; type?: string | string[] }>();
  const linkedUrl = Linking.useLinkingURL();
  const { setSession, setUser, setProfile } = useAuthStore();
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [loading, setLoading] = useState(false);
  const attemptedToken = useRef<string | null>(null);

  const acceptRecoveryUrl = useCallback(async (url: string | null) => {
    if (!url) return 'skip' as const;
    if (!url.includes('code=') && !url.includes('access_token=')) return 'skip' as const;

    try {
      const { session } = await completeAuthRedirectFromUrl(url);
      setSession(session);
      setUser(session.user);
      setLinkError(null);
      setReady(true);
      return 'ok' as const;
    } catch (error) {
      setLinkError(error instanceof Error ? error.message : 'Lien invalide ou expiré');
      setReady(false);
      return 'error' as const;
    }
  }, [setSession, setUser]);

  useEffect(() => {
    let mounted = true;
    const code = firstParam(params.code);
    const type = firstParam(params.type);
    const fromParams = code
      ? `moments-locaux://auth/reset-password?code=${encodeURIComponent(code)}${type ? `&type=${encodeURIComponent(type)}` : ''}`
      : null;
    const token = code || (linkedUrl && (linkedUrl.includes('code=') || linkedUrl.includes('access_token=')) ? linkedUrl : null);
    if (token && attemptedToken.current === token) return;
    if (token) attemptedToken.current = token;

    (async () => {
      const fromRoute = await acceptRecoveryUrl(fromParams);
      if (!mounted || fromRoute === 'ok' || fromRoute === 'error') return;
      const fromLink = await acceptRecoveryUrl(linkedUrl);
      if (!mounted || fromLink === 'ok' || fromLink === 'error') return;

      const existing = await AuthService.getCurrentSession();
      if (!mounted) return;
      if (existing?.user) {
        setSession(existing);
        setUser(existing.user);
        setReady(true);
        return;
      }

      setLinkError('Ce lien n’a pas ouvert de session. Redemandez-le depuis ce téléphone, puis ouvrez-le dans l’app.');
      setReady(false);
    })();

    return () => {
      mounted = false;
    };
  }, [acceptRecoveryUrl, linkedUrl, params.code, params.type, setSession, setUser]);

  const validate = () => {
    const next: { password?: string; confirmPassword?: string } = {};
    if (!password) {
      next.password = 'Mot de passe requis';
    } else if (password.length < 6) {
      next.password = 'Minimum 6 caractères';
    }
    if (password !== confirmPassword) {
      next.confirmPassword = 'Les mots de passe ne correspondent pas';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    const response = await AuthService.updatePassword(password);
    setLoading(false);

    if (!response.success) {
      Alert.alert('Erreur', response.error || 'Impossible de mettre à jour le mot de passe');
      return;
    }

    if (response.user) {
      const profile =
        (await AuthService.getCurrentProfile()) ||
        (await AuthService.ensureProfile(response.user.id, response.user.email || ''));
      setProfile(profile);
      setSession(response.session ?? null);
      setUser(response.user);
    }

    Alert.alert('Mot de passe mis à jour', 'Vous pouvez continuer dans l’application.', [
      { text: 'OK', onPress: () => router.replace('/(tabs)' as any) },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppBackground />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <ScreenHeader title="" onBack={() => router.replace('/auth/login')} />
          <Text style={styles.title}>Nouveau mot de passe</Text>
          <Text style={styles.subtitle}>Choisissez un mot de passe sécurisé pour votre compte.</Text>
        </View>

        {!ready && !linkError ? (
          <ActivityIndicator color={colors.brand.secondary} style={styles.loader} />
        ) : null}

        {linkError && !ready ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{linkError}</Text>
            <Button title="Demander un nouveau lien" onPress={() => router.replace('/auth/forgot-password')} />
            <Button title="Retour à la connexion" variant="secondary" onPress={() => router.replace('/auth/login')} />
          </View>
        ) : null}

        {ready ? (
          <View style={styles.form}>
            <Input
              label="Nouveau mot de passe"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              showPasswordToggle
              autoComplete="password-new"
              error={errors.password}
            />
            <Input
              label="Confirmer le mot de passe"
              placeholder="••••••••"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              showPasswordToggle
              autoComplete="password-new"
              error={errors.confirmPassword}
            />
            <Button title="Enregistrer" onPress={handleSubmit} loading={loading} />
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.brand.page,
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
  loader: {
    marginTop: spacing.xl,
  },
  errorBox: {
    gap: spacing.md,
  },
  errorText: {
    ...typography.body,
    color: colors.brand.error,
  },
});
