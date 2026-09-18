import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Camera } from 'lucide-react-native';
import {
  AVATAR_PRESETS,
  encodePresetAvatarUrl,
  isPresetAvatarUrl,
  isRemoteAvatarUrl,
} from '@/constants/avatar-presets';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import { haptics } from '@/utils/haptics';
import { UserAvatar } from '@/components/ui/UserAvatar';

const COLS = 4;

type Props = {
  selectedUrl: string | null;
  onSelectPreset: (url: string) => void;
  onPressPhoto: () => void;
  photoBusy?: boolean;
};

export function AvatarPresetPicker({ selectedUrl, onSelectPreset, onPressPhoto, photoBusy = false }: Props) {
  const [gridWidth, setGridWidth] = useState(0);
  const gap = spacing.sm;
  const cell = gridWidth > 0 ? Math.floor((gridWidth - gap * (COLS - 1)) / COLS) : 72;
  const photoSelected = isRemoteAvatarUrl(selectedUrl);

  return (
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
            accessibilityRole="button"
            accessibilityLabel={preset.label}
            accessibilityState={{ selected }}
          >
            <UserAvatar uri={url} size={cell - 8} name={preset.label} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
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
