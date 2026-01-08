import React, { useState, useRef } from 'react';
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
import { useRouter } from 'expo-router';
import { Upload, User as UserIcon, ChevronLeft } from 'lucide-react-native';
import { Button, Input } from '../../components/ui';
import { useAuth } from '../../hooks';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAutoScrollOnFocus } from '../../hooks/useAutoScrollOnFocus';
import { ProfileService } from '../../services/profile.service';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { getRoleLabel } from '../../utils/roleHelpers';

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
  const { scrollViewRef, registerField, handleInputFocus } = useAutoScrollOnFocus();

  const handleSave = async () => {
    if (!user || !profile) return;

    if (!displayName.trim()) {
      Alert.alert('Erreur', 'Le nom d\'affichage est requis');
      return;
    }

    setLoading(true);
    const updates: any = {
      display_name: displayName,
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
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.top}
    >
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={{ paddingBottom: spacing.xl + insets.bottom }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
      <View style={styles.navRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={20} color={colors.neutral[700]} />
          <Text style={styles.backText}>Retour</Text>
        </TouchableOpacity>
      </View>

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
              <UserIcon size={48} color={colors.neutral[400]} />
            </View>
          )}
          <TouchableOpacity
            style={styles.cameraButton}
            onPress={handleAvatarUpload}
            disabled={uploadingAvatar}
          >
            {uploadingAvatar ? (
              <ActivityIndicator size="small" color={colors.neutral[0]} />
            ) : (
              <Upload size={20} color={colors.neutral[0]} />
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
          onLayout={registerField('displayName')}
          onFocus={() => handleInputFocus('displayName')}
        />

        <Input
          label="Bio"
          placeholder="Parlez-nous de vous..."
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={4}
          onLayout={registerField('bio')}
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
          style={styles.saveButton}
        />
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  backText: {
    ...typography.bodySmall,
    color: colors.neutral[700],
    fontWeight: '600',
  },
  header: {
    alignItems: 'center',
    backgroundColor: colors.neutral[0],
    paddingBottom: spacing.lg,
  },
  coverWrapper: {
    width: '100%',
    height: 180,
    backgroundColor: colors.neutral[200],
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    backgroundColor: colors.neutral[200],
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
  },
  avatarPlaceholder: {
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary[600],
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.neutral[0],
  },
  uploadHint: {
    ...typography.bodySmall,
    color: colors.neutral[600],
    textAlign: 'center',
  },
  form: {
    padding: spacing.lg,
  },
  infoBox: {
    padding: spacing.md,
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  infoLabel: {
    ...typography.bodySmall,
    color: colors.neutral[600],
    marginBottom: spacing.xs,
  },
  infoValue: {
    ...typography.body,
    color: colors.neutral[900],
    fontWeight: '600',
  },
  saveButton: {
    marginTop: spacing.lg,
  },
});
