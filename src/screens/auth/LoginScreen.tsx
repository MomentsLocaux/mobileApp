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
import { Input, Button } from '../../components/ui';
import { SocialLoginButtons } from '@/components/auth/SocialLoginButtons';
import type { SocialProvider } from '@/services/oauth.service';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, signInWithProvider, isLoading, session } = useAuth();
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

  const handleSocialLogin = async (provider: SocialProvider) => {
    const response = await signInWithProvider(provider);
    if (!response?.success) {
      Alert.alert('Erreur', response?.error || 'Connexion impossible');
      return;
    }
    router.replace('/(tabs)/map');
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
    <View style={styles.container}>
      <ImageBackground
        source={require('../../../assets/images/welcome-background.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['rgba(15,23,25,0.25)', 'rgba(15,23,25,0.55)', 'rgba(15,23,25,0.92)']}
          locations={[0, 0.45, 1]}
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
                        <Ionicons name="mail-outline" size={20} color="rgba(255,255,255,0.6)" style={styles.inputIcon} />
                        <Input
                          placeholder="Email"
                          value={email}
                          onChangeText={setEmail}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoComplete="email"
                          error={errors.email}
                          style={styles.input}
                          placeholderTextColor="rgba(255,255,255,0.5)"
                        />
                      </View>

                      <View style={styles.inputContainer}>
                        <Ionicons name="lock-closed-outline" size={20} color="rgba(255,255,255,0.6)" style={styles.inputIcon} />
                        <Input
                          placeholder="Mot de passe"
                          value={password}
                          onChangeText={setPassword}
                          secureTextEntry
                          autoComplete="password"
                          error={errors.password}
                          style={styles.input}
                          placeholderTextColor="rgba(255,255,255,0.5)"
                        />
                      </View>
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
    backgroundColor: '#000',
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
    shadowColor: '#2bbfe3',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 6,
  },
  appName: {
    ...typography.h1,
    color: '#fff',
    fontSize: 32,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  tagline: {
    ...typography.body,
    color: 'rgba(255,255,255,0.8)',
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
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
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
    color: '#fff',
    borderWidth: 0,
    backgroundColor: 'transparent',
    height: 50,
  },
  primaryButton: {
    backgroundColor: '#fff',
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  primaryButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  guestButton: {
    marginTop: spacing.xs,
    alignItems: 'center',
  },
  guestButtonText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
    gap: spacing.xs,
  },
  footerText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  linkText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
