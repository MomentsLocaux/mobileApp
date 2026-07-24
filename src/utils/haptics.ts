import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const canHaptic = Platform.OS === 'ios' || Platform.OS === 'android';

export const haptics = {
  selection() {
    if (!canHaptic) return;
    void Haptics.selectionAsync().catch(() => undefined);
  },
  light() {
    if (!canHaptic) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  },
  medium() {
    if (!canHaptic) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
  },
  success() {
    if (!canHaptic) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  },
};
