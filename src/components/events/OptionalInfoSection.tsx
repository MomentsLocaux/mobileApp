import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/components/ui/v2';

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
        accessibilityRole="button"
        onPress={() =>
          setOpen((v) => {
            const next = !v;
            if (next) onOpen?.();
            return next;
          })
        }
      >
        <Text style={styles.title}>Infos pratiques (facultatif)</Text>
        {open ? <ChevronUp size={18} color={colors.textSecondary} /> : <ChevronDown size={18} color={colors.textSecondary} />}
      </TouchableOpacity>
      {open && (
        <View style={styles.fields}>
          <Text style={styles.label}>Prix</Text>
          <TextInput
            style={styles.input}
            placeholder="Gratuit, 5€..."
            placeholderTextColor={colors.textSecondary}
            value={price}
            onChangeText={(text) => onChange({ price: text })}
            ref={onInputRef?.('price')}
            onFocus={() => onInputFocus?.('price')}
          />

          <Text style={styles.label}>Durée estimée</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: 2h"
            placeholderTextColor={colors.textSecondary}
            value={duration}
            onChangeText={(text) => onChange({ duration: text })}
            ref={onInputRef?.('duration')}
            onFocus={() => onInputFocus?.('duration')}
          />

          <Text style={styles.label}>Contact</Text>
          <TextInput
            style={styles.input}
            placeholder="Email ou téléphone"
            placeholderTextColor={colors.textSecondary}
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
            placeholderTextColor={colors.textSecondary}
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
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surfaceLevel1,
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
    color: colors.textPrimary,
    fontWeight: '700',
  },
  fields: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  label: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.element,
    padding: spacing.md,
    backgroundColor: colors.surfaceLevel2,
    color: colors.textPrimary,
  },
});
