import React, { useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Link2, Plug } from 'lucide-react-native';
import type { ProSubtype } from '@/constants/accountIdentity';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import { haptics } from '@/utils/haptics';

export type ConnectorStatus =
  | 'none'
  | 'sit_pending'
  | 'sit_connected'
  | 'custom_requested'
  | 'custom_active';

export type ConnectorDraft = {
  status: ConnectorStatus;
  sitProvider?: string | null;
  tool?: string;
  url?: string;
  contact?: string;
  notes?: string;
};

type Props = {
  proSubtype: ProSubtype | null;
  value: ConnectorDraft;
  onChange: (next: ConnectorDraft) => void;
};

/**
 * OT → Connecter SIT (pending). Autres pros → demande connecteur sur mesure (lead).
 * Skip = status none ; dashboard reste accessible.
 */
export function OnboardingConnectorStep({ proSubtype, value, onChange }: Props) {
  const isOt = proSubtype === 'office_tourisme';
  const [tool, setTool] = useState(value.tool || '');
  const [url, setUrl] = useState(value.url || '');
  const [contact, setContact] = useState(value.contact || '');

  if (isOt) {
    const pending = value.status === 'sit_pending' || value.status === 'sit_connected';
    return (
      <View style={styles.wrap}>
        <Text style={styles.titleFormal}>Relier ton agenda touristique</Text>
        <Text style={styles.subtitleFormal}>
          Si tu as déjà un outil, par exemple Apidae, on reprend tes dates sans les ressaisir. La
          liaison technique peut attendre.
        </Text>
        <TouchableOpacity
          style={[styles.primaryBtn, pending && styles.primaryBtnActive]}
          onPress={() => {
            haptics.selection();
            onChange({
              status: 'sit_pending',
              sitProvider: 'apidae',
            });
          }}
          accessibilityRole="button"
        >
          <Plug size={18} color={colors.brand.secondary} />
          <Text style={styles.primaryBtnText}>
            {pending ? 'Agenda en attente de liaison' : 'Relier mon agenda (Apidae)'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.noteFormal}>
          Tu pourras reprendre cette étape plus tard. La passer ne bloque pas l’accès.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.titleFormal}>Éviter de publier deux fois</Text>
      <Text style={styles.subtitleFormal}>
        Si tes dates sont déjà sur un site, une billetterie ou un calendrier, demande une liaison.
        Une seule saisie suffit.
      </Text>
      <View style={styles.field}>
        <Text style={styles.label}>Outil / source actuelle</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex. site WordPress, billetterie, Facebook…"
          placeholderTextColor={colors.brand.textSecondary}
          value={tool}
          onChangeText={setTool}
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>URL ou API (optionnel)</Text>
        <TextInput
          style={styles.input}
          placeholder="https://…"
          placeholderTextColor={colors.brand.textSecondary}
          autoCapitalize="none"
          value={url}
          onChangeText={setUrl}
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Contact technique (optionnel)</Text>
        <TextInput
          style={styles.input}
          placeholder="Email ou téléphone"
          placeholderTextColor={colors.brand.textSecondary}
          autoCapitalize="none"
          value={contact}
          onChangeText={setContact}
        />
      </View>
      <TouchableOpacity
        style={styles.primaryBtn}
        onPress={() => {
          haptics.selection();
          onChange({
            status: 'custom_requested',
            tool: tool.trim(),
            url: url.trim(),
            contact: contact.trim(),
          });
        }}
        accessibilityRole="button"
      >
        <Link2 size={18} color={colors.brand.secondary} />
        <Text style={styles.primaryBtnText}>
          {value.status === 'custom_requested'
            ? 'Demande enregistrée'
            : 'Envoyer la demande de liaison'}
        </Text>
      </TouchableOpacity>
      <Text style={styles.noteFormal}>
        Tu peux passer cette étape et publier à la main en attendant.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  titleFormal: {
    ...typography.h2,
    color: colors.brand.text,
    letterSpacing: 0.2,
  },
  subtitleFormal: {
    ...typography.body,
    color: colors.brand.textSecondary,
    lineHeight: 22,
  },
  field: { gap: spacing.xs },
  label: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontWeight: '600',
  },
  input: {
    fontFamily: typography.body.fontFamily,
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
    borderWidth: 1,
    backgroundColor: colors.brand.surface,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingTop: 14,
    paddingBottom: 18,
    minHeight: 56,
    color: colors.brand.text,
    overflow: 'visible',
    ...(Platform.OS === 'android'
      ? { includeFontPadding: false, textAlignVertical: 'center' as const }
      : null),
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.brand.secondary,
    backgroundColor: colors.brand.surface,
  },
  primaryBtnActive: {
    backgroundColor: colors.brand.surfaceMuted,
  },
  primaryBtnText: {
    ...typography.body,
    color: colors.brand.secondary,
    fontWeight: '600',
    flex: 1,
  },
  noteFormal: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    lineHeight: 18,
  },
});
