import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  User,
  Bell,
  Lock,
  FileText,
  Trash2,
  Info,
  Cookie,
  BookOpenCheck,
  Compass,
} from 'lucide-react-native';
import { DISCOVERY_ENABLED } from '@/config/discovery.flags';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { SettingsSectionCard, SettingsRow } from '@/components/settings/SettingsSectionCard';

export default function SettingsScreen() {
  const router = useRouter();

  return (
    <SettingsLayout title="Paramètres">
      <SettingsSectionCard
        title="Compte"
        icon={User}
        description="Gérer les informations visibles sur votre profil."
      >
        <SettingsRow
          label="Modifier le profil"
          icon={User}
          onPress={() => router.push('/profile/edit' as any)}
          noBorder
        />
      </SettingsSectionCard>

      <SettingsSectionCard title="Notifications" icon={Bell}>
        <SettingsRow
          label="Gérer les notifications"
          icon={Bell}
          onPress={() => router.push('/settings/notifications' as any)}
          noBorder
        />
      </SettingsSectionCard>

      {DISCOVERY_ENABLED && (
        <SettingsSectionCard title="Discovery" icon={Compass}>
          <SettingsRow
            label="Personnalisation Discovery"
            icon={Compass}
            onPress={() => router.push('/settings/discovery' as any)}
            noBorder
          />
        </SettingsSectionCard>
      )}

      <SettingsSectionCard title="Confidentialité & données" icon={Lock} accent>
        <SettingsRow
          label="Politique de confidentialité"
          icon={FileText}
          onPress={() => router.push('/settings/privacy/policy' as any)}
          noBorder
        />
        <SettingsRow
          label="Supprimer mon compte"
          icon={Trash2}
          onPress={() => router.push('/settings/privacy/delete' as any)}
          danger
        />
      </SettingsSectionCard>

      <SettingsSectionCard title="Informations légales" icon={Info}>
        <SettingsRow
          label="Conditions Générales d’Utilisation"
          icon={BookOpenCheck}
          onPress={() => router.push('/settings/legal/cgu' as any)}
          noBorder
        />
        <SettingsRow
          label="Mentions légales"
          icon={Info}
          onPress={() => router.push('/settings/legal/mentions' as any)}
        />
        <SettingsRow
          label="Politique des cookies"
          icon={Cookie}
          onPress={() => router.push('/settings/legal/cookies' as any)}
        />
      </SettingsSectionCard>
      <View />
    </SettingsLayout>
  );
}
