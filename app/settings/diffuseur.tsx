import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Megaphone } from 'lucide-react-native';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks';
import { openDiffuseurContact, openDiffuseurOffer } from '@/utils/open-website';

const openOrWarn = async (action: () => Promise<void>) => {
  try {
    await action();
  } catch {
    Alert.alert('Lien indisponible', 'Ouvrez moments-locaux.com/fr/contact depuis votre navigateur.');
  }
};

export default function DiffuseurCtaScreen() {
  const { profile, session } = useAuth();

  return (
    <SettingsLayout title="Moments Diffuseur">
      <SettingsSectionCard
        title="Parlons de vos événements"
        icon={Megaphone}
        description="Touchez les personnes qui cherchent une sortie autour d’elles, même si elles ne vous suivent pas encore."
      >
        <Text style={styles.copy}>
          Même parcours que sur le site : un message à l’équipe, sans activer d’espace pro dans
          l’app.
        </Text>
        <View style={styles.actions}>
          <Button
            title="Parlons de vos événements"
            onPress={() =>
              void openOrWarn(() =>
                openDiffuseurContact({
                  name: profile?.display_name,
                  email: profile?.email ?? session?.user?.email,
                }),
              )
            }
          />
          <Button
            title="Voir l’offre sur le site"
            variant="ghost"
            onPress={() => void openOrWarn(openDiffuseurOffer)}
          />
        </View>
      </SettingsSectionCard>
    </SettingsLayout>
  );
}

const styles = StyleSheet.create({
  copy: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    marginTop: spacing.sm,
  },
  actions: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
});
