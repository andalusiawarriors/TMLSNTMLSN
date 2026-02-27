import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Image,
  Pressable,
  ActivityIndicator,
  Alert,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { format } from 'date-fns';
import { useTheme } from '../context/ThemeContext';
import { useActiveWorkout } from '../context/ActiveWorkoutContext';
import { supabase } from '../lib/supabase';
import { Camera, Image as ImageIcon, CaretLeft } from 'phosphor-react-native';
import { getWorkoutSessions, getUserSettings } from '../utils/storage';
import { toDisplayVolume, formatWeightDisplay } from '../utils/units';

export default function WorkoutSaveScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { originRoute } = useActiveWorkout();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [createdPostId, setCreatedPostId] = useState<string | null>(null);

  const [session, setSession] = useState<any>(null);
  const [weightUnit, setWeightUnit] = useState<'lb' | 'kg'>('lb');

  useEffect(() => {
    async function loadSession() {
      const [sessions, settings] = await Promise.all([
        getWorkoutSessions(),
        getUserSettings(),
      ]);
      const found = sessions.find((s: any) => s.id === sessionId);
      setSession(found || null);
      setWeightUnit(settings.weightUnit);
    }
    if (sessionId) loadSession();
  }, [sessionId]);

  // Derived stats
  const duration = session?.duration ?? 0;
  const totalSets = session
    ? session.exercises.reduce(
        (acc: number, ex: any) =>
          acc + ex.sets.filter((s: any) => s.completed).length,
        0
      )
    : 0;
  const rawVolume = session
    ? session.exercises.reduce(
        (acc: number, ex: any) =>
          acc +
          ex.sets
            .filter((s: any) => s.completed)
            .reduce(
              (sacc: number, set: any) => sacc + set.weight * set.reps,
              0
            ),
        0
      )
    : 0;
  const volumeDisplay = toDisplayVolume(rawVolume, weightUnit);
  const volumeStr = formatWeightDisplay(volumeDisplay, weightUnit);

  const formatDuration = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera access.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setUploadError(null);
    }
  };

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant photo access.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setUploadError(null);
    }
  };

  const handleSave = async () => {
    if (!supabase || !sessionId) return;
    setIsSaving(true);
    setUploadError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      let postId = createdPostId;

      if (!postId) {
        const { data: postData, error: postError } = await supabase
          .from('workout_posts')
          .insert({
            user_id: user.id,
            session_id: sessionId,
            title: title.trim() || null,
            description: description.trim() || null,
            visibility: isPublic ? 'public' : 'private',
          })
          .select()
          .single();

        if (postError) throw postError;
        postId = postData.id;
        setCreatedPostId(postId);
        if (__DEV__) console.log('[WorkoutSave] created postId:', postId);
      }

      if (imageUri) {
        const timestamp = Date.now();
        const imagePath = `${postId}/${timestamp}.jpg`;

        const file = await fetch(imageUri);
        const blob = await file.blob();

        const { error: uploadErr } = await supabase.storage
          .from('workout-images')
          .upload(imagePath, blob, { upsert: true });

        if (uploadErr) {
          setUploadError(
            'Image upload failed. Post saved. Tap Save again to retry.'
          );
          if (__DEV__) console.warn('[WorkoutSave] upload failed:', uploadErr);
          setIsSaving(false);
          return;
        }

        const { error: updateErr } = await supabase
          .from('workout_posts')
          .update({ image_path: imagePath })
          .eq('id', postId);

        if (updateErr) {
          setUploadError(
            'Could not update post with image. Tap Save again to retry.'
          );
          if (__DEV__)
            console.warn('[WorkoutSave] update image_path failed:', updateErr);
          setIsSaving(false);
          return;
        }

        if (__DEV__)
          console.log('[WorkoutSave] uploaded image_path:', imagePath);
      }

      const dest =
        originRoute && originRoute !== '/(tabs)/workout'
          ? originRoute
          : '/(tabs)/nutrition';
      router.replace(dest as any);
    } catch (e) {
      console.error('Save error', e);
      Alert.alert('Error', 'Could not save post.');
    } finally {
      setIsSaving(false);
    }
  };

  const dateLabel = format(new Date(), 'EEEE, MMMM d · h:mm a');

  const divider = (
    <View
      style={[
        styles.divider,
        { backgroundColor: colors.primaryLight + '15' },
      ]}
    />
  );

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={[styles.root, { backgroundColor: colors.primaryDark }]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* TOP BAR */}
          <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
            <Pressable
              onPress={() => router.back()}
              style={styles.topBarLeft}
              hitSlop={12}
            >
              <CaretLeft size={24} color={colors.primaryLight} weight="regular" />
            </Pressable>

            <Text style={[styles.screenTitle, { color: colors.primaryLight }]}>
              Save Workout
            </Text>

            <Pressable
              onPress={handleSave}
              style={styles.topBarRight}
              hitSlop={12}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={colors.primaryDark} />
              ) : (
                <View
                  style={[
                    styles.saveButton,
                    { backgroundColor: colors.primaryLight },
                  ]}
                >
                  <Text
                    style={[
                      styles.saveButtonText,
                      { color: colors.primaryDark },
                    ]}
                  >
                    Save
                  </Text>
                </View>
              )}
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[
              styles.scroll,
              { paddingBottom: insets.bottom + 48 },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Error banner */}
            {uploadError ? (
              <View
                style={[
                  styles.errorRow,
                  { backgroundColor: '#FF3B30' + '15' },
                ]}
              >
                <Text style={[styles.errorText, { color: colors.primaryLight }]}>
                  {uploadError}
                </Text>
              </View>
            ) : null}

            {/* 1. Title input */}
            <TextInput
              style={[styles.titleInput, { color: colors.primaryLight }]}
              placeholder="Workout title"
              placeholderTextColor={colors.primaryLight + '30'}
              value={title}
              onChangeText={setTitle}
              returnKeyType="done"
            />

            {/* 2. Divider */}
            {divider}

            {/* 3. Stats row */}
            <View style={styles.statsRow}>
              <View style={styles.statCol}>
                <Text
                  style={[
                    styles.statLabel,
                    { color: colors.primaryLight + '50' },
                  ]}
                >
                  Duration
                </Text>
                <Text
                  style={[styles.statValue, { color: colors.primaryLight }]}
                >
                  {duration > 0 ? formatDuration(duration) : '--'}
                </Text>
              </View>

              <View style={styles.statCol}>
                <Text
                  style={[
                    styles.statLabel,
                    { color: colors.primaryLight + '50' },
                  ]}
                >
                  Volume
                </Text>
                <Text
                  style={[styles.statValue, { color: colors.primaryLight }]}
                >
                  {rawVolume > 0 ? volumeStr : '--'}
                </Text>
              </View>

              <View style={styles.statCol}>
                <Text
                  style={[
                    styles.statLabel,
                    { color: colors.primaryLight + '50' },
                  ]}
                >
                  Sets
                </Text>
                <Text
                  style={[styles.statValue, { color: colors.primaryLight }]}
                >
                  {totalSets > 0 ? String(totalSets) : '--'}
                </Text>
              </View>
            </View>

            {/* 4. Divider */}
            {divider}

            {/* 5. When row */}
            <View style={styles.whenRow}>
              <Text
                style={[
                  styles.whenLabel,
                  { color: colors.primaryLight + '60' },
                ]}
              >
                When
              </Text>
              <Text
                style={[styles.whenValue, { color: colors.primaryLight }]}
              >
                {dateLabel}
              </Text>
            </View>

            {/* 6. Divider */}
            {divider}

            {/* 7. Photo row */}
            <View style={styles.photoRow}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.previewImage} />
              ) : (
                <View
                  style={[
                    styles.photoPlaceholder,
                    { borderColor: colors.primaryLight + '25' },
                  ]}
                >
                  <Camera
                    size={22}
                    color={colors.primaryLight + '40'}
                    weight="regular"
                  />
                </View>
              )}

              <View style={styles.photoButtons}>
                <Pressable
                  style={[
                    styles.photoBtn,
                    { backgroundColor: colors.primaryLight + '10' },
                  ]}
                  onPress={handleTakePhoto}
                >
                  <Camera size={18} color={colors.primaryLight} weight="regular" />
                  <Text
                    style={[styles.photoBtnLabel, { color: colors.primaryLight }]}
                  >
                    Camera
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.photoBtn,
                    { backgroundColor: colors.primaryLight + '10' },
                  ]}
                  onPress={handlePickPhoto}
                >
                  <ImageIcon
                    size={18}
                    color={colors.primaryLight}
                    weight="regular"
                  />
                  <Text
                    style={[styles.photoBtnLabel, { color: colors.primaryLight }]}
                  >
                    Gallery
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* 8. Divider */}
            {divider}

            {/* 9. Description */}
            <View style={styles.descSection}>
              <Text
                style={[
                  styles.descLabel,
                  { color: colors.primaryLight + '50' },
                ]}
              >
                Description
              </Text>
              <TextInput
                style={[styles.descInput, { color: colors.primaryLight }]}
                placeholder="How did your workout go? Leave some notes here..."
                placeholderTextColor={colors.primaryLight + '30'}
                multiline
                value={description}
                onChangeText={setDescription}
                textAlignVertical="top"
              />
            </View>

            {/* 10. Divider */}
            {divider}

            {/* 11. Visibility row */}
            <View style={styles.visibilityRow}>
              <Text
                style={[styles.visibilityLabel, { color: colors.primaryLight }]}
              >
                Visibility
              </Text>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{
                  false: colors.primaryLight + '20',
                  true: colors.primaryLight + '80',
                }}
                thumbColor={
                  isPublic
                    ? colors.primaryDark
                    : colors.primaryLight + '60'
                }
                ios_backgroundColor={colors.primaryLight + '20'}
              />
            </View>

            {/* 12. Divider */}
            <View
              style={[
                styles.divider,
                styles.discardDivider,
                { backgroundColor: colors.primaryLight + '15' },
              ]}
            />

            {/* 13. Discard button */}
            <Pressable
              onPress={() => router.back()}
              style={styles.discardWrap}
              hitSlop={8}
            >
              <Text style={styles.discardText}>Discard Workout</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  topBarLeft: {
    minWidth: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  topBarRight: {
    minWidth: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  screenTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  saveButton: {
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },

  // Scroll
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },

  // Error banner
  errorRow: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
  },

  // Divider
  divider: {
    height: StyleSheet.hairlineWidth,
  },

  // 1. Title
  titleInput: {
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: -0.5,
    paddingVertical: 20,
  },

  // 3. Stats row
  statsRow: {
    flexDirection: 'row',
    paddingVertical: 16,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
  },

  // 5. When row
  whenRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  whenLabel: {
    fontSize: 15,
  },
  whenValue: {
    fontSize: 15,
  },

  // 7. Photo row
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 14,
  },
  photoPlaceholder: {
    width: 72,
    height: 90,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: 72,
    height: 90,
    borderRadius: 10,
  },
  photoButtons: {
    flex: 1,
    gap: 10,
  },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  photoBtnLabel: {
    fontSize: 15,
    fontWeight: '500',
  },

  // 9. Description
  descSection: {
    paddingVertical: 14,
  },
  descLabel: {
    fontSize: 12,
    marginBottom: 8,
  },
  descInput: {
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
  },

  // 11. Visibility
  visibilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  visibilityLabel: {
    fontSize: 15,
  },

  // 12. Discard divider spacing
  discardDivider: {
    marginTop: 16,
  },

  // 13. Discard
  discardWrap: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  discardText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FF3B30',
    textAlign: 'center',
  },
});
