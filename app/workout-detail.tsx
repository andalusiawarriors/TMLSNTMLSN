import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { CaretLeft, Database, Clock } from 'phosphor-react-native';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { getWorkoutSessions, getUserSettings } from '../utils/storage';
import { WorkoutSession } from '../types';
import { formatWeightDisplay, toDisplayWeight, toDisplayVolume } from '../utils/units';

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
                    getUserSettings()
                ]);
                const found = loadedSessions.find(s => s.id === sessionId);
                if (found) setSession(found);
                setWeightUnit(settings.weightUnit);
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
            <View style={[styles.container, { backgroundColor: colors.black, paddingTop: insets.top }]}>
                <ActivityIndicator style={{ marginTop: Spacing.xl }} color={colors.primaryLight} />
            </View>
        );
    }

    const rawVolume = session.exercises.reduce((acc, ex) =>
        acc + ex.sets.filter(s => s.completed).reduce((sacc, set) => sacc + (set.weight * set.reps), 0),
        0);
    const volumeDisplay = toDisplayVolume(rawVolume, weightUnit);

    return (
        <View style={[styles.container, { backgroundColor: colors.black, paddingTop: insets.top }]}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
                    <CaretLeft size={28} color={colors.primaryLight} />
                </Pressable>
                <Text style={[styles.title, { color: colors.primaryLight }]}>Workout Detail</Text>
                <View style={{ width: 44 }} />
            </View>
            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.summaryCard}>
                    <Text style={[styles.summaryTitle, { color: colors.primaryLight }]}>{session.name}</Text>
                    <Text style={[styles.summaryDate, { color: colors.primaryLight + '80' }]}>
                        {format(new Date(session.date), 'MMM d, yyyy • h:mm a')}
                    </Text>
                    <View style={styles.statsRow}>
                        <View style={styles.statPill}>
                            <Clock size={16} color={colors.primaryLight + 'A0'} />
                            <Text style={[styles.statText, { color: colors.primaryLight }]}>{session.duration}m duration</Text>
                        </View>
                        <View style={styles.statPill}>
                            <Database size={16} color={colors.primaryLight + 'A0'} />
                            <Text style={[styles.statText, { color: colors.primaryLight }]}>{formatWeightDisplay(volumeDisplay, weightUnit)} total</Text>
                        </View>
                    </View>
                </View>

                {session.exercises.map((ex, i) => (
                    <View key={ex.id} style={[styles.exerciseCard, { backgroundColor: colors.primaryDarkLighter }]}>
                        <Text style={[styles.exerciseTitle, { color: colors.primaryLight }]}>
                            {i + 1}. {ex.name}
                        </Text>
                        {ex.notes ? (
                            <Text style={[styles.exerciseNotes, { color: colors.primaryLight + 'A0' }]}>{ex.notes}</Text>
                        ) : null}

                        <View style={styles.setRowHeader}>
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
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
        borderBottomWidth: 1, borderBottomColor: '#222'
    },
    backBtn: { padding: Spacing.xs },
    title: { fontSize: 20, fontFamily: 'EBGaramond_600SemiBold' },
    content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
    summaryCard: { marginBottom: Spacing.xl },
    summaryTitle: { fontSize: 28, fontFamily: 'EBGaramond_600SemiBold', marginBottom: Spacing.xs },
    summaryDate: { fontSize: 14, fontFamily: 'DMMono_400Regular', marginBottom: Spacing.md },
    statsRow: { flexDirection: 'row', gap: Spacing.md },
    statPill: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: '#ffffff10', paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: 38 },
    statText: { fontSize: 14, fontFamily: 'DMMono_500Medium' },
    exerciseCard: { padding: Spacing.lg, borderRadius: BorderRadius.lg, marginBottom: Spacing.md },
    exerciseTitle: { fontSize: 18, fontFamily: 'EBGaramond_600SemiBold', marginBottom: Spacing.xs },
    exerciseNotes: { fontSize: 14, fontFamily: 'DMMono_400Regular', fontStyle: 'italic', marginBottom: Spacing.sm },
    setRowHeader: { flexDirection: 'row', paddingVertical: Spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ffffff30', marginBottom: Spacing.xs },
    setColText: { fontSize: 12, fontFamily: 'DMMono_500Medium', textAlign: 'center' },
    setRow: { flexDirection: 'row', paddingVertical: Spacing.sm, alignItems: 'center' },
    setValText: { fontSize: 16, fontFamily: 'DMMono_400Regular', textAlign: 'center' },
    setNotesRow: { paddingLeft: 40, paddingBottom: Spacing.sm },
    setNotesText: { fontSize: 13, fontFamily: 'DMMono_400Regular', fontStyle: 'italic' }
});
