import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { BrandIcon } from '@/components/ui/BrandIcon';
import { colors, spacing } from '@/constants/theme';

export type AgendaSwipeHandle = { close: () => void };
export type OnAgendaSwipeStart = (handle: AgendaSwipeHandle) => void;

export function useAgendaSwipeActions() {
  const current = useRef<AgendaSwipeHandle | null>(null);
  const closeSwipe = useCallback(() => {
    current.current?.close();
    current.current = null;
  }, []);
  const handleSwipeStart = useCallback<OnAgendaSwipeStart>((handle) => {
    if (current.current !== handle) closeSwipe();
    current.current = handle;
  }, [closeSwipe]);
  return { closeSwipe, handleSwipeStart };
}

type Props = {
  children: React.ReactNode;
  title: string;
  pending: boolean;
  onRemove: () => void;
  onSwipeStart: OnAgendaSwipeStart;
};

/** Scoped to Agenda: dragging reveals an action; only pressing it removes a heart. */
export function AgendaSwipeAction({ children, title, pending, onRemove, onSwipeStart }: Props) {
  const swipeRef = useRef<Swipeable>(null);
  const [open, setOpen] = useState(false);
  const { width, fontScale } = useWindowDimensions();
  const close = useCallback(() => {
    swipeRef.current?.reset();
    setOpen(false);
  }, []);
  const handle = useRef<AgendaSwipeHandle>({ close }).current;
  useEffect(() => { close(); }, [close, width, fontScale]);

  return (
    <Swipeable
      key={`${width}:${fontScale}`}
      ref={swipeRef}
      enabled={!pending}
      friction={1}
      dragOffsetFromRightEdge={20}
      dragOffsetFromLeftEdge={20}
      failOffsetY={[-12, 12]}
      rightThreshold={48}
      overshootLeft={false}
      overshootRight={false}
      childrenContainerStyle={styles.foreground}
      onSwipeableOpenStartDrag={() => onSwipeStart(handle)}
      onSwipeableWillOpen={() => {
        onSwipeStart(handle);
        setOpen(true);
      }}
      onSwipeableClose={() => setOpen(false)}
      renderRightActions={() => (
        <View
          style={{ width: Math.min(160, Math.max(96, 80 * fontScale)) }}
          accessibilityElementsHidden={!open}
          aria-hidden={!open}
          importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
        >
          <TouchableOpacity
            style={styles.action}
            onPress={onRemove}
            disabled={!open || pending}
            accessibilityRole="button"
            accessibilityLabel={`Retirer ${title} des favoris`}
            accessibilityHint="Retire le cœur et le favori de ton agenda."
            accessibilityState={{ disabled: !open || pending, busy: pending }}
          >
            {pending
              ? <ActivityIndicator color={colors.error[700]} />
              : <BrandIcon name="heart" size={22} color={colors.error[700]} />}
            <Text style={styles.label}>Retirer</Text>
          </TouchableOpacity>
        </View>
      )}
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  foreground: { backgroundColor: colors.brand.page },
  action: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.error[50],
  },
  label: { color: colors.error[700], fontSize: 14, fontWeight: '700', textAlign: 'center' },
});
