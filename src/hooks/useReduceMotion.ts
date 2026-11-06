import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Optional synchronous seed while AccessibilityInfo resolves its current setting. */
export function useReduceMotion(initialValue = false) {
  const [reduceMotion, setReduceMotion] = useState(initialValue);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled);
      })
      .catch(() => {
        if (mounted) setReduceMotion(initialValue);
      });

    const subscription = AccessibilityInfo.addEventListener?.(
      'reduceMotionChanged',
      (enabled) => setReduceMotion(enabled)
    );

    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, [initialValue]);

  return reduceMotion;
}
