import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Image,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { ArrowLeft, Camera, Image as ImageIcon } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { AppBackground, Button } from '@/components/ui';
import { useImagePicker } from '@/hooks/useImagePicker';
import { useAuthStore } from '@/state/auth';
import { ContestsService } from '@/features/contests';

export default function ContestSubmitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const { pickImage, takePhoto } = useImagePicker();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [useLocation, setUseLocation] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [legalVersion, setLegalVersion] = useState('v1');

  React.useEffect(() => {
    if (!id) return;
    ContestsService.getById(id)
      .then((contest) => setLegalVersion(contest.legal_version || 'v1'))
      .catch(() => undefined);
  }, [id]);

  const onPick = async () => {
    const asset = await pickImage({ aspect: [4, 3] });
    if (asset?.uri) setImageUri(asset.uri);
  };

  const onTake = async () => {
    const asset = await takePhoto({ aspect: [4, 3] });
    if (asset?.uri) setImageUri(asset.uri);
  };

  const onSubmit = async () => {
    if (!id || !userId) {
      Alert.alert('Connexion requise', 'Connectez-vous pour participer.');
      return;
    }
    if (!legalAccepted) {
      Alert.alert('Consentement', 'Vous devez accepter le règlement pour participer.');
      return;
    }
    if (!imageUri) {
      Alert.alert('Photo requise', 'Ajoutez une photo de votre participation.');
      return;
    }

    setSubmitting(true);
    try {
      let lat: number | null = null;
      let lng: number | null = null;
      if (useLocation) {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status === 'granted') {
          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          lat = position.coords.latitude;
          lng = position.coords.longitude;
        }
      }

      const uploaded = await ContestsService.uploadEntryPhoto({
        contestId: id,
        userId,
        uri: imageUri,
      });

      await ContestsService.submitEntry({
        contestId: id,
        title,
        content,
        mediaUrl: uploaded.publicUrl,
        storagePath: uploaded.storagePath,
        legalVersion,
        lat,
        lng,
      });

      Alert.alert('Merci', 'Participation envoyée. Elle sera visible après validation.');
      router.replace(`/contests/${id}` as any);
    } catch (err) {
      Alert.alert('Erreur', err instanceof Error ? err.message : 'Envoi impossible.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.wrapper}>
      <AppBackground />
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={20} color={colors.neutral[100]} />
        </TouchableOpacity>
        <Text style={styles.title}>Participer</Text>
        <Text style={styles.meta}>
          Une photo + consentement légal. La localisation est optionnelle et affichée en zone, pas en pin exact.
        </Text>

        <View style={styles.row}>
          <TouchableOpacity style={styles.mediaBtn} onPress={onPick}>
            <ImageIcon size={18} color={colors.neutral[100]} />
            <Text style={styles.mediaBtnText}>Galerie</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mediaBtn} onPress={onTake}>
            <Camera size={18} color={colors.neutral[100]} />
            <Text style={styles.mediaBtnText}>Photo</Text>
          </TouchableOpacity>
        </View>

        {imageUri ? <Image source={{ uri: imageUri }} style={styles.preview} /> : null}

        <TextInput
          style={styles.input}
          placeholder="Titre"
          placeholderTextColor={colors.neutral[500]}
          value={title}
          onChangeText={setTitle}
        />
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="Description (optionnel)"
          placeholderTextColor={colors.neutral[500]}
          value={content}
          onChangeText={setContent}
          multiline
        />

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Utiliser ma position (zone)</Text>
          <Switch value={useLocation} onValueChange={setUseLocation} />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>
            J’accepte le règlement (version {legalVersion}) et autorise la diffusion de ma photo.
          </Text>
          <Switch value={legalAccepted} onValueChange={setLegalAccepted} />
        </View>

        <Button title="Envoyer" onPress={onSubmit} loading={submitting} disabled={submitting} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  content: { padding: spacing.lg, paddingTop: spacing.xl + spacing.md, gap: spacing.md },
  backBtn: { alignSelf: 'flex-start', padding: spacing.xs },
  title: { ...typography.h2, color: colors.neutral[50] },
  meta: { ...typography.caption, color: colors.neutral[400] },
  row: { flexDirection: 'row', gap: spacing.sm },
  mediaBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[800],
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  mediaBtnText: { ...typography.caption, color: colors.neutral[100] },
  preview: { width: '100%', height: 220, borderRadius: borderRadius.lg },
  input: {
    backgroundColor: colors.neutral[900],
    borderWidth: 1,
    borderColor: colors.neutral[800],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.neutral[50],
  },
  textarea: { minHeight: 100, textAlignVertical: 'top' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  switchLabel: { ...typography.caption, color: colors.neutral[200], flex: 1 },
});
