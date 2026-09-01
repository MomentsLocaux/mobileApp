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
  Modal,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronDown, ImagePlus, Trash2, X } from 'lucide-react-native';
import { AppBackground, Button } from '@/components/ui';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import {
  bugReportPageLabel,
  isBugReportPageId,
  mobileBugReportPages,
  normalizeBugReportPage,
  type BugReportPageId,
} from '@/constants/bug-report-pages';
import { BugsService } from '@/services/bugs.service';
import { useAuth } from '@/hooks';
import { useAutoScrollOnFocus } from '@/hooks/useAutoScrollOnFocus';
import { useImagePicker, type ImageAsset } from '@/hooks/useImagePicker';

const CATEGORIES = ['bug', 'ux', 'suggestion'] as const;
const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

const CATEGORY_LABELS: Record<(typeof CATEGORIES)[number], string> = {
  bug: 'Bug',
  ux: 'Expérience',
  suggestion: 'Suggestion',
};

const SEVERITY_LABELS: Record<(typeof SEVERITIES)[number], string> = {
  low: 'Faible',
  medium: 'Moyenne',
  high: 'Élevée',
  critical: 'Critique',
};

const resolveInitialPage = (raw?: string): BugReportPageId | '' => {
  if (!raw || /bug-report/i.test(raw)) return '';
  const normalized = normalizeBugReportPage(raw);
  return mobileBugReportPages.some((option) => option.id === normalized) ? normalized : '';
};

