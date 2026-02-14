import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { AppBackground, Button, Card, Input, colors, radius, spacing, typography } from '@/components/ui/v2';
import { useAuth } from '@/hooks';
import { useAutoScrollOnFocus } from '@/hooks/useAutoScrollOnFocus';
import { BugsService } from '@/services/bugs.service';

const CATEGORIES = ['bug', 'ux', 'suggestion'] as const;
const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

export default function BugReportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ page?: string }>();
  const pathname = usePathname();
  const { profile, session } = useAuth();
  const insets = useSafeAreaInsets();
  const { scrollViewRef, registerFieldRef, handleInputFocus, handleScroll } = useAutoScrollOnFocus();

  const defaultPage = useMemo(
    () => (typeof params.page === 'string' && params.page ? params.page : pathname || ''),
    [params.page, pathname]
  );

  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('bug');
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>('medium');
  const [description, setDescription] = useState('');
  const [page, setPage] = useState(defaultPage);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = () => {
    if (!description.trim()) {
      setError('La description est obligatoire.');
      return false;
    }
    if (!CATEGORIES.includes(category)) {
      setError('Catégorie invalide.');
      return false;
    }
    if (!SEVERITIES.includes(severity)) {
      setError('Sévérité invalide.');
      return false;
    }
    setError(null);
    return true;
  };

  const handleSubmit = async () => {
    if (!session) {
      router.push('/auth/login' as any);
      return;
    }
    if (!validate()) return;
    setSubmitting(true);
    try {
      await BugsService.submit({
        category,
        severity,
        description: description.trim(),
        page: page || defaultPage || pathname || undefined,
        reporterId: profile?.id,
      });
      Alert.alert('Merci !', 'Votre signalement a été envoyé.');
      setDescription('');
      router.back();
    } catch (err: any) {
      console.error('Bug report error', err);
      setError(err?.message || 'Impossible d’envoyer le bug.');
      Alert.alert('Erreur', err?.message || 'Impossible d’envoyer le bug.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderChips = (items: readonly string[], value: string, onSelect: (val: any) => void) => (
    <View style={styles.chipsRow}>
      {items.map((item) => {
        const active = item === value;
        return (
          <TouchableOpacity
            key={item}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onSelect(item)}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{item}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <View style={styles.container}>
      <AppBackground opacity={0.2} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
          onScroll={handleScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => router.replace('/(tabs)/map')}
              accessibilityRole="button"
            >
              <X size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>Reporter un bug</Text>
          <Text style={styles.subtitle}>
            Merci de décrire le problème rencontré. Les champs marqués sont obligatoires.
          </Text>

          <Card style={styles.card}>
            <View style={styles.field}>
              <Text style={styles.label}>Catégorie *</Text>
              {renderChips(CATEGORIES, category, (val) => setCategory(val))}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Sévérité *</Text>
              {renderChips(SEVERITIES, severity, (val) => setSeverity(val))}
            </View>

            <Input
              label="Page/écran"
              placeholder="Ex: /home ou event-detail/123"
              value={page}
              onChangeText={setPage}
              autoCapitalize="none"
              ref={registerFieldRef('page')}
              onFocus={() => handleInputFocus('page')}
            />

            <Input
              label="Description *"
              placeholder="Décrivez le bug, les étapes pour le reproduire, l'attendu..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={5}
              style={styles.descriptionInput}
              ref={registerFieldRef('description')}
              onFocus={() => handleInputFocus('description')}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Button
              title="Envoyer"
              onPress={handleSubmit}
              loading={submitting}
              fullWidth
              disabled={submitting}
              accessibilityRole="button"
            />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.xs,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceLevel1,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  title: {
    ...typography.sectionTitle,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  card: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  descriptionInput: {
    minHeight: 140,
    borderRadius: radius.element,
    textAlignVertical: 'top',
    paddingTop: spacing.md,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surfaceLevel1,
    minWidth: 90,
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: 'rgba(43, 191, 227, 0.16)',
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textSecondary,
    textTransform: 'capitalize',
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.primary,
  },
  error: {
    ...typography.body,
    color: colors.danger,
  },
});
