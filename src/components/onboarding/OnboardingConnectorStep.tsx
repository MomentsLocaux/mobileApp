import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
        <Text style={styles.titleFormal}>Connecter votre SIT</Text>
        <Text style={styles.subtitleFormal}>
          Reliez votre système d’information touristique (ex. Apidae). Moments Locaux synchronise
          l’agenda et mesure la présence réelle — sans double saisie. La connexion technique peut
          être finalisée plus tard.
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
          <Plug size={18} color={colors.brand.primary} />
          <Text style={styles.primaryBtnText}>
            {pending ? 'SIT en attente de connexion' : 'Connecter mon SIT (Apidae)'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.noteFormal}>
          Vous pourrez reprendre cette étape depuis le tableau de bord. Passer cette étape n’empêche
          pas d’accéder à Moments Diffuseur.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.titleFormal}>Éviter de publier deux fois</Text>
      <Text style={styles.subtitleFormal}>
        Moments Locaux est votre tableau de bord de présence et d’interactions temps réel. Demandez
        un connecteur sur mesure (site, billetterie, CRM, ICS…) : une saisie en amont suffit.
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
        <Link2 size={18} color={colors.brand.primary} />
        <Text style={styles.primaryBtnText}>
          {value.status === 'custom_requested'
            ? 'Demande enregistrée'
            : 'Envoyer la demande de connecteur'}
        </Text>
      </TouchableOpacity>
      <Text style={styles.noteFormal}>
        Demande accessible dès Diffuseur Gratuit ; la priorisation d’intégration est renforcée avec
        Diffuseur Pro. Vous pouvez passer et publier manuellement en attendant.
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
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.brand.text,
    ...typography.body,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.brand.primary,
  },
  primaryBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  primaryBtnText: {
    ...typography.body,
    color: colors.brand.primary,
    fontWeight: '600',
    flex: 1,
  },
  noteFormal: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    lineHeight: 18,
  },
});
