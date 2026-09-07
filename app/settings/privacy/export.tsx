import React, { useCallback, useState } from 'react';
import { Alert, Linking, Text, View, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Download, FileJson } from 'lucide-react-native';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography } from '@/constants/theme';
import {
  AccountExportService,
  type AccountExportRequest,
} from '@/services/account-export.service';

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const statusLabel = (status: AccountExportRequest['status']) => {
  if (status === 'ready') return 'Disponible';
  if (status === 'pending') return 'En préparation';
  if (status === 'expired') return 'Expiré';
  return 'Échec';
};

export default function ExportDataScreen() {
  const [requests, setRequests] = useState<AccountExportRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const rows = await AccountExportService.listMine();
      setRequests(rows);
    } catch (error) {
      console.warn('list exports', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const requestExport = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const result = await AccountExportService.requestExport();
      if (!result.success || !result.downloadUrl) {
        Alert.alert('Export impossible', result.message || 'Réessayez dans un instant.');
        return;
      }
      setDownloadUrl(result.downloadUrl);
      setExpiresAt(result.expiresAt ?? null);
      await refresh();
    } finally {
      setLoading(false);
    }
  };

  const openDownload = async () => {
    if (!downloadUrl) return;
    const canOpen = await Linking.canOpenURL(downloadUrl);
    if (!canOpen) {
      Alert.alert('Téléchargement', 'Impossible d’ouvrir le fichier sur cet appareil.');
      return;
    }
    await Linking.openURL(downloadUrl);
  };

  return (
    <SettingsLayout title="Exporter mes données">
      <SettingsSectionCard title="Droit à la portabilité" icon={FileJson}>
        <Text style={styles.copy}>
          Vous pouvez demander une copie JSON de votre compte : profil, préférences, événements créés,
          likes, favoris, abonnements, commentaires et contributions.
        </Text>
        <Text style={styles.hint}>
          Préparation en quelques secondes. Le lien de téléchargement expire au bout de 24 h.
        </Text>
        <View style={styles.actions}>
          <Button
            title={loading ? 'Préparation…' : 'Demander mon export'}
            onPress={requestExport}
            loading={loading}
            disabled={loading}
          />
          {downloadUrl ? (
            <Button title="Télécharger le fichier" variant="secondary" onPress={openDownload} />
          ) : null}
        </View>
        {expiresAt ? (
          <Text style={styles.ready}>Votre export est prêt. Le lien expire le {formatDate(expiresAt)}.</Text>
        ) : null}
      </SettingsSectionCard>

      {requests.length > 0 ? (
        <SettingsSectionCard title="Demandes récentes" icon={Download}>
          {requests.map((row) => (
            <View key={row.id} style={styles.historyRow}>
              <Text style={styles.historyStatus}>{statusLabel(row.status)}</Text>
              <Text style={styles.historyDate}>{formatDate(row.created_at)}</Text>
            </View>
          ))}
        </SettingsSectionCard>
      ) : null}
    </SettingsLayout>
  );
}

const styles = StyleSheet.create({
  copy: {
    ...typography.body,
    color: colors.brand.text,
    marginTop: spacing.sm,
  },
  hint: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    marginTop: spacing.sm,
  },
  actions: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  ready: {
    ...typography.bodySmall,
    color: colors.brand.secondary,
    marginTop: spacing.md,
    fontWeight: '600',
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(26,51,41,0.08)',
  },
  historyStatus: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '600',
  },
  historyDate: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
});
