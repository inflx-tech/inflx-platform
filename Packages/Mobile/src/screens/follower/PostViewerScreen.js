/**
 * PostViewerScreen — full-screen post, design v3 (founder-locked board
 * post-design-v3.html, reference 2 pin-to-pin).
 *
 * The ENTIRE canvas is the cream sheet (#F5F2EC). Top: back ‹ + ⋯ only.
 * Media (true image, Model B — never cropped) with runtime pins. RIGHT RAIL
 * in black outline with counts BELOW each icon (like/save live; comments/
 * share coming soon). Bottom: creator row (ring avatar, black handle, blue
 * tick when verified, · Follow in BLACK — founder addition), caption
 * (more/less), grey timestamp, the WHITE "Shop this post / View all N
 * products in this look ›" banner, and the comment bar (visual until
 * comments ship). Back-from-product reopens the sheet.
 */
import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, Image, FlatList, TouchableOpacity, Pressable, ScrollView,
  ActivityIndicator, Alert, Dimensions, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { followerApi } from '../../services/api';
import {
  Pin, RingAvatar, timeAgo, YELLOW, CREAM, clampedHeight,
} from '../../components/posts/PostCard';
import { BagCircle, HeartIcon, CommentIcon, ShareIcon, SaveIcon, VerifiedTick } from '../../components/posts/icons';
import ShopThisPostSheet from '../../components/posts/ShopThisPostSheet';
// Slice 0 (features/follower-event-log) — a view with real dwell is the
// strongest quality signal a post can produce; nothing was recording it.
import { track, flush } from '../../services/events';

const WIN = Dimensions.get('window');

