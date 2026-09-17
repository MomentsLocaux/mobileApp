import React from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MapPin, Search } from 'lucide-react-native';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';

type CardProps = {
  displayName: string;
  avatarUrl?: string | null;
  locationLabel: string;
  caption?: string | null;
  followLabel: string;
  isFollowing: boolean;
  pending?: boolean;
  showFollow?: boolean;
  onPressProfile: () => void;
  onPressFollow: () => void;
};

export function CommunityMemberCard({
  displayName,
  avatarUrl,
  locationLabel,
  caption,
  followLabel,
  isFollowing,
  pending = false,
  showFollow = true,
  onPressProfile,
  onPressFollow,
}: CardProps) {
  const initial = (displayName || '?').slice(0, 1).toUpperCase();
  const meta = caption ? `${locationLabel} · ${caption}` : locationLabel;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPressProfile}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={`Profil de ${displayName}`}
    >
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarFallbackText}>{initial}</Text>
        </View>
      )}
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {displayName}
        </Text>
        <View style={styles.metaRow}>
          <MapPin size={12} color={colors.brand.textSecondary} />
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        </View>
      </View>
      {showFollow ? (
        <TouchableOpacity
          style={[styles.followBtn, isFollowing && styles.followingBtn]}
          disabled={pending}
          onPress={onPressFollow}
          accessibilityRole="button"
          accessibilityLabel={isFollowing ? 'Ne plus suivre' : followLabel}
          hitSlop={8}
        >
          {pending ? (
            <ActivityIndicator
              size="small"
              color={isFollowing ? colors.brand.secondary : colors.brand.onAccent}
            />
          ) : (
            <Text style={[styles.followText, isFollowing && styles.followingText]} numberOfLines={1}>
              {followLabel}
            </Text>
          )}
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
}

type SearchProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  accessibilityLabel: string;
};

export function CommunitySearchField({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
}: SearchProps) {
  return (
    <View style={styles.searchBox}>
      <Search size={16} color={colors.brand.textSecondary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.brand.textSecondary}
        style={styles.searchInput}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        accessibilityLabel={accessibilityLabel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.brand.surface,
    borderWidth: 1,
    borderColor: 'rgba(26, 51, 41, 0.08)',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.brand.surfaceMuted,
  },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124, 181, 24, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(124, 181, 24, 0.28)',
  },
  avatarFallbackText: {
    ...typography.h5,
    color: colors.brand.secondary,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  name: {
    ...typography.body,
    fontWeight: '700',
    color: colors.brand.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 0,
  },
  meta: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    flexShrink: 1,
  },
  followBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    minHeight: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followingBtn: {
    backgroundColor: colors.brand.surfaceMuted,
    borderWidth: 1,
    borderColor: 'rgba(26, 51, 41, 0.12)',
  },
  followText: {
    ...typography.bodySmall,
    color: colors.brand.onAccent,
    fontWeight: '800',
  },
  followingText: {
    color: colors.brand.text,
  },
  searchBox: {
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.surfaceMuted,
    borderWidth: 1.5,
    borderColor: colors.primary[200],
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.bodySmall,
    color: colors.brand.text,
    paddingVertical: 0,
  },
});
