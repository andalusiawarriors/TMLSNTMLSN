import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Pressable,
    ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { CaretLeft, Database, Clock } from 'phosphor-react-native';
import { Spacing } from '../constants/theme';
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
                style={({ pressed }) => [
                    styles.card,
                    { backgroundColor: pressed ? colors.primaryLight + '10' : colors.primaryLight + '08' },
                ]}
                onPress={() => router.push({ pathname: '/workout-detail', params: { sessionId: item.id } })}
            >
                <View style={styles.cardTop}>
                    <Text style={[styles.cardName, { color: colors.primaryLight }]} numberOfLines={1}>
                        {item.name}
                    </Text>
                    <Text style={[styles.cardDate, { color: colors.primaryLight + '50' }]}>
                        {format(new Date(item.date), 'MMM d, yyyy')}
                    </Text>
                </View>
                <View style={styles.cardStats}>
                    <View style={[styles.statPill, { backgroundColor: colors.primaryLight + '12' }]}>
                        <Clock size={13} color={colors.primaryLight + '80'} />
                        <Text style={[styles.statText, { color: colors.primaryLight + 'CC' }]}>
                            {item.duration}m
                        </Text>
                    </View>
                    <View style={[styles.statPill, { backgroundColor: colors.primaryLight + '12' }]}>
                        <Database size={13} color={colors.primaryLight + '80'} />
                        <Text style={[styles.statText, { color: colors.primaryLight + 'CC' }]}>
                            {formatWeightDisplay(volumeDisplay, weightUnit)}
                        </Text>
                    </View>
                </View>
            </Pressable>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.primaryDark }]}>
            {/* ─── HEADER ─── */}
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
                    <CaretLeft size={24} color={colors.primaryLight} />
                </Pressable>
                <Text style={[styles.title, { color: colors.primaryLight }]}>History</Text>
                <View style={styles.headerSpacer} />
            </View>

            {loading ? (
                <ActivityIndicator
                    style={{ marginTop: Spacing.xl }}
                    color={colors.primaryLight + '80'}
                />
            ) : (
                <FlatList
                    data={sessions}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={[
                        styles.list,
                        { paddingBottom: insets.bottom + 40 },
                    ]}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyWrap}>
                            <Text style={[styles.emptyText, { color: colors.primaryLight + '40' }]}>
                                No completed workouts yet.
                            </Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },

    // Header — matches workout overlay top bar
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingBottom: 12,
    },
    backBtn: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        flex: 1,
        fontSize: 17,
        fontWeight: '600',
        letterSpacing: -0.3,
        textAlign: 'center',
        marginRight: 40, // offset for back button so title is truly centred
    },
    headerSpacer: {
        width: 0,
    },

    // List
    list: {
        paddingHorizontal: 16,
        paddingTop: 8,
        gap: 8,
    },

    // Card
    card: {
        borderRadius: 14,
        padding: 16,
    },
    cardTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
        gap: 8,
    },
    cardName: {
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: -0.2,
        flex: 1,
    },
    cardDate: {
        fontSize: 13,
        fontWeight: '400',
    },
    cardStats: {
        flexDirection: 'row',
        gap: 8,
    },
    statPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
    },
    statText: {
        fontSize: 13,
        fontWeight: '500',
    },

    // Empty
    emptyWrap: {
        alignItems: 'center',
        marginTop: 60,
    },
    emptyText: {
        fontSize: 15,
        fontWeight: '400',
        textAlign: 'center',
    },
});
