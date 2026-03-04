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
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Camera, Image as ImageIcon, CaretLeft, Trophy } from 'phosphor-react-native';
import { useTheme } from '../context/ThemeContext';
import { useActiveWorkout } from '../context/ActiveWorkoutContext';
import { supabase } from '../lib/supabase';
import { getWorkoutSessions, getUserSettings, updateWorkoutSessionName } from '../utils/storage';
import { toDisplayWeight, toDisplayVolume, formatWeightDisplay } from '../utils/units';
import { HomeGradientBackground } from '../components/HomeGradientBackground';
import { GlassCard } from '../components/ui/GlassCard';
import { Colors, Glass, Font } from '../constants/theme';
import { WorkoutSession } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TILE_GAP = 10;
const TILE_SIZE = (SCREEN_WIDTH - 40 - TILE_GAP) / 2;

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatMins(minutes: number): string {
  if (minutes <= 0) return '—';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ─── Stat Tile ───────────────────────────────────────────────────────────────

function StatTile({
  value,
  label,
  icon,
  highlight = false,
}: {
  value: string;
  label: string;
  icon: string;
  highlight?: boolean;
}) {
  return (
    <View style={[styles.tile, Glass.shadow]}>
      <BlurView
        intensity={Glass.blurIntensity}
        tint="dark"
        style={[StyleSheet.absoluteFillObject, { borderRadius: Glass.radius.primary }]}
      />
      <View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: Glass.fill, borderRadius: Glass.radius.primary },
        ]}
      />
      <LinearGradient
        colors={[Glass.specularStrong, Glass.specular, 'transparent']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.55 }}
        style={[StyleSheet.absoluteFillObject, { borderRadius: Glass.radius.primary }]}
        pointerEvents="none"
      />
      <View
        style={[
          StyleSheet.absoluteFillObject,
          {
            borderRadius: Glass.radius.primary,
            borderWidth: Glass.borderWidth,
            borderColor: highlight ? Colors.primaryLight + '55' : Glass.border,
          },
        ]}
        pointerEvents="none"
      />
      <View style={styles.tileContent}>
        <Ionicons
          name={icon as any}
          size={18}
          color={highlight ? Colors.primaryLight : Colors.primaryLight + '45'}
          style={{ marginBottom: 10 }}
        />
        <Text style={[styles.tileValue, highlight && { color: Colors.primaryLight }]}>
          {value}
        </Text>
        <Text style={styles.tileLabel}>{label}</Text>
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function WorkoutSaveScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { originRoute } = useActiveWorkout();

  // Session data
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [weightUnit, setWeightUnit] = useState<'lb' | 'kg'>('lb');
  const [prs, setPrs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Social post state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [createdPostId, setCreatedPostId] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    (async () => {
      const [sessions, settings] = await Promise.all([
        getWorkoutSessions(),
        getUserSettings(),
      ]);
      const unit = settings?.weightUnit ?? 'lb';
      setWeightUnit(unit);

      const current = sessions.find((s) => s.id === sessionId) ?? null;
      setSession(current);

      if (current?.name && current.name !== 'Workout') {
        setTitle(current.name);
      }

      // PR detection — max weight this session vs every prior session
      if (current) {
        const priorSessions = sessions.filter((s) => s.id !== sessionId);
        const prSet = new Set<string>();

        for (const ex of current.exercises ?? []) {
          const doneSets = (ex.sets ?? []).filter((s) => s.completed && s.weight > 0);
          if (doneSets.length === 0) continue;
          const curMax = Math.max(...doneSets.map((s) => s.weight));

          const exNameLower = ex.name.toLowerCase();
          let priorMax = 0;
          for (const ps of priorSessions) {
            const matchEx = ps.exercises?.find(
              (e) =>
                (ex.exerciseDbId && e.exerciseDbId === ex.exerciseDbId) ||
                e.name.toLowerCase() === exNameLower
            );
            if (matchEx) {
              const m = Math.max(
                ...(matchEx.sets ?? [])
                  .filter((s) => s.completed && s.weight > 0)
                  .map((s) => s.weight),
                0
              );
              priorMax = Math.max(priorMax, m);
            }
          }
          if (curMax > priorMax) prSet.add(ex.name);
        }
        setPrs(prSet);
      }

      setLoading(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    })();
  }, [sessionId]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const allCompleted = (session?.exercises ?? []).flatMap((ex) =>
    (ex.sets ?? []).filter((s) => s.completed)
  );
  const rawVolume = allCompleted.reduce((acc, s) => acc + s.weight * s.reps, 0);
  const volumeStr = rawVolume > 0
    ? formatWeightDisplay(toDisplayVolume(rawVolume, weightUnit), weightUnit)
    : '—';
  const totalSets = allCompleted.length;
  const totalReps = allCompleted.reduce((acc, s) => acc + s.reps, 0);
  const prCount = prs.size;
  const duration = session?.duration ?? 0;

  // ── Photo helpers ──────────────────────────────────────────────────────────
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

  // ── Share / save post ──────────────────────────────────────────────────────
  const handleShare = async () => {
    if (!supabase || !sessionId) return;
    setIsSaving(true);
    setUploadError(null);
    try {
      if (title.trim()) await updateWorkoutSessionName(sessionId, title.trim());
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      let postId = createdPostId;
      if (!postId) {
        const { data: postData, error: postError } = await supabase
          .from('workout_posts')
          .insert({ user_id: user.id, session_id: sessionId, title: title.trim() || null, description: description.trim() || null, visibility: isPublic ? 'public' : 'private' })
          .select().single();
        if (postError) throw postError;
        postId = postData.id;
        setCreatedPostId(postId);
      }

      if (imageUri && postId) {
        const imagePath = `${postId}/${Date.now()}.jpg`;
        const blob = await (await fetch(imageUri)).blob();
        const { error: uploadErr } = await supabase.storage.from('workout-images').upload(imagePath, blob, { upsert: true });
        if (uploadErr) { setUploadError('Image upload failed. Post saved. Tap Share again to retry.'); setIsSaving(false); return; }
        await supabase.from('workout_posts').update({ image_path: imagePath }).eq('id', postId);
      }

      const dest = originRoute && originRoute !== '/(tabs)/workout' ? originRoute : '/(tabs)/nutrition';
      router.replace(dest as any);
    } catch (e) {
      console.error('Share error', e);
      Alert.alert('Error', 'Could not share workout.');
    } finally {
      setIsSaving(false);
    }
  };

  const dateLabel = format(new Date(), 'EEEE, MMMM d · h:mm a');

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <HomeGradientBackground />
        <ActivityIndicator color={Colors.primaryLight} />
      </View>
    );
  }

  const exercises = session?.exercises ?? [];

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={[styles.root, { backgroundColor: colors.primaryDark }]}>
        <HomeGradientBackground />
        <KeyboardAvoidingView style={{ flex: 1, zIndex: 2 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

          {/* ── Top bar ──────────────────────────────────────────────────── */}
          <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
            <Pressable onPress={() => router.back()} style={styles.topBarSide} hitSlop={12}>
              <CaretLeft size={22} color={colors.primaryLight + '80'} weight="regular" />
            </Pressable>
            <View style={styles.topBarSide} />
          </View>

          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 48 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >

            {/* ── Hero header ──────────────────────────────────────────────── */}
            <View style={styles.hero}>
              <View style={[styles.checkCircle, { backgroundColor: Colors.primaryLight }]}>
                <Ionicons name="checkmark" size={42} color={Colors.primaryDark} />
              </View>
              <Text style={styles.heroTitle}>Workout Complete</Text>
              <Text style={styles.heroName}>{session?.name ?? 'Workout'}</Text>
              <Text style={styles.heroDuration}>{formatMins(duration)}</Text>
            </View>

            {/* ── 2×2 stat tiles ───────────────────────────────────────────── */}
            <View style={styles.tileGrid}>
              <StatTile value={volumeStr} label="Total Volume" icon="barbell-outline" />
              <StatTile value={String(totalSets)} label="Sets Completed" icon="layers-outline" />
              <StatTile value={String(totalReps)} label="Total Reps" icon="repeat-outline" />
              <StatTile value={String(prCount)} label="Personal Records" icon="trophy-outline" highlight={prCount > 0} />
            </View>

            {/* ── Exercise breakdown ────────────────────────────────────────── */}
            {exercises.some((ex) => (ex.sets ?? []).some((s) => s.completed)) && (
              <>
                <Text style={styles.sectionLabel}>EXERCISES</Text>
                <GlassCard noPadding style={styles.exCard}>
                  {exercises.map((ex, idx) => {
                    const done = (ex.sets ?? []).filter((s) => s.completed && s.weight > 0 && s.reps > 0);
                    if (done.length === 0) return null;
                    const exVol = done.reduce((acc, s) => acc + s.weight * s.reps, 0);
                    const maxW = Math.max(...done.map((s) => s.weight));
                    const isPr = prs.has(ex.name);
                    const isLast = idx === exercises.length - 1;
                    return (
                      <View key={ex.id} style={[styles.exRow, !isLast && styles.exRowDivider]}>
                        <View style={styles.exLeft}>
                          <View style={styles.exNameRow}>
                            <Text style={styles.exName} numberOfLines={1}>{ex.name}</Text>
                            {isPr && (
                              <View style={styles.prBadge}>
                                <Text style={styles.prBadgeText}>PR</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.exMeta}>
                            {done.length} {done.length === 1 ? 'set' : 'sets'} · {formatWeightDisplay(toDisplayVolume(exVol, weightUnit), weightUnit)} vol
                          </Text>
                        </View>
                        <Text style={styles.exMaxWeight}>
                          {formatWeightDisplay(toDisplayWeight(maxW, weightUnit), weightUnit)}
                        </Text>
                      </View>
                    );
                  })}
                </GlassCard>
              </>
            )}

            {/* ── Done button ───────────────────────────────────────────────── */}
            <Pressable
              style={({ pressed }) => [styles.doneButton, { backgroundColor: Colors.primaryLight, opacity: pressed ? 0.85 : 1 }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.back(); }}
            >
              <Text style={[styles.doneButtonText, { color: Colors.primaryDark }]}>Done</Text>
            </Pressable>

            {/* ── Share toggle ──────────────────────────────────────────────── */}
            <Pressable
              style={styles.shareToggle}
              onPress={() => { setShowShare((v) => !v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            >
              <Text style={styles.shareToggleText}>
                {showShare ? 'Hide' : 'Share this workout'} ↓
              </Text>
            </Pressable>

            {/* ── Social post form ──────────────────────────────────────────── */}
            {showShare && (
              <View style={styles.shareSection}>
                {uploadError && (
                  <View style={styles.errorRow}>
                    <Text style={[styles.errorText, { color: colors.primaryLight }]}>{uploadError}</Text>
                  </View>
                )}

                <TextInput
                  style={[styles.titleInput, { color: colors.primaryLight }]}
                  placeholder="Workout title"
                  placeholderTextColor={colors.primaryLight + '30'}
                  value={title}
                  onChangeText={setTitle}
                  returnKeyType="done"
                />

                <View style={[styles.divider, { backgroundColor: colors.primaryLight + '15' }]} />

                <View style={styles.whenRow}>
                  <Text style={[styles.whenLabel, { color: colors.primaryLight + '60' }]}>When</Text>
                  <Text style={[styles.whenValue, { color: colors.primaryLight }]}>{dateLabel}</Text>
                </View>

                <View style={[styles.divider, { backgroundColor: colors.primaryLight + '15' }]} />

                {/* Photo */}
                <View style={styles.photoRow}>
                  {imageUri ? (
                    <Image source={{ uri: imageUri }} style={styles.previewImage} />
                  ) : (
                    <View style={[styles.photoPlaceholder, { borderColor: colors.primaryLight + '25' }]}>
                      <Camera size={22} color={colors.primaryLight + '40'} weight="regular" />
                    </View>
                  )}
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

                <View style={[styles.divider, { backgroundColor: colors.primaryLight + '15' }]} />

                {/* Description */}
                <View style={styles.descSection}>
                  <Text style={[styles.descLabel, { color: colors.primaryLight + '50' }]}>Notes</Text>
                  <TextInput
                    style={[styles.descInput, { color: colors.primaryLight }]}
                    placeholder="How did your workout go?"
                    placeholderTextColor={colors.primaryLight + '30'}
                    multiline
                    value={description}
                    onChangeText={setDescription}
                    textAlignVertical="top"
                  />
                </View>

                <View style={[styles.divider, { backgroundColor: colors.primaryLight + '15' }]} />

                {/* Visibility */}
                <View style={styles.visibilityRow}>
                  <Text style={[styles.visibilityLabel, { color: colors.primaryLight }]}>Make public</Text>
                  <Switch
                    value={isPublic}
                    onValueChange={setIsPublic}
                    trackColor={{ false: colors.primaryLight + '20', true: colors.primaryLight + '80' }}
                    thumbColor={isPublic ? colors.primaryDark : colors.primaryLight + '60'}
                    ios_backgroundColor={colors.primaryLight + '20'}
                  />
                </View>

                {/* Share button */}
                <Pressable
                  style={({ pressed }) => [styles.shareButton, { opacity: pressed ? 0.85 : 1 }]}
                  onPress={handleShare}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color={Colors.primaryDark} />
                  ) : (
                    <Text style={[styles.shareButtonText, { color: Colors.primaryDark }]}>Share Workout</Text>
                  )}
                </Pressable>
              </View>
            )}

          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  topBarSide: { minWidth: 40 },

  scroll: { paddingHorizontal: 20, paddingTop: 8 },

  // ── Hero ─────────────────────────────────────────────────────────────────
  hero: { alignItems: 'center', marginBottom: 32 },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  heroTitle: {
    fontFamily: Font.bold,
    fontSize: 30,
    fontWeight: '700',
    color: Colors.primaryLight,
    letterSpacing: -0.7,
    marginBottom: 6,
  },
  heroName: {
    fontFamily: Font.medium,
    fontSize: 16,
    color: Colors.primaryLight + '65',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  heroDuration: {
    fontFamily: Font.medium,
    fontSize: 14,
    color: Colors.primaryLight + '45',
  },

  // ── Stat tiles ────────────────────────────────────────────────────────────
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: TILE_GAP,
    marginBottom: 32,
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: Glass.radius.primary,
    overflow: 'hidden',
  },
  tileContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    zIndex: 1,
  },
  tileValue: {
    fontFamily: Font.bold,
    fontSize: 30,
    fontWeight: '700',
    color: Colors.primaryLight + 'BB',
    letterSpacing: -1.2,
    lineHeight: 34,
    marginBottom: 4,
    textAlign: 'center',
  },
  tileLabel: {
    fontFamily: Font.medium,
    fontSize: 11,
    fontWeight: '500',
    color: Colors.primaryLight + '50',
    textAlign: 'center',
    lineHeight: 14,
  },

  // ── Section label ─────────────────────────────────────────────────────────
  sectionLabel: {
    fontFamily: Font.semiBold,
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primaryLight + '40',
    letterSpacing: 1.4,
    marginBottom: 10,
    marginLeft: 4,
  },

  // ── Exercise breakdown ────────────────────────────────────────────────────
  exCard: { marginBottom: 28 },
  exRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  exRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Glass.border,
  },
  exLeft: { flex: 1, marginRight: 12 },
  exNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  exName: {
    fontFamily: Font.semiBold,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primaryLight + 'DD',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  exMeta: {
    fontFamily: Font.medium,
    fontSize: 12,
    color: Colors.primaryLight + '48',
    letterSpacing: -0.1,
  },
  exMaxWeight: {
    fontFamily: Font.semiBold,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primaryLight + '75',
    letterSpacing: -0.3,
  },
  prBadge: {
    backgroundColor: Colors.primaryLight + '16',
    borderWidth: 1,
    borderColor: Colors.primaryLight + '35',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  prBadgeText: {
    fontFamily: Font.bold,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primaryLight,
    letterSpacing: 0.4,
  },

  // ── Done button ───────────────────────────────────────────────────────────
  doneButton: {
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  doneButtonText: {
    fontFamily: Font.bold,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },

  // ── Share toggle ──────────────────────────────────────────────────────────
  shareToggle: { alignItems: 'center', paddingVertical: 12, marginBottom: 4 },
  shareToggleText: {
    fontFamily: Font.medium,
    fontSize: 13,
    color: Colors.primaryLight + '45',
    letterSpacing: -0.1,
  },

  // ── Share section ─────────────────────────────────────────────────────────
  shareSection: { marginTop: 8 },
  errorRow: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FF3B30' + '15',
    marginBottom: 8,
  },
  errorText: { fontSize: 14, lineHeight: 20 },

  divider: { height: StyleSheet.hairlineWidth },

  titleInput: {
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.4,
    paddingVertical: 18,
  },
  whenRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  whenLabel: { fontSize: 15 },
  whenValue: { fontSize: 15 },

  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 14,
  },
  photoPlaceholder: {
    width: 72, height: 90, borderRadius: 10,
    borderWidth: 1.5, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  previewImage: { width: 72, height: 90, borderRadius: 10 },
  photoButtons: { flex: 1, gap: 10 },
  photoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14,
  },
  photoBtnLabel: { fontSize: 15, fontWeight: '500' },

  descSection: { paddingVertical: 14 },
  descLabel: { fontSize: 12, marginBottom: 8 },
  descInput: { fontSize: 15, minHeight: 80, textAlignVertical: 'top' },

  visibilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  visibilityLabel: { fontSize: 15 },

  shareButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  shareButtonText: {
    fontFamily: Font.bold,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
});
