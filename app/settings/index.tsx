import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  User,
  Bell,
  ShieldCheck,
  Lock,
  FileText,
  Mail,
  Compass,
  Download,
  Trash2,
  Key,
  Laptop,
  Smartphone,
  Info,
  Cookie,
  BookOpenCheck,
} from 'lucide-react-native';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { SettingsSectionCard, SettingsRow } from '@/components/settings/SettingsSectionCard';

export default function SettingsScreen() {
  const router = useRouter();

  return (
    <SettingsLayout title="Paramètres">
      <SettingsSectionCard
        title="Compte"
        icon={User}
        description="Gérer vos informations personnelles et préférences."
      >
        <SettingsRow
          label="Informations personnelles"
          icon={User}
          onPress={() => router.push('/settings/account/personal' as any)}
          noBorder
        />
        <SettingsRow
          label="Email & authentification"
          icon={Mail}
          onPress={() => router.push('/settings/account/email' as any)}
        />
        <SettingsRow
          label="Préférences utilisateur"
          icon={Compass}
          onPress={() => router.push('/settings/account/preferences' as any)}
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

      <SettingsSectionCard title="Confidentialité & données" icon={Lock} accent>
        <SettingsRow
          label="Politique de confidentialité"
          icon={FileText}
          onPress={() => router.push('/settings/privacy/policy' as any)}
          noBorder
        />
        <SettingsRow
          label="Exporter mes données"
          icon={Download}
          onPress={() => router.push('/settings/privacy/export' as any)}
        />
        <SettingsRow
          label="Supprimer mon compte"
          icon={Trash2}
          onPress={() => router.push('/settings/privacy/delete' as any)}
          danger
        />
      </SettingsSectionCard>

      <SettingsSectionCard title="Sécurité" icon={ShieldCheck}>
        <SettingsRow
          label="Changer le mot de passe"
          icon={Key}
          onPress={() => router.push('/settings/security/password' as any)}
          noBorder
        />
        <SettingsRow
          label="Connexions actives"
          icon={Laptop}
          onPress={() => router.push('/settings/security/sessions' as any)}
        />
        <SettingsRow
          label="Sécurité du compte"
          icon={Smartphone}
          onPress={() => router.push('/settings/security/account' as any)}
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
