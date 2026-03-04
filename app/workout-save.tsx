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
import { Camera, Image as ImageIcon, CaretLeft } from 'phosphor-react-native';
import { useTheme } from '../context/ThemeContext';
import { useActiveWorkout } from '../context/ActiveWorkoutContext';
import { supabase } from '../lib/supabase';
import { getWorkoutSessions, getUserSettings, updateWorkoutSessionName } from '../utils/storage';
import { toDisplayWeight, toDisplayVolume, formatWeightDisplay } from '../utils/units';
import { HomeGradientBackground } from '../components/HomeGradientBackground';
import { GlassCard } from '../components/ui/GlassCard';
import { Colors, Glass } from '../constants/theme';
import { WorkoutSession } from '../types';

// ─── Layout ──────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TILE_GAP = 12;
const TILE_SIZE = (SCREEN_WIDTH - 40 - TILE_GAP) / 2;

// ─── Design tokens (match progress-graph.tsx exactly) ────────────────────────

const C_TEXT     = 'rgba(198,198,198,0.92)';
const C_TEXT_DIM = 'rgba(198,198,198,0.50)';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMins(minutes: number): string {
  if (minutes <= 0) return '—';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ─── Stat Tile — identical layers to progress-graph.tsx StatSquareTile ───────

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={tile.shadow}>
      <View style={tile.wrap}>
        {/* 1. Backdrop blur */}
        <BlurView
          intensity={26}
          tint="dark"
          style={[StyleSheet.absoluteFillObject, { borderRadius: 38 }]}
        />
        {/* 2. Dark fill overlay */}
        <View
          style={[StyleSheet.absoluteFillObject, tile.fillOverlay, { borderRadius: 38 }]}
        />
        {/* 3. Diagonal specular highlight */}
        <LinearGradient
          colors={['rgba(255,255,255,0.20)', 'rgba(255,255,255,0.06)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.85, y: 0.85 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: 38 }]}
          pointerEvents="none"
        />
        {/* 4. Top-rim lensing band */}
        <LinearGradient
          colors={['rgba(255,255,255,0.26)', 'rgba(255,255,255,0.05)', 'transparent']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.16 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: 38 }]}
          pointerEvents="none"
        />
        {/* 5. Bottom depth shadow */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.20)']}
          start={{ x: 0.5, y: 0.55 }}
          end={{ x: 0.5, y: 1 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: 38 }]}
          pointerEvents="none"
        />
        {/* 6. Border rim */}
        <View
          style={[
            StyleSheet.absoluteFillObject,
            { borderRadius: 38, borderWidth: 1, borderColor: 'rgba(198,198,198,0.22)' },
          ]}
          pointerEvents="none"
        />
        {/* Content — bottom-aligned like progress hub */}
        <View style={tile.inner}>
          <View style={tile.valueRow}>
            <Text style={tile.value}>{value}</Text>
          </View>
          <Text style={tile.label} numberOfLines={2}>{label}</Text>
        </View>
      </View>
    </View>
  );
}

