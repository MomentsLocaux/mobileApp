import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { AnimatedBrandMark } from '@/components/ui/AnimatedBrandMark';
import { colors, spacing, typography } from '@/constants/theme';

// In-memory only: survives navigation/remounts; a fresh JS runtime is a new launch.
let signatureClaimed = false;

export function HomeBrandSignature() {
  const focused = useIsFocused();
  const [playSignature] = useState(() => !signatureClaimed);

  useEffect(() => {
    if (focused && playSignature) signatureClaimed = true;
  }, [focused, playSignature]);

  return (
    <View style={styles.row} accessible accessibilityLabel="Moments Locaux" pointerEvents="none">
      <AnimatedBrandMark size={36} variant={playSignature ? 'signature' : 'static'} active={focused} />
      <Text style={styles.name}>Moments Locaux</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingBottom: spacing.xs },
  name: { ...typography.h6, color: colors.brand.text, flexShrink: 1 },
});
