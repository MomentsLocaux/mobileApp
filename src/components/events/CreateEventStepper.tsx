import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    BackHandler,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import PagerView from 'react-native-pager-view';
import { ChevronLeft, Rocket, Pencil, X } from 'lucide-react-native';
import { colors, typography, spacing, borderRadius } from '@/constants/theme';
import { Motion, createStandardTiming } from '@/constants/motion';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { haptics } from '@/utils/haptics';
import { Step1Content } from '@/components/events/steps/Step1Content';
import { Step2Content } from '@/components/events/steps/Step2Content';
import { Step3Content } from '@/components/events/steps/Step3Content';
import { CoverGenerateStep } from '@/components/events/CoverGenerateStep';
import { hasCreateEventDraft, useCreateEventStore } from '@/hooks/useCreateEventStore';
import { confirmDiscardEventDraft } from '@/utils/discard-event-draft';
import { useAuth } from '@/hooks';
import { EventsService } from '@/services/events.service';
import { EventDedupService } from '@/services/event-dedup.service';
import { invalidateMySuggestionHistory } from '@/services/suggestion-history.service';
import { EventSuggestEntryButton } from '@/components/events/EventSuggestEntryButton';
import { eventScheduleModeToDb, isSameDayRange, operatingHoursFromDraft } from '@/utils/event-schedule';
import { prefillCreateEventStore } from '@/utils/prefill-create-event-store';
import { withoutNeedsChangesTag } from '@/constants/moderation-tags';

const isRemoteUrl = (url?: string | null) => !!url && /^https?:\/\//i.test(url);

