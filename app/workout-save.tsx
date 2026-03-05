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
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { format } from 'date-fns';
import { useTheme } from '../context/ThemeContext';
import { useActiveWorkout } from '../context/ActiveWorkoutContext';
import { supabase } from '../lib/supabase';
import { Camera, Image as ImageIcon, CaretLeft } from 'phosphor-react-native';
import { getWorkoutSessions, getUserSettings, finalizeWorkoutSession } from '../utils/storage';
import { toDisplayVolume, formatVolumeDisplay } from '../utils/units';
import { HomeGradientBackground } from '../components/HomeGradientBackground';

export default function WorkoutSaveScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { activeWorkout, setActiveWorkout, discardWorkout } = useActiveWorkout();

  const handleDiscard = () => {
    Alert.alert(
      'Discard Workout',
      'This will permanently delete this workout. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            discardWorkout(() => {
              router.replace('/(tabs)' as any);
            });
          },
        },
      ]
    );
  };

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
      if (found?.name && found.name !== 'Workout') setTitle(found.name);
    }
    if (sessionId) loadSession();
  }, [sessionId]);

  // Prefer active workout from context when it matches (user just tapped Finish); else use loaded session.
  useEffect(() => {
    if (sessionId && activeWorkout?.id === sessionId) {
      setSession(activeWorkout);
      if (activeWorkout.name && activeWorkout.name !== 'Workout') setTitle(activeWorkout.name);
    }
  }, [sessionId, activeWorkout]);

  // Derived stats
  const duration = session?.duration ?? 0;
  const totalSets = session
    ? session.exercises.reduce((acc: number, ex: any) => acc + ex.sets.filter((s: any) => s.completed).length, 0)
    : 0;
  const rawVolume = session
    ? session.exercises.reduce(
        (acc: number, ex: any) =>
          acc + ex.sets.filter((s: any) => s.completed).reduce((sacc: number, set: any) => sacc + set.weight * set.reps, 0),
        0
      )
    : 0;
  const volumeStr = rawVolume > 0 ? formatVolumeDisplay(toDisplayVolume(rawVolume, weightUnit), weightUnit) : '--';

  const formatDuration = (mins: number): string => {
    if (mins <= 0) return '--';
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Please grant camera access.'); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 5], quality: 0.7 });
    if (!result.canceled && result.assets[0]) { setImageUri(result.assets[0].uri); setUploadError(null); }
  };

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Please grant photo access.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 5], quality: 0.7 });
    if (!result.canceled && result.assets[0]) { setImageUri(result.assets[0].uri); setUploadError(null); }
  };

  const handleSave = async () => {
    if (!sessionId) return;
    const sessionToFinalize = (activeWorkout?.id === sessionId ? activeWorkout : null) ?? session;
    if (!sessionToFinalize) {
      Alert.alert('Error', 'Workout data not found. Go back and try again.');
      return;
    }
    setIsSaving(true);
    setUploadError(null);

    try {
      // Single canonical finalize: persist session + exercises + sets, run prescriptions, mark complete. Idempotent for same sessionId.
      const nameToUse = title.trim() || sessionToFinalize.name || 'Workout';
      const sessionWithName = { ...sessionToFinalize, name: nameToUse };
      await finalizeWorkoutSession(sessionWithName);

      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          let postId = createdPostId;
          if (!postId) {
            const { data: postData, error: postError } = await supabase
              .from('workout_posts')
              .insert({ user_id: user.id, session_id: sessionId, title: nameToUse, description: description.trim() || null, visibility: isPublic ? 'public' : 'private' })
              .select().single();
            if (postError) throw postError;
            postId = postData.id;
            setCreatedPostId(postId);
          }

          if (imageUri && postId) {
            const imagePath = `${postId}/${Date.now()}.jpg`;
            const arrayBuffer = await fetch(imageUri).then((r) => r.arrayBuffer());
            const { error: uploadErr } = await supabase.storage
              .from('workout-images')
              .upload(imagePath, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
            if (uploadErr) {
              if (__DEV__) console.warn('[workout-save] image upload error:', uploadErr);
              setUploadError('Image upload failed. Post saved. Tap Save again to retry.');
              setIsSaving(false);
              return;
            }
            const { error: updateErr } = await supabase
              .from('workout_posts')
              .update({ image_path: imagePath })
              .eq('id', postId);
            if (__DEV__ && updateErr) console.warn('[workout-save] image_path update error:', updateErr);
          }
        }
      }

      // Clear the active workout now that the user has confirmed the save
      setActiveWorkout(null);

      // Navigate to summary screen
      router.replace({ pathname: '/workout-logged', params: { sessionId } } as any);
    } catch (e) {
      console.error('Save error', e);
      Alert.alert('Error', 'Could not save workout.');
    } finally {
      setIsSaving(false);
    }
  };

  const dateLabel = format(new Date(), 'EEEE, MMMM d · h:mm a');

  const divider = <View style={[styles.divider, { backgroundColor: colors.primaryLight + '15' }]} />;

  return (
    <>
      {/* Hide the Expo Router header */}
      <Stack.Screen options={{ headerShown: false }} />

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={[styles.root, { backgroundColor: colors.primaryDark }]}>
          <HomeGradientBackground />
          <KeyboardAvoidingView style={{ flex: 1, zIndex: 2 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

            {/* Top bar */}
            <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
              <Pressable onPress={() => router.back()} style={styles.topBarLeft} hitSlop={12}>
                <CaretLeft size={24} color={colors.primaryLight} weight="regular" />
              </Pressable>
              <Text style={[styles.screenTitle, { color: colors.primaryLight }]}>Save Workout</Text>
              <Pressable onPress={handleSave} style={styles.topBarRight} hitSlop={12} disabled={isSaving}>
                {isSaving
                  ? <ActivityIndicator size="small" color={colors.primaryDark} />
                  : (
                    <View style={[styles.saveButton, { backgroundColor: colors.primaryLight }]}>
                      <Text style={[styles.saveButtonText, { color: colors.primaryDark }]}>Save</Text>
                    </View>
                  )
                }
              </Pressable>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 48 }]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {uploadError && (
                <View style={[styles.errorRow, { backgroundColor: '#FF3B30' + '15' }]}>
                  <Text style={[styles.errorText, { color: colors.primaryLight }]}>{uploadError}</Text>
                </View>
              )}

              {/* Title */}
              <TextInput
                style={[styles.titleInput, { color: colors.primaryLight }]}
                placeholder="Workout title"
                placeholderTextColor={colors.primaryLight + '30'}
                value={title}
                onChangeText={setTitle}
                returnKeyType="done"
              />

              {divider}

              {/* Stats */}
              <View style={styles.statsRow}>
                <View style={styles.statCol}>
                  <Text style={[styles.statLabel, { color: colors.primaryLight + '50' }]}>Duration</Text>
                  <Text style={[styles.statValue, { color: colors.primaryLight }]}>{formatDuration(duration)}</Text>
                </View>
                <View style={styles.statCol}>
                  <Text style={[styles.statLabel, { color: colors.primaryLight + '50' }]}>Volume</Text>
                  <Text style={[styles.statValue, { color: colors.primaryLight }]}>{volumeStr}</Text>
                </View>
                <View style={styles.statCol}>
                  <Text style={[styles.statLabel, { color: colors.primaryLight + '50' }]}>Sets</Text>
                  <Text style={[styles.statValue, { color: colors.primaryLight }]}>{totalSets > 0 ? String(totalSets) : '--'}</Text>
                </View>
              </View>

              {divider}

              {/* When */}
              <View style={styles.whenRow}>
                <Text style={[styles.whenLabel, { color: colors.primaryLight + '60' }]}>When</Text>
                <Text style={[styles.whenValue, { color: colors.primaryLight }]}>{dateLabel}</Text>
              </View>

              {divider}

              {/* Photo */}
              <View style={styles.photoRow}>
                {imageUri
                  ? <Image source={{ uri: imageUri }} style={styles.previewImage} />
                  : (
                    <View style={[styles.photoPlaceholder, { borderColor: colors.primaryLight + '25' }]}>
                      <Camera size={22} color={colors.primaryLight + '40'} weight="regular" />
                    </View>
                  )
                }
                <View style={styles.photoButtons}>
                  <Pressable style={[styles.photoBtn, { backgroundColor: colors.primaryLight + '10' }]} onPress={handleTakePhoto}>
                    <Camera size={18} color={colors.primaryLight} weight="regular" />
                    <Text style={[styles.photoBtnLabel, { color: colors.primaryLight }]}>Camera</Text>
                  </Pressable>
                  <Pressable style={[styles.photoBtn, { backgroundColor: colors.primaryLight + '10' }]} onPress={handlePickPhoto}>
                    <ImageIcon size={18} color={colors.primaryLight} weight="regular" />
                    <Text style={[styles.photoBtnLabel, { color: colors.primaryLight }]}>Gallery</Text>
                  </Pressable>
                </View>
              </View>

              {divider}

              {/* Description */}
              <View style={styles.descSection}>
                <Text style={[styles.descLabel, { color: colors.primaryLight + '50' }]}>Description</Text>
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

              {divider}

              {/* Visibility */}
              <View style={styles.visibilityRow}>
                <Text style={[styles.visibilityLabel, { color: colors.primaryLight }]}>Visibility</Text>
                <Switch
                  value={isPublic}
                  onValueChange={setIsPublic}
                  trackColor={{ false: colors.primaryLight + '20', true: colors.primaryLight + '80' }}
                  thumbColor={isPublic ? colors.primaryDark : colors.primaryLight + '60'}
                  ios_backgroundColor={colors.primaryLight + '20'}
                />
              </View>

              <View style={[styles.divider, styles.discardDivider, { backgroundColor: colors.primaryLight + '15' }]} />

              <Pressable onPress={handleDiscard} style={styles.discardWrap} hitSlop={8}>
                <Text style={styles.discardText}>Discard Workout</Text>
              </Pressable>
            </ScrollView>

          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
  topBarLeft: { minWidth: 40, alignItems: 'flex-start', justifyContent: 'center' },
  topBarRight: { minWidth: 40, alignItems: 'flex-end', justifyContent: 'center' },
  screenTitle: { fontSize: 17, fontWeight: '600', letterSpacing: -0.3 },
  saveButton: { borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8 },
  saveButtonText: { fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
  scroll: { paddingHorizontal: 20, paddingTop: 4 },
  errorRow: { padding: 12, borderRadius: 10, marginBottom: 8 },
  errorText: { fontSize: 14, lineHeight: 20 },
  divider: { height: StyleSheet.hairlineWidth },
  titleInput: { fontSize: 26, fontWeight: '600', letterSpacing: -0.5, paddingVertical: 20 },
  statsRow: { flexDirection: 'row', paddingVertical: 16 },
  statCol: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 12, marginBottom: 4 },
  statValue: { fontSize: 16, fontWeight: '600' },
  whenRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
  whenLabel: { fontSize: 15 },
  whenValue: { fontSize: 15 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 14 },
  photoPlaceholder: { width: 72, height: 90, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  previewImage: { width: 72, height: 90, borderRadius: 10 },
  photoButtons: { flex: 1, gap: 10 },
  photoBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
  photoBtnLabel: { fontSize: 15, fontWeight: '500' },
  descSection: { paddingVertical: 14 },
  descLabel: { fontSize: 12, marginBottom: 8 },
  descInput: { fontSize: 15, minHeight: 80, textAlignVertical: 'top' },
  visibilityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  visibilityLabel: { fontSize: 15 },
  discardDivider: { marginTop: 16 },
  discardWrap: { paddingVertical: 20, alignItems: 'center' },
  discardText: { fontSize: 15, fontWeight: '500', color: '#FF3B30', textAlign: 'center' },
});
