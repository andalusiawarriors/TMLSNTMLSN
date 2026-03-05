import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  Modal,
  ScrollView,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Heart, UserCircle } from 'phosphor-react-native';
import { BlurView } from 'expo-blur';
import { Spacing } from '../../../constants/theme';
import { supabase } from '../../../lib/supabase';
import { BackButton } from '../../../components/BackButton';
import { HomeGradientBackground } from '../../../components/HomeGradientBackground';
import { ExploreProfileModal } from '../../../components/explore/ExploreProfileModal';
import { ExplorePostDetailModal } from '../../../components/explore/ExplorePostDetailModal';
import type { PostForDetail } from '../../../components/explore/ExplorePostDetailModal';

const CARD_RADIUS = 24;

type FeedPost = PostForDetail & { type: 'post' };

function formatTimeAgo(createdAt: string): string {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const diffHrs = Math.floor(diffMs / 3600000);
  if (diffHrs < 1) return 'Just now';
  if (diffHrs < 24) return `${diffHrs}h`;
  return `${Math.floor(diffHrs / 24)}d`;
}

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();

  const [feedItems, setFeedItems] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [selectedPost, setSelectedPost] = useState<PostForDetail | null>(null);

  const loadFeed = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('workout_posts')
        .select('id, title, description, created_at, user_id, session_id, image_path')
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error || !data || data.length === 0) return;

      const sessionIds = data.filter((p) => p.session_id).map((p) => p.session_id);

      const [sessionRows, signedUrls] = await Promise.all([
        sessionIds.length > 0
          ? supabase
              .from('workout_sessions')
              .select('id, user_id, duration, name')
              .in('id', sessionIds)
              .then((r) => r.data ?? [])
          : Promise.resolve([] as any[]),
        Promise.all(
          data.map(async (p) => {
            if (!p.image_path) return null;
            const { data: urlData, error: urlErr } = await supabase.storage
              .from('workout-images')
              .createSignedUrl(p.image_path, 3600);
            if (__DEV__ && urlErr) console.warn('[ExploreFeed] signedUrl error for', p.image_path, urlErr);
            return urlData?.signedUrl ?? null;
          })
        ),
      ]);

      const sessionMap = new Map<string, any>(
        (sessionRows as any[]).map((s: any) => [`${s.user_id}:${s.id}`, s])
      );

      const posts: FeedPost[] = data.map((p, i) => {
        const session = sessionMap.get(`${p.user_id}:${p.session_id}`);
        return {
          type: 'post' as const,
          id: p.id,
          userId: p.user_id,
          authorName: 'Athlete',
          authorHandle: p.user_id.slice(0, 8),
          caption: p.description || '',
          title: p.title ?? null,
          imageUrl: signedUrls[i],
          workoutSessionId: p.session_id,
          duration: session?.duration ?? 0,
          timeAgo: formatTimeAgo(p.created_at),
        };
      });

      setFeedItems(posts);
    } catch (err) {
      if (__DEV__) console.warn('[ExploreFeed] error', err);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadFeed().finally(() => setLoading(false));
  }, [loadFeed]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFeed();
    setRefreshing(false);
  }, [loadFeed]);

  const renderPost = ({ item }: { item: FeedPost }) => (
    <Pressable
      onPress={() => setSelectedPost(item)}
      style={({ pressed }) => [styles.cardPressable, { opacity: pressed ? 0.88 : 1 }]}
    >
      <View style={[styles.glass, { borderRadius: CARD_RADIUS }]}>
        <BlurView
          intensity={26}
          tint="dark"
          style={[StyleSheet.absoluteFillObject, { borderRadius: CARD_RADIUS }]}
        />
        <View style={[StyleSheet.absoluteFillObject, styles.fill, { borderRadius: CARD_RADIUS }]} />
        <LinearGradient
          colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.07)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.85, y: 0.85 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: CARD_RADIUS }]}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.06)', 'transparent']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.18 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: CARD_RADIUS }]}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.22)']}
          start={{ x: 0.5, y: 0.55 }}
          end={{ x: 0.5, y: 1 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: CARD_RADIUS }]}
          pointerEvents="none"
        />
        <View
          style={[StyleSheet.absoluteFillObject, styles.border, { borderRadius: CARD_RADIUS }]}
          pointerEvents="none"
        />

        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.cardImage}
            resizeMode="cover"
          />
        ) : null}

        <View style={styles.cardBody}>
          <View style={styles.authorRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.authorName[0]}</Text>
            </View>
            <View style={styles.authorMeta}>
              <Text style={styles.authorName} numberOfLines={1}>
                {item.authorName}
              </Text>
              <Text style={styles.authorHandle} numberOfLines={1}>
                @{item.authorHandle} · {item.timeAgo}
              </Text>
            </View>
          </View>

          {item.title ? (
            <Text style={styles.postTitle} numberOfLines={2}>
              {item.title}
            </Text>
          ) : null}

          {item.caption ? (
            <Text style={styles.postCaption} numberOfLines={3}>
              {item.caption}
            </Text>
          ) : null}

          {item.duration > 0 ? (
            <View style={styles.durationChip}>
              <Text style={styles.durationText}>{item.duration} min</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );

  const headerTop = insets.top + 8;

  return (
    <View style={styles.container}>
      <HomeGradientBackground />

      <View style={[styles.header, { paddingTop: headerTop }]}>
        <Pressable
          onPress={() => setShowNotifications(true)}
          style={styles.headerIcon}
          hitSlop={12}
        >
          <Heart size={24} weight="regular" color="#C6C6C6" />
        </Pressable>
        <View style={styles.headerSpacer} />
        <Pressable
          onPress={() => setShowProfile(true)}
          style={styles.headerIcon}
          hitSlop={12}
        >
          <UserCircle size={24} weight="regular" color="#C6C6C6" />
        </Pressable>
      </View>

      <FlatList
        data={feedItems}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: headerTop + 44 + Spacing.sm,
            paddingBottom: Math.max(Spacing.lg, insets.bottom + 100),
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#C6C6C6"
          />
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color="#C6C6C6" style={{ marginTop: 60 }} />
          ) : (
            <Text style={styles.emptyText}>
              No posts yet. Share a workout to get started.
            </Text>
          )
        }
        showsVerticalScrollIndicator={false}
      />

      <ExplorePostDetailModal
        visible={selectedPost !== null}
        post={selectedPost}
        onClose={() => setSelectedPost(null)}
      />

      <Modal
        visible={showNotifications}
        animationType="fade"
        transparent
        onRequestClose={() => setShowNotifications(false)}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowNotifications(false)}>
          <BlurView
            intensity={50}
            tint="dark"
            style={StyleSheet.absoluteFill}
            {...(Platform.OS === 'android'
              ? { experimentalBlurMethod: 'dimezisBlurView' as const }
              : {})}
          />
        </Pressable>
        <View style={[styles.modalBackRow, { top: headerTop, paddingLeft: Spacing.lg }]}>
          <BackButton onPress={() => setShowNotifications(false)} />
        </View>
        <ScrollView
          contentContainerStyle={[
            styles.notificationsScroll,
            { paddingTop: headerTop + 48 + 48 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.notificationsTitle}>Notifications</Text>
          <Text style={styles.emptyText}>No new notifications.</Text>
        </ScrollView>
      </Modal>

      <ExploreProfileModal visible={showProfile} onClose={() => setShowProfile(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a1a' },

  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 2,
  },
  headerIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerSpacer: { flex: 1 },

  listContent: { paddingHorizontal: 16 },

  cardPressable: {
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 10,
  },
  glass: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  fill: { backgroundColor: 'rgba(47, 48, 49, 0.30)' },
  border: { borderWidth: 1, borderColor: 'rgba(198,198,198,0.22)' },

  cardImage: {
    width: '100%',
    aspectRatio: 4 / 3,
  },
  cardBody: { padding: 16 },

  authorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(198,198,198,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: { fontSize: 15, fontWeight: '600', color: '#C6C6C6' },
  authorMeta: { flex: 1, minWidth: 0 },
  authorName: { fontSize: 15, fontWeight: '600', color: '#C6C6C6' },
  authorHandle: { fontSize: 12, color: 'rgba(198,198,198,0.6)', marginTop: 1 },

  postTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
    color: '#C6C6C6',
    marginBottom: 4,
  },
  postCaption: {
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(198,198,198,0.8)',
    marginBottom: 10,
  },
  durationChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(198,198,198,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(198,198,198,0.18)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  durationText: { fontSize: 12, fontWeight: '500', color: 'rgba(198,198,198,0.75)' },

  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
    color: 'rgba(198,198,198,0.45)',
  },

  modalBackRow: { position: 'absolute', left: 0, right: 0, zIndex: 10 },
  notificationsScroll: { paddingHorizontal: 24, paddingBottom: 40 },
  notificationsTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#C6C6C6',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
});
