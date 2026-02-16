import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Calendar, MapPin, Euro } from 'lucide-react-native';
import { colors, typography, spacing, borderRadius } from '@/constants/theme';
import { EventPreviewMiniMap } from '@/components/events/EventPreviewMiniMap';
import { useCreateEventStore } from '@/hooks/useCreateEventStore';

export const Step3Content = () => {
    const coverImage = useCreateEventStore((s) => s.coverImage);
    const title = useCreateEventStore((s) => s.title);
    const startDate = useCreateEventStore((s) => s.startDate);
    const location = useCreateEventStore((s) => s.location);
    const description = useCreateEventStore((s) => s.description);
    const category = useCreateEventStore((s) => s.category);
    const price = useCreateEventStore((s) => s.price);

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
                    category={category}
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

            <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>Simulation du fil</Text>
            <View style={styles.feedSimulation}>
                <View style={styles.feedHeader}>
                    <View style={styles.feedAvatar} />
                    <View style={{ gap: 2 }}>
                        <View style={styles.feedNamePatch} />
                        <View style={styles.feedTimePatch} />
                    </View>
                </View>
                <View style={styles.feedImagePlaceholder} />
                <View style={styles.feedTitlePatch} />
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    content: {
        padding: spacing.md,
        paddingBottom: spacing.xl * 3,
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
    feedSimulation: {
        backgroundColor: colors.brand.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        gap: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    feedHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    feedAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    feedNamePatch: {
        width: 120,
        height: 12,
        borderRadius: 6,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    feedTimePatch: {
        width: 80,
        height: 10,
        borderRadius: 5,
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    feedImagePlaceholder: {
        width: '100%',
        height: 180,
        borderRadius: borderRadius.md,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    feedTitlePatch: {
        width: '80%',
        height: 14,
        borderRadius: 7,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
});
