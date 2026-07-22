import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { Coins } from 'lucide-react-native';
import { AppBackground, ScreenHeader } from '@/components/ui';
import { GAMIFICATION_ENABLED } from '@/config/gamification.flags';
import { useAuth } from '@/hooks';
import { LumoService, type LumoTransactionRow } from '@/services/lumo.service';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

function formatTxLabel(row: LumoTransactionRow): string {
  if (row.reason) return row.reason;
  if (row.source) return row.source;
  return row.type === 'credit' ? 'Crédit Lumo' : 'Débit Lumo';
}

export default function WalletScreen() {
  if (!GAMIFICATION_ENABLED) {
    return <Redirect href="/(tabs)/map" />;
  }
  return <WalletScreenInner />;
}

function WalletScreenInner() {
  const router = useRouter();
  const { profile, session } = useAuth();
  const userId = profile?.id || session?.user?.id;
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState<LumoTransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!userId) {
      setBalance(0);
      setHistory([]);
      setLoading(false);
      return;
    }
    try {
      const [b, h] = await Promise.all([
        LumoService.getBalance(userId),
        LumoService.getHistory(userId),
      ]);
      setBalance(b);
      setHistory(h);
    } catch (e) {
      console.warn('wallet load', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  return (
    <View style={styles.wrapper}>
      <AppBackground />
      <ScreenHeader title="Mon portefeuille" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={colors.brand.secondary}
          />
        }
      >
        <View style={styles.balanceCard}>
          <View style={styles.balanceIcon}>
            <Coins size={22} color={colors.brand.secondary} />
          </View>
          <Text style={styles.balanceLabel}>Solde Lumo</Text>
          {loading ? (
            <ActivityIndicator color={colors.brand.secondary} />
          ) : (
            <Text style={styles.balanceValue}>{balance}</Text>
          )}
          <Text style={styles.balanceHint}>Monnaie d’engagement — pas convertible en €</Text>
        </View>

        <Text style={styles.sectionTitle}>Historique</Text>
        {loading ? (
          <ActivityIndicator color={colors.brand.secondary} style={{ marginTop: spacing.md }} />
        ) : history.length === 0 ? (
          <Text style={styles.empty}>Aucune transaction pour le moment. Fais un check-in pour gagner des Lumo.</Text>
        ) : (
          history.map((row) => {
            const isCredit = row.type === 'credit';
            return (
              <View key={row.id} style={styles.txRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txTitle}>{formatTxLabel(row)}</Text>
                  <Text style={styles.txMeta}>
                    {new Date(row.created_at).toLocaleString('fr-FR')}
                  </Text>
                </View>
                <Text style={[styles.txAmount, isCredit ? styles.txCredit : styles.txDebit]}>
                  {isCredit ? '+' : '−'}
                  {Math.abs(Number(row.amount))}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  container: {
    padding: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  balanceCard: {
    backgroundColor: colors.brand.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: spacing.md,
  },
  balanceIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: spacing.xs,
  },
  balanceLabel: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
  },
  balanceValue: {
    ...typography.h2,
    color: colors.brand.text,
    fontWeight: '700',
  },
  balanceHint: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.brand.text,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  empty: {
    ...typography.body,
    color: colors.brand.textSecondary,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  txTitle: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '600',
  },
  txMeta: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    marginTop: 2,
  },
  txAmount: {
    ...typography.bodyLarge,
    fontWeight: '700',
  },
  txCredit: { color: colors.brand.success },
  txDebit: { color: colors.brand.secondary },
});
