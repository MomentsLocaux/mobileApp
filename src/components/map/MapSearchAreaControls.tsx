import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ZoomIn } from 'lucide-react-native';
import { BrandIcon } from '@/components/ui/BrandIcon';
import { borderRadius, colors, spacing } from '@/constants/theme';

type Props = {
  pending: boolean;
  loading: boolean;
  tooLarge: boolean;
  showWarning: boolean;
  onSearch: () => void;
  onTighten: () => void;
};

export function MapSearchAreaControls({
  pending, loading, tooLarge, showWarning, onSearch, onTighten,
}: Props) {
  if (!pending && !showWarning) return null;
  const disabled = loading || tooLarge;

  return (
    <View style={styles.slot} pointerEvents="box-none">
      {pending ? (
        <TouchableOpacity
          style={[styles.button, tooLarge && styles.disabled]}
          onPress={onSearch}
          disabled={disabled}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityState={{ disabled, busy: loading }}
          accessibilityLabel={loading ? 'Recherche en cours dans cette zone' : 'Rechercher dans cette zone'}
          accessibilityHint={tooLarge
            ? 'Zone trop large. Utilisez le bouton de rapprochement sous cette action.'
            : 'Les filtres quoi et quand sont conservés. La recherche par lieu est remplacée par la zone visible.'}
        >
          <View style={styles.icon}>
            {loading ? (
              <ActivityIndicator size="small" color={colors.brand.onAccent} />
            ) : (
              <BrandIcon name="search" size={20} color={colors.brand.onAccent} fillColor="transparent" />
            )}
          </View>
          <Text style={styles.label}>Rechercher dans cette zone</Text>
        </TouchableOpacity>
      ) : null}
      {showWarning ? (
        <TouchableOpacity
          style={styles.warning}
          onPress={onTighten}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLiveRegion="polite"
          accessibilityLabel="Zone trop large. Touchez pour vous rapprocher et afficher les événements."
        >
          <ZoomIn size={18} color={colors.brand.text} />
          <View style={styles.warningCopy}>
            <Text style={styles.warningTitle}>Zone trop large</Text>
            <Text style={styles.warningText}>
              Touchez pour vous rapprocher et afficher les événements.
            </Text>
          </View>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    zIndex: 27,
    alignItems: 'center',
    gap: spacing.sm,
  },
  button: {
    maxWidth: '100%',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.secondary,
    shadowColor: colors.brand.ink,
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 4,
  },
  disabled: { opacity: 0.55 },
  icon: {
    width: 20,
    height: 20,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flexShrink: 1,
    color: colors.brand.onAccent,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  warning: {
    alignSelf: 'stretch',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.warning[50],
    borderWidth: 1,
    borderColor: colors.warning[500],
  },
  warningCopy: { flex: 1 },
  warningTitle: { color: colors.brand.text, fontSize: 13, fontWeight: '800' },
  warningText: { color: colors.brand.textSecondary, fontSize: 12 },
});
