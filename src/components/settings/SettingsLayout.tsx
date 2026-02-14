import React from 'react';
import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenLayout, TopBar, colors, spacing } from '@/components/ui/v2';

type Props = {
  title: string;
  children: React.ReactNode;
};

export const SettingsLayout: React.FC<Props> = ({ title, children }) => {
  const router = useRouter();

  return (
    <ScreenLayout
      header={<TopBar title={title} onBack={() => router.back()} />}
      contentContainerStyle={styles.content}
      edges={['top', 'left', 'right']}
    >
      {children}
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background,
  },
});