const tile = StyleSheet.create({
  shadow: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 38,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.30,
    shadowRadius: 18,
    elevation: 10,
  },
  wrap: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 38,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  fillOverlay: {
    backgroundColor: 'rgba(47,48,49,0.28)',
  },
  inner: {
    flex: 1,
    padding: 18,
    justifyContent: 'flex-end',
    zIndex: 1,
  },
  valueRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  value: {
    fontSize: 28,
    fontWeight: '600',
    color: C_TEXT,
    letterSpacing: -0.8,
    lineHeight: 32,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: C_TEXT_DIM,
    lineHeight: 16,
  },
});

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

      if (current?.name && current.name !== 'Workout') setTitle(current.name);

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
                ...(matchEx.sets ?? []).filter((s) => s.completed && s.weight > 0).map((s) => s.weight),
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
  const rawVolume  = allCompleted.reduce((acc, s) => acc + s.weight * s.reps, 0);
  const volumeStr  = rawVolume > 0 ? formatWeightDisplay(toDisplayVolume(rawVolume, weightUnit), weightUnit) : '—';
  const totalSets  = allCompleted.length;
  const totalReps  = allCompleted.reduce((acc, s) => acc + s.reps, 0);
  const prCount    = prs.size;
  const duration   = session?.duration ?? 0;

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

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <HomeGradientBackground />
        <ActivityIndicator color={Colors.primaryLight} />
      </View>
    );
  }

  const exercises = session?.exercises ?? [];

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={[s.root, { backgroundColor: colors.primaryDark }]}>
        <HomeGradientBackground />

        <KeyboardAvoidingView style={{ flex: 1, zIndex: 2 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

          {/* Top bar */}
          <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
            <Pressable onPress={() => router.back()} style={s.topBarSide} hitSlop={12}>
              <CaretLeft size={22} color={colors.primaryLight + '80'} weight="regular" />
            </Pressable>
            <View style={s.topBarSide} />
          </View>

          <ScrollView
            contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 48 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >

            {/* ── Hero ─────────────────────────────────────────────────── */}
            <View style={s.hero}>
              <View style={[s.checkCircle, { backgroundColor: Colors.primaryLight }]}>
                <Ionicons name="checkmark" size={44} color={Colors.primaryDark} />
              </View>
              <Text style={s.heroTitle}>Workout Complete</Text>
              <Text style={s.heroName}>{session?.name ?? 'Workout'}</Text>
              <Text style={s.heroDuration}>{formatMins(duration)}</Text>
            </View>

            {/* ── 2×2 Stat Tiles (progress hub style) ──────────────────── */}
            <View style={s.tileGrid}>
              <StatTile value={volumeStr}      label="total volume" />
              <StatTile value={String(totalSets)} label="sets completed" />
              <StatTile value={String(totalReps)} label="total reps" />
              <StatTile value={String(prCount)}   label={prCount === 1 ? 'personal record' : 'personal records'} />
            </View>

            {/* ── Exercise breakdown ────────────────────────────────────── */}
            {exercises.some((ex) => (ex.sets ?? []).some((s) => s.completed)) && (
              <>
                <Text style={s.sectionLabel}>EXERCISES</Text>
                <GlassCard noPadding style={s.exCard}>
                  {exercises.map((ex, idx) => {
                    const done = (ex.sets ?? []).filter((s) => s.completed && s.weight > 0 && s.reps > 0);
                    if (done.length === 0) return null;
                    const exVol = done.reduce((acc, s) => acc + s.weight * s.reps, 0);
                    const maxW  = Math.max(...done.map((s) => s.weight));
                    const isPr  = prs.has(ex.name);
                    const isLast = idx === exercises.length - 1;
                    return (
                      <View key={ex.id} style={[s.exRow, !isLast && s.exRowDivider]}>
                        <View style={s.exLeft}>
                          <View style={s.exNameRow}>
                            <Text style={s.exName} numberOfLines={1}>{ex.name}</Text>
                            {isPr && (
                              <View style={s.prBadge}>
                                <Text style={s.prBadgeText}>PR</Text>
                              </View>
                            )}
                          </View>
                          <Text style={s.exMeta}>
                            {done.length} {done.length === 1 ? 'set' : 'sets'} · {formatWeightDisplay(toDisplayVolume(exVol, weightUnit), weightUnit)} vol
                          </Text>
                        </View>
                        <Text style={s.exMaxWeight}>
                          {formatWeightDisplay(toDisplayWeight(maxW, weightUnit), weightUnit)}
                        </Text>
                      </View>
                    );
                  })}
                </GlassCard>
              </>
            )}

            {/* ── Done button ───────────────────────────────────────────── */}
            <Pressable
              style={({ pressed }) => [s.doneButton, { backgroundColor: Colors.primaryLight, opacity: pressed ? 0.85 : 1 }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.back(); }}
            >
              <Text style={[s.doneButtonText, { color: Colors.primaryDark }]}>Done</Text>
            </Pressable>

            {/* ── Share toggle ──────────────────────────────────────────── */}
            <Pressable
              style={s.shareToggle}
              onPress={() => { setShowShare((v) => !v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            >
              <Text style={s.shareToggleText}>{showShare ? 'Hide' : 'Share this workout ↓'}</Text>
            </Pressable>

            {/* ── Social post form (opt-in) ─────────────────────────────── */}
            {showShare && (
              <View style={s.shareSection}>
                {uploadError && (
                  <View style={s.errorRow}>
                    <Text style={[s.errorText, { color: colors.primaryLight }]}>{uploadError}</Text>
                  </View>
                )}

                <TextInput
                  style={[s.titleInput, { color: colors.primaryLight }]}
                  placeholder="Workout title"
                  placeholderTextColor={colors.primaryLight + '30'}
                  value={title}
                  onChangeText={setTitle}
                  returnKeyType="done"
                />

                <View style={[s.divider, { backgroundColor: colors.primaryLight + '15' }]} />

                <View style={s.whenRow}>
                  <Text style={[s.whenLabel, { color: colors.primaryLight + '60' }]}>When</Text>
                  <Text style={[s.whenValue, { color: colors.primaryLight }]}>{dateLabel}</Text>
                </View>

                <View style={[s.divider, { backgroundColor: colors.primaryLight + '15' }]} />

                <View style={s.photoRow}>
                  {imageUri
                    ? <Image source={{ uri: imageUri }} style={s.previewImage} />
                    : (
                      <View style={[s.photoPlaceholder, { borderColor: colors.primaryLight + '25' }]}>
                        <Camera size={22} color={colors.primaryLight + '40'} weight="regular" />
                      </View>
                    )
                  }
                  <View style={s.photoButtons}>
                    <Pressable style={[s.photoBtn, { backgroundColor: colors.primaryLight + '10' }]} onPress={handleTakePhoto}>
                      <Camera size={18} color={colors.primaryLight} weight="regular" />
                      <Text style={[s.photoBtnLabel, { color: colors.primaryLight }]}>Camera</Text>
                    </Pressable>
                    <Pressable style={[s.photoBtn, { backgroundColor: colors.primaryLight + '10' }]} onPress={handlePickPhoto}>
                      <ImageIcon size={18} color={colors.primaryLight} weight="regular" />
                      <Text style={[s.photoBtnLabel, { color: colors.primaryLight }]}>Gallery</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={[s.divider, { backgroundColor: colors.primaryLight + '15' }]} />

                <View style={s.descSection}>
                  <Text style={[s.descLabel, { color: colors.primaryLight + '50' }]}>Notes</Text>
                  <TextInput
                    style={[s.descInput, { color: colors.primaryLight }]}
                    placeholder="How did it go?"
                    placeholderTextColor={colors.primaryLight + '30'}
                    multiline
                    value={description}
                    onChangeText={setDescription}
                    textAlignVertical="top"
                  />
                </View>

                <View style={[s.divider, { backgroundColor: colors.primaryLight + '15' }]} />

                <View style={s.visibilityRow}>
                  <Text style={[s.visibilityLabel, { color: colors.primaryLight }]}>Make public</Text>
                  <Switch
                    value={isPublic}
                    onValueChange={setIsPublic}
                    trackColor={{ false: colors.primaryLight + '20', true: colors.primaryLight + '80' }}
                    thumbColor={isPublic ? colors.primaryDark : colors.primaryLight + '60'}
                    ios_backgroundColor={colors.primaryLight + '20'}
                  />
                </View>

                <Pressable
                  style={({ pressed }) => [s.shareButton, { backgroundColor: Colors.primaryLight, opacity: pressed ? 0.85 : 1 }]}
                  onPress={handleShare}
                  disabled={isSaving}
                >
                  {isSaving
                    ? <ActivityIndicator size="small" color={Colors.primaryDark} />
                    : <Text style={[s.shareButtonText, { color: Colors.primaryDark }]}>Share Workout</Text>
                  }
                </Pressable>
              </View>
            )}

          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
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

  // Hero
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
    fontSize: 30,
    fontWeight: '700',
    color: C_TEXT,
    letterSpacing: -0.7,
    marginBottom: 6,
  },
  heroName: {
    fontSize: 16,
    fontWeight: '500',
    color: C_TEXT_DIM,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  heroDuration: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(198,198,198,0.38)',
  },

  // Tile grid
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: TILE_GAP,
    marginBottom: 32,
  },

  // Section label
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(198,198,198,0.40)',
    letterSpacing: 1.4,
    marginBottom: 10,
    marginLeft: 4,
  },

  // Exercise card
  exCard: { marginBottom: 28 },
  exRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  exRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(198,198,198,0.12)',
  },
  exLeft: { flex: 1, marginRight: 12 },
  exNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  exName: {
    fontSize: 15,
    fontWeight: '600',
    color: C_TEXT,
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  exMeta: {
    fontSize: 12,
    fontWeight: '400',
    color: C_TEXT_DIM,
    letterSpacing: -0.1,
  },
  exMaxWeight: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(198,198,198,0.65)',
    letterSpacing: -0.3,
  },
  prBadge: {
    backgroundColor: 'rgba(198,198,198,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(198,198,198,0.28)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  prBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: C_TEXT,
    letterSpacing: 0.4,
  },

  // Done button
  doneButton: {
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  doneButtonText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },

  // Share toggle
  shareToggle: { alignItems: 'center', paddingVertical: 12, marginBottom: 4 },
  shareToggleText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(198,198,198,0.40)',
    letterSpacing: -0.1,
  },

  // Share section
  shareSection: { marginTop: 8 },
  errorRow: { padding: 12, borderRadius: 10, backgroundColor: '#FF3B30' + '15', marginBottom: 8 },
  errorText: { fontSize: 14, lineHeight: 20 },
  divider: { height: StyleSheet.hairlineWidth },
  titleInput: { fontSize: 22, fontWeight: '600', letterSpacing: -0.4, paddingVertical: 18 },
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
  shareButton: { height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  shareButtonText: { fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
});
