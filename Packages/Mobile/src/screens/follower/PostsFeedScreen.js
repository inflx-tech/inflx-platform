/**
 * PostsFeedScreen — the Posts tab (Post/Concept Stage A).
 * Contract: features/concept-stagea-posts-ui/.
 *
 * Instagram-style card feed of approved+eligible creator posts (followed
 * creators pinned server-side). Anonymous browsing works; like/save prompt
 * login. Mounted on the follower app's spare tab slot (old Reels
 * placeholder) so the new experience ships without touching the old app.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { followerApi } from '../../services/api';
import PostCard from '../../components/posts/PostCard';
import ShopThisPostSheet from '../../components/posts/ShopThisPostSheet';

const PAGE = 20;

export default function PostsFeedScreen({ navigation }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [end, setEnd] = useState(false);
  const [shopPost, setShopPost] = useState(null);   // hydrated detail for the sheet

  const load = useCallback(async (offset = 0, refresh = false) => {
    if (refresh) setRefreshing(true);
    const res = await followerApi.getPosts({ limit: PAGE, offset });
    setRefreshing(false); setLoading(false);
    if (res.success) {
      const page = res.data?.posts || [];
      setEnd(page.length < PAGE);
      setPosts(prev => offset === 0 ? page : [...prev, ...page]);
    }
  }, []);
  useEffect(() => { load(0); }, [load]);

  function requireLogin() {
    Alert.alert('Login needed', 'Log in to like and save posts.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Login', onPress: () => navigation.navigate('FollowerLogin') },
    ]);
  }

  async function toggle(post, kind) {
    const liked = kind === 'like' ? post.liked : post.saved;
    const call = kind === 'like'
      ? (liked ? followerApi.unlikePost : followerApi.likePost)
      : (liked ? followerApi.unsavePost : followerApi.savePost);
    const res = await call(post.id);
    if (!res.success) {
      if (res.error?.code === 'UNAUTHORIZED' || res.status === 401) requireLogin();
      return;
    }
    setPosts(ps => ps.map(p => p.id !== post.id ? p : (kind === 'like'
      ? { ...p, liked: !liked, like_count: res.data.like_count }
      : { ...p, saved: !liked, save_count: res.data.save_count })));
  }

  async function openShop(post) {
    const res = await followerApi.getPost(post.id);
    if (res.success) setShopPost(res.data.post);
    else Alert.alert('Unavailable', 'This post is no longer available.');
  }

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <View style={st.header}>
        <Text style={st.logo}>INFLX</Text>
        <Text style={st.tab}>Posts</Text>
      </View>
      <FlatList
        data={posts}
        keyExtractor={p => p.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onOpen={() => navigation.navigate('PostViewer', { postId: item.id })}
            onShop={() => openShop(item)}
            onLike={() => toggle(item, 'like')}
            onSave={() => toggle(item, 'save')}
            onCreator={() => item.creator?.handle && navigation.navigate('InfluencerStore', { handle: item.creator.handle })}
          />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(0, true)} />}
        onEndReached={() => { if (!end && !loading) load(posts.length); }}
        onEndReachedThreshold={0.6}
        ListEmptyComponent={!loading && (
          <View style={st.empty}>
            <Text style={st.emptyTitle}>No posts yet</Text>
            <Text style={st.emptySub}>Creator posts land here the moment they're approved. Check back soon.</Text>
          </View>
        )}
      />
      <ShopThisPostSheet
        visible={!!shopPost}
        post={shopPost}
        onClose={() => setShopPost(null)}
        navigation={navigation}
      />
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF' },
  header: { flexDirection: 'row', alignItems: 'baseline', gap: 14, paddingHorizontal: 16, paddingVertical: 10 },
  logo: { fontSize: 18, fontWeight: '900', color: '#111', letterSpacing: 0.5 },
  tab: { fontSize: 13, fontWeight: '700', color: '#111', borderBottomWidth: 2.5, borderColor: '#F6B11E', paddingBottom: 2 },
  empty: { alignItems: 'center', paddingTop: 90, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#111' },
  emptySub: { fontSize: 12.5, color: '#999', textAlign: 'center', marginTop: 6, lineHeight: 18 },
});
