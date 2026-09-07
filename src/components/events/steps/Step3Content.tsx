import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Calendar, MapPin, Euro } from 'lucide-react-native';
import { colors, typography, spacing, borderRadius } from '@/constants/theme';
import { EventPreviewMiniMap } from '@/components/events/EventPreviewMiniMap';
import { useCreateEventStore } from '@/hooks/useCreateEventStore';
import { getCategoryLabel } from '@/constants/categories';
import { useTaxonomyStore } from '@/store/taxonomyStore';

export const Step3Content = () => {
    const coverImage = useCreateEventStore((s) => s.coverImage);
    const title = useCreateEventStore((s) => s.title);
    const startDate = useCreateEventStore((s) => s.startDate);
    const location = useCreateEventStore((s) => s.location);
    const description = useCreateEventStore((s) => s.description);
    const category = useCreateEventStore((s) => s.category);
    const price = useCreateEventStore((s) => s.price);
    const categoriesMap = useTaxonomyStore((s) => s.categoriesMap);
    const categoryLabel = categoriesMap[category || '']?.label || (category ? getCategoryLabel(category as any) : undefined);

    const dateLabel = useMemo(() => {
        if (!startDate) return '';
        const d = new Date(startDate);
        return d.toLocaleString('fr-FR', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        });
    }, [startDate]);

    return (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionTitle}>Aperçu de l'événement</Text>

            <View style={styles.previewCard}>
                <EventPreviewMiniMap
                    coverUrl={coverImage?.publicUrl}
                    title={title}
                    dateLabel={dateLabel}
                    category={categoryLabel}
                    city={location?.city}
                    location={location}
                />

                <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>{title}</Text>

                    <View style={styles.infoRow}>
                        <Calendar size={16} color={colors.brand.secondary} />
                        <Text style={styles.infoText}>{dateLabel}</Text>
                    </View>

                    <View style={styles.infoRow}>
                        <MapPin size={16} color={colors.brand.secondary} />
                        <Text style={styles.infoText}>{location?.addressLabel || location?.city}</Text>
                    </View>

                    <View style={styles.infoRow}>
                        <Euro size={16} color={colors.brand.secondary} />
                        <Text style={styles.infoText}>
                            {!price || price === '0' ? 'Gratuit' : `${price}€ par personne`}
                        </Text>
                    </View>

                    <View style={styles.divider} />

                    <Text style={styles.descriptionLabel}>Description</Text>
                    {description ? <Text style={styles.description}>{description}</Text> : null}
                </View>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    content: {
        padding: spacing.md,
        paddingBottom: 168,
    },
    sectionTitle: {
        ...typography.h6,
        color: colors.brand.text,
        fontWeight: '700',
        marginBottom: spacing.md,
    },
    previewCard: {
        borderRadius: borderRadius.lg,
        overflow: 'hidden',
        backgroundColor: colors.brand.surface,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    cardContent: {
        padding: spacing.md,
        gap: spacing.sm,
    },
    cardTitle: {
        ...typography.h4,
        color: colors.brand.text,
        fontWeight: '700',
        marginBottom: spacing.xs,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    infoText: {
        ...typography.body,
        color: colors.brand.text,
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginVertical: spacing.md,
    },
    descriptionLabel: {
        ...typography.body,
        color: colors.brand.textSecondary,
        fontWeight: '700',
        marginBottom: spacing.xs,
    },
    description: {
        ...typography.body,
        color: colors.brand.text,
        lineHeight: 22,
    },
});
