import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Platform, Linking, Alert } from 'react-native';
import type { EventWithCreator } from '../../types/database';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';

interface Props {
  visible: boolean;
  event: EventWithCreator | null;
  onClose: () => void;
}

const buildUrls = (lat: number, lon: number) => ({
  wazeApp: `waze://?ll=${lat},${lon}&navigate=yes`,
  wazeWeb: `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`,
  google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`,
  apple: `http://maps.apple.com/?daddr=${lat},${lon}`,
});

type NavigationUrlKey = keyof ReturnType<typeof buildUrls>;

async function tryOpenUrl(url: string) {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

async function openNavigation(urls: ReturnType<typeof buildUrls>, preference: 'waze' | 'google' | 'apple') {
  const order: NavigationUrlKey[] =
    Platform.OS === 'ios'
      ? preference === 'waze'
        ? ['wazeApp', 'wazeWeb', 'google', 'apple']
        : preference === 'apple'
          ? ['apple', 'google', 'wazeWeb']
          : ['google', 'wazeWeb', 'apple']
      : preference === 'waze'
        ? ['wazeApp', 'wazeWeb', 'google']
        : ['google', 'wazeWeb'];

  for (const key of order) {
    const url = urls[key];
    const opened = await tryOpenUrl(url);
    if (opened) {
      return;
    }
  }

  Alert.alert('Navigation', 'Aucune application de navigation disponible.');
}

export const NavigationOptionsSheet: React.FC<Props> = ({ visible, event, onClose }) => {
  const urls = useMemo(() => {
    if (!event) return null;
    const coordsArray =
      event.location && typeof event.location === 'object' && 'coordinates' in event.location
        ? event.location.coordinates
        : undefined;
    let lat: number | undefined;
    let lon: number | undefined;

    if (Array.isArray(coordsArray) && coordsArray.length === 2) {
      lon = Number(coordsArray[0]);
      lat = Number(coordsArray[1]);
    } else {
      lat = typeof event.latitude === 'number' ? event.latitude : undefined;
      lon = typeof event.longitude === 'number' ? event.longitude : undefined;
    }

    if (typeof lat !== 'number' || typeof lon !== 'number' || Number.isNaN(lat) || Number.isNaN(lon)) {
      return null;
    }

    return buildUrls(lat, lon);
  }, [event]);

  if (!event || !urls) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.title}>Choisir une application</Text>
        <TouchableOpacity
          style={styles.option}
          onPress={async () => {
            await openNavigation(urls, 'waze');
            onClose();
          }}
        >
          <Text style={styles.optionText}>Waze</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.option}
          onPress={async () => {
            await openNavigation(urls, 'google');
            onClose();
          }}
        >
          <Text style={styles.optionText}>Google Maps</Text>
        </TouchableOpacity>
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={styles.option}
            onPress={async () => {
              await openNavigation(urls, 'apple');
              onClose();
            }}
          >
            <Text style={styles.optionText}>Apple Plans</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[styles.option, styles.cancel]} onPress={onClose}>
          <Text style={[styles.optionText, styles.cancelText]}>Annuler</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#00000055',
  },
  sheet: {
    backgroundColor: colors.brand.surface,
    padding: spacing.lg,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
  },
  title: {
    ...typography.h4,
    color: colors.brand.text,
    marginBottom: spacing.md,
  },
  option: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  optionText: {
    ...typography.body,
    color: colors.brand.text,
  },
  cancel: {
    borderBottomWidth: 0,
    marginTop: spacing.sm,
  },
  cancelText: {
    color: colors.brand.error,
    textAlign: 'center',
  },
});
