import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  ImageBackground,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { CaretLeft, Database, Clock } from 'phosphor-react-native';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { getWorkoutSessions, getUserSettings } from '../utils/storage';
import { WorkoutSession } from '../types';
import { formatWeightDisplay, toDisplayWeight, toDisplayVolume } from '../utils/units';
import { Card } from '../components/Card';

const SCREEN_WIDTH = Dimensions.get('window').width;
const windowHeight = Dimensions.get('window').height;

export default function WorkoutDetailScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [weightUnit, setWeightUnit] = useState<'lb' | 'kg'>('lb');

  useEffect(() => {
    async function load() {
      if (!sessionId) return;
      try {
        const [loadedSessions, settings] = await Promise.all([
          getWorkoutSessions(),
          getUserSettings(),
        ]);
        const found = loadedSessions.find((s) => s.id === sessionId);
        if (found) setSession(found);
        setWeightUnit(settings?.weightUnit ?? 'lb');
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [sessionId]);

  if (loading || !session) {
    return (
      <View style={styles.container}>
        <View style={[StyleSheet.absoluteFill, { zIndex: 0 }]} pointerEvents="none">
          <ImageBackground
            source={require('../assets/home-background.png')}
            style={{ width: SCREEN_WIDTH, height: windowHeight, position: 'absolute', top: 0, left: 0 }}
            resizeMode="cover"
          >
            <LinearGradient
              colors={['transparent', 'rgba(47, 48, 49, 0.4)', 'rgba(47, 48, 49, 0.85)', '#2F3031', '#1a1a1a']}
              locations={[0, 0.2, 0.35, 0.45, 0.65]}
              style={StyleSheet.absoluteFill}
            />
          </ImageBackground>
        </View>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 44) + 12 }]} />
        <ActivityIndicator style={{ marginTop: Spacing.xxl }} color={colors.primaryLight} />
      </View>
    );
  }

  const rawVolume = session.exercises.reduce(
    (acc, ex) =>
      acc + ex.sets.filter((s) => s.completed).reduce((sacc, set) => sacc + set.weight * set.reps, 0),
    0
  );
  const volumeDisplay = toDisplayVolume(rawVolume, weightUnit);

  return (
    <View style={styles.container}>
      {/* Background: same as Home / Workout / Explore */}
      <View style={[StyleSheet.absoluteFill, { zIndex: 0 }]} pointerEvents="none">
        <ImageBackground
          source={require('../assets/home-background.png')}
          style={{ width: SCREEN_WIDTH, height: windowHeight, position: 'absolute', top: 0, left: 0 }}
          resizeMode="cover"
        >
          <LinearGradient
            colors={['transparent', 'rgba(47, 48, 49, 0.4)', 'rgba(47, 48, 49, 0.85)', '#2F3031', '#1a1a1a']}
            locations={[0, 0.2, 0.35, 0.45, 0.65]}
            style={StyleSheet.absoluteFill}
          />
        </ImageBackground>
      </View>

      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top, 44) + 12,
            paddingHorizontal: Spacing.md + (insets.left || 0),
            paddingRight: Spacing.md + (insets.right || 0),
          },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <CaretLeft size={26} color={colors.primaryLight} weight="bold" />
        </Pressable>
        <Text style={[styles.title, { color: colors.primaryLight }]}>Workout Detail</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        <Card gradientFill borderRadius={20} style={styles.summaryCard}>
          <Text style={[styles.summaryTitle, { color: colors.primaryLight }]}>{session.name}</Text>
          <Text style={[styles.summaryDate, { color: colors.primaryLight + '80' }]}>
            {format(new Date(session.date), 'MMM d, yyyy • h:mm a')}
          </Text>
          <View style={styles.statsRow}>
            <View style={[styles.statPill, { backgroundColor: colors.primaryDark }]}>
              <Clock size={16} color={colors.primaryLight + 'B0'} />
              <Text style={[styles.statText, { color: colors.primaryLight }]}>{session.duration}m duration</Text>
            </View>
            <View style={[styles.statPill, { backgroundColor: colors.primaryDark }]}>
              <Database size={16} color={colors.primaryLight + 'B0'} />
              <Text style={[styles.statText, { color: colors.primaryLight }]}>{formatWeightDisplay(volumeDisplay, weightUnit)} total</Text>
            </View>
          </View>
        </Card>

        {session.exercises.map((ex, i) => (
          <Card key={ex.id} gradientFill borderRadius={20} style={styles.exerciseCard}>
            <Text style={[styles.exerciseTitle, { color: colors.primaryLight }]}>
              {i + 1}. {ex.name}
            </Text>
            {ex.notes ? (
              <Text style={[styles.exerciseNotes, { color: colors.primaryLight + 'A0' }]}>{ex.notes}</Text>
            ) : null}

            <View style={[styles.setRowHeader, { borderBottomColor: colors.primaryLight + '30' }]}>
              <Text style={[styles.setColText, { flex: 0.5, color: colors.primaryLight + '80' }]}>Set</Text>
              <Text style={[styles.setColText, { flex: 1, color: colors.primaryLight + '80' }]}>Weight</Text>
              <Text style={[styles.setColText, { flex: 1, color: colors.primaryLight + '80' }]}>Reps</Text>
            </View>

            {ex.sets.map((set, sIdx) => {
              const displayWt = toDisplayWeight(set.weight, weightUnit);
              const isCompleted = set.completed;
              return (
                <View key={set.id}>
                  <View style={[styles.setRow, !isCompleted && { opacity: 0.5 }]}>
                    <Text style={[styles.setValText, { flex: 0.5, color: colors.primaryLight }]}>{sIdx + 1}</Text>
                    <Text style={[styles.setValText, { flex: 1, color: colors.primaryLight }]}>
                      {displayWt > 0 ? displayWt : '-'} {weightUnit}
                    </Text>
                    <Text style={[styles.setValText, { flex: 1, color: colors.primaryLight }]}>
                      {set.reps > 0 ? set.reps : '-'}
                    </Text>
                  </View>
                  {set.notes ? (
                    <View style={styles.setNotesRow}>
                      <Text style={[styles.setNotesText, { color: colors.primaryLight + '80' }]}>Note: {set.notes}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2F3031' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.md,
    zIndex: 2,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: Typography.h2, fontWeight: '600', letterSpacing: -0.11 },
  content: { padding: Spacing.lg },
  summaryCard: { marginBottom: Spacing.xl, padding: Spacing.lg, overflow: 'hidden' },
  summaryTitle: { fontSize: 24, fontWeight: '600', marginBottom: Spacing.xs },
  summaryDate: { fontSize: Typography.label, opacity: 0.8, marginBottom: Spacing.md },
  statsRow: { flexDirection: 'row', gap: Spacing.md },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: 38,
  },
  statText: { fontSize: Typography.label, fontWeight: '500' },
  exerciseCard: { marginBottom: Spacing.md, padding: Spacing.lg, overflow: 'hidden' },
  exerciseTitle: { fontSize: Typography.body, fontWeight: '600', marginBottom: Spacing.xs },
  exerciseNotes: { fontSize: Typography.label, fontStyle: 'italic', marginBottom: Spacing.sm },
  setRowHeader: {
    flexDirection: 'row',
    paddingVertical: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.xs,
  },
  setColText: { fontSize: 12, fontWeight: '500', textAlign: 'center' },
  setRow: { flexDirection: 'row', paddingVertical: Spacing.sm, alignItems: 'center' },
  setValText: { fontSize: Typography.body, textAlign: 'center' },
  setNotesRow: { paddingLeft: 40, paddingBottom: Spacing.sm },
  setNotesText: { fontSize: Typography.label, fontStyle: 'italic' },
});