export default function PostViewerScreen({ navigation, route }) {
  const { postId } = route.params || {};
  const [post, setPost] = useState(null);
  const [missing, setMissing] = useState(false);
  const [slide, setSlide] = useState(0);
  const [shopOpen, setShopOpen] = useState(false);
  const [capOpen, setCapOpen] = useState(false);
  const [followed, setFollowed] = useState(false);
  const reopenShop = useRef(false);

  useEffect(() => {
    followerApi.getPost(postId).then(res => {
      if (res.success) setPost(res.data.post);
      else setMissing(true);
    });
  }, [postId]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      if (reopenShop.current) { reopenShop.current = false; setShopOpen(true); }
    });
    return unsub;
  }, [navigation]);

  // Dwell is measured from mount to unmount and sent ON THE WAY OUT — a 'view'
  // logged on open would count every accidental tap as engagement. The flush is
  // deliberate: leaving the viewer is exactly when the tail tends to be lost.
  useEffect(() => {
    if (!postId) return undefined;
    const openedAt = Date.now();
    return () => {
      track('view', postId, 'posts_tab', { dwell_ms: Date.now() - openedAt });
      flush();
    };
  }, [postId]);

  function requireLogin(what = 'do this') {
    Alert.alert('Login needed', `Log in to ${what}.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Login', onPress: () => navigation.navigate('FollowerLogin') },
    ]);
  }

  async function toggle(kind) {
    const on = kind === 'like' ? post.liked : post.saved;
    const call = kind === 'like'
      ? (on ? followerApi.unlikePost : followerApi.likePost)
      : (on ? followerApi.unsavePost : followerApi.savePost);
    const res = await call(post.id);
    if (!res.success) {
      if (res.error?.code === 'UNAUTHORIZED' || res.status === 401) requireLogin('like and save posts');
      return;
    }
    track(on ? `un${kind}` : kind, post.id, 'posts_tab');
    setPost(pv => kind === 'like'
      ? { ...pv, liked: !on, like_count: res.data.like_count }
      : { ...pv, saved: !on, save_count: res.data.save_count });
  }

  async function follow() {
    const res = followed
      ? await followerApi.unfollow(post.creator.id)
      : await followerApi.follow(post.creator.id);
    if (!res.success) {
      if (res.error?.code === 'UNAUTHORIZED' || res.status === 401) requireLogin('follow creators');
      return;
    }
    setFollowed(f => !f);
  }

  function openProduct(p) {
    if (p === '__bag__') { navigation.navigate('Cart'); return; }
    track('tap_product', postId, 'posts_tab', { product_id: p?.product_id || p?.id || null });
    reopenShop.current = true;
    setShopOpen(false);
    // The post travels WITH the product: it is what makes the eventual sale
    // traceable back to the post that caused it (via_post_id).
    navigation.navigate('PostProduct', { p, post_id: postId });
  }

  if (missing) {
    return (
      <SafeAreaView style={st.safeWhite}>
        <View style={st.center}>
          <Text style={st.missTitle}>Post unavailable</Text>
          <Text style={st.missSub}>It may have been removed, or its products no longer match its concept.</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn}>
            <Text style={st.backBtnTxt}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  if (!post) {
    return <SafeAreaView style={st.safe}><ActivityIndicator style={{ marginTop: 80 }} color={YELLOW} /></SafeAreaView>;
  }

  const soon = (what) => Alert.alert(what, 'Coming soon.');
  const capLong = (post.caption || '').length > 90;
  const mediaH = Math.min(clampedHeight(post.media[0]?.width, post.media[0]?.height) + 40, WIN.height * 0.58);

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 18 }}>
        {/* top: back + menu only, floating on cream */}
        <View style={st.top}>
          <TouchableOpacity onPress={() => navigation.goBack()}><Text style={st.topIcon}>‹</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => soon('Options')}><Text style={st.menu}>⋯</Text></TouchableOpacity>
        </View>

        {/* media + rail region */}
        <View>
          <FlatList
            horizontal pagingEnabled showsHorizontalScrollIndicator={false}
            data={post.media} keyExtractor={m => m.id}
            onMomentumScrollEnd={e => setSlide(Math.round(e.nativeEvent.contentOffset.x / WIN.width))}
            renderItem={({ item: m }) => (
              <View style={{ width: WIN.width, height: mediaH }}>
                <Image source={{ uri: m.url }} style={{ width: WIN.width, height: mediaH }} resizeMode="cover" />
                {(post.pins || []).filter(t => t.media_id === m.id).map((t, i) => (
                  <Pin key={i} tag={t} style={post.tag_style} />
                ))}
              </View>
            )}
          />
          {post.media.length > 1 && (
            <View style={st.slideBadge}><Text style={st.slideBadgeTxt}>{slide + 1}/{post.media.length}</Text></View>
          )}
          {/* RIGHT RAIL — black outline on cream, counts BELOW */}
          <View style={st.rail}>
            <TouchableOpacity style={st.railBtn} onPress={() => toggle('like')}>
              <HeartIcon size={22} color={post.liked ? '#E0245E' : '#111'} filled={post.liked} />
              <Text style={st.railCount}>{post.like_count || 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.railBtn} onPress={() => soon('Comments')}>
              <CommentIcon size={22} />
              <Text style={st.railCount}>0</Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.railBtn} onPress={() => soon('Share')}>
              <ShareIcon size={22} />
            </TouchableOpacity>
            <TouchableOpacity style={st.railBtn} onPress={() => toggle('save')}>
              <SaveIcon size={22} color={post.saved ? YELLOW : '#111'} filled={post.saved} />
              <Text style={st.railCount}>{post.save_count || 0}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* bottom block on cream */}
        <View style={{ paddingHorizontal: 14 }}>
          <View style={st.creatorRow}>
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
              onPress={() => post.creator?.handle && navigation.navigate('InfluencerStore', { handle: post.creator.handle })}>
              <RingAvatar creator={post.creator} size={32} />
              <Text style={st.handle}>{post.creator.handle}</Text>
              {post.creator.verified ? <VerifiedTick size={13} /> : null}
            </TouchableOpacity>
            <Text style={{ color: '#8A8A8A', marginHorizontal: 7 }}>·</Text>
            <TouchableOpacity onPress={follow}>
              <Text style={st.followTxt}>{followed ? 'Following' : 'Follow'}</Text>
            </TouchableOpacity>
          </View>

          {!!post.caption && (
            <Pressable onPress={() => capLong && setCapOpen(o => !o)}>
              <Text style={st.caption} numberOfLines={capOpen ? undefined : 2}>{post.caption}</Text>
              {capLong && <Text style={st.capMore}>{capOpen ? 'less' : '… more'}</Text>}
            </Pressable>
          )}
          <Text style={st.timestamp}>{timeAgo(post.created_at)}</Text>

          {/* WHITE shop banner */}
          <TouchableOpacity style={st.shopBanner} activeOpacity={0.9}
            onPress={() => { track('tap_shop', postId, 'posts_tab'); setShopOpen(true); }}>
            <BagCircle size={28} />
            <View style={{ flex: 1 }}>
              <Text style={st.shopTitle}>Shop this post</Text>
              <Text style={st.shopSub}>View all {(post.products || []).length} product{(post.products || []).length === 1 ? '' : 's'} in this look</Text>
            </View>
            <Text style={st.chev}>›</Text>
          </TouchableOpacity>

          {/* comment bar — visual until comments ship */}
          <TouchableOpacity style={st.commentBar} activeOpacity={0.8} onPress={() => soon('Comments')}>
            <View style={st.commentAvatar} />
            <Text style={st.commentPlaceholder}>Add a comment…</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ShopThisPostSheet
        visible={shopOpen}
        post={post}
        onClose={() => setShopOpen(false)}
        onOpenProduct={openProduct}
      />
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF' },
  safeWhite: { flex: 1, backgroundColor: '#FFF' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 6 },
  topIcon: { fontSize: 28, color: '#111' },
  menu: { fontSize: 16, color: '#111', letterSpacing: 2 },
  slideBadge: { position: 'absolute', top: 10, right: 12, backgroundColor: 'rgba(17,17,17,0.78)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  slideBadgeTxt: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  rail: { position: 'absolute', right: 12, bottom: 10, alignItems: 'center', gap: 11 },
  // white chip behind each icon — media is cover-fit now, so the rail sits
  // over the photo; the chip keeps black icons readable on any image.
  railBtn: { alignItems: 'center', gap: 2, backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 6, minWidth: 44 },
  railCount: { fontSize: 11, fontWeight: '600', color: '#111' },
  creatorRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  handle: { fontSize: 13.5, fontWeight: '800', color: '#111' },
  followTxt: { fontSize: 13, fontWeight: '800', color: '#111' },
  caption: { fontSize: 12, color: '#111', lineHeight: 17.5, marginTop: 7 },
  capMore: { fontSize: 11.5, fontWeight: '600', color: '#8A8A8A', marginTop: 2 },
  timestamp: { fontSize: 10.5, color: '#8A8A8A', marginTop: 4 },
  shopBanner: { marginTop: 10, backgroundColor: '#FFF', borderRadius: 14, paddingVertical: 11, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 11, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 7, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  shopTitle: { fontSize: 13, fontWeight: '800', color: '#111' },
  shopSub: { fontSize: 10.5, color: '#8A8A8A', marginTop: 1 },
  chev: { fontSize: 17, color: '#777' },
  commentBar: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  commentAvatar: { width: 27, height: 27, borderRadius: 14, backgroundColor: '#DDD' },
  commentPlaceholder: { flex: 1, backgroundColor: '#FFF', borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14, fontSize: 11.5, color: '#999' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  missTitle: { fontSize: 16, fontWeight: '800', color: '#111' },
  missSub: { fontSize: 12.5, color: '#999', textAlign: 'center', marginTop: 6, lineHeight: 18 },
  backBtn: { marginTop: 16, backgroundColor: '#111', borderRadius: 12, paddingHorizontal: 22, paddingVertical: 11 },
  backBtnTxt: { color: YELLOW, fontWeight: '800', fontSize: 13 },
});