export default function BugReportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ page?: string }>();
  const { profile, session } = useAuth();
  const insets = useSafeAreaInsets();
  const { scrollViewRef, registerFieldRef, handleInputFocus, handleScroll } = useAutoScrollOnFocus();
  const { pickImage, takePhoto } = useImagePicker();

  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('bug');
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>('medium');
  const [description, setDescription] = useState('');
  const [page, setPage] = useState<BugReportPageId | ''>(() =>
    resolveInitialPage(typeof params.page === 'string' ? params.page : undefined),
  );
  const [pagePickerOpen, setPagePickerOpen] = useState(false);
  const [attachment, setAttachment] = useState<ImageAsset | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPageLabel = useMemo(
    () => (page ? bugReportPageLabel(page) : 'Choisir l’écran concerné'),
    [page],
  );

  const validate = () => {
    if (!page || !isBugReportPageId(page)) {
      setError('Choisissez la page ou l’écran concerné.');
      return false;
    }
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

  const handlePickAttachment = () => {
    Alert.alert('Pièce jointe', 'Ajouter une capture comme évidence', [
      {
        text: 'Galerie',
        onPress: async () => {
          const asset = await pickImage({ allowsEditing: false });
          if (asset) setAttachment(asset);
        },
      },
      {
        text: 'Prendre une photo',
        onPress: async () => {
          const asset = await takePhoto({ allowsEditing: false });
          if (asset) setAttachment(asset);
        },
      },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const handleSubmit = async () => {
    if (!session) {
      setError('Connectez-vous pour envoyer un signalement.');
      return;
    }
    if (!validate()) return;
    setSubmitting(true);
    try {
      await BugsService.submit({
        category,
        severity,
        description: description.trim(),
        page,
        reporterId: profile?.id,
        attachment: attachment
          ? { uri: attachment.uri, mimeType: attachment.mimeType, fileName: attachment.fileName }
          : null,
      });
      Alert.alert('Merci !', 'Votre signalement a été envoyé.');
      setDescription('');
      setAttachment(null);
      router.back();
    } catch (err: any) {
      console.error('Bug report error', err);
      setError(err?.message || 'Impossible d’envoyer le bug.');
      Alert.alert('Erreur', err?.message || 'Impossible d’envoyer le bug.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderChips = (
    items: readonly string[],
    value: string,
    labels: Record<string, string>,
    onSelect: (val: any) => void,
  ) => (
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
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{labels[item] || item}</Text>
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
      <AppBackground />
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={() => router.replace('/(tabs)/map')}>
            <X size={20} color={colors.brand.text} />
          </TouchableOpacity>
        </View>
        <Text style={styles.title}>Reporter un bug</Text>
        <Text style={styles.subtitle}>
          Merci de décrire le problème rencontré. Les champs marqués sont obligatoires.
        </Text>

        {!session ? (
          <Text style={styles.authNotice}>
            Cette fonctionnalité est réservée aux comptes connectés. Connectez-vous depuis l&apos;écran de connexion pour
            envoyer un signalement.
          </Text>
        ) : null}

        <View style={[styles.formPanel, !session && styles.formPanelDisabled]}>
          <View style={styles.field}>
            <Text style={styles.label}>Catégorie *</Text>
            {renderChips(CATEGORIES, category, CATEGORY_LABELS, (val) => setCategory(val))}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Sévérité *</Text>
            {renderChips(SEVERITIES, severity, SEVERITY_LABELS, (val) => setSeverity(val))}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Page / écran *</Text>
            <TouchableOpacity
              style={styles.select}
              onPress={() => session && setPagePickerOpen(true)}
              disabled={!session}
              accessibilityRole="button"
              accessibilityLabel="Choisir la page concernée"
            >
              <Text style={[styles.selectText, !page && styles.selectPlaceholder]}>{selectedPageLabel}</Text>
              <ChevronDown size={18} color={colors.brand.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Décrivez le bug, les étapes pour le reproduire, l'attendu…"
              placeholderTextColor={colors.brand.textSecondary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              ref={registerFieldRef('description')}
              onFocus={() => handleInputFocus('description')}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Pièce jointe (optionnel)</Text>
            {attachment ? (
              <View style={styles.attachmentPreviewWrap}>
                <Image source={{ uri: attachment.uri }} style={styles.attachmentImage} />
                <TouchableOpacity
                  style={styles.attachmentRemove}
                  onPress={() => setAttachment(null)}
                  accessibilityLabel="Supprimer la pièce jointe"
                >
                  <Trash2 size={16} color={colors.error[500]} />
                  <Text style={styles.attachmentRemoveText}>Retirer</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.attachmentButton}
                onPress={handlePickAttachment}
                disabled={!session}
                accessibilityRole="button"
                accessibilityLabel="Ajouter une capture"
              >
                <ImagePlus size={18} color={colors.brand.secondary} />
                <Text style={styles.attachmentButtonText}>Ajouter une capture</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.attachmentHint}>Une photo ou capture d’écran pour illustrer le problème.</Text>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Button
            title="Envoyer"
            onPress={handleSubmit}
            loading={submitting}
            fullWidth
            disabled={submitting || !session}
          />
        </View>
      </ScrollView>

      <Modal visible={pagePickerOpen} transparent animationType="fade" onRequestClose={() => setPagePickerOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: spacing.md + insets.bottom }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Page / écran concerné</Text>
              <TouchableOpacity style={styles.closeButton} onPress={() => setPagePickerOpen(false)}>
                <X size={18} color={colors.brand.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              {mobileBugReportPages.map((option) => {
                const active = option.id === page;
                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[styles.modalOption, active && styles.modalOptionActive]}
                    onPress={() => {
                      setPage(option.id);
                      setPagePickerOpen(false);
                      if (error) setError(null);
                    }}
                  >
                    <Text style={[styles.modalOptionText, active && styles.modalOptionTextActive]}>{option.label}</Text>
                    {active ? <Check size={16} color={colors.brand.primary} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.brand.page,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
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
    backgroundColor: colors.brand.surface,
    borderWidth: 1,
    borderColor: 'rgba(26,51,41,0.12)',
  },
  title: {
    ...typography.h2,
    color: colors.brand.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.brand.textSecondary,
    marginBottom: spacing.md,
  },
  authNotice: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    marginBottom: spacing.sm,
  },
  formPanel: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.brand.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  formPanelDisabled: {
    opacity: 0.55,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    backgroundColor: colors.brand.surfaceMuted,
    ...typography.body,
    color: colors.brand.text,
  },
  textarea: {
    minHeight: 140,
  },
  select: {
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    backgroundColor: colors.brand.surfaceMuted,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  selectText: {
    ...typography.body,
    color: colors.brand.text,
    flex: 1,
  },
  selectPlaceholder: {
    color: colors.brand.textSecondary,
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
    backgroundColor: colors.brand.surfaceMuted,
    minWidth: 90,
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: colors.brand.secondary,
    borderColor: colors.brand.secondary,
  },
  chipText: {
    color: colors.brand.textSecondary,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.brand.primary,
  },
  attachmentButton: {
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    backgroundColor: colors.brand.surfaceMuted,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  attachmentButtonText: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '600',
  },
  attachmentHint: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
  attachmentPreviewWrap: {
    gap: spacing.sm,
  },
  attachmentImage: {
    width: '100%',
    height: 180,
    borderRadius: borderRadius.md,
    backgroundColor: colors.brand.surfaceMuted,
  },
  attachmentRemove: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
  },
  attachmentRemoveText: {
    ...typography.bodySmall,
    color: colors.error[500],
    fontWeight: '600',
  },
  error: {
    ...typography.bodySmall,
    color: colors.error[500],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(26,51,41,0.35)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '75%',
    backgroundColor: colors.brand.surface,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    padding: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.brand.text,
  },
  modalList: {
    maxHeight: 420,
  },
  modalOption: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  modalOptionActive: {
    backgroundColor: colors.brand.surfaceMuted,
  },
  modalOptionText: {
    ...typography.body,
    color: colors.brand.text,
    flex: 1,
  },
  modalOptionTextActive: {
    fontWeight: '700',
  },
});
