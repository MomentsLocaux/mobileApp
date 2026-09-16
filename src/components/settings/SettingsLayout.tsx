import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { colors, spacing, typography } from '@/constants/theme';
import { IdentityAppBackground } from '@/components/identity/IdentityAppBackground';
import { TAB_BAR_ICONS_HEIGHT } from '@/components/navigation/MapAwareTabBar';

type Props = {
  title: string;
  children: React.ReactNode;
};

export const SettingsLayout: React.FC<Props> = ({ title, children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const underTabBar = pathname === '/settings' || pathname.startsWith('/settings/');
  const tabBarClearance = TAB_BAR_ICONS_HEIGHT + Math.max(insets.bottom, 8);

  return (
    <SafeAreaView
      style={styles.safe}
      edges={underTabBar ? ['top', 'left', 'right'] : ['top', 'left', 'right', 'bottom']}
    >
      <IdentityAppBackground />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)' as any);
          }}
        >
          <ChevronLeft size={22} color={colors.brand.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          underTabBar ? { paddingBottom: spacing.lg + tabBarClearance } : null,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: 'transparent',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    ...typography.h3,
    color: colors.brand.text,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
});
