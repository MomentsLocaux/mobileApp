import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled);
      })
      .catch(() => {
        if (mounted) setReduceMotion(false);
      });

    const subscription = AccessibilityInfo.addEventListener?.(
      'reduceMotionChanged',
      (enabled) => setReduceMotion(enabled)
    );

    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, []);

  return reduceMotion;
}
