import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { colors, typography, spacing, borderRadius } from '@/constants/theme';
import { EventPreviewMiniMap } from '@/components/events/EventPreviewMiniMap';
import { useCreateEventStore } from '@/hooks/useCreateEventStore';
import { EventsService } from '@/services/events.service';
import { useAuth } from '@/hooks';
import { supabase } from '@/lib/supabase/client';
import { useEventsStore } from '@/store';
import { GuestGateModal } from '@/components/auth/GuestGateModal';

const isRemoteUrl = (url?: string | null) => !!url && /^https?:\/\//i.test(url);

export default function CreateEventPreview() {
  const router = useRouter();
  const { user } = useAuth();
  const { edit } = useLocalSearchParams<{ edit?: string }>();

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
  const duration = useCreateEventStore((s) => s.duration);
  const contact = useCreateEventStore((s) => s.contact);
  const externalLink = useCreateEventStore((s) => s.externalLink);
  const videoLink = useCreateEventStore((s) => s.videoLink);
  const gallery = useCreateEventStore((s) => s.gallery);
  const resetStore = useCreateEventStore((s) => s.reset);

  const [submitting, setSubmitting] = useState(false);
  const isGuest = !user;
  const marker = '/storage/v1/object/public/event-media/';

  const derivePath = (url?: string) => {
    if (!url) return undefined;
    const idx = url.indexOf(marker);
    return idx !== -1 ? url.slice(idx + marker.length) : undefined;
  };

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

  const canPublish = useMemo(() => !!category && !!title && !!startDate && !!location, [
    category,
    title,
    startDate,
    location,
  ]);

  const handleConfirm = async () => {
    if (!canPublish || !location || !startDate) return;
    if (!user) return;

    // Sécurité : si on arrive directement sur la preview avec ?edit=... sans être passé par step-1
    if (edit && (!title || !location || !coverImage)) {
      Alert.alert('Données manquantes', 'Veuillez repasser par l’étape 1 pour charger toutes les données.');
      return;
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
        let oldCoverPath: string | undefined;
        try {
          const currentEvt = await EventsService.getById(edit);
          if (currentEvt && currentEvt.cover_url && currentEvt.cover_url !== finalCoverUrl) {
            oldCoverPath = derivePath(currentEvt.cover_url);
          }
        } catch (err) {
          console.warn('Failed to fetch original event for cleanup check', err);
        }

        await EventsService.update(edit, payload as any);
        if ((EventsService as any).setMedia) {
          await EventsService.setMedia(edit, activeMedias as any);
        }

        const finalRemovedPaths = [...removedPaths];
        if (oldCoverPath && !finalRemovedPaths.includes(oldCoverPath)) {
          finalRemovedPaths.push(oldCoverPath);
        }
        if (finalRemovedPaths.length > 0) {
          try {
            await supabase.storage.from('event-media').remove(finalRemovedPaths);
          } catch (rmErr) {
            console.warn('remove storage (edit)', rmErr);
          }
        }
        await useEventsStore.getState().fetchEvents({ force: true });
        resetStore();
        router.replace('/(tabs)/map');
        return;
      }

      const created = await EventsService.create(payload as any);
      if (activeMedias.length > 0 && (EventsService as any).setMedia) {
        await EventsService.setMedia(created.id, activeMedias as any);
      }
      if (removedPaths.length > 0) {
        try {
          await supabase.storage.from('event-media').remove(removedPaths);
        } catch (rmErr) {
          console.warn('remove storage (create)', rmErr);
        }
      }
      await useEventsStore.getState().fetchEvents({ force: true });
      resetStore();
      Alert.alert(
        'Événement soumis',
        'Votre événement a bien été soumis pour validation.',
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

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <ChevronLeft size={20} color={colors.neutral[800]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Prévisualisation</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Résumé de l'événement</Text>
        <EventPreviewMiniMap
          coverUrl={coverImage?.publicUrl}
          title={title}
          dateLabel={dateLabel}
          category={category}
          city={location?.city}
          location={location}
        />
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.confirmBtn, (!canPublish || submitting) && styles.confirmDisabled]}
          disabled={!canPublish || submitting}
          onPress={handleConfirm}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.confirmText}>Confirmer la création de l'événement</Text>
          )}
        </TouchableOpacity>
      </View>

      {isGuest ? (
        <GuestGateModal
          visible
          title="Créer un événement"
          onClose={() => router.replace('/(tabs)/map')}
          onSignUp={() => router.replace('/auth/register' as any)}
          onSignIn={() => router.replace('/auth/login' as any)}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.neutral[0],
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
  headerTitle: {
    ...typography.h5,
    color: colors.neutral[900],
    fontWeight: '700',
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
    gap: spacing.lg,
  },
  sectionTitle: {
    ...typography.h6,
    color: colors.neutral[900],
    fontWeight: '700',
  },
  description: {
    ...typography.body,
    color: colors.neutral[700],
  },
  footer: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    right: spacing.md,
  },
  confirmBtn: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    alignItems: 'center',
  },
  confirmDisabled: {
    backgroundColor: colors.neutral[300],
  },
  confirmText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '700',
  },
});
