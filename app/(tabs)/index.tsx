import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Colors, Typography, Spacing } from '../../constants/theme';
import { getTodayNutritionLog, getRecentWorkouts, getUserSettings } from '../../utils/storage';
import { NutritionLog, WorkoutSession, UserSettings } from '../../types';
import { formatDate } from '../../utils/helpers';

export default function HomeScreen() {
  const router = useRouter();
  const [todayNutrition, setTodayNutrition] = useState<NutritionLog | null>(null);
  const [recentWorkout, setRecentWorkout] = useState<WorkoutSession | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const nutrition = await getTodayNutritionLog();
    const workouts = await getRecentWorkouts(1);
    const userSettings = await getUserSettings();
    
    setTodayNutrition(nutrition);
    setRecentWorkout(workouts[0] || null);
    setSettings(userSettings);
  };

  const calculateCalorieProgress = () => {
    if (!todayNutrition || !settings) return 0;
    return Math.round((todayNutrition.calories / settings.dailyGoals.calories) * 100);
  };

  const calculateProteinProgress = () => {
    if (!todayNutrition || !settings) return 0;
    return Math.round((todayNutrition.protein / settings.dailyGoals.protein) * 100);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>Welcome to TMLSN</Text>
        <Text style={styles.subtitle}>Your integrated fitness operating system</Text>
      </View>

      {/* Today's Nutrition Summary */}
      <Card>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Today's Nutrition</Text>
          <TouchableOpacity onPress={() => router.push('/nutrition')}>
            <Text style={styles.linkText}>View →</Text>
          </TouchableOpacity>
        </View>
        {todayNutrition ? (
          <View style={styles.statsContainer}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{todayNutrition.calories}</Text>
              <Text style={styles.statLabel}>Calories</Text>
              <Text style={styles.statProgress}>{calculateCalorieProgress()}%</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{todayNutrition.protein}g</Text>
              <Text style={styles.statLabel}>Protein</Text>
              <Text style={styles.statProgress}>{calculateProteinProgress()}%</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{todayNutrition.water}</Text>
              <Text style={styles.statLabel}>Water (oz)</Text>
            </View>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No nutrition logged today</Text>
            <Button
              title="Start Tracking"
              onPress={() => router.push('/nutrition')}
              style={styles.button}
            />
          </View>
        )}
      </Card>

      {/* Recent Workout */}
      <Card>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Recent Workout</Text>
          <TouchableOpacity onPress={() => router.push('/workout')}>
            <Text style={styles.linkText}>View →</Text>
          </TouchableOpacity>
        </View>
        {recentWorkout ? (
          <View>
            <Text style={styles.workoutName}>{recentWorkout.name}</Text>
            <Text style={styles.workoutDate}>{formatDate(recentWorkout.date)}</Text>
            <Text style={styles.workoutDetail}>
              {recentWorkout.exercises.length} exercises • {recentWorkout.duration} min
            </Text>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No workouts logged yet</Text>
            <Button
              title="Start Workout"
              onPress={() => router.push('/workout')}
              style={styles.button}
            />
          </View>
        )}
      </Card>

      {/* Quick Actions */}
      <Card>
        <Text style={styles.cardTitle}>Quick Actions</Text>
        <View style={styles.quickActions}>
          <Button
            title="📊 Track Meal"
            onPress={() => router.push('/nutrition')}
            variant="secondary"
            style={styles.actionButton}
          />
          <Button
            title="💪 Log Workout"
            onPress={() => router.push('/workout')}
            variant="secondary"
            style={styles.actionButton}
          />
          <Button
            title="📝 Browse Prompts"
            onPress={() => router.push('/prompts')}
            variant="secondary"
            style={styles.actionButton}
          />
        </View>
      </Card>

      {/* Mastering Aesthetics Teaser */}
      <Card>
        <Text style={styles.cardTitle}>🔒 Mastering Aesthetics Course</Text>
        <Text style={styles.teaserText}>
          Unlock the complete aesthetics mastery system with AI coaching, integrated tools, and personalized protocols.
        </Text>
        <Button
          title="Learn More"
          onPress={() => {
            // This would navigate to subscription/upgrade screen
            console.log('Navigate to subscription screen');
          }}
          style={styles.upgradeButton}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.black,
  },
  contentContainer: {
    padding: Spacing.md,
  },
  header: {
    marginBottom: Spacing.lg,
    paddingTop: Spacing.md,
  },
  title: {
    fontSize: Typography.h1,
    fontWeight: Typography.weights.bold,
    color: Colors.white,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: Typography.body,
    color: Colors.primaryLight,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontSize: Typography.h2,
    fontWeight: Typography.weights.semiBold,
    color: Colors.white,
  },
  linkText: {
    fontSize: Typography.body,
    color: Colors.accentBlue,
    fontWeight: Typography.weights.medium,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: Typography.dataValue,
    fontWeight: Typography.weights.bold,
    color: Colors.white,
  },
  statLabel: {
    fontSize: Typography.label,
    color: Colors.primaryLight,
    marginTop: Spacing.xs,
  },
  statProgress: {
    fontSize: Typography.label,
    color: Colors.accentBlue,
    marginTop: Spacing.xs,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  emptyText: {
    fontSize: Typography.body,
    color: Colors.primaryLight,
    marginBottom: Spacing.md,
  },
  button: {
    minWidth: 200,
  },
  workoutName: {
    fontSize: Typography.h2,
    fontWeight: Typography.weights.semiBold,
    color: Colors.white,
    marginBottom: Spacing.xs,
  },
  workoutDate: {
    fontSize: Typography.body,
    color: Colors.primaryLight,
    marginBottom: Spacing.xs,
  },
  workoutDetail: {
    fontSize: Typography.body,
    color: Colors.primaryLight,
  },
  quickActions: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  actionButton: {
    width: '100%',
  },
  teaserText: {
    fontSize: Typography.body,
    color: Colors.primaryLight,
    marginVertical: Spacing.md,
    lineHeight: 22,
  },
  upgradeButton: {
    marginTop: Spacing.sm,
  },
});
