import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';

type Props = {
  price?: string;
  duration?: string;
  contact?: string;
  externalLink?: string;
  onInputFocus?: (key: string) => void;
  onInputRef?: (key: string) => (node: any) => void;
  onOpen?: () => void;
  onChange: (data: { price?: string; duration?: string; contact?: string; externalLink?: string }) => void;
};

export const OptionalInfoSection = ({
  price,
  duration,
  contact,
  externalLink,
  onInputFocus,
  onInputRef,
  onOpen,
  onChange,
}: Props) => {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() =>
          setOpen((v) => {
            const next = !v;
            if (next) onOpen?.();
            return next;
          })
        }
      >
        <Text style={styles.title}>Infos pratiques (facultatif)</Text>
        {open ? <ChevronUp size={18} color={colors.brand.textSecondary} /> : <ChevronDown size={18} color={colors.brand.textSecondary} />}
      </TouchableOpacity>
      {open && (
        <View style={styles.fields}>
          <Text style={styles.label}>Prix</Text>
          <TextInput
            style={styles.input}
            placeholder="Gratuit, 5€..."
            value={price}
            onChangeText={(text) => onChange({ price: text })}
            ref={onInputRef?.('price')}
            onFocus={() => onInputFocus?.('price')}
          />

          <Text style={styles.label}>Durée estimée</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: 2h"
            value={duration}
            onChangeText={(text) => onChange({ duration: text })}
            ref={onInputRef?.('duration')}
            onFocus={() => onInputFocus?.('duration')}
          />

          <Text style={styles.label}>Contact</Text>
          <TextInput
            style={styles.input}
            placeholder="Email ou téléphone"
            value={contact}
            onChangeText={(text) => onChange({ contact: text })}
            autoCapitalize="none"
            ref={onInputRef?.('contact')}
            onFocus={() => onInputFocus?.('contact')}
          />

          <Text style={styles.label}>Lien externe</Text>
          <TextInput
            style={styles.input}
            placeholder="Site web, réseau social"
            value={externalLink}
            onChangeText={(text) => onChange({ externalLink: text })}
            autoCapitalize="none"
            ref={onInputRef?.('externalLink')}
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
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: colors.brand.surface,
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
    color: colors.brand.text,
    fontWeight: '700',
  },
  fields: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  label: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    backgroundColor: colors.brand.surface,
    color: colors.brand.text,
  },
});
