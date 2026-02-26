import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { CaretLeft, Database, Clock } from 'phosphor-react-native';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { getWorkoutSessions, getUserSettings } from '../utils/storage';
import { WorkoutSession } from '../types';
import { toDisplayVolume, formatWeightDisplay } from '../utils/units';

export default function WorkoutHistoryScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const [sessions, setSessions] = useState<WorkoutSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [weightUnit, setWeightUnit] = useState<'lb' | 'kg'>('lb');

    useEffect(() => {
        async function load() {
            try {
                const [loadedSessions, settings] = await Promise.all([
                    getWorkoutSessions(),
                    getUserSettings()
                ]);
                setSessions(loadedSessions);
                setWeightUnit(settings.weightUnit);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    const renderItem = ({ item }: { item: WorkoutSession }) => {
        const rawVolume = item.exercises.reduce((acc, ex) =>
            acc + ex.sets.filter(s => s.completed).reduce((sacc, set) => sacc + (set.weight * set.reps), 0),
            0);
        const volumeDisplay = toDisplayVolume(rawVolume, weightUnit);

        return (
            <Pressable
                style={[styles.card, { backgroundColor: colors.primaryDarkLighter }]}
                onPress={() => router.push({ pathname: '/workout-detail', params: { sessionId: item.id } })}
            >
                <View style={styles.cardHeader}>
                    <Text style={[styles.cardTitle, { color: colors.primaryLight }]}>{item.name}</Text>
                    <Text style={[styles.cardDate, { color: colors.primaryLight + '80' }]}>
                        {format(new Date(item.date), 'MMM d, yyyy')}
                    </Text>
                </View>
                <View style={styles.cardStats}>
                    <View style={styles.statPill}>
                        <Clock size={16} color={colors.primaryLight + 'A0'} />
                        <Text style={[styles.statText, { color: colors.primaryLight }]}>{item.duration}m</Text>
                    </View>
                    <View style={styles.statPill}>
                        <Database size={16} color={colors.primaryLight + 'A0'} />
                        <Text style={[styles.statText, { color: colors.primaryLight }]}>{formatWeightDisplay(volumeDisplay, weightUnit)}</Text>
                    </View>
                </View>
            </Pressable>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.black, paddingTop: insets.top }]}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
                    <CaretLeft size={28} color={colors.primaryLight} />
                </Pressable>
                <Text style={[styles.title, { color: colors.primaryLight }]}>History</Text>
                <View style={{ width: 44 }} />
            </View>
            {loading ? (
                <ActivityIndicator style={{ marginTop: Spacing.xl }} color={colors.primaryLight} />
            ) : (
                <FlatList
                    data={sessions}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <Text style={[styles.emptyText, { color: colors.primaryLight + '80' }]}>No completed workouts yet.</Text>
                    }
                />
            )}
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
    listContent: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
    card: {
        padding: Spacing.lg, borderRadius: BorderRadius.lg, marginBottom: Spacing.md,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
    cardTitle: { fontSize: 18, fontFamily: 'EBGaramond_600SemiBold' },
    cardDate: { fontSize: 14, fontFamily: 'DMMono_400Regular' },
    cardStats: { flexDirection: 'row', gap: Spacing.md },
    statPill: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: '#ffffff10', paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: 38 },
    statText: { fontSize: 14, fontFamily: 'DMMono_500Medium' },
    emptyText: { textAlign: 'center', marginTop: Spacing.xl, fontFamily: 'DMMono_400Regular' }
});
