import React from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { filterSpacing, type FilterChipTone } from '@/constants/filter-tokens';
import { FilterChip, type FilterChipSize } from './FilterChip';

export interface FilterChipRowOption<T extends string> {
  key: T;
  label: string;
  disabled?: boolean;
  disabledReason?: string;
  tone?: FilterChipTone;
  icon?: React.ReactNode;
}

interface BaseProps<T extends string> {
  options: readonly FilterChipRowOption<T>[];
  /** Horizontal scroll (default) keeps long rows reachable on small screens. */
  scrollable?: boolean;
  size?: FilterChipSize;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /** Extra controls rendered after the chips (e.g. a sort pill). */
  children?: React.ReactNode;
  testID?: string;
}

interface SingleModeProps<T extends string> {
  mode?: 'single';
  value?: T | null;
  /** Allows tapping the active chip to clear the selection. */
  allowDeselect?: boolean;
  onChange: (next: T | null) => void;
}

interface MultiModeProps<T extends string> {
  mode: 'multi';
  values: readonly T[];
  onChange: (next: T[]) => void;
}

export type FilterChipRowProps<T extends string> = BaseProps<T> &
  (SingleModeProps<T> | MultiModeProps<T>);

export function FilterChipRow<T extends string>(props: FilterChipRowProps<T>) {
  const {
    options,
    scrollable = true,
    size = 'sm',
    style,
    contentContainerStyle,
    accessibilityLabel,
    children,
    testID,
  } = props;

  const isActive = (key: T) =>
    props.mode === 'multi' ? props.values.includes(key) : props.value === key;

  const handlePress = (key: T) => {
    if (props.mode === 'multi') {
      const next = props.values.includes(key)
        ? props.values.filter((item) => item !== key)
        : [...props.values, key];
      props.onChange(next);
      return;
    }

    if (props.value === key) {
      if (props.allowDeselect) props.onChange(null);
      return;
    }
    props.onChange(key);
  };

  const chips = options.map((option) => (
    <FilterChip
      key={option.key}
      label={option.label}
      active={isActive(option.key)}
      disabled={option.disabled}
      disabledReason={option.disabledReason}
      tone={option.tone}
      icon={option.icon}
      size={size}
      onPress={() => handlePress(option.key)}
    />
  ));

  if (!scrollable) {
    return (
      <View
        style={[styles.wrapRow, style]}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
      >
        {chips}
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={style}
      contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {chips}
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: filterSpacing.chipGap,
    paddingVertical: filterSpacing.rowPaddingVertical,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: filterSpacing.chipGap,
  },
});
