import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Upload, User as UserIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBackground, Button, Input, TopBar, Card, colors, radius, spacing, typography } from '@/components/ui/v2';
import { useAuth } from '@/hooks';
import { useAutoScrollOnFocus } from '@/hooks/useAutoScrollOnFocus';
import { ProfileService } from '@/services/profile.service';
import { getRoleLabel } from '@/utils/roleHelpers';

export default function ProfileEditScreen() {
  const router = useRouter();
  const { profile, user, refreshProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [avatarUri, setAvatarUri] = useState(profile?.avatar_url || '');
  const [coverUri, setCoverUri] = useState(profile?.cover_url || '');
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const insets = useSafeAreaInsets();
  const { scrollViewRef, registerFieldRef, handleInputFocus, handleScroll } = useAutoScrollOnFocus();

  const handleSave = async () => {
    if (!user || !profile) return;

    if (!displayName.trim()) {
      Alert.alert('Erreur', "Le nom d'affichage est requis");
      return;
    }

    setLoading(true);
    const updates: Record<string, unknown> = {
      display_name: displayName.trim(),
      bio: bio || null,
    };

    if (avatarUri && avatarUri !== profile.avatar_url) {
      updates.avatar_url = avatarUri;
    }
    if (coverUri && coverUri !== profile.cover_url) {
      updates.cover_url = coverUri;
    }

    const updatedProfile = await ProfileService.updateProfile(user.id, updates);
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

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    if (!asset.uri) return;

    setUploadingAvatar(true);
    const uploadedUrl = await ProfileService.uploadAvatar(user.id, asset.uri);
    setUploadingAvatar(false);

    if (uploadedUrl) {
      setAvatarUri(uploadedUrl);
      Alert.alert('Succès', 'Avatar mis à jour');
    } else {
      Alert.alert('Erreur', "Impossible d'uploader l'avatar");
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
      Alert.alert('Erreur', "Impossible d'uploader la couverture");
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
      Alert.alert('Erreur', "L'image ne doit pas dépasser 5 Mo");
      return;
    }

    setUploadingAvatar(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      const uploadedUrl = await ProfileService.uploadAvatar(user.id, dataUrl);
      if (uploadedUrl) {
        setAvatarUri(uploadedUrl);
        Alert.alert('Succès', 'Avatar mis à jour');
      } else {
        Alert.alert('Erreur', "Impossible d'uploader l'avatar");
      }
      setUploadingAvatar(false);
    };
    reader.readAsDataURL(file);
  };

  if (!profile) {
    return (
      <View style={styles.loadingContainer}>
        <AppBackground opacity={0.18} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppBackground opacity={0.18} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top}
      >
        <View style={styles.topBarWrap}>
          <TopBar title="Modifier le profil" onBack={() => router.back()} />
        </View>

        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: spacing.xl + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          <Card padding="none" style={styles.heroCard}>
            <TouchableOpacity
              style={styles.coverWrapper}
              onPress={handleCoverUpload}
              disabled={uploadingAvatar}
              accessibilityRole="button"
              activeOpacity={0.85}
            >
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
                  <UserIcon size={42} color={colors.textSecondary} />
                </View>
              )}
              <TouchableOpacity
                style={styles.cameraButton}
                onPress={handleAvatarUpload}
                disabled={uploadingAvatar}
                accessibilityRole="button"
              >
                {uploadingAvatar ? (
                  <ActivityIndicator size="small" color={colors.background} />
                ) : (
                  <Upload size={18} color={colors.background} />
                )}
              </TouchableOpacity>
            </View>

            {Platform.OS === 'web' ? (
              <input
                ref={fileInputRef as any}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            ) : null}

            <Text style={styles.uploadHint}>Touchez l’icône pour changer votre avatar</Text>
          </Card>

          <Card padding="md" style={styles.formCard}>
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
              style={styles.bioInput}
              ref={registerFieldRef('bio')}
              onFocus={() => handleInputFocus('bio')}
            />

            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{profile.email}</Text>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>Rôle</Text>
              <Text style={styles.infoValue}>{getRoleLabel(profile.role)}</Text>
            </View>

            <Button
              title="Enregistrer"
              onPress={handleSave}
              loading={loading}
              fullWidth
              accessibilityRole="button"
            />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  topBarWrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  heroCard: {
    overflow: 'hidden',
    alignItems: 'center',
    paddingBottom: spacing.md,
  },
  coverWrapper: {
    width: '100%',
    height: 170,
    backgroundColor: colors.surfaceLevel2,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    backgroundColor: colors.surfaceLevel2,
  },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  coverText: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  avatarContainer: {
    marginTop: -52,
    position: 'relative',
  },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: radius.full,
    borderWidth: 3,
    borderColor: colors.background,
  },
  avatarPlaceholder: {
    backgroundColor: colors.surfaceLevel2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraButton: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  uploadHint: {
    marginTop: spacing.sm,
    ...typography.caption,
    color: colors.textSecondary,
  },
  formCard: {
    gap: spacing.md,
  },
  bioInput: {
    minHeight: 120,
    borderRadius: radius.element,
    textAlignVertical: 'top',
    paddingTop: spacing.md,
  },
  infoBox: {
    borderRadius: radius.element,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: 'rgba(36, 49, 51, 0.55)',
    padding: spacing.md,
    gap: spacing.xxs,
  },
  infoLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  infoValue: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
});
