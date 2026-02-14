import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks';
import { AuthService } from '@/services/auth.service';
import { AuthLayout } from '@/components/ui/v2/templates/AuthLayout';
import { Input } from '@/components/ui/v2/atoms/Input';
import { Button } from '@/components/ui/v2/atoms/Button';
import { Typography } from '@/components/ui/v2/atoms/Typography';
import { Divider } from '@/components/ui/v2/molecules/Divider';
import { SocialButton } from '@/components/ui/v2/molecules/SocialButton';
import { colors, spacing } from '@/components/ui/v2/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, isLoading, session, profile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [hasSavedSession, setHasSavedSession] = useState<boolean>(false);
  const [showForm, setShowForm] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const emailEditedRef = useRef(false);

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};

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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleBiometric = async (): Promise<boolean> => {
    setBiometricLoading(true);
    const res = await AuthService.restoreSessionWithBiometrics();
    setBiometricLoading(false);
    if (!res.success) {
      setHasSavedSession(false);
      return false;
    }
    setShowForm(false);
    router.replace('/(tabs)/map');
    return true;
  };

  const handleLogin = async () => {
    if (!showForm) {
      if (hasSavedSession) {
        const success = await handleBiometric();
        if (success) return;
      }
      setShowForm(true);
      return;
    }

    if (!validate()) return;

    const response = await signIn(email, password);
    if (!response?.success) {
      Alert.alert('Erreur', response?.error || 'Email ou mot de passe incorrect');
      return;
    }

    router.replace('/(tabs)/map');
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      const saved = await AuthService.hasSavedSession();
      if (!mounted) return;
      setHasSavedSession(saved);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (emailEditedRef.current) return;
      if (email) return;

      const sessionEmail = session?.user?.email || profile?.email || null;
      if (sessionEmail) {
        if (!mounted) return;
        setEmail(sessionEmail.toLowerCase());
        return;
      }

      const lastEmail = await AuthService.getLastEmail();
      if (!mounted || !lastEmail) return;
      setEmail(lastEmail);
    })();

    return () => {
      mounted = false;
    };
  }, [session?.user?.email, profile?.email, email]);

  useEffect(() => {
    if (session) {
      router.replace('/(tabs)/map');
    }
  }, [session, router]);

  return (
    <AuthLayout
      title="Ravi de vous revoir"
      subtitle="Connectez-vous pour découvrir les pépites de votre ville."
      footer={(
        <View style={styles.footerWrap}>
          <View style={styles.inlineLinkRow}>
            <Typography variant="body" color={colors.textSecondary}>
              Pas encore de compte ?{' '}
            </Typography>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Créer un compte"
              accessibilityHint="Ouvre l'écran d'inscription"
              style={styles.inlineLinkPressable}
              onPress={() => router.push('/auth/register')}
            >
              <Typography variant="body" color={colors.textPrimary} weight="700">
                S'inscrire
              </Typography>
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continuer en tant qu'invité"
            accessibilityHint="Accéder à l'application sans compte"
            style={styles.linkButton}
            onPress={() => router.replace('/(tabs)/map')}
          >
            <Typography variant="body" color={colors.primary} weight="600" style={styles.underlined}>
              Continuer en tant qu'invité
            </Typography>
          </Pressable>
        </View>
      )}
    >
      <View style={styles.formBlock}>
        <Input
          label="Email"
          placeholder="votre@email.com"
          value={email}
          onChangeText={(value) => {
            emailEditedRef.current = true;
            setShowForm(true);
            setEmail(value);
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          autoCorrect={false}
          error={showForm ? errors.email : undefined}
        />

        <Input
          label="Mot de passe"
          placeholder="••••••••"
          value={password}
          onChangeText={(value) => {
            setShowForm(true);
            setPassword(value);
          }}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={handleLogin}
          error={showForm ? errors.password : undefined}
        />

        <View style={styles.forgotRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mot de passe oublié"
            accessibilityHint="Ouvre l'aide de récupération"
            style={styles.linkButton}
            onPress={() => Alert.alert('Information', 'Fonctionnalité bientôt disponible.')}
          >
            <Typography variant="body" color={colors.primary} weight="600">
              Mot de passe oublié ?
            </Typography>
          </Pressable>
        </View>

        <Button
          title="Se connecter"
          onPress={handleLogin}
          loading={isLoading || biometricLoading}
          disabled={isLoading || biometricLoading}
        />

        {!showForm && hasSavedSession ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Se connecter avec un autre compte"
            accessibilityHint="Affiche le formulaire email et mot de passe"
            style={styles.linkButton}
            onPress={() => setShowForm(true)}
          >
            <Typography variant="body" color={colors.primary} weight="600" style={styles.underlined}>
              Se connecter avec un autre compte
            </Typography>
          </Pressable>
        ) : null}
      </View>

      <Divider label="OU CONTINUER AVEC" />

      <View style={styles.socialBlock}>
        <SocialButton
          provider="Google"
          onPress={() => Alert.alert('Information', 'Connexion Google bientôt disponible.')}
        />
        <SocialButton
          provider="iOS"
          onPress={() => Alert.alert('Information', 'Connexion Apple bientôt disponible.')}
        />
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  formBlock: {
    gap: spacing.md,
  },
  forgotRow: {
    alignItems: 'flex-end',
  },
  socialBlock: {
    gap: spacing.sm,
  },
  footerWrap: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.lg,
  },
  inlineLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inlineLinkPressable: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  linkButton: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  underlined: {
    textDecorationLine: 'underline',
  },
});
