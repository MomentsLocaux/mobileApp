import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, Platform, type KeyboardEvent } from 'react-native';

/**
 * How much of the window the Android keyboard still covers.
 * Null while the keyboard is closed. Zero when the window already resized above it.
 * Always null on iOS, which uses KeyboardAvoidingView.
 */
export function useAndroidKeyboardOverlap(): number | null {
  const [overlap, setOverlap] = useState<number | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (event: KeyboardEvent) => {
      const windowHeight = Dimensions.get('window').height;
      const covered = Math.max(0, windowHeight - event.endCoordinates.screenY);
      setOverlap(covered);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setOverlap(null));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return overlap;
}

/** Resting bottom padding, plus the Android navigation bar or the covered keyboard. iOS stays at `resting`. */
export function androidEdgePadding(
  resting: number,
  insetBottom: number,
  keyboardOverlap: number | null,
): number {
  if (Platform.OS !== 'android') return resting;
  return resting + (keyboardOverlap == null ? insetBottom : keyboardOverlap);
}
