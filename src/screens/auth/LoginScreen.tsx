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
  Image,
  ImageBackground,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks';
import { colors, spacing, typography } from '../../constants/theme';
import { AuthService } from '@/services/auth.service';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../../components/ui';
import { SocialLoginButtons } from '@/components/auth/SocialLoginButtons';
import type { SocialProvider } from '@/services/oauth.service';
import { useAuthStore } from '@/state/auth';

const { width, height } = Dimensions.get('window');

const INK = colors.brand.ink as string;
const MUTED = colors.brand.textSecondary as string;
const ACCENT = colors.brand.secondary as string;
const ON_ACCENT = colors.brand.onAccent as string;
const PAGE = colors.brand.page as string;

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, signInWithProvider, isLoading } = useAuth();
  const setSession = useAuthStore((state) => state.setSession);
  const setUser = useAuthStore((state) => state.setUser);
  const setProfile = useAuthStore((state) => state.setProfile);
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
    setSession(res.session ?? null);
    setUser(res.user ?? null);
    setProfile(res.profile ?? null);
    if (res.user && !res.profile) {
      void AuthService.getProfileForUser(res.user).then(setProfile).catch((profileError) => {
        console.error('Post-biometric profile hydration failed:', profileError);
      });
    }
    setShowForm(false);
    router.replace('/(tabs)' as any);
    return true;
  };

  const handleSocialLogin = async (provider: SocialProvider) => {
    const response = await signInWithProvider(provider);
    if (!response?.success) {
      Alert.alert('Erreur', response?.error || 'Connexion impossible');
      return;
    }
    router.replace('/(tabs)' as any);
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

    router.replace('/(tabs)' as any);
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

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('../../../assets/images/welcome-background.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <LinearGradient
          colors={[
            'rgba(244,251,246,0.35)',
            'rgba(244,251,246,0.55)',
            'rgba(26,51,41,0.42)',
            'rgba(26,51,41,0.78)',
          ]}
          locations={[0, 0.35, 0.7, 1]}
          style={styles.gradient}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardView}
          >
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.contentContainer}>
                <View style={styles.logoContainer}>
                  <Image
                    source={require('../../../assets/images/icon.png')}
                    style={styles.appIcon}
                    accessibilityLabel="Logo Moments Locaux"
                  />
                  <Text style={styles.appName}>Moments Locaux</Text>
                  <Text style={styles.tagline}>Vivez l'instant présent</Text>
                </View>

                <View style={styles.formContainer}>
                  {showForm ? (
                    <View style={styles.inputsWrapper}>
                      <View style={styles.inputContainer}>
                        <Ionicons name="mail-outline" size={20} color={MUTED} style={styles.inputIcon} />
                        <Input
                          placeholder="Email"
                          value={email}
                          onChangeText={setEmail}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoComplete="email"
                          error={errors.email}
                          containerStyle={styles.inputFieldContainer}
                          style={styles.input}
                          placeholderTextColor="rgba(26,51,41,0.45)"
                        />
                      </View>

                      <View style={styles.inputContainer}>
                        <Ionicons name="lock-closed-outline" size={20} color={MUTED} style={styles.inputIcon} />
                        <Input
                          placeholder="Mot de passe"
                          value={password}
                          onChangeText={setPassword}
                          secureTextEntry
                          showPasswordToggle
                          toggleIconColor={MUTED}
                          autoComplete="password"
                          error={errors.password}
                          containerStyle={styles.inputFieldContainer}
                          style={styles.input}
                          placeholderTextColor="rgba(26,51,41,0.45)"
                        />
                      </View>

                      <TouchableOpacity
                        onPress={() => router.push('/auth/forgot-password')}
                        style={styles.forgotButton}
                      >
                        <Text style={styles.forgotButtonText}>Mot de passe oublié ?</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleLogin}
                    disabled={isLoading || biometricLoading}
                  >
                    {isLoading || biometricLoading ? (
                      <Text style={styles.primaryButtonText}>Chargement...</Text>
                    ) : (
                      <Text style={styles.primaryButtonText}>
                        {showForm ? 'Se connecter' : (hasSavedSession ? 'Connexion biométrique' : 'Se connecter avec un email')}
                      </Text>
                    )}
                  </TouchableOpacity>

                  {!showForm && hasSavedSession && (
                    <TouchableOpacity
                      onPress={() => setShowForm(true)}
                      style={styles.secondaryButton}
                    >
                      <Text style={styles.secondaryButtonText}>Utiliser un mot de passe</Text>
                    </TouchableOpacity>
                  )}

                  <SocialLoginButtons
                    onProviderPress={handleSocialLogin}
                    disabled={isLoading || biometricLoading}
                    variant="light"
                  />

                  <TouchableOpacity
                    onPress={() => router.replace('/(tabs)/map')}
                    style={styles.guestButton}
                  >
                    <Text style={styles.guestButtonText}>Continuer en invité</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.footer}>
                  <Text style={styles.footerText}>Pas encore de compte ?</Text>
                  <TouchableOpacity onPress={() => router.push('/auth/register')}>
                    <Text style={styles.linkText}>Créer un compte</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAGE,
  },
  backgroundImage: {
    flex: 1,
    width: width,
    height: height,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: spacing.xl,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: spacing.xl * 2,
  },
  appIcon: {
    width: 80,
    height: 80,
    borderRadius: 18,
    marginBottom: spacing.md,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  appName: {
    ...typography.h1,
    color: INK,
    fontSize: 32,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  tagline: {
    ...typography.body,
    color: MUTED,
    fontSize: 16,
  },
  formContainer: {
    width: '100%',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  inputsWrapper: {
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(26,51,41,0.12)',
    paddingHorizontal: spacing.md,
  },
  inputIcon: {
    marginRight: spacing.xs,
  },
  inputFieldContainer: {
    flex: 1,
    marginBottom: 0,
  },
  input: {
    color: INK,
    borderWidth: 0,
    backgroundColor: 'transparent',
    height: 50,
  },
  forgotButton: {
    alignSelf: 'flex-end',
    paddingVertical: spacing.xs,
  },
  forgotButtonText: {
    color: INK,
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  primaryButton: {
    backgroundColor: ACCENT,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: INK,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryButtonText: {
    color: ON_ACCENT,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  secondaryButtonText: {
    color: INK,
    fontSize: 16,
    fontWeight: '600',
  },
  guestButton: {
    marginTop: spacing.xs,
    alignItems: 'center',
  },
  guestButtonText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
    gap: spacing.xs,
  },
  footerText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
  },
  linkText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
