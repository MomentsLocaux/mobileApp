import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';

type Props = {
  price?: string;
  duration?: string;
  contact?: string;
  externalLink?: string;
  onInputFocus?: (key: string) => void;
  onInputLayout?: (key: string) => (event: LayoutChangeEvent) => void;
  onChange: (data: { price?: string; duration?: string; contact?: string; externalLink?: string }) => void;
};

export const OptionalInfoSection = ({
  price,
  duration,
  contact,
  externalLink,
  onInputFocus,
  onInputLayout,
  onChange,
}: Props) => {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.header} onPress={() => setOpen((v) => !v)}>
        <Text style={styles.title}>Infos pratiques (facultatif)</Text>
        {open ? <ChevronUp size={18} color={colors.neutral[700]} /> : <ChevronDown size={18} color={colors.neutral[700]} />}
      </TouchableOpacity>
      {open && (
        <View style={styles.fields}>
          <Text style={styles.label}>Prix</Text>
          <TextInput
            style={styles.input}
            placeholder="Gratuit, 5€..."
            value={price}
            onChangeText={(text) => onChange({ price: text })}
            onLayout={onInputLayout?.('price')}
            onFocus={() => onInputFocus?.('price')}
          />

          <Text style={styles.label}>Durée estimée</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: 2h"
            value={duration}
            onChangeText={(text) => onChange({ duration: text })}
            onLayout={onInputLayout?.('duration')}
            onFocus={() => onInputFocus?.('duration')}
          />

          <Text style={styles.label}>Contact</Text>
          <TextInput
            style={styles.input}
            placeholder="Email ou téléphone"
            value={contact}
            onChangeText={(text) => onChange({ contact: text })}
            autoCapitalize="none"
            onLayout={onInputLayout?.('contact')}
            onFocus={() => onInputFocus?.('contact')}
          />

          <Text style={styles.label}>Lien externe</Text>
          <TextInput
            style={styles.input}
            placeholder="Site web, réseau social"
            value={externalLink}
            onChangeText={(text) => onChange({ externalLink: text })}
            autoCapitalize="none"
            onLayout={onInputLayout?.('externalLink')}
            onFocus={() => onInputFocus?.('externalLink')}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.neutral[0],
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  title: {
    ...typography.body,
    color: colors.neutral[900],
    fontWeight: '700',
  },
  fields: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  label: {
    ...typography.bodySmall,
    color: colors.neutral[700],
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    backgroundColor: colors.neutral[0],
  },
});
