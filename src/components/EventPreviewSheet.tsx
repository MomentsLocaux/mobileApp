import React, { useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Linking,
} from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import { X, Navigation, Share2, MapPin } from 'lucide-react-native';
import type { EventWithCreator } from '../types/database';
import { colors, spacing, typography, borderRadius } from '../constants/theme';

interface EventPreviewSheetProps {
  event: EventWithCreator | null;
  onClose: () => void;
}

export function EventPreviewSheet({ event, onClose }: EventPreviewSheetProps) {
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['35%', '60%'], []);

  useEffect(() => {
    if (event) {
      sheetRef.current?.expand();
    } else {
      sheetRef.current?.close();
    }
  }, [event]);

  if (!event) return null;

  const openMaps = () => {
    const url = `http://maps.apple.com/?ll=${event.latitude},${event.longitude}`;
    Linking.openURL(url);
  };

  const shareEvent = () => {
    // TODO: integrate share API when available
  };

  return (
    <BottomSheet
      ref={sheetRef}
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onClose}
      handleIndicatorStyle={{ backgroundColor: colors.neutral[300] }}
      backgroundStyle={{ backgroundColor: colors.neutral[0], borderRadius: 24 }}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.handle} />
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X size={20} color={colors.neutral[600]} />
          </TouchableOpacity>
        </View>

        {event.cover_url ? (
          <Image source={{ uri: event.cover_url }} style={styles.cover} />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder]} />
        )}

        <View style={styles.body}>
          <Text style={styles.title}>{event.title}</Text>
          <View style={styles.addressRow}>
            <MapPin size={16} color={colors.neutral[500]} />
            <Text style={styles.address} numberOfLines={2}>
              {event.address || 'Adresse non renseignée'}
            </Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.button, styles.primary]} onPress={openMaps}>
              <Navigation size={18} color={colors.neutral[0]} />
              <Text style={styles.primaryText}>Y aller</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.secondary]} onPress={shareEvent}>
              <Share2 size={18} color={colors.primary[600]} />
              <Text style={styles.secondaryText}>Partager</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral[300],
  },
  closeBtn: {
    position: 'absolute',
    right: spacing.md,
    top: spacing.sm,
    padding: spacing.xs,
  },
  cover: {
    width: '100%',
    height: 160,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral[200],
  },
  coverPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    ...typography.h4,
    color: colors.neutral[900],
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  address: {
    ...typography.bodySmall,
    color: colors.neutral[600],
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  primary: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  primaryText: {
    ...typography.body,
    color: colors.neutral[0],
    fontWeight: '600',
  },
  secondary: {
    backgroundColor: colors.neutral[0],
    borderColor: colors.primary[600],
  },
  secondaryText: {
    ...typography.body,
    color: colors.primary[700],
    fontWeight: '600',
  },
});
