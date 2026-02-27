import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Pressable,
    ActivityIndicator,
    ImageBackground,
    Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { CaretLeft, Database, Clock } from 'phosphor-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, BorderRadius, Font } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { getWorkoutSessions, getUserSettings } from '../utils/storage';
import { WorkoutSession } from '../types';
import { toDisplayVolume, formatWeightDisplay } from '../utils/units';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const ACCENT_GOLD = '#D4B896';

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
                style={styles.card}
                onPress={() => router.push({ pathname: '/workout-detail', params: { sessionId: item.id } })}
            >
                <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    <Text style={styles.cardDate}>
                        {format(new Date(item.date), 'MMM d, yyyy')}
                    </Text>
                </View>
                <View style={styles.cardStats}>
                    <View style={styles.statPill}>
                        <Clock size={14} color={colors.primaryLight + 'A0'} />
                        <Text style={styles.statText}>{item.duration}m</Text>
                    </View>
                    <View style={styles.statPill}>
                        <Database size={14} color={colors.primaryLight + 'A0'} />
                        <Text style={styles.statText}>{formatWeightDisplay(volumeDisplay, weightUnit)}</Text>
                    </View>
                </View>
            </Pressable>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.primaryDark }]}>
            {/* Background: ImageBackground + LinearGradient overlay */}
            <View style={[StyleSheet.absoluteFill, { zIndex: 0 }]} pointerEvents="none">
                <ImageBackground
                    source={require('../assets/home-background.png')}
                    style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, position: 'absolute', top: 0, left: 0 }}
                    resizeMode="cover"
                >
                    <LinearGradient
                        colors={[
                            'transparent',
                            'rgba(47, 48, 49, 0.4)',
                            'rgba(47, 48, 49, 0.85)',
                            '#2F3031',
                            '#1a1a1a',
                        ]}
                        locations={[0, 0.2, 0.35, 0.45, 0.65]}
                        style={StyleSheet.absoluteFill}
                    />
                </ImageBackground>
            </View>

            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
                <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
                    <CaretLeft size={26} color={colors.primaryLight} />
                </Pressable>
                <Text style={styles.title}>History</Text>
                <View style={{ width: 44 }} />
            </View>

            {/* Content */}
            {loading ? (
                <ActivityIndicator style={{ marginTop: Spacing.xl }} color={ACCENT_GOLD} />
            ) : (
                <FlatList
                    data={sessions}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={[
                        styles.listContent,
                        { paddingBottom: insets.bottom + Spacing.xxl },
                    ]}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No completed workouts yet.</Text>
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        zIndex: 1,
    },
    backBtn: {
        width: 44,
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: Spacing.xs,
    },
    title: {
        fontSize: 20,
        fontFamily: Font.semiBold,
        color: ACCENT_GOLD,
        letterSpacing: -0.3,
    },
    listContent: {
        padding: Spacing.lg,
        paddingTop: Spacing.md,
    },
    card: {
        backgroundColor: 'rgba(40, 40, 40, 0.6)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: 18,
        padding: Spacing.lg,
        marginBottom: Spacing.md,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    cardTitle: {
        fontSize: 18,
        fontFamily: Font.semiBold,
        color: '#C6C6C6',
        flexShrink: 1,
        marginRight: Spacing.sm,
    },
    cardDate: {
        fontSize: 13,
        fontFamily: Font.mono,
        color: 'rgba(198, 198, 198, 0.6)',
    },
    cardStats: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    statPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 38,
    },
    statText: {
        fontSize: 13,
        fontFamily: Font.monoMedium,
        color: '#C6C6C6',
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: Spacing.xl,
    },
    emptyText: {
        fontFamily: Font.mono,
        fontSize: 14,
        color: ACCENT_GOLD,
        opacity: 0.7,
        textAlign: 'center',
    },
});
