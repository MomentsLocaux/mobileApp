import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, RotateCcw, Shuffle, X } from 'lucide-react-native';
import { AVATAR_PRESETS, getEditableAvatarConfig, type AvatarPreset } from '@/constants/avatar-presets';
import {
  AVATAR_COLOR_OPTIONS,
  AVATAR_OPTIONS,
  type AvatarColorKey,
  type AvatarConfig,
  type AvatarStyleKey,
} from '@/constants/avatar-options';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import { createAvatarConfig, encodeCustomAvatar, randomizeAvatar } from '@/utils/avatar-config';
import { haptics } from '@/utils/haptics';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { Button } from '@/components/ui/Button';
import { PresetAvatarArt } from '@/components/ui/PresetAvatarArt';

type TabKey = 'models' | AvatarStyleKey | 'colors';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'models', label: 'Modèles' },
  { key: 'faceShape', label: 'Visage' },
  { key: 'eyes', label: 'Yeux' },
  { key: 'mouth', label: 'Bouche' },
  { key: 'nose', label: 'Nez' },
  { key: 'ears', label: 'Oreilles' },
  { key: 'hairStyle', label: 'Cheveux' },
  { key: 'facialHair', label: 'Pilosité' },
  { key: 'accessory', label: 'Accessoires' },
  { key: 'colors', label: 'Couleurs' },
];
const COLOR_LABELS: Record<AvatarColorKey, string> = {
  skin: 'Teint', hair: 'Cheveux et pilosité', eyeColor: 'Iris',
  shirt: 'Vêtement', accessoryColor: 'Accessoire', bg: 'Fond',
};
const TAB_COLOR: Partial<Record<TabKey, AvatarColorKey>> = {
  faceShape: 'skin', eyes: 'eyeColor', hairStyle: 'hair', facialHair: 'hair', accessory: 'accessoryColor',
};

type Props = {
  initialUrl: string | null;
  onApply: (url: string) => void;
  onClose: () => void;
};

function portrait(config: AvatarConfig): AvatarPreset {
  return { ...config, id: 'editor', label: 'Aperçu de votre avatar' };
}

