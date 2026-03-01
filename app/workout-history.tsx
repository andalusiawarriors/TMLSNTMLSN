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
import { CaretLeft, Clock, ChartBar, Barbell } from 'phosphor-react-native';
import { useTheme } from '../context/ThemeContext';
import { getWorkoutSessions, getUserSettings } from '../utils/storage';
import { WorkoutSession } from '../types';
import { toDisplayVolume, formatWeightDisplay } from '../utils/units';
import { HomeGradientBackground } from '../components/HomeGradientBackground';

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
            acc + ex.sets.filter(s => s.completed).reduce((sacc, set) => sacc + (set.weight * set.reps), 0), 0);
        const volumeDisplay = toDisplayVolume(rawVolume, weightUnit);
        const volumeStr = formatWeightDisplay(volumeDisplay, weightUnit);
        const exerciseCount = item.exercises.length;

        return (
            <Pressable
                style={({ pressed }) => [
                    styles.card,
                    {
                        backgroundColor: pressed
                            ? colors.primaryLight + '14'
                            : colors.primaryLight + '08',
                        borderWidth: 1,
                        borderColor: colors.primaryLight + '10',
                    },
                ]}
                onPress={() =>
                    router.push({ pathname: '/workout-detail', params: { sessionId: item.id } })
                }
            >
                <View style={styles.cardTop}>
                    <Text
                        style={[styles.cardName, { color: colors.primaryLight }]}
                        numberOfLines={1}
                    >
                        {item.name}
                    </Text>
                    <Text style={[styles.cardDate, { color: colors.primaryLight + '50' }]}>
                        {format(new Date(item.date), 'MMM d, yyyy')}
                    </Text>
                </View>

                <View style={styles.cardStats}>
                    <View style={[styles.statPill, { backgroundColor: colors.primaryLight + '10' }]}>
                        <Clock size={13} color={colors.primaryLight + '70'} />
                        <Text style={[styles.statText, { color: colors.primaryLight + 'CC' }]}>
                            {item.duration}m
                        </Text>
                    </View>

                    <View style={[styles.statPill, { backgroundColor: colors.primaryLight + '10' }]}>
                        <ChartBar size={13} color={colors.primaryLight + '70'} />
                        <Text style={[styles.statText, { color: colors.primaryLight + 'CC' }]}>
                            {volumeStr} {weightUnit}
                        </Text>
                    </View>

                    <View style={[styles.statPill, { backgroundColor: colors.primaryLight + '10' }]}>
                        <Barbell size={13} color={colors.primaryLight + '70'} />
                        <Text style={[styles.statText, { color: colors.primaryLight + 'CC' }]}>
                            {exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''}
                        </Text>
                    </View>
                </View>
            </Pressable>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.primaryDark }]}>
            <HomeGradientBackground />
            {/* TOP BAR */}
            <View style={[styles.header, { paddingTop: insets.top + 8, zIndex: 2 }]}>
                <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
                    <CaretLeft size={24} color={colors.primaryLight} />
                </Pressable>
                <Text style={[styles.title, { color: colors.primaryLight }]}>History</Text>
            </View>

            {loading ? (
                <ActivityIndicator
                    style={[styles.loader, { zIndex: 2 }]}
                    color={colors.primaryLight + '80'}
                />
            ) : (
                <FlatList
                    style={{ zIndex: 2 }}
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
                            <Text style={[styles.emptyPrimary, { color: colors.primaryLight + '30' }]}>
                                No workouts yet.
                            </Text>
                            <Text style={[styles.emptySecondary, { color: colors.primaryLight + '25' }]}>
                                Complete your first workout to see your history.
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

    // Header
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
        marginRight: 40,
    },

    // Loader
    loader: {
        marginTop: 80,
    },

    // List
    list: {
        paddingHorizontal: 16,
        paddingTop: 8,
    },

    // Card
    card: {
        borderRadius: 16,
        padding: 18,
        marginBottom: 10,
    },
    cardTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    cardName: {
        fontSize: 17,
        fontWeight: '600',
        letterSpacing: -0.3,
        flex: 1,
    },
    cardDate: {
        fontSize: 13,
        marginTop: 2,
    },

    // Stats row
    cardStats: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 12,
        flexWrap: 'wrap',
    },
    statPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    statText: {
        fontSize: 13,
        fontWeight: '500',
    },

    // Empty state
    emptyWrap: {
        alignItems: 'center',
        marginTop: 80,
    },
    emptyPrimary: {
        fontSize: 16,
        fontWeight: '500',
        textAlign: 'center',
    },
    emptySecondary: {
        fontSize: 14,
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 20,
        paddingHorizontal: 40,
    },
});
