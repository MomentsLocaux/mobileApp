import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { colors, typography, spacing, borderRadius } from '@/constants/theme';
import { CoverGenerateStep } from '@/components/events/CoverGenerateStep';
import { useCreateEventStore } from '@/hooks/useCreateEventStore';
import { useAuth } from '@/hooks';
import { GuestGateModal } from '@/components/auth/GuestGateModal';
import { RequireCreateAccess } from '@/components/identity/RequireCreateAccess';

function CreateEventCoverInner() {
  const router = useRouter();
  const { session } = useAuth();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const coverImage = useCreateEventStore((s) => s.coverImage);
  const insets = useSafeAreaInsets();
  const isGuest = !session;

  if (isGuest) {
    return (
      <SafeAreaView style={styles.safe}>
        <GuestGateModal
          visible
          title="Créer un événement"
          onClose={() => router.replace('/(tabs)/map')}
          onSignUp={() => router.replace('/auth/register' as any)}
          onSignIn={() => router.replace('/auth/login' as any)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
            <ChevronLeft size={20} color={colors.brand.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Couverture</Text>
            <Text style={styles.headerSubtitle}>Étape 3 sur 4</Text>
          </View>
          <View style={styles.headerBtn} />
        </View>

        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: '75%' }]} />
        </View>

        <View style={styles.body}>
          <CoverGenerateStep />
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.prevBtn} onPress={() => router.back()}>
            <Text style={styles.prevText}>Précédent</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.nextBtn, !coverImage && styles.nextBtnDisabled]}
            disabled={!coverImage}
            onPress={() => {
              if (!coverImage) {
                Alert.alert('Couverture requise', 'Ajoute une photo ou génère une couverture pour continuer.');
                return;
              }
              router.push({
                pathname: '/events/create/preview',
                params: edit ? { edit } : {},
              } as any);
            }}
          >
            <Text style={styles.nextText}>Continuer</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function CreateEventCover() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  return (
    <RequireCreateAccess allowIfCanCreate={Boolean(edit)}>
      <CreateEventCoverInner />
    </RequireCreateAccess>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.brand.page,
  },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  headerBtn: {
    padding: spacing.sm,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.h5,
    color: colors.brand.text,
    fontWeight: '700',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: 'rgba(26, 51, 41, 0.12)',
    width: '100%',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.brand.secondary,
  },
  body: {
    flex: 1,
  },
  footer: {
    padding: spacing.md,
    backgroundColor: colors.brand.page,
    borderTopWidth: 1,
    borderTopColor: 'rgba(26, 51, 41, 0.08)',
    flexDirection: 'row',
    gap: spacing.md,
  },
  prevBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(26, 51, 41, 0.16)',
  },
  prevText: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '600',
  },
  nextBtn: {
    flex: 1,
    backgroundColor: colors.brand.secondary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    alignItems: 'center',
  },
  nextBtnDisabled: {
    opacity: 0.45,
  },
  nextText: {
    ...typography.body,
    color: colors.brand.onAccent,
    fontWeight: '700',
  },
});
