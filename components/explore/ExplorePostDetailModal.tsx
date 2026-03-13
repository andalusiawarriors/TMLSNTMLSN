import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'phosphor-react-native';
import { supabase } from '../../lib/supabase';
import { HomeGradientBackground } from '../HomeGradientBackground';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PostForDetail = {
  id: string;
  userId: string;
  title?: string | null;
  caption: string;
  imageUrl?: string | null;
  workoutSessionId?: string | null;
  duration: number;
  timeAgo: string;
  authorName: string;
  authorHandle: string;
};

type WorkoutExercise = {
  id: string;
  name: string;
  sort_order: number;
};

type WorkoutSet = {
  exercise_id: string;
  weight: number;
  reps: number;
  set_order: number;
};

interface Props {
  visible: boolean;
  onClose: () => void;
  post: PostForDetail | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return '';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

function formatSet(weight: number, reps: number): string {
  if (!weight || weight === 0) return `× ${reps}`;
  return `${weight} kg × ${reps}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExplorePostDetailModal({ visible, onClose, post }: Props) {
  const insets = useSafeAreaInsets();

  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [setsByExercise, setSetsByExercise] = useState<Record<string, WorkoutSet[]>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!post || !post.workoutSessionId || !supabase) {
      setExercises([]);
      setSetsByExercise({});
      return;
    }

    let cancelled = false;
    setLoading(true);
    setExercises([]);
    setSetsByExercise({});

    const sessionId = post.workoutSessionId;
    const userId = post.userId;

    Promise.all([
      supabase
        .from('workout_exercises')
        .select('id, name, sort_order')
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('workout_sets')
        .select('exercise_id, weight, reps, set_order')
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .eq('completed', true)
        .order('set_order', { ascending: true }),
    ]).then(([exercisesRes, setsRes]) => {
      if (cancelled) return;

      const fetchedExercises: WorkoutExercise[] = (exercisesRes.data ?? []) as WorkoutExercise[];
      const fetchedSets: WorkoutSet[] = (setsRes.data ?? []) as WorkoutSet[];

      const grouped: Record<string, WorkoutSet[]> = {};
      for (const s of fetchedSets) {
        if (!grouped[s.exercise_id]) grouped[s.exercise_id] = [];
        grouped[s.exercise_id].push(s);
      }

      setExercises(fetchedExercises);
      setSetsByExercise(grouped);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [post?.id, post?.workoutSessionId]);

  if (!post) return null;

  const durationLabel = formatDuration(post.duration);
  const initials = getInitials(post.authorName);
  const hasWorkout = Boolean(post.workoutSessionId);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <BlurView
          intensity={60}
          tint="dark"
          style={StyleSheet.absoluteFill}
          {...(Platform.OS === 'android'
            ? { experimentalBlurMethod: 'dimezisBlurView' as const }
            : {})}
        />
        <HomeGradientBackground />

        <View style={styles.content}>
          <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <X size={22} color="#C6C6C6" weight="bold" />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + 100 },
            ]}
            showsVerticalScrollIndicator={false}
            bounces
          >
            {!!post.imageUrl && (
              <Image
                source={{ uri: post.imageUrl }}
                style={styles.heroImage}
                resizeMode="cover"
              />
            )}

            <View style={styles.infoSection}>
              <View style={styles.authorRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
                <View style={styles.authorMeta}>
                  <Text style={styles.authorName}>{post.authorName}</Text>
                  <Text style={styles.authorHandle}>
                    @{post.authorHandle} · {post.timeAgo}
                  </Text>
                </View>
              </View>

              {!!post.title && (
                <Text style={styles.postTitle}>{post.title}</Text>
              )}

              {!!post.caption && (
                <Text style={styles.caption}>{post.caption}</Text>
              )}

              {durationLabel.length > 0 && (
                <View style={styles.durationChip}>
                  <Text style={styles.durationChipText}>{durationLabel}</Text>
                </View>
              )}

              {hasWorkout ? (
                loading ? (
                  <ActivityIndicator color="#C6C6C6" size="small" style={styles.loader} />
                ) : exercises.length > 0 ? (
                  <>
                    <Text style={styles.workoutSectionLabel}>Workout</Text>
                    {exercises.map((exercise) => {
                      const sets = setsByExercise[exercise.id] ?? [];
                      return (
                        <View key={exercise.id} style={styles.exerciseCard}>
                          <BlurView
                            intensity={22}
                            tint="dark"
                            style={[StyleSheet.absoluteFill, styles.cardRadius]}
                            {...(Platform.OS === 'android'
                              ? { experimentalBlurMethod: 'dimezisBlurView' as const }
                              : {})}
                          />
                          <View style={[StyleSheet.absoluteFillObject, styles.cardFill, styles.cardRadius]} />
                          <LinearGradient
                            colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.05)', 'transparent']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 0.85, y: 0.85 }}
                            style={[StyleSheet.absoluteFill, styles.cardRadius]}
                          />
                          <View style={[StyleSheet.absoluteFillObject, styles.cardBorder, styles.cardRadius]} />
                          <View style={styles.cardContent}>
                            <Text style={styles.exerciseName}>{exercise.name}</Text>
                            {sets.length > 0 ? (
                              sets.map((s, idx) => (
                                <Text key={idx} style={styles.setRow}>
                                  {formatSet(s.weight, s.reps)}
                                </Text>
                              ))
                            ) : (
                              <Text style={styles.setRow}>No sets recorded</Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </>
                ) : (
                  <Text style={styles.emptyState}>Workout no longer available.</Text>
                )
              ) : (
                <Text style={styles.emptyState}>No workout data attached.</Text>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const PRIMARY_LIGHT = '#C6C6C6';
const CARD_RADIUS_VAL = 20;

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, zIndex: 1 },

  header: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(198,198,198,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(198,198,198,0.18)',
  },

  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1 },

  heroImage: { width: '100%', aspectRatio: 4 / 3 },

  infoSection: { padding: 20 },

  authorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(198,198,198,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '600', color: PRIMARY_LIGHT },
  authorMeta: { marginLeft: 10 },
  authorName: { fontSize: 16, fontWeight: '600', color: PRIMARY_LIGHT },
  authorHandle: { fontSize: 13, color: 'rgba(198,198,198,0.6)', marginTop: 1 },

  postTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: PRIMARY_LIGHT,
    marginBottom: 6,
  },
  caption: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(198,198,198,0.85)',
    marginBottom: 12,
  },

  durationChip: {
    borderRadius: 20,
    backgroundColor: 'rgba(198,198,198,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(198,198,198,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  durationChipText: { fontSize: 13, fontWeight: '500', color: PRIMARY_LIGHT },

  workoutSectionLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: PRIMARY_LIGHT,
    marginBottom: 12,
  },
  loader: { marginTop: 16, marginBottom: 16 },

  exerciseCard: {
    borderRadius: CARD_RADIUS_VAL,
    overflow: 'hidden',
    marginBottom: 10,
  },
  cardRadius: { borderRadius: CARD_RADIUS_VAL },
  cardFill: { backgroundColor: 'rgba(47,48,49,0.30)' },
  cardBorder: { borderWidth: 1, borderColor: 'rgba(198,198,198,0.22)' },
  cardContent: { padding: 14, zIndex: 1 },
  exerciseName: { fontSize: 15, fontWeight: '600', color: PRIMARY_LIGHT, marginBottom: 8 },
  setRow: { fontSize: 13, color: 'rgba(198,198,198,0.7)', marginBottom: 3 },

  emptyState: { fontSize: 14, color: 'rgba(198,198,198,0.5)', marginTop: 8 },
});
