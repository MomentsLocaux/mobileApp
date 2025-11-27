import React, { useState, useEffect } from 'react';
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
import { Button, Input } from '../../components/ui';
import { useAuth } from '../../hooks';
import { colors, spacing, typography } from '../../constants/theme';
import { AuthService } from '@/services/auth.service';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, isLoading, session } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [hasSavedSession, setHasSavedSession] = useState<boolean>(false);
  const [showForm, setShowForm] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);

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
    // Premier clic : tenter biométrie si session sauvegardée, sinon afficher le formulaire
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
    if (session) {
      router.replace('/(tabs)/map');
    }
  }, [session, router]);

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
          <Text style={styles.title}>Bienvenue</Text>
          <Text style={styles.subtitle}>Accédez à vos moments en toute sécurité</Text>
        </View>

        <View style={styles.form}>
          {showForm ? (
            <>
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
                autoComplete="password"
                error={errors.password}
              />
            </>
          ) : null}

          <Button
            title="Se connecter"
            onPress={handleLogin}
            loading={isLoading || biometricLoading}
            fullWidth
            style={styles.loginButton}
          />

          {!showForm && (
            <TouchableOpacity
              onPress={() => {
                setShowForm(true);
                setHasSavedSession(false);
              }}
            >
              <Text style={styles.altLink}>Se connecter avec un autre compte</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Pas encore de compte ? </Text>
          <TouchableOpacity onPress={() => router.push('/auth/register')}>
            <Text style={styles.link}>S&apos;inscrire</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
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
    color: colors.neutral[900],
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.neutral[600],
  },
  form: {
    width: '100%',
    gap: spacing.sm,
  },
  loginButton: {
    marginTop: spacing.md,
  },
  altLink: {
    ...typography.bodySmall,
    color: colors.primary[600],
    fontWeight: '600',
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  footerText: {
    ...typography.body,
    color: colors.neutral[600],
  },
  link: {
    ...typography.body,
    color: colors.primary[600],
    fontWeight: '600',
  },
});
