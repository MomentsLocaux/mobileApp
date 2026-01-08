import { useCallback, useEffect, useRef } from 'react';
import { Keyboard, ScrollView } from 'react-native';

export const useAutoScrollOnFocus = () => {
  const scrollViewRef = useRef<ScrollView>(null);
  const fieldRefs = useRef(new Map<string, any>());
  const pendingFocusKey = useRef<string | null>(null);
  const scrollYRef = useRef(0);

  const registerFieldRef = useCallback((key: string) => {
    return (node: any) => {
      if (node) {
        fieldRefs.current.set(key, node);
      } else {
        fieldRefs.current.delete(key);
      }
    };
  }, []);

  const scrollToKey = useCallback((key: string) => {
    const target = fieldRefs.current.get(key);
    const scrollNode = scrollViewRef.current;
    if (!target || !scrollNode || typeof target.measureInWindow !== 'function') return;

    target.measureInWindow((_x: number, targetY: number, _w: number, _h: number) => {
      if (typeof scrollNode.measureInWindow !== 'function') return;
      scrollNode.measureInWindow((_sx: number, scrollY: number) => {
        const relativeY = targetY - scrollY + scrollYRef.current;
        scrollViewRef.current?.scrollTo({
          y: Math.max(0, relativeY - 24),
          animated: true,
        });
      });
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

  const handleScroll = useCallback((event: any) => {
    scrollYRef.current = event.nativeEvent.contentOffset.y;
  }, []);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      const key = pendingFocusKey.current;
      if (key) {
        scrollToKey(key);
      }
    });
    return () => showSub.remove();
  }, []);

  return { scrollViewRef, registerFieldRef, handleInputFocus, handleScroll };
};
