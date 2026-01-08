import { useCallback, useEffect, useRef } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Keyboard, ScrollView } from 'react-native';

export const useAutoScrollOnFocus = () => {
  const scrollViewRef = useRef<ScrollView>(null);
  const fieldPositions = useRef(new Map<string, number>());
  const pendingFocusKey = useRef<string | null>(null);

  const registerField = useCallback((key: string) => {
    return (event: LayoutChangeEvent) => {
      fieldPositions.current.set(key, event.nativeEvent.layout.y);
    };
  }, []);

  const scrollToKey = useCallback((key: string) => {
    const y = fieldPositions.current.get(key);
    if (y === undefined) return;

    scrollViewRef.current?.scrollTo({
      y: Math.max(0, y - 24),
      animated: true,
    });
  }, []);

  const handleInputFocus = useCallback(
    (key: string) => {
      pendingFocusKey.current = key;
      setTimeout(() => {
        scrollToKey(key);
      }, 120);
    },
    [scrollToKey]
  );

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      const key = pendingFocusKey.current;
      if (key) {
        scrollToKey(key);
      }
    });
    return () => showSub.remove();
  }, []);

  return { scrollViewRef, registerField, handleInputFocus };
};
