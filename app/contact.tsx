import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { Mail } from 'lucide-react-native';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { CONTACT_INTENTS, CONTACT_INTENT_LABELS, type ContactIntent } from '@/constants/contact';
import { useAuth } from '@/hooks';
import { openContactForm } from '@/utils/open-website';

export default function ContactScreen() {
  const { profile } = useAuth();
  const [intent, setIntent] = useState<ContactIntent>('question');
  const [name, setName] = useState(profile?.display_name || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const canSend = useMemo(
    () => name.trim().length > 0 && email.includes('@') && message.trim().length > 0,
    [email, message, name],
  );

  const send = async () => {
    if (!canSend || sending) return;
    setSending(true);
    try {
      await openContactForm({
        intent,
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
      });
    } catch (error) {
      Alert.alert(
        'Envoi impossible',
        error instanceof Error ? error.message : 'Réessayez dans un instant.',
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <SettingsLayout title="Contact">
      <SettingsSectionCard
        title="Assistance"
        icon={Mail}
        description="Même formulaire que le site : choisissez un sujet, puis envoyez. Le message arrive à l’équipe."
      >
        <Text style={styles.label}>Sujet</Text>
        <View style={styles.intentStack}>
          {CONTACT_INTENTS.map((value) => (
            <Button
              key={value}
              title={CONTACT_INTENT_LABELS[value]}
              variant={intent === value ? 'primary' : 'outline'}
              size="sm"
              onPress={() => setIntent(value)}
            />
          ))}
        </View>
        <Text style={styles.label}>Nom</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          autoComplete="name"
          placeholder="Votre nom"
          placeholderTextColor={colors.brand.textSecondary}
        />
        <Text style={styles.label}>E-mail</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoComplete="email"
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="vous@email.com"
          placeholderTextColor={colors.brand.textSecondary}
        />
        <Text style={styles.label}>Message</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={5000}
          textAlignVertical="top"
          placeholder="Comment peut-on vous aider ?"
          placeholderTextColor={colors.brand.textSecondary}
        />
        <View style={styles.actions}>
          <Button
            title={sending ? 'Ouverture…' : 'Envoyer le message'}
            onPress={() => void send()}
            loading={sending}
            disabled={!canSend || sending}
          />
        </View>
      </SettingsSectionCard>
    </SettingsLayout>
  );
}

const styles = StyleSheet.create({
  label: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '700',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  intentStack: {
    gap: spacing.xs,
  },
  input: {
    ...typography.body,
    color: colors.brand.text,
    backgroundColor: colors.brand.surfaceMuted,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 48,
  },
  textarea: {
    minHeight: 140,
    paddingTop: spacing.sm,
  },
  actions: {
    marginTop: spacing.lg,
  },
});
