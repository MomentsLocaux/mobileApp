import React, { useState } from 'react';
import { ActivityIndicator, Keyboard, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Camera, ChevronRight, SlidersHorizontal } from 'lucide-react-native';
import {
  AVATAR_PRESETS,
  encodePresetAvatarUrl,
  getIllustratedAvatar,
  isPresetAvatarUrl,
  isRemoteAvatarUrl,
} from '@/constants/avatar-presets';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import { haptics } from '@/utils/haptics';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { AvatarEditorModal } from './AvatarEditorModal';

const COLS = 4;

type Props = {
  selectedUrl: string | null;
  onSelectPreset: (url: string) => void;
  onPressPhoto: () => void;
  photoBusy?: boolean;
};

export function AvatarPresetPicker({ selectedUrl, onSelectPreset, onPressPhoto, photoBusy = false }: Props) {
  const [gridWidth, setGridWidth] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const gap = spacing.sm;
  const cell = gridWidth > 0 ? Math.floor((gridWidth - gap * (COLS - 1)) / COLS) : 72;
  const photoSelected = isRemoteAvatarUrl(selectedUrl);
  const illustrated = getIllustratedAvatar(selectedUrl);
  const customSelected = !!illustrated && !isPresetAvatarUrl(selectedUrl);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.customize, customSelected && styles.customizeSelected]}
        onPress={() => { Keyboard.dismiss(); haptics.selection(); setEditorOpen(true); }}
        disabled={photoBusy}
        accessibilityRole="button"
        accessibilityLabel={customSelected ? 'Modifier mon avatar personnalisé' : 'Créer ou personnaliser mon avatar'}
        accessibilityState={{ disabled: photoBusy }}
      >
        {illustrated ? <UserAvatar uri={selectedUrl} size={52} /> : (
          <View style={styles.customizeIcon}><SlidersHorizontal size={24} color={colors.brand.text} /></View>
        )}
        <View style={styles.customizeCopy}>
          <Text style={styles.customizeTitle}>{customSelected ? 'Modifier mon avatar' : illustrated ? 'Personnaliser ce portrait' : 'Créer mon avatar'}</Text>
          <Text style={styles.customizeHint}>Visage, coiffure, couleurs… à votre image.</Text>
        </View>
        <ChevronRight size={20} color={colors.brand.text} />
      </TouchableOpacity>
      <View
        style={styles.grid}
        onLayout={(event) => {
          const next = Math.round(event.nativeEvent.layout.width);
          if (next > 0 && next !== gridWidth) setGridWidth(next);
        }}
      >
        <TouchableOpacity
          style={[styles.cell, { width: cell, height: cell }, photoSelected && styles.cellSelected]}
          onPress={onPressPhoto}
          disabled={photoBusy}
          accessibilityRole="button"
          accessibilityLabel="Choisir une photo de profil"
          accessibilityState={{ selected: photoSelected, busy: photoBusy }}
        >
          {photoBusy ? (
            <ActivityIndicator color={colors.brand.secondary} />
          ) : photoSelected && selectedUrl ? (
            <UserAvatar uri={selectedUrl} size={cell - 8} fallback="empty" />
          ) : (
            <View style={styles.photoFallback}>
              <Camera size={22} color={colors.brand.secondary} />
              <Text style={styles.photoLabel}>Photo</Text>
            </View>
          )}
        </TouchableOpacity>

        {AVATAR_PRESETS.map((preset) => {
          const url = encodePresetAvatarUrl(preset.id);
          const selected = isPresetAvatarUrl(selectedUrl) && selectedUrl === url;
          return (
            <TouchableOpacity
              key={preset.id}
              style={[styles.cell, { width: cell, height: cell }, selected && styles.cellSelected]}
              onPress={() => {
                haptics.selection();
                onSelectPreset(url);
              }}
              disabled={photoBusy}
              accessibilityRole="button"
              accessibilityLabel={preset.label}
              accessibilityState={{ selected, disabled: photoBusy }}
            >
              <UserAvatar uri={url} size={cell - 8} name={preset.label} />
            </TouchableOpacity>
          );
        })}
      </View>
      {editorOpen && (
        <AvatarEditorModal
          initialUrl={selectedUrl}
          onClose={() => setEditorOpen(false)}
          onApply={(url) => { onSelectPreset(url); setEditorOpen(false); }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  customize: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: borderRadius.lg, backgroundColor: colors.brand.surfaceMuted, borderWidth: 2, borderColor: 'transparent' },
  customizeSelected: { borderColor: colors.brand.secondary },
  customizeIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand.surface },
  customizeCopy: { flex: 1 },
  customizeTitle: { ...typography.bodySmall, fontWeight: '700', color: colors.brand.text },
  customizeHint: { ...typography.caption, color: colors.brand.textSecondary, marginTop: 4 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'flex-start',
  },
  cell: {
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.brand.surfaceMuted,
  },
  cellSelected: {
    borderColor: colors.brand.secondary,
  },
  photoFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  photoLabel: {
    ...typography.caption,
    color: colors.brand.text,
    fontWeight: '700',
  },
});
