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
  ImageBackground,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Heart, UserCircle } from 'phosphor-react-native';
import { BlurView } from 'expo-blur';
import { Colors, Spacing, BorderRadius } from '../../../constants/theme';
import { useTheme } from '../../../context/ThemeContext';
import { supabase } from '../../../lib/supabase';
import { BackButton } from '../../../components/BackButton';
import { ExploreProfileModal } from '../../../components/explore/ExploreProfileModal';
const SCREEN_WIDTH = Dimensions.get('window').width;
const windowHeight = Dimensions.get('window').height;

type FeedPost = {
  type: 'post';
  id: string;
  authorName: string;
  authorHandle: string;
  caption: string;
  title?: string | null;
  imageUrl?: string | null;
  imagePath?: string | null;
  workoutSessionId?: string | null;
  stats?: { duration: number; volume: number };
  publicNotes?: string[];
  likes: number;
  comments: number;
  timeAgo: string;
};

type SuggestedProfile = {
  id: string;
  name: string;
  username: string;
};

type FeedSuggested = {
  type: 'suggested';
  id: string;
  profiles: SuggestedProfile[];
};

type FeedItem = FeedPost | FeedSuggested;

const MOCK_SUGGESTED: SuggestedProfile[] = [
  { id: 's1', name: 'Morgan', username: 'morgan_fit' },
  { id: 's2', name: 'Taylor', username: 'taylor_lifts' },
  { id: 's3', name: 'Quinn', username: 'quinn_trains' },
];

function formatTimeAgo(createdAt: string): string {
  const date = new Date(createdAt);
  const diffMs = Date.now() - date.getTime();
  const diffHrs = Math.floor(diffMs / 3600000);
  if (diffHrs < 1) return 'Just now';
  if (diffHrs < 24) return `${diffHrs}h`;
  return `${Math.floor(diffHrs / 24)}d`;
}

