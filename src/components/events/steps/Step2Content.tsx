import React, { useRef, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { colors, spacing, typography } from '@/constants/theme';
import { CategorySelector } from '@/components/events/CategorySelector';
import { TagsSelector } from '@/components/events/TagsSelector';
import { VisibilitySelector } from '@/components/events/VisibilitySelector';
import { OptionalInfoSection } from '@/components/events/OptionalInfoSection';
import { useCreateEventStore } from '@/hooks/useCreateEventStore';

type Props = {
    scrollViewRef?: React.RefObject<ScrollView>;
    onInputFocus?: (key: string) => void;
    onInputRef?: (key: string) => (node: any) => void;
};

export const Step2Content = ({ scrollViewRef, onInputFocus, onInputRef }: Props) => {
    const category = useCreateEventStore((s) => s.category);
    const subcategory = useCreateEventStore((s) => s.subcategory);
    const tags = useCreateEventStore((s) => s.tags);
    const visibility = useCreateEventStore((s) => s.visibility);
    const privateAudienceIds = useCreateEventStore((s) => s.privateAudienceIds);
    const price = useCreateEventStore((s) => s.price);
    const contact = useCreateEventStore((s) => s.contact);
    const externalLink = useCreateEventStore((s) => s.externalLink);
    const setCategory = useCreateEventStore((s) => s.setCategory);
    const setSubcategory = useCreateEventStore((s) => s.setSubcategory);
    const setTags = useCreateEventStore((s) => s.setTags);
    const setVisibility = useCreateEventStore((s) => s.setVisibility);
    const setPrivateAudienceIds = useCreateEventStore((s) => s.setPrivateAudienceIds);
    const setPrice = useCreateEventStore((s) => s.setPrice);
    const setContact = useCreateEventStore((s) => s.setContact);
    const setExternalLink = useCreateEventStore((s) => s.setExternalLink);

    const sectionPositions = useRef({
        subcategory: 0,
        tags: 0,
        visibility: 0,
        optional: 0,
    });

    const registerSection = useCallback((key: keyof typeof sectionPositions.current) => {
        return (event: LayoutChangeEvent) => {
            sectionPositions.current[key] = event.nativeEvent.layout.y;
        };
    }, []);

    const scrollToSection = useCallback(
        (key: keyof typeof sectionPositions.current) => {
            const y = sectionPositions.current[key];
            if (!scrollViewRef?.current) return;
            scrollViewRef.current.scrollTo({ y: Math.max(0, y - 12), animated: true });
        },
        [scrollViewRef]
    );

    return (
        <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
        >
            <Text style={styles.sectionTitle}>Catégorie & Visibilité</Text>
            <CategorySelector
                selected={category}
                subcategory={subcategory}
                onSelect={(value) => {
                    setCategory(value);
                    requestAnimationFrame(() => scrollToSection('subcategory'));
                }}
                onSelectSubcategory={(value) => {
                    setSubcategory(value);
                    requestAnimationFrame(() => scrollToSection('tags'));
                }}
                onSubcategoryLayout={registerSection('subcategory')}
            />
            <View onLayout={registerSection('tags')}>
                <TagsSelector
                    selected={tags}
                    onChange={(next) => {
                        setTags(next);
                        if (next.length > 0) {
                            requestAnimationFrame(() => scrollToSection('visibility'));
                        }
                    }}
                />
            </View>
            <View onLayout={registerSection('visibility')}>
                <VisibilitySelector
                    value={visibility}
                    privateAudienceIds={privateAudienceIds}
                    onChange={(next) => {
                        setVisibility(next);
                        if (next === 'public') setPrivateAudienceIds([]);
                    }}
                    onChangeAudience={setPrivateAudienceIds}
                />
                <View style={styles.togglesContainer}>
                    <View style={styles.toggleRow}>
                        <View>
                            <Text style={styles.toggleLabel}>Places limitées</Text>
                            <Text style={styles.toggleSubLabel}>Définir un nombre maximum de participants</Text>
                        </View>
                        <View style={[styles.switchTrack, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                            <View style={[styles.switchThumb, { transform: [{ translateX: 2 }] }]} />
                        </View>
                    </View>
                    <View style={styles.toggleRow}>
                        <View>
                            <Text style={styles.toggleLabel}>Inscription requise</Text>
                            <Text style={styles.toggleSubLabel}>Valider chaque demande manuellement</Text>
                        </View>
                        <View style={[styles.switchTrack, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                            <View style={[styles.switchThumb, { transform: [{ translateX: 2 }] }]} />
                        </View>
                    </View>
                </View>
            </View>
            <View onLayout={registerSection('optional')}>
                <OptionalInfoSection
                    price={price}
                    contact={contact}
                    externalLink={externalLink}
                    onOpen={() => requestAnimationFrame(() => scrollToSection('optional'))}
                    onInputFocus={onInputFocus}
                    onInputRef={onInputRef}
                    onChange={(data) => {
                        if (data.price !== undefined) setPrice(data.price);
                        if (data.contact !== undefined) setContact(data.contact);
                        if (data.externalLink !== undefined) setExternalLink(data.externalLink);
                    }}
                />
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    content: {
        padding: spacing.md,
        paddingBottom: spacing.xl * 3,
        gap: spacing.lg,
    },
    sectionTitle: {
        ...typography.h6,
        color: colors.brand.text,
        fontWeight: '700',
        marginBottom: spacing.xs,
    },
    togglesContainer: {
        gap: spacing.md,
        backgroundColor: colors.brand.surface,
        padding: spacing.md,
        borderRadius: 24,
        marginTop: spacing.sm,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    toggleLabel: {
        ...typography.body,
        color: colors.brand.text,
        fontWeight: '600',
    },
    toggleSubLabel: {
        ...typography.caption,
        color: colors.brand.textSecondary,
        maxWidth: 200,
    },
    switchTrack: {
        width: 44,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
    },
    switchThumb: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2.5,
        elevation: 2,
    },
});
