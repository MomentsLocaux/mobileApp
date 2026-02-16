import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import PagerView from 'react-native-pager-view';
import { ChevronLeft, Rocket, Pencil } from 'lucide-react-native';
import { colors, typography, spacing, borderRadius } from '@/constants/theme';
import { Step1Content } from '@/components/events/steps/Step1Content';
import { Step2Content } from '@/components/events/steps/Step2Content';
import { Step3Content } from '@/components/events/steps/Step3Content';
import { useCreateEventStore } from '@/hooks/useCreateEventStore';
import { useAuth } from '@/hooks';
import { EventsService } from '@/services/events.service';
import { useEventsStore } from '@/store';

const isRemoteUrl = (url?: string | null) => !!url && /^https?:\/\//i.test(url);

export const CreateEventStepper = () => {
    const router = useRouter();
    const { user } = useAuth();
    const { edit } = useLocalSearchParams<{ edit?: string }>();
    const insets = useSafeAreaInsets();

    const pagerRef = useRef<PagerView>(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [formValid, setFormValid] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const coverImage = useCreateEventStore((s) => s.coverImage);
    const title = useCreateEventStore((s) => s.title);
    const startDate = useCreateEventStore((s) => s.startDate);
    const endDate = useCreateEventStore((s) => s.endDate);
    const location = useCreateEventStore((s) => s.location);
    const description = useCreateEventStore((s) => s.description);
    const category = useCreateEventStore((s) => s.category);
    const subcategory = useCreateEventStore((s) => s.subcategory);
    const tags = useCreateEventStore((s) => s.tags);
    const visibility = useCreateEventStore((s) => s.visibility);
    const price = useCreateEventStore((s) => s.price);
    const contact = useCreateEventStore((s) => s.contact);
    const externalLink = useCreateEventStore((s) => s.externalLink);
    const videoLink = useCreateEventStore((s) => s.videoLink);
    const gallery = useCreateEventStore((s) => s.gallery);
    const resetStore = useCreateEventStore((s) => s.reset);

    const canProceedStep1 = useMemo(
        () => !!coverImage && formValid && !!title.trim() && !!startDate && !!location,
        [coverImage, formValid, title, startDate, location]
    );

    const canProceedStep2 = useMemo(
        () => !!category && !!title && !!startDate && !!location,
        [category, title, startDate, location]
    );

    const canPublish = canProceedStep2;

    const goToPage = (page: number) => {
        pagerRef.current?.setPage(page);
    };

    const handlePageChange = (e: any) => {
        setCurrentStep(e.nativeEvent.position);
    };

    const handleNext = () => {
        if (currentStep === 0 && !canProceedStep1) {
            Alert.alert('Informations manquantes', 'Veuillez remplir tous les champs obligatoires.');
            return;
        }
        if (currentStep === 1 && !canProceedStep2) {
            Alert.alert('Catégorie requise', 'Veuillez sélectionner une catégorie.');
            return;
        }
        goToPage(currentStep + 1);
    };

    const handlePrevious = () => {
        goToPage(currentStep - 1);
    };

    const handleBack = () => {
        if (currentStep > 0) {
            goToPage(currentStep - 1);
        } else {
            router.back();
        }
    };

    const marker = '/storage/v1/object/public/event-media/';
    const derivePath = (url?: string) => {
        if (!url) return undefined;
        const idx = url.indexOf(marker);
        return idx !== -1 ? url.slice(idx + marker.length) : undefined;
    };

    const handlePublish = async () => {
        if (!canPublish || !location || !startDate || !user) return;

        const activeImages = gallery
            .filter((g) => g.status !== 'removed' && g.publicUrl && g.publicUrl.trim().length > 0)
            .slice(0, 3);
        const activeMedias = activeImages.map((g, index) => ({
            id: g.id,
            url: g.publicUrl,
            order: index,
        }));
        const removedImages = gallery.filter((g) => g.status === 'removed');
        const removedPaths = Array.from(
            new Set(
                removedImages
                    .map((g) => g.storagePath || derivePath(g.publicUrl))
                    .filter((p): p is string => !!p)
            )
        );

        try {
            setSubmitting(true);
            const contact_email = contact && contact.includes('@') ? contact : null;
            const contact_phone = contact && !contact.includes('@') ? contact : null;
            let priceValue: number | null = null;
            if (price) {
                const normalized = Number(price.replace(',', '.').replace(/[^0-9.-]/g, ''));
                if (!Number.isNaN(normalized)) {
                    priceValue = normalized;
                }
            }

            let finalCoverUrl = coverImage?.publicUrl || null;
            if (coverImage?.publicUrl && !isRemoteUrl(coverImage.publicUrl)) {
                const uploaded = await EventsService.uploadEventCover(user.id, coverImage.publicUrl);
                if (uploaded) {
                    finalCoverUrl = uploaded;
                }
            }

            const payload = {
                title,
                description: description || '',
                category: category as any,
                subcategory: subcategory || null,
                tags,
                starts_at: startDate,
                ends_at: endDate || null,
                latitude: location.latitude,
                longitude: location.longitude,
                address: location.addressLabel,
                city: location.city,
                postal_code: location.postalCode,
                visibility: visibility === 'public' ? 'public' : 'prive',
                is_free: !price || price.toLowerCase().includes('gratuit'),
                price: priceValue,
                cover_url: finalCoverUrl,
                max_participants: null,
                registration_required: null,
                external_url: externalLink || videoLink || null,
                contact_email,
                contact_phone,
                status: 'pending',
                creator_id: user?.id,
            };

            if (edit) {
                await EventsService.update(edit, payload as any);
                if (activeMedias.length > 0) {
                    await EventsService.setMedia(edit, activeMedias);
                }
            } else {
                const created = await EventsService.create(payload as any);
                if (created?.id && activeMedias.length > 0) {
                    await EventsService.setMedia(created.id, activeMedias);
                }
            }

            resetStore();
            Alert.alert(
                edit ? 'Événement mis à jour' : 'Événement créé',
                edit
                    ? 'Ton événement a été mis à jour avec succès.'
                    : 'Ton événement a été créé et sera vérifié avant publication.',
                [
                    {
                        text: 'OK',
                        onPress: () => router.replace('/profile/my-events' as any),
                    },
                ]
            );
        } catch (e) {
            console.error('publish event', e);
            Alert.alert('Erreur', 'Impossible de publier cet événement pour le moment.');
        } finally {
            setSubmitting(false);
        }
    };

    const getTitle = () => {
        switch (currentStep) {
            case 0:
                return 'Créer un événement';
            case 1:
                return "Détails de l'événement";
            case 2:
                return 'Prévisualisation';
            default:
                return 'Créer un événement';
        }
    };

    const getSubtitle = () => {
        return `Étape ${currentStep + 1} sur 3`;
    };

    const getProgress = () => {
        return ((currentStep + 1) / 3) * 100;
    };

    const renderFooter = () => {
        switch (currentStep) {
            case 0:
                return (
                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={[styles.nextBtn, !canProceedStep1 && styles.nextBtnDisabled]}
                            disabled={!canProceedStep1}
                            onPress={handleNext}
                        >
                            <Text style={styles.nextText}>Suivant</Text>
                        </TouchableOpacity>
                    </View>
                );

            case 1:
                return (
                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.prevBtn} onPress={handlePrevious}>
                            <Text style={styles.prevText}>Précédent</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.nextBtn, !canProceedStep2 && styles.nextBtnDisabled]}
                            disabled={!canProceedStep2}
                            onPress={handleNext}
                        >
                            <Text style={styles.nextText}>Continuer</Text>
                        </TouchableOpacity>
                    </View>
                );

            case 2:
                return (
                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={[styles.publishBtn, (!canPublish || submitting) && styles.publishDisabled]}
                            disabled={!canPublish || submitting}
                            onPress={handlePublish}
                        >
                            {submitting ? (
                                <ActivityIndicator color="#0f1719" />
                            ) : (
                                <>
                                    <Rocket size={20} color="#0f1719" />
                                    <Text style={styles.publishText}>Publier maintenant</Text>
                                </>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.editBtn} disabled={submitting} onPress={() => goToPage(0)}>
                            <Pencil size={18} color="#fff" />
                            <Text style={styles.editText}>Modifier les informations</Text>
                        </TouchableOpacity>
                    </View>
                );

            default:
                return null;
        }
    };

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={insets.top}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.headerBtn} onPress={handleBack}>
                        <ChevronLeft size={20} color={colors.brand.text} />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerTitle}>{getTitle()}</Text>
                        <Text style={styles.headerSubtitle}>{getSubtitle()}</Text>
                    </View>
                    <View style={styles.headerBtn} />
                </View>

                {/* Progress Bar */}
                <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBar, { width: `${getProgress()}%` }]} />
                </View>

                {/* Pager */}
                <PagerView
                    ref={pagerRef}
                    style={{ flex: 1 }}
                    initialPage={0}
                    scrollEnabled={false} // Disable swipe gestures, only allow button navigation
                    onPageSelected={handlePageChange}
                >
                    <View key="0" style={{ flex: 1 }}>
                        <Step1Content onValidate={setFormValid} />
                    </View>
                    <View key="1" style={{ flex: 1 }}>
                        <Step2Content />
                    </View>
                    <View key="2" style={{ flex: 1 }}>
                        <Step3Content />
                    </View>
                </PagerView>

                {/* Footer */}
                {renderFooter()}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: colors.brand.primary,
    },
    header: {
        height: 64,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
    },
    headerBtn: {
        padding: spacing.sm,
        minWidth: 64,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitleContainer: {
        alignItems: 'center',
    },
    headerTitle: {
        ...typography.h5,
        color: colors.brand.text,
        fontWeight: '700',
    },
    headerSubtitle: {
        ...typography.caption,
        color: colors.brand.textSecondary,
        fontSize: 12,
        textTransform: 'uppercase',
    },
    progressBarContainer: {
        height: 4,
        backgroundColor: '#1e293b',
        width: '100%',
    },
    progressBar: {
        height: '100%',
        backgroundColor: colors.brand.secondary,
    },
    footer: {
        padding: spacing.md,
        backgroundColor: colors.brand.primary,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
        flexDirection: 'row',
        gap: spacing.md,
    },
    prevBtn: {
        flex: 1,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.full,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    prevText: {
        ...typography.body,
        color: '#fff',
        fontWeight: '600',
    },
    nextBtn: {
        flex: 1,
        backgroundColor: colors.brand.secondary,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.full,
        alignItems: 'center',
    },
    nextBtnDisabled: {
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    nextText: {
        ...typography.body,
        color: '#0f1719',
        fontWeight: '700',
    },
    publishBtn: {
        flex: 1,
        backgroundColor: colors.brand.secondary,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.full,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
    },
    publishDisabled: {
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    publishText: {
        ...typography.body,
        color: '#0f1719',
        fontWeight: '700',
    },
    editBtn: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingVertical: spacing.md,
        borderRadius: borderRadius.full,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
    },
    editText: {
        ...typography.body,
        color: '#fff',
        fontWeight: '600',
    },
});
