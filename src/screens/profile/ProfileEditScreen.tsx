import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { MapPin, Upload, User as UserIcon } from 'lucide-react-native';
import { AppBackground, Button, Input, ScreenHeader } from '../../components/ui';
import { LocationPickerModal } from '@/components/events/LocationPickerModal';
import { useAuth } from '../../hooks';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAutoScrollOnFocus } from '../../hooks/useAutoScrollOnFocus';
import { ProfileService } from '../../services/profile.service';
import { setHomeLocationFromCoords } from '@/services/push.service';
import { getVisibleHomeLocation } from '@/services/home-location.service';
import { MapboxService } from '@/services/mapbox.service';
import type { EventLocation } from '@/hooks/useCreateEventStore';
import type { Profile } from '../../types/database';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';

export default function ProfileEditScreen() {
  const router = useRouter();
  const { profile, user, refreshProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [avatarUri, setAvatarUri] = useState(profile?.avatar_url || '');
  const [coverUri, setCoverUri] = useState(profile?.cover_url || '');
  const [homeLocation, setHomeLocation] = useState<EventLocation | null>(null);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const insets = useSafeAreaInsets();
  const { scrollViewRef, registerFieldRef, handleInputFocus, handleScroll } = useAutoScrollOnFocus();

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    void (async () => {
      const coords = await getVisibleHomeLocation(profile.id);
      if (cancelled || !coords) return;
      const geo = await MapboxService.reverse(coords.lat, coords.lon);
      if (cancelled) return;
      setHomeLocation({
        latitude: coords.lat,
        longitude: coords.lon,
        addressLabel: geo?.label || profile.city || 'Position enregistrée',
        city: geo?.city || profile.city || '',
        postalCode: geo?.postalCode || '',
        country: geo?.country || 'FR',
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.city, profile?.id]);

  const handleSave = async () => {
    if (!user || !profile) return;

    if (!displayName.trim()) {
      Alert.alert('Erreur', 'Le nom d\'affichage est requis');
      return;
    }

    setLoading(true);
    const updates: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>> = {
      display_name: displayName,
      bio: bio || null,
    };

    if (avatarUri && avatarUri !== profile.avatar_url) {
      updates.avatar_url = avatarUri;
    }
    if (coverUri && coverUri !== profile.cover_url) {
      updates.cover_url = coverUri;
    }
    if (homeLocation?.city) {
      updates.city = homeLocation.city;
    }

    const updatedProfile = await ProfileService.updateProfile(user.id, updates);
    if (homeLocation && Number.isFinite(homeLocation.latitude) && Number.isFinite(homeLocation.longitude)) {
      const saved = await setHomeLocationFromCoords(homeLocation.latitude, homeLocation.longitude);
      if (!saved) {
        setLoading(false);
        Alert.alert('Lieu de référence', 'Le profil a été enregistré, mais le lieu n’a pas pu être mis à jour.');
        return;
      }
    }
    setLoading(false);

    if (updatedProfile) {
      if (refreshProfile) {
        await refreshProfile();
      }
      Alert.alert('Succès', 'Profil mis à jour');
      router.back();
    } else {
      Alert.alert('Erreur', 'Impossible de mettre à jour le profil');
    }
  };

  const handleUseCurrentPosition = async () => {
    if (locating) return;
    setLocating(true);
    try {
      let status = (await Location.getForegroundPermissionsAsync()).status;
      if (status !== 'granted') {
        status = (await Location.requestForegroundPermissionsAsync()).status;
      }
      if (status !== 'granted') {
        Alert.alert('Position', 'Autorisez la localisation pour utiliser votre position actuelle.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const geo = await MapboxService.reverse(pos.coords.latitude, pos.coords.longitude);
      setHomeLocation({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        addressLabel: geo?.label || 'Ma position actuelle',
        city: geo?.city || '',
        postalCode: geo?.postalCode || '',
        country: geo?.country || 'FR',
      });
    } catch {
      Alert.alert('Position', 'Impossible de récupérer votre position actuelle.');
    } finally {
      setLocating(false);
    }
  };

  const handleAvatarUpload = async () => {
    if (Platform.OS === 'web') {
      fileInputRef.current?.click();
      return;
    }

    if (!user) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Autorisation requise', 'Veuillez autoriser l’accès à vos photos pour changer l’avatar.');
      return;
    }

    const mediaTypes = [(ImagePicker as any).MediaType?.Images ?? 'images'] as any;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    const asset = result.assets[0];
    if (!asset.uri) return;

    setUploadingAvatar(true);
    const uploadedUrl = await ProfileService.uploadAvatar(user.id, asset.uri);
    setUploadingAvatar(false);

    if (uploadedUrl) {
      setAvatarUri(uploadedUrl);
      Alert.alert('Succès', 'Avatar uploadé');
    } else {
      Alert.alert('Erreur', 'Impossible d\'uploader l\'avatar');
    }
  };

  const handleCoverUpload = async () => {
    if (!user) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Autorisation requise', 'Veuillez autoriser l’accès à vos photos pour changer la couverture.');
      return;
    }
    const mediaTypes = [(ImagePicker as any).MediaType?.Images ?? 'images'] as any;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    if (!asset.uri) return;
    setUploadingAvatar(true);
    const uploadedUrl = await ProfileService.uploadAvatar(user.id, asset.uri);
    setUploadingAvatar(false);
    if (uploadedUrl) {
      setCoverUri(uploadedUrl);
      Alert.alert('Succès', 'Couverture mise à jour');
    } else {
      Alert.alert('Erreur', 'Impossible d\'uploader la couverture');
    }
  };

  const handleFileChange = async (event: any) => {
    if (!user) return;

    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      Alert.alert('Erreur', 'Veuillez sélectionner une image');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      Alert.alert('Erreur', 'L\'image ne doit pas dépasser 5 Mo');
      return;
    }

    setUploadingAvatar(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      const uploadedUrl = await ProfileService.uploadAvatar(user.id, dataUrl);

      if (uploadedUrl) {
        setAvatarUri(uploadedUrl);
        Alert.alert('Succès', 'Avatar uploadé');
      } else {
        Alert.alert('Erreur', 'Impossible d&apos;uploader l&apos;avatar');
      }
      setUploadingAvatar(false);
    };

    reader.readAsDataURL(file);
  };

  if (!profile) {
    return (
      <View style={styles.loadingContainer}>
        <AppBackground />
        <ActivityIndicator size="large" color={colors.brand.secondary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.top}
    >
      <AppBackground />
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={{ paddingBottom: spacing.xl + insets.bottom }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
      <ScreenHeader title="Modifier le profil" onBack={() => router.back()} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.coverWrapper} onPress={handleCoverUpload} disabled={uploadingAvatar}>
          {coverUri ? (
            <Image source={{ uri: coverUri }} style={styles.cover} />
          ) : (
            <View style={[styles.cover, styles.coverPlaceholder]} />
          )}
          <View style={styles.coverOverlay}>
            <Text style={styles.coverText}>Changer la couverture</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.avatarContainer}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <UserIcon size={48} color={colors.brand.textSecondary} />
            </View>
          )}
          <TouchableOpacity
            style={styles.cameraButton}
            onPress={handleAvatarUpload}
            disabled={uploadingAvatar}
          >
            {uploadingAvatar ? (
              <ActivityIndicator size="small" color={colors.brand.secondary} />
            ) : (
              <Upload size={20} color={colors.brand.primary} />
            )}
          </TouchableOpacity>
        </View>
        {Platform.OS === 'web' && (
          <input
            ref={fileInputRef as any}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        )}
        <Text style={styles.uploadHint}>Cliquez sur l&apos;icône pour changer votre avatar</Text>
      </View>

      <View style={styles.form}>
        <Input
          label="Nom d'affichage *"
          placeholder="Votre nom"
          value={displayName}
          onChangeText={setDisplayName}
          ref={registerFieldRef('displayName')}
          onFocus={() => handleInputFocus('displayName')}
        />

        <Input
          label="Bio"
          placeholder="Parlez-nous de vous..."
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={4}
          ref={registerFieldRef('bio')}
          onFocus={() => handleInputFocus('bio')}
        />

        <Text style={styles.locationLabel}>Lieu de référence</Text>
        <TouchableOpacity
          style={styles.locationField}
          onPress={() => setLocationModalVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Modifier le lieu de référence"
        >
          <MapPin size={18} color={colors.brand.secondary} />
          <Text
            style={[styles.locationValue, !homeLocation && !profile.city && styles.locationPlaceholder]}
            numberOfLines={2}
          >
            {homeLocation?.addressLabel || profile.city || 'Choisir un lieu'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.locationHint}>
          Ville ou quartier pour les événements autour de vous et les alertes à proximité.
        </Text>
        <Button
          title={locating ? 'Localisation…' : 'Utiliser ma position actuelle'}
          variant="outline"
          size="sm"
          onPress={() => void handleUseCurrentPosition()}
          loading={locating}
          disabled={locating}
        />

        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue}>{profile.email}</Text>
        </View>

        <Button
          title="Enregistrer"
          onPress={handleSave}
          loading={loading}
          fullWidth
          style={styles.saveButton}
        />
      </View>
      </ScrollView>
      <LocationPickerModal
        visible={locationModalVisible}
        location={homeLocation}
        onClose={() => setLocationModalVisible(false)}
        onConfirmLocation={(location) => {
          setHomeLocation(location);
          setLocationModalVisible(false);
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.brand.page,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.brand.page,
  },
  header: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingBottom: spacing.lg,
  },
  coverWrapper: {
    width: '100%',
    height: 180,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    backgroundColor: 'rgba(124, 181, 24,0.08)',
  },
  coverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  coverText: {
    ...typography.caption,
    color: colors.neutral[0],
    fontWeight: '600',
  },
  avatarContainer: {
    position: 'relative',
    marginTop: -60,
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: borderRadius.full,
    borderWidth: 4,
    borderColor: colors.brand.primary,
  },
  avatarPlaceholder: {
    backgroundColor: colors.brand.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.brand.secondary,
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.brand.primary,
  },
  uploadHint: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    textAlign: 'center',
  },
  form: {
    padding: spacing.lg,
  },
  locationLabel: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.brand.textSecondary,
    marginBottom: spacing.xs,
  },
  locationField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(26,51,41,0.12)',
    backgroundColor: colors.brand.surface,
  },
  locationValue: {
    ...typography.body,
    color: colors.brand.text,
    flex: 1,
  },
  locationPlaceholder: {
    color: colors.brand.textSecondary,
  },
  locationHint: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  infoBox: {
    padding: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: spacing.md,
  },
  infoLabel: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    marginBottom: spacing.xs,
  },
  infoValue: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '600',
  },
  saveButton: {
    marginTop: spacing.lg,
  },
});
