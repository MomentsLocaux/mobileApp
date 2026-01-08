import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { Button, Card } from '@/components/ui';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { BugsService } from '@/services/bugs.service';
import { useAuth } from '@/hooks';
import { useAutoScrollOnFocus } from '@/hooks/useAutoScrollOnFocus';

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
    [params.page, pathname],
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
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{item}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.top}
    >
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={() => router.replace('/(tabs)/map')}>
            <X size={20} color={colors.neutral[700]} />
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

        <View style={styles.field}>
          <Text style={styles.label}>Page/écran</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: /home ou event-detail/123"
            value={page}
            onChangeText={setPage}
            autoCapitalize="none"
            ref={registerFieldRef('page')}
            onFocus={() => handleInputFocus('page')}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Description *</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Décrivez le bug, les étapes pour le reproduire, l'attendu…"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            ref={registerFieldRef('description')}
            onFocus={() => handleInputFocus('description')}
          />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <Button
          title="Envoyer"
          onPress={handleSubmit}
          loading={submitting}
          fullWidth
          disabled={submitting}
        />
      </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.md,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  title: {
    ...typography.h2,
    color: colors.neutral[900],
  },
  subtitle: {
    ...typography.body,
    color: colors.neutral[600],
    marginBottom: spacing.md,
  },
  card: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    ...typography.bodySmall,
    color: colors.neutral[700],
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    backgroundColor: colors.neutral[0],
    ...typography.body,
    color: colors.neutral[900],
  },
  textarea: {
    minHeight: 140,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.neutral[0],
    minWidth: 90,
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[300],
  },
  chipText: {
    color: colors.neutral[800],
    textTransform: 'capitalize',
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.primary[700],
  },
  error: {
    ...typography.bodySmall,
    color: colors.error[600],
  },
});