export const CreateEventStepper = () => {
    const router = useRouter();
    const navigation = useNavigation();
    const { user } = useAuth();
    const { edit } = useLocalSearchParams<{ edit?: string }>();
    const insets = useSafeAreaInsets();
    const allowExitRef = useRef(false);

    const pagerRef = useRef<PagerView>(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [formValid, setFormValid] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const reduceMotion = useReduceMotion();
    const progressAnim = useSharedValue((1 / 4) * 100);

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
    const submissionSource = useCreateEventStore((s) => s.submissionSource);
    const scheduleMode = useCreateEventStore((s) => s.scheduleMode);
    const scheduleOpenDays = useCreateEventStore((s) => s.scheduleOpenDays);
    const scheduleFixedSlots = useCreateEventStore((s) => s.scheduleFixedSlots);
    const scheduleVariableDays = useCreateEventStore((s) => s.scheduleVariableDays);
    const resetStore = useCreateEventStore((s) => s.reset);
    const [editPrefill, setEditPrefill] = useState<'idle' | 'loading' | 'ready' | 'blocked'>('idle');
    const isSuggest = submissionSource === 'community_suggest';
    const currentStepRef = useRef(currentStep);
    currentStepRef.current = currentStep;

    const canProceedStep1 = useMemo(
        () => formValid && !!title.trim() && !!startDate && !!location,
        [formValid, title, startDate, location]
    );

    const canProceedStep2 = useMemo(
        () => !!category && !!title && !!startDate && !!location,
        [category, title, startDate, location]
    );

    const canPublish = canProceedStep2 && !!coverImage;

    const missingStep1Fields = useMemo(() => {
        const missing: string[] = [];
        if (!title.trim()) missing.push('un titre');
        if (!startDate) missing.push('une date');
        if (!location) missing.push('un lieu');
        return missing;
    }, [title, startDate, location]);

    const missingPublishFields = useMemo(() => {
        const missing: string[] = [...missingStep1Fields];
        if (!coverImage) missing.push('une cover');
        if (!category) missing.push('une catégorie');
        return missing;
    }, [missingStep1Fields, coverImage, category]);

    const missingFieldsHint =
        missingPublishFields.length > 0
            ? `Il manque ${missingPublishFields.join(', ')}.`
            : null;

    const goToPage = (page: number) => {
        pagerRef.current?.setPage(page);
    };

    const handlePageChange = (e: any) => {
        setCurrentStep(e.nativeEvent.position);
    };

    const handleNext = () => {
        if (currentStep === 0 && !canProceedStep1) {
            Alert.alert(
                'Informations manquantes',
                missingStep1Fields.length > 0
                    ? `Il manque ${missingStep1Fields.join(', ')}.`
                    : 'Veuillez remplir tous les champs obligatoires.'
            );
            return;
        }
        if (currentStep === 1 && !canProceedStep2) {
            Alert.alert(
                'Informations manquantes',
                missingFieldsHint || 'Veuillez sélectionner une catégorie.'
            );
            return;
        }
        if (currentStep === 2 && !coverImage) {
            Alert.alert('Couverture requise', 'Ajoute une photo ou génère une couverture pour continuer.');
            return;
        }
        goToPage(currentStep + 1);
    };

    const handlePrevious = () => {
        goToPage(currentStep - 1);
    };

    const handleClose = () => {
        if (navigation.canGoBack()) {
            navigation.goBack();
            return;
        }
        router.replace('/(tabs)');
    };

    const handleBack = () => {
        if (currentStep > 0) {
            goToPage(currentStep - 1);
            return;
        }
        handleClose();
    };

    const marker = '/storage/v1/object/public/event-media/';
    const derivePath = (url?: string) => {
        if (!url) return undefined;
        const idx = url.indexOf(marker);
        return idx !== -1 ? url.slice(idx + marker.length) : undefined;
    };

    const handlePublish = async (options?: { skipDedup?: boolean }) => {
        if (!canPublish || !location || !startDate || !user) return;

        if (!edit && !options?.skipDedup) {
            try {
                setSubmitting(true);
                const duplicates = await EventDedupService.findSubmitDuplicates({
                    title,
                    startsAt: typeof startDate === 'string' ? startDate : new Date(startDate).toISOString(),
                    latitude: location.latitude,
                    longitude: location.longitude,
                });
                const top = duplicates[0];
                if (top) {
                    setSubmitting(false);
                    Alert.alert(
                        'Cet événement existe déjà',
                        `« ${top.title} »${top.city ? ` à ${top.city}` : ''} ressemble à votre saisie.`,
                        [
                            { text: 'Annuler', style: 'cancel' },
                            ...(top.status === 'published'
                                ? [{
                                    text: 'Voir la fiche',
                                    onPress: () => router.push(`/events/${top.id}` as any),
                                }]
                                : []),
                            {
                                text: 'Signaler quand même',
                                onPress: () => {
                                    void handlePublish({ skipDedup: true });
                                },
                            },
                        ],
                    );
                    return;
                }
            } catch (error) {
                console.warn('dedup check', error);
            }
        }

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
            const contact_email = !isSuggest && contact && contact.includes('@') ? contact : null;
            const contact_phone = !isSuggest && contact && !contact.includes('@') ? contact : null;
            let priceValue: number | null = null;
            if (!isSuggest && price) {
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
                tags: withoutNeedsChangesTag(tags),
                starts_at: startDate,
                ends_at: endDate || null,
                latitude: location.latitude,
                longitude: location.longitude,
                address: location.addressLabel,
                city: location.city,
                postal_code: location.postalCode,
                visibility: isSuggest || visibility === 'public' ? 'public' : 'prive',
                is_free: isSuggest ? true : !price || price.toLowerCase().includes('gratuit'),
                price: priceValue,
                cover_url: finalCoverUrl,
                max_participants: null,
                registration_required: null,
                external_url: externalLink || videoLink || null,
                contact_email,
                contact_phone,
                schedule_mode: eventScheduleModeToDb(
                    isSameDayRange(startDate, endDate) ? 'single_day' : scheduleMode,
                ),
                operating_hours: operatingHoursFromDraft({
                    startDate,
                    endDate,
                    scheduleMode: isSameDayRange(startDate, endDate) ? 'single_day' : scheduleMode,
                    scheduleOpenDays,
                    scheduleFixedSlots,
                    scheduleVariableDays,
                }),
                status: 'pending',
                creator_id: user?.id, // suggester for RLS + Mes suggestions; public organizer is Moments Locaux when community_suggest
                submission_source: submissionSource,
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

            allowExitRef.current = true;
            resetStore();
            haptics.success();
            if (isSuggest && user?.id) {
              invalidateMySuggestionHistory(user.id);
            }
            Toast.show({
                type: 'success',
                text1: edit ? 'Événement mis à jour' : isSuggest ? 'Proposition envoyée' : 'Événement créé',
                text2: edit
                    ? 'Ton événement a été mis à jour avec succès.'
                    : isSuggest
                      ? 'Merci ! Votre proposition sera vérifiée avant publication.'
                      : 'Ton événement a été créé et sera vérifié avant publication.',
            });
            router.replace((isSuggest ? '/profile/my-suggestions' : '/profile/my-events') as any);
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
                return isSuggest ? 'Proposer un événement' : 'Créer un événement';
            case 1:
                return isSuggest ? "Détails de l'événement repéré" : "Détails de l'événement";
            case 2:
                return 'Couverture';
            case 3:
                return 'Prévisualisation';
            default:
                return isSuggest ? 'Proposer un événement' : 'Créer un événement';
        }
    };

    const getSubtitle = () => {
        return `Étape ${currentStep + 1} sur 4`;
    };

    useEffect(() => {
        let cancelled = false;
        if (!edit) {
            setEditPrefill('ready');
            return;
        }
        setEditPrefill('loading');
        void prefillCreateEventStore(edit).then((result) => {
            if (cancelled) return;
            if (!result.ok) {
                setEditPrefill('blocked');
                Alert.alert(
                    'Édition indisponible',
                    result.reason === 'missing'
                        ? 'Événement introuvable.'
                        : 'Seuls les brouillons et les événements refusés peuvent être modifiés depuis l’app.',
                    [{ text: 'OK', onPress: () => router.replace(`/events/${edit}` as any) }],
                );
                return;
            }
            setEditPrefill('ready');
        });
        return () => {
            cancelled = true;
        };
    }, [edit, router]);

    useEffect(() => {
        const target = ((currentStep + 1) / 4) * 100;
        progressAnim.value = reduceMotion
            ? target
            : withTiming(target, createStandardTiming(Motion.duration.normal));
    }, [currentStep, progressAnim, reduceMotion]);

    const progressBarStyle = useAnimatedStyle(() => ({
        width: `${progressAnim.value}%`,
    }));

    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (event) => {
            if (allowExitRef.current) return;
            const inProgress =
                hasCreateEventDraft(useCreateEventStore.getState()) || currentStepRef.current > 0;
            if (!inProgress) {
                resetStore();
                return;
            }
            event.preventDefault();
            confirmDiscardEventDraft(() => {
                allowExitRef.current = true;
                resetStore();
                navigation.dispatch(event.data.action);
            });
        });
        return unsubscribe;
    }, [navigation, resetStore]);

    useEffect(() => {
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            if (currentStepRef.current > 0) {
                pagerRef.current?.setPage(currentStepRef.current - 1);
                return true;
            }
            return false;
        });
        return () => subscription.remove();
    }, []);

    const canContinue =
        currentStep === 0 ? canProceedStep1 : currentStep === 1 ? canProceedStep2 : Boolean(coverImage);

    const renderContinueFooter = () => (
        <View style={styles.footer}>
            {currentStep === 0 ? (
                <View style={styles.prevBtnSpacer} />
            ) : (
                <TouchableOpacity style={styles.prevBtn} onPress={handlePrevious} accessibilityRole="button">
                    <Text style={styles.prevText}>Précédent</Text>
                </TouchableOpacity>
            )}
            <TouchableOpacity
                style={[styles.nextBtn, !canContinue && styles.nextBtnDisabled]}
                disabled={!canContinue}
                onPress={handleNext}
                accessibilityRole="button"
                accessibilityLabel="Continuer"
            >
                <Text style={[styles.nextText, !canContinue && styles.nextTextDisabled]}>Continuer</Text>
            </TouchableOpacity>
        </View>
    );

    const renderFooter = () => {
        switch (currentStep) {
            case 0:
            case 1:
            case 2:
                return renderContinueFooter();

            case 3:
                return (
                    <View style={styles.publishFooter}>
                        <TouchableOpacity
                            style={[styles.publishBtn, (!canPublish || submitting) && styles.publishDisabled]}
                            disabled={!canPublish || submitting}
                            onPress={() => void handlePublish()}
                            accessibilityRole="button"
                            accessibilityLabel="Soumettre pour validation"
                        >
                            {submitting ? (
                                <ActivityIndicator color={colors.brand.onAccent} />
                            ) : (
                                <>
                                    <Rocket size={20} color={colors.brand.onAccent} />
                                    <Text style={styles.publishText}>Soumettre pour validation</Text>
                                </>
                            )}
                        </TouchableOpacity>
                        {missingFieldsHint ? (
                            <Text style={styles.missingHint}>{missingFieldsHint}</Text>
                        ) : (
                            <Text style={styles.missingHint}>
                                {isSuggest
                                    ? 'Votre proposition sera vérifiée avant d’être publiée.'
                                    : 'Votre événement sera vérifié avant d’être publié.'}
                            </Text>
                        )}
                        <TouchableOpacity style={styles.editBtn} disabled={submitting} onPress={() => goToPage(0)}>
                            <Pencil size={18} color={colors.brand.text} />
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
                    <TouchableOpacity
                        style={styles.headerBtn}
                        onPress={handleBack}
                        accessibilityRole="button"
                        accessibilityLabel={currentStep > 0 ? 'Étape précédente' : 'Retour'}
                    >
                        <ChevronLeft size={20} color={colors.brand.text} />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerTitle}>{getTitle()}</Text>
                        <Text style={styles.headerSubtitle}>{getSubtitle()}</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.headerBtn}
                        onPress={handleClose}
                        accessibilityRole="button"
                        accessibilityLabel="Fermer"
                    >
                        <X size={20} color={colors.brand.text} />
                    </TouchableOpacity>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressBarContainer}>
                    <Animated.View style={[styles.progressBar, progressBarStyle]} />
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
                        <EventSuggestEntryButton visible={submissionSource !== 'community_suggest'} />
                        <View style={{ flex: 1 }}>
                            <Step1Content onValidate={setFormValid} />
                        </View>
                    </View>
                    <View key="1" style={{ flex: 1 }}>
                        <Step2Content />
                    </View>
                    <View key="2" style={{ flex: 1 }}>
                        <CoverGenerateStep />
                    </View>
                    <View key="3" style={{ flex: 1 }}>
                        <Step3Content />
                    </View>
                </PagerView>

                {/* Footer */}
                {renderFooter()}
                {editPrefill === 'loading' ? (
                    <View style={styles.prefillOverlay}>
                        <ActivityIndicator color={colors.brand.secondary} />
                    </View>
                ) : null}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: colors.brand.page,
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
        backgroundColor: colors.brand.surfaceMuted,
        width: '100%',
    },
    progressBar: {
        height: '100%',
        backgroundColor: colors.brand.secondary,
    },
    footer: {
        padding: spacing.md,
        backgroundColor: colors.brand.page,
        borderTopWidth: 1,
        borderTopColor: colors.brand.surfaceMuted,
        flexDirection: 'row',
        gap: spacing.md,
    },
    publishFooter: {
        padding: spacing.md,
        backgroundColor: colors.brand.page,
        borderTopWidth: 1,
        borderTopColor: colors.brand.surfaceMuted,
        gap: spacing.sm,
    },
    missingHint: {
        ...typography.caption,
        color: colors.brand.textSecondary,
        textAlign: 'center',
        paddingHorizontal: spacing.sm,
    },
    prevBtn: {
        flex: 1,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.full,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.brand.surfaceMuted,
        backgroundColor: colors.brand.surface,
    },
    prevBtnSpacer: {
        flex: 1,
    },
    prevText: {
        ...typography.body,
        color: colors.brand.text,
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
        backgroundColor: colors.brand.surfaceMuted,
    },
    nextText: {
        ...typography.body,
        color: colors.brand.onAccent,
        fontWeight: '700',
    },
    nextTextDisabled: {
        color: colors.brand.textSecondary,
    },
    publishBtn: {
        backgroundColor: colors.brand.secondary,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.full,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
    },
    publishDisabled: {
        backgroundColor: colors.brand.surfaceMuted,
    },
    publishText: {
        ...typography.body,
        color: colors.brand.onAccent,
        fontWeight: '700',
    },
    editBtn: {
        backgroundColor: colors.brand.surfaceMuted,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.full,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
    },
    editText: {
        ...typography.body,
        color: colors.brand.text,
        fontWeight: '600',
    },
    prefillOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15,23,25,0.45)',
    },
});