export default function ExploreScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [signedUrlCache, setSignedUrlCache] = useState<Record<string, string>>({});
  const [signedUrlCacheHits, setSignedUrlCacheHits] = useState(0);
  const [signedUrlCacheMisses, setSignedUrlCacheMisses] = useState(0);

  const getSignedUrl = useCallback(
    async (postId: string, imagePath: string | null | undefined): Promise<string | null> => {
      if (!imagePath || !supabase) return null;
      const cacheKey = `${postId}:${imagePath}`;
      if (signedUrlCache[cacheKey]) {
        setSignedUrlCacheHits((c) => c + 1);
        return signedUrlCache[cacheKey];
      }
      setSignedUrlCacheMisses((c) => c + 1);
      const { data, error } = await supabase.storage
        .from('workout-images')
        .createSignedUrl(imagePath, 3600);
      if (error) return null;
      const url = data?.signedUrl ?? null;
      if (url) setSignedUrlCache((prev) => ({ ...prev, [cacheKey]: url }));
      return url;
    },
    [signedUrlCache]
  );

  useEffect(() => {
    async function loadFeed() {
      if (!supabase) {
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('workout_posts')
          .select('id, title, description, created_at, user_id, session_id, image_path')
          .eq('visibility', 'public')
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) {
          if (__DEV__) console.warn('[ExploreFeed] fetch error:', error);
          setLoading(false);
          return;
        }

        const posts: FeedPost[] = [];
        for (const p of data ?? []) {
          const imageUrl = p.image_path
            ? await getSignedUrl(p.id, p.image_path)
            : null;
          const timeAgo = formatTimeAgo(p.created_at);

          posts.push({
            type: 'post',
            id: p.id,
            authorName: 'Athlete',
            authorHandle: 'tmlsn_user',
            caption: p.description || '',
            title: p.title ?? null,
            imageUrl,
            imagePath: p.image_path,
            workoutSessionId: p.session_id,
            stats: { duration: 0, volume: 0 },
            publicNotes: [],
            likes: 0,
            comments: 0,
            timeAgo,
          });
        }

        const items: FeedItem[] = [];
        posts.forEach((p, i) => {
          if (i > 0 && i % 4 === 0) {
            const batch = MOCK_SUGGESTED.slice(0, 3);
            items.push({ type: 'suggested', id: `sug-${i}`, profiles: batch });
          }
          items.push(p);
        });

        setFeedItems(items);
        if (__DEV__) console.log('[ExploreFeed] loaded posts count:', posts.length);
      } catch (err) {
        if (__DEV__) console.warn('[ExploreFeed] error', err);
      } finally {
        setLoading(false);
      }
    }
    loadFeed();
  }, []);

  useEffect(() => {
    if (__DEV__ && (signedUrlCacheHits > 0 || signedUrlCacheMisses > 0)) {
      console.log('[ExploreFeed] signedUrl cache hit:', signedUrlCacheHits, 'miss:', signedUrlCacheMisses);
    }
  }, [signedUrlCacheHits, signedUrlCacheMisses]);

  const renderPost = (item: FeedPost) => (
    <View
      style={[
        styles.feedPostCard,
        { backgroundColor: colors.primaryDarkLighter, borderColor: colors.primaryLight + '20' },
      ]}
    >
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.feedPostMedia} />
      ) : (
        <View style={[styles.feedPostMedia, { backgroundColor: colors.primaryLight + '12' }]} />
      )}
      <View style={styles.feedPostHeader}>
        <View style={[styles.feedPostAvatar, { backgroundColor: colors.primaryLight + '25' }]}>
          <Text style={[styles.feedPostAvatarText, { color: colors.primaryLight }]}>
            {item.authorName[0]}
          </Text>
        </View>
        <View style={styles.feedPostMeta}>
          <Text style={[styles.feedPostAuthor, { color: colors.primaryLight }]} numberOfLines={1}>
            {item.authorName}
          </Text>
          <Text style={[styles.feedPostHandle, { color: colors.primaryLight + '99' }]} numberOfLines={1}>
            @{item.authorHandle} · {item.timeAgo}
          </Text>
        </View>
      </View>
      {item.title ? (
        <Text style={[styles.feedPostCaption, styles.feedPostTitle, { color: colors.primaryLight }]}>
          {item.title}
        </Text>
      ) : null}
      <Text style={[styles.feedPostCaption, { color: colors.primaryLight }]}>{item.caption}</Text>
      {item.stats && item.stats.duration > 0 && (
        <View style={styles.statsRow}>
          <Text style={[styles.statsText, { color: colors.primaryLight + 'A0' }]}>
            {item.stats.duration}m
          </Text>
          <Text style={[styles.statsText, { color: colors.primaryLight + 'A0' }]}>
            {item.stats.volume} total
          </Text>
        </View>
      )}
      <View style={styles.feedPostFooter}>
        <Text style={[styles.feedPostStats, { color: colors.primaryLight + '99' }]}>
          {item.likes} likes · {item.comments} comments
        </Text>
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: FeedItem }) => {
    if (item.type === 'post') return renderPost(item);
    return (
      <View
        style={[
          styles.feedSuggestedBlock,
          { backgroundColor: colors.primaryDarkLighter, borderColor: colors.primaryLight + '20' },
        ]}
      >
        <Text style={[styles.feedSuggestedTitle, { color: colors.primaryLight }]}>
          Suggested for you
        </Text>
        {item.profiles.map((profile) => (
          <View key={profile.id} style={styles.feedSuggestedRow}>
            <View
              style={[
                styles.feedPostAvatar,
                styles.feedSuggestedAvatar,
                { backgroundColor: colors.primaryLight + '25' },
              ]}
            >
              <Text style={[styles.feedPostAvatarText, { color: colors.primaryLight }]}>
                {profile.name[0]}
              </Text>
            </View>
            <View style={styles.feedSuggestedMeta}>
              <Text style={[styles.feedPostAuthor, { color: colors.primaryLight }]} numberOfLines={1}>
                {profile.name}
              </Text>
              <Text style={[styles.feedPostHandle, { color: colors.primaryLight + '99' }]} numberOfLines={1}>
                @{profile.username}
              </Text>
            </View>
            <Pressable style={[styles.feedFollowButton, { backgroundColor: colors.primaryLight }]}>
              <Text style={[styles.feedFollowButtonText, { color: colors.primaryDark }]}>Follow</Text>
            </Pressable>
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.primaryDark }]}>
      <View style={[StyleSheet.absoluteFill, { zIndex: 0 }]} pointerEvents="none">
        <ImageBackground
          source={require('../../../assets/home-background.png')}
          style={{ width: SCREEN_WIDTH, height: windowHeight, position: 'absolute', top: 0, left: 0 }}
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

      <View
        style={[
          styles.header,
          { paddingTop: 54, paddingHorizontal: Spacing.md + (insets.left || 0), paddingRight: Spacing.md + (insets.right || 0) },
        ]}
      >
        <Pressable onPress={() => setShowNotifications(true)} style={styles.headerIcon} hitSlop={12}>
          <Heart size={24} weight="regular" color={colors.primaryLight} />
        </Pressable>
        <View style={styles.headerSpacer} />
        <Pressable onPress={() => setShowProfile(true)} style={styles.headerIcon} hitSlop={12}>
          <UserCircle size={24} weight="regular" color={colors.primaryLight} />
        </Pressable>
      </View>

      <FlatList
        data={feedItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: 54 + 40 + Spacing.sm, paddingBottom: Math.max(Spacing.lg, insets.bottom + 100) },
        ]}
        ListEmptyComponent={
          loading ? null : (
            <Text style={[styles.emptyText, { color: colors.primaryLight + '80' }]}>
              No posts yet. Share a workout to get started.
            </Text>
          )
        }
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
            {...(Platform.OS === 'android' ? { experimentalBlurMethod: 'dimezisBlurView' as const } : {})}
          />
        </Pressable>
        <View style={[styles.modalBackRow, { top: 54, paddingLeft: Spacing.lg }]}>
          <BackButton onPress={() => setShowNotifications(false)} />
        </View>
        <View
          style={[
            styles.modalContent,
            { top: 54, height: windowHeight - 54 - 24 - insets.bottom, paddingBottom: 24 + insets.bottom },
          ]}
        >
          <ScrollView
            contentContainerStyle={[styles.notificationsScroll, { paddingTop: 54 + 48 }]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.notificationsTitle, { color: colors.primaryLight }]}>Notifications</Text>
            <Text style={[styles.sectionLabel, { color: colors.primaryLight + '99' }]}>Today</Text>
            <Text style={[styles.emptyText, { color: colors.primaryLight + '60' }]}>No new notifications.</Text>
          </ScrollView>
        </View>
      </Modal>

      <ExploreProfileModal visible={showProfile} onClose={() => setShowProfile(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 2,
  },
  headerIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerSpacer: { flex: 1 },
  listContent: { paddingHorizontal: Spacing.md },
  feedPostCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  feedPostMedia: { width: '100%', aspectRatio: 1 },
  feedPostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  feedPostAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  feedPostAvatarText: { fontSize: 17, fontWeight: '600' },
  feedPostMeta: { flex: 1, minWidth: 0 },
  feedPostAuthor: { fontSize: 17, fontWeight: '600', letterSpacing: -0.11 },
  feedPostHandle: { fontSize: 13, marginTop: 2 },
  feedPostCaption: { fontSize: 17, lineHeight: 22, marginBottom: Spacing.sm, paddingHorizontal: Spacing.md },
  feedPostTitle: { fontWeight: '600', paddingBottom: 4 },
  statsRow: { flexDirection: 'row', paddingHorizontal: Spacing.md, gap: Spacing.md, marginTop: Spacing.sm },
  statsText: { fontSize: 12, fontWeight: '500' },
  feedPostFooter: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  feedPostStats: { fontSize: 13 },
  feedSuggestedBlock: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  feedSuggestedTitle: { fontSize: 17, fontWeight: '600', marginBottom: Spacing.sm },
  feedSuggestedRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  feedSuggestedMeta: { flex: 1, minWidth: 0, marginLeft: Spacing.sm },
  feedSuggestedAvatar: { marginRight: 0 },
  feedFollowButton: { paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: 20 },
  feedFollowButtonText: { fontSize: 13, fontWeight: '600' },
  modalBackRow: { position: 'absolute', left: 0, right: 0, zIndex: 10 },
  modalContent: { position: 'absolute', left: 0, right: 0, pointerEvents: 'box-none' },
  notificationsScroll: { paddingBottom: Spacing.lg },
  notificationsTitle: { fontSize: 22, fontWeight: '600', marginBottom: Spacing.md },
  sectionLabel: { fontSize: 13, marginBottom: Spacing.sm },
  emptyText: { textAlign: 'center', marginTop: Spacing.xl },
});