// Mounted only while open: every session starts from the current parent selection.
export function AvatarEditorModal({ initialUrl, onApply, onClose }: Props) {
  const [initial] = useState(() => getEditableAvatarConfig(initialUrl));
  const [draft, setDraft] = useState(initial);
  const [tab, setTab] = useState<TabKey>('faceShape');
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const compact = height < 700;
  const columns = width >= 480 ? 4 : 3;
  const optionWidth = (Math.min(width, 600) - spacing.lg * 2 - spacing.sm * (columns - 1)) / columns;
  const changed = encodeCustomAvatar(draft) !== encodeCustomAvatar(initial);
  const selectedTab = TABS.find((item) => item.key === tab)!;
  const contextualColor = TAB_COLOR[tab];

  function update<Key extends keyof AvatarConfig>(key: Key, value: AvatarConfig[Key]) {
    haptics.selection();
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function renderColors(key: AvatarColorKey) {
    const options: readonly { value: string; label: string }[] = AVATAR_COLOR_OPTIONS[key];
    // A saved RGB value remains editable even if a future palette no longer suggests it.
    const choices = options.some((option) => option.value === draft[key])
      ? options : [{ value: draft[key], label: 'Couleur actuelle' }, ...options];
    return (
      <View key={key} style={styles.colorGroup}>
        <Text style={styles.sectionTitle}>{COLOR_LABELS[key]}</Text>
        <View style={styles.swatches}>
          {choices.map((option) => {
            const selected = draft[key] === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                onPress={() => update(key, option.value)}
                style={[styles.swatchButton, selected && styles.swatchSelected]}
                accessibilityRole="button"
                accessibilityLabel={`${COLOR_LABELS[key]} : ${option.label}`}
                accessibilityState={{ selected }}
                aria-selected={selected}
              >
                <View style={[styles.swatch, { backgroundColor: option.value }]} />
                {selected && <View style={styles.swatchCheck}><Check size={12} color={colors.brand.onAccent} strokeWidth={3} /></View>}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <Modal visible animationType={reduceMotion ? 'none' : 'slide'} presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]} accessibilityViewIsModal onAccessibilityEscape={onClose}>
        <View style={styles.frame}>
          <View style={styles.header}>
            <View style={styles.heading}>
              <Text style={styles.title} accessibilityRole="header">Ton avatar</Text>
              {!compact && <Text style={styles.subtitle}>Un portrait qui te ressemble.</Text>}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Fermer sans appliquer">
              <X size={22} color={colors.brand.text} />
            </TouchableOpacity>
          </View>

          <View style={[styles.preview, compact && styles.previewCompact]}>
            <View accessible accessibilityRole="image" accessibilityLabel="Aperçu de ton avatar personnalisé">
              <PresetAvatarArt preset={portrait(draft)} size={compact ? 96 : 144} />
            </View>
            <View style={styles.tools}>
              <TouchableOpacity
                style={styles.tool}
                onPress={() => { haptics.selection(); setDraft(randomizeAvatar()); }}
                accessibilityRole="button"
                accessibilityLabel="Créer un avatar aléatoire"
              >
                <Shuffle size={18} color={colors.brand.text} />
                <Text style={styles.toolLabel}>Aléatoire</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tool, !changed && styles.disabled]}
                disabled={!changed}
                onPress={() => { haptics.selection(); setDraft({ ...initial }); }}
                accessibilityRole="button"
                accessibilityLabel="Revenir au portrait de départ"
                accessibilityState={{ disabled: !changed }}
              >
                <RotateCcw size={18} color={colors.brand.text} />
                <Text style={styles.toolLabel}>Au départ</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.tabsWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
              {TABS.map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.tab, tab === item.key && styles.tabSelected]}
                  onPress={() => { haptics.selection(); setTab(item.key); }}
                  accessibilityRole="tab"
                  accessibilityLabel={item.label}
                  accessibilityState={{ selected: tab === item.key }}
                  aria-selected={tab === item.key}
                >
                  <Text style={[styles.tabLabel, tab === item.key && styles.tabLabelSelected]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <ScrollView key={tab} style={styles.optionsScroll} contentContainerStyle={styles.options}>
            <Text style={styles.sectionTitle} accessibilityRole="header">{selectedTab.label}</Text>
            {tab === 'models' ? (
              <>
                <Text style={styles.hint}>Choisis une base, puis ajuste chaque détail.</Text>
                <View style={styles.grid}>
                  {AVATAR_PRESETS.map((preset) => {
                    const config = createAvatarConfig(preset);
                    const selected = encodeCustomAvatar(draft) === encodeCustomAvatar(config);
                    return (
                      <TouchableOpacity
                        key={preset.id}
                        style={[styles.option, { width: optionWidth }, selected && styles.optionSelected]}
                        onPress={() => { haptics.selection(); setDraft(config); }}
                        accessibilityRole="button"
                        accessibilityLabel={preset.label}
                        accessibilityState={{ selected }}
                        aria-selected={selected}
                      >
                        <PresetAvatarArt preset={preset} size={64} />
                        <Text style={styles.optionLabel}>{preset.id.charAt(0).toUpperCase() + preset.id.slice(1)}</Text>
                        {selected && <View style={styles.optionCheck}><Check size={14} color={colors.brand.onAccent} /></View>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : tab === 'colors' ? (
              (Object.keys(AVATAR_COLOR_OPTIONS) as AvatarColorKey[]).map(renderColors)
            ) : (
              <>
                <View style={styles.grid}>
                  {AVATAR_OPTIONS[tab].map((option) => {
                    const selected = draft[tab] === option.value;
                    const config = { ...draft, [tab]: option.value };
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[styles.option, { width: optionWidth }, selected && styles.optionSelected]}
                        onPress={() => update(tab, option.value)}
                        accessibilityRole="button"
                        accessibilityLabel={`${selectedTab.label} : ${option.label}`}
                        accessibilityState={{ selected }}
                        aria-selected={selected}
                      >
                        <PresetAvatarArt preset={portrait(config)} size={64} />
                        <Text style={styles.optionLabel}>{option.label}</Text>
                        {selected && <View style={styles.optionCheck}><Check size={14} color={colors.brand.onAccent} /></View>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {contextualColor && renderColors(contextualColor)}
                {tab === 'eyes' && draft.eyes === 'smiling' && <Text style={styles.hint}>La couleur des iris apparaît quand les yeux sont ouverts.</Text>}
                {tab === 'accessory' && draft.accessory === 'none' && <Text style={styles.hint}>Choisis un accessoire pour voir sa couleur.</Text>}
              </>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Button title="Annuler" variant="secondary" onPress={onClose} style={styles.cancel} />
            <Button
              title="Utiliser ce portrait"
              onPress={() => { haptics.success(); onApply(encodeCustomAvatar(draft)); }}
              style={styles.apply}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.brand.page, alignItems: 'center' },
  frame: { flex: 1, width: '100%', maxWidth: 600 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm },
  heading: { flex: 1 },
  title: { ...typography.h4, color: colors.brand.text },
  subtitle: { ...typography.caption, color: colors.brand.textSecondary, marginTop: 4 },
  iconButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.full, backgroundColor: colors.brand.surfaceMuted },
  preview: { alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.sm },
  previewCompact: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg, paddingHorizontal: spacing.lg },
  tools: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', justifyContent: 'center', flexShrink: 1 },
  tool: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: spacing.sm, borderRadius: borderRadius.full, backgroundColor: colors.brand.surfaceMuted },
  toolLabel: { ...typography.caption, color: colors.brand.text, fontWeight: '600' },
  disabled: { opacity: 0.4 },
  tabsWrap: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.brand.surfaceMuted },
  tabs: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm },
  tab: { minHeight: 44, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.full, backgroundColor: colors.brand.surfaceMuted },
  tabSelected: { backgroundColor: colors.brand.secondary },
  tabLabel: { ...typography.bodySmall, color: colors.brand.text, fontWeight: '600' },
  tabLabelSelected: { color: colors.brand.onAccent },
  optionsScroll: { flex: 1 },
  options: { padding: spacing.lg, gap: spacing.md },
  sectionTitle: { ...typography.bodySmall, color: colors.brand.text, fontWeight: '700' },
  hint: { ...typography.caption, color: colors.brand.textSecondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  option: { minHeight: 116, alignItems: 'center', justifyContent: 'center', padding: spacing.sm, gap: spacing.sm, borderRadius: borderRadius.lg, backgroundColor: colors.brand.surface, borderWidth: 2, borderColor: 'transparent' },
  optionSelected: { borderColor: colors.brand.secondary, backgroundColor: colors.brand.surfaceMuted },
  optionLabel: { ...typography.caption, color: colors.brand.text, textAlign: 'center', fontWeight: '600' },
  optionCheck: { position: 'absolute', top: 4, right: 4, backgroundColor: colors.brand.secondary, borderRadius: borderRadius.full, padding: 2 },
  colorGroup: { gap: spacing.sm },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  swatchButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.full, borderWidth: 2, borderColor: 'transparent' },
  swatchSelected: { borderColor: colors.brand.text },
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brand.textSecondary },
  swatchCheck: { position: 'absolute', bottom: 0, right: 0, borderRadius: borderRadius.full, backgroundColor: colors.brand.secondary, padding: 2 },
  footer: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.brand.surfaceMuted, backgroundColor: colors.brand.page },
  cancel: { flex: 1, paddingHorizontal: spacing.sm },
  apply: { flex: 2, paddingHorizontal: spacing.sm },
});
