import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MapboxGL from '@rnmapbox/maps';
import { ChevronLeft } from 'lucide-react-native';
import { AppBackground, colors, radius, shadows, spacing, typography } from '@/components/ui/v2';
import { useCreateEventStore } from '@/hooks/useCreateEventStore';
import { EventsService } from '@/services/events.service';
import { useAuth } from '@/hooks';

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '');

export default function CreateEventStep3() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    coverImage,
    title,
    startDate,
    endDate,
    category,
    tags,
    visibility,
    price,
    description,
    location,
    duration,
    contact,
    externalLink,
    videoLink,
    reset,
  } = useCreateEventStore();

  const [loading, setLoading] = useState(false);

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

  const endDateLabel = useMemo(() => {
    if (!endDate) return '';
    const d = new Date(endDate);
    return d.toLocaleString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [endDate]);

  const canPublish = !!title && !!startDate && !!location && !!category;

  const handlePublish = async () => {
    if (!canPublish || !user) {
      Alert.alert('Champs requis', 'Complétez les informations avant de publier.');
      return;
    }
    try {
      setLoading(true);
      const contact_email = contact && contact.includes('@') ? contact : null;
      const contact_phone = contact && !contact.includes('@') ? contact : null;
      let priceValue: number | null = null;
      if (price) {
        const normalized = Number(price.replace(',', '.').replace(/[^0-9.-]/g, ''));
        if (!Number.isNaN(normalized)) priceValue = normalized;
      }

      const payload = {
        title,
        description: description || '',
        category: category as any,
        tags,
        starts_at: startDate,
        ends_at: endDate || null,
        latitude: location?.latitude,
        longitude: location?.longitude,
        address: location?.addressLabel,
        city: location?.city,
        postal_code: location?.postalCode,
        visibility: visibility === 'public' ? 'public' : 'prive',
        is_free: !price || price.toLowerCase().includes('gratuit'),
        price: priceValue,
        cover_url: coverImage?.publicUrl || null,
        max_participants: null,
        registration_required: null,
        external_url: externalLink || videoLink || null,
        contact_email,
        contact_phone,
        status: 'pending',
        creator_id: user.id,
      };

      await EventsService.create(payload as any);
      reset();
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
      console.error('publish event step3', e);
      Alert.alert('Erreur', 'Une erreur est survenue, veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <AppBackground opacity={0.2} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()} accessibilityRole="button">
          <ChevronLeft size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Aperçu de l'événement</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {coverImage?.publicUrl ? (
            <Image source={{ uri: coverImage.publicUrl }} style={styles.heroImg} />
          ) : (
            <View style={[styles.heroImg, styles.heroPlaceholder]} />
          )}
          <View style={styles.heroOverlay}>
            <Text style={styles.heroTitle} numberOfLines={1}>
              {title || 'Événement'}
            </Text>
            <Text style={styles.heroMeta}>{dateLabel || 'Date à venir'}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Infos principales</Text>
          <Text style={styles.infoLine}>{title || 'Titre manquant'}</Text>
          <Text style={styles.metaText}>Catégorie : {category || 'Non définie'}</Text>
          {tags.length > 0 ? (
            <View style={styles.tagsRow}>
              {tags.map((tag) => (
                <View key={tag} style={styles.tagChip}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.metaText}>Aucun tag</Text>
          )}
          <Text style={styles.metaText}>
            {price ? `Prix : ${price}` : 'Gratuit'}
          </Text>
          <Text style={styles.metaText}>
            Visibilité : {visibility === 'public' ? 'Public' : 'Non listé'}
          </Text>
          {endDateLabel ? <Text style={styles.metaText}>Fin : {endDateLabel}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Emplacement</Text>
          <Text style={styles.infoLine}>{location?.addressLabel || 'Adresse manquante'}</Text>
          <Text style={styles.metaText}>
            {location?.postalCode ? `${location.postalCode} ` : ''}
            {location?.city || ''}
          </Text>
          <View style={styles.mapBox}>
            {location ? (
              <MapboxGL.MapView
                style={StyleSheet.absoluteFill}
                styleURL={MapboxGL.StyleURL.Street}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
              >
                <MapboxGL.Camera
                  zoomLevel={13}
                  centerCoordinate={[location.longitude, location.latitude]}
                />
                <MapboxGL.PointAnnotation
                  id="preview-step3"
                  coordinate={[location.longitude, location.latitude]}
                >
                  <View />
                </MapboxGL.PointAnnotation>
              </MapboxGL.MapView>
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.mapPlaceholder]} />
            )}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Description</Text>
          {description ? (
            <Text style={styles.bodyText}>{description}</Text>
          ) : (
            <Text style={styles.metaText}>Aucune description ajoutée</Text>
          )}
        </View>

        {(duration || contact || externalLink || videoLink) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Infos pratiques</Text>
            {duration ? <Text style={styles.metaText}>Durée : {duration}</Text> : null}
            {contact ? <Text style={styles.metaText}>Contact : {contact}</Text> : null}
            {externalLink ? <Text style={styles.metaText}>Lien : {externalLink}</Text> : null}
            {videoLink ? <Text style={styles.metaText}>Lien visio : {videoLink}</Text> : null}
          </View>
        )}

        <View style={styles.cardInfo}>
          <Text style={styles.infoText}>Une fois publié, l'événement sera visible sur la carte.</Text>
          <Text style={styles.infoText}>Vous pourrez le modifier ou le supprimer à tout moment.</Text>
          <Text style={styles.infoText}>Cet événement pourra être soumis à une vérification.</Text>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.primaryBtn, (!canPublish || loading) && styles.primaryDisabled]}
          disabled={!canPublish || loading}
          accessibilityRole="button"
          onPress={handlePublish}
        >
          {loading ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.primaryText}>Publier l'événement</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  headerBtn: {
    minHeight: 44,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  headerTitle: {
    ...typography.subsection,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 3,
    gap: spacing.lg,
  },
  hero: {
    borderRadius: radius.card,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.surfaceLevel2,
    height: 220,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  heroImg: {
    width: '100%',
    height: '100%',
  },
  heroPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.35)',
    gap: spacing.xs,
  },
  heroTitle: {
    ...typography.subsection,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  heroMeta: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  card: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.card,
    padding: spacing.md,
    backgroundColor: colors.surfaceLevel1,
    gap: spacing.sm,
    ...shadows.surfaceSoft,
  },
  cardTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  infoLine: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  metaText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  bodyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tagChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceLevel2,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  tagText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  mapBox: {
    height: 200,
    borderRadius: radius.element,
    overflow: 'hidden',
    backgroundColor: colors.surfaceLevel2,
  },
  mapPlaceholder: {
    backgroundColor: colors.surfaceLevel2,
  },
  cardInfo: {
    borderRadius: radius.card,
    padding: spacing.md,
    backgroundColor: colors.surfaceLevel1,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: spacing.xs,
  },
  infoText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surfaceLevel1,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  secondaryBtn: {
    flex: 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  primaryBtn: {
    flex: 1,
    minHeight: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.primaryGlow,
  },
  primaryDisabled: {
    opacity: 0.45,
  },
  primaryText: {
    ...typography.body,
    color: colors.background,
    fontWeight: '700',
  },
});
