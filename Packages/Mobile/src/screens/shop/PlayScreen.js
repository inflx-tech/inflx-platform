/**
 * F5 Play — full-screen videos only, all creators, swipe up for the next (like Reels).
 * Contract: features/follower-app-v2 · board F5 · rules v1.7 §4.7, §5.7
 *
 * The ▶ tab, and any video tapped in the feed (it goes first). Each video shows the creator and
 * brand (their stores), the offer, Shop this video, and like · comment · share · save. Until the
 * Play Store build brings the player, a video shows its product photo with "Update INFLX to play
 * videos" (VideoView) — the order, the actions and the recording already work.
 */
import React, { useCallback, useRef, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { followerApi } from '../../services/api';
import { CS, fmtCount } from '../../components/shop/copyShop';
import { VideoView, ShopSheet, SignInSheet, Loading, Empty, usePostActions, C } from '../../components/shop/bitsShop';
import { useShopNav } from '../../components/shop/useShopNav';
import { useAutoplay } from '../../components/shop/useAutoplay';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { whoParams, ensureDeviceHeader } from '../../components/shop/shopStore';
import { track } from '../../services/events';
import { fonts } from '../../theme/tokens';

function Reel({ post, height, nav, index, active, sound, onSound }) {
  const a = usePostActions(post, { surface: 'play', onNeedSignIn: nav.needSignIn });
  const n = post.products ? post.products.length : 0;
  return (
    <View style={{ height, backgroundColor: C.dark }} testID={`reel-${post.id}`}>
      <VideoView post={post} height={height} active={active} muted={!sound} surface="play" soundToggle onSoundChange={onSound} />
      <View style={st.rail}>
        <TouchableOpacity onPress={a.like} style={st.railBtn} testID={`reel-like-${post.id}`}><View style={st.railIc}><Icon name={a.liked ? 'heart' : 'heart-outline'} size={22} color={a.liked ? '#FF5A5A' : '#fff'} /></View><Text style={st.railN}>{fmtCount(a.likes)}</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => nav.openComments(post)} style={st.railBtn}><View style={st.railIc}><Icon name="comment-outline" size={21} color="#fff" /></View><Text style={st.railN}>{fmtCount(post.counts ? post.counts.comments : 0)}</Text></TouchableOpacity>
        <TouchableOpacity onPress={a.share} style={st.railBtn}><View style={st.railIc}><Icon name="share-outline" size={22} color="#fff" /></View><Text style={st.railN}>{fmtCount(post.counts ? post.counts.shares : 0)}</Text></TouchableOpacity>
        <TouchableOpacity onPress={a.save} style={st.railBtn} testID={`reel-save-${post.id}`}><View style={st.railIc}><Icon name={a.saved ? 'bookmark' : 'bookmark-outline'} size={21} color="#fff" /></View><Text style={st.railN}>{a.saved ? 'Saved' : 'Save'}</Text></TouchableOpacity>
      </View>
      <View style={st.who}>
        <Text style={st.whoName}>
          <Text onPress={() => { track('tap_creator', post.id, 'play'); nav.openCreator(post.creator); }}>{post.creator ? post.creator.name : ''}</Text>
          {' · '}
          <Text onPress={() => { track('tap_brand', post.id, 'play'); nav.openBrand(post.brand); }}>{post.brand ? post.brand.name : ''}</Text>
        </Text>
        {post.caption ? <Text style={st.whoCap} numberOfLines={2}>{post.caption}</Text> : null}
        {post.offer && post.offer.badge ? <View style={st.badge}><Text style={st.badgeText}>{post.offer.badge}</Text></View> : null}
      </View>
      <TouchableOpacity style={st.shop} onPress={() => { track('tap_shop', post.id, 'play', { position: index }); nav.openShop(post); }} testID={`reel-shop-${post.id}`}>
        <Text style={st.shopText}>{CS.shopThisVideo} · {CS.items(n)}</Text>
        <Text style={st.shopText}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function PlayScreen({ navigation, route }) {
  const nav = useShopNav(navigation);
  const [height, setHeight] = useState(Dimensions.get('window').height - 120);
  const [posts, setPosts] = useState([]);
  const { seenProps, playingId } = useAutoplay('play', posts);
  const [sound, setSound] = useState(false);
  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem('inflx_video_sound').then((v) => setSound(v === '1')).catch(() => {});
  }, []));
  const onSound = useCallback((on) => { setSound(on); AsyncStorage.setItem('inflx_video_sound', on ? '1' : '0').catch(() => {}); }, []);
  const [status, setStatus] = useState('loading');
  const [more, setMore] = useState(true);
  const served = useRef([]);
  const busy = useRef(false);
  const startKey = route && route.params ? `${route.params.start}:${route.params.at}` : null;
  const lastStart = useRef(null);
  const listRef = useRef(null);

  const load = useCallback(async (reset, start) => {
    if (busy.current) return;
    busy.current = true;
    if (reset) served.current = [];
    await ensureDeviceHeader();
    const who = await whoParams();
    const res = await followerApi.feed({ mode: 'play', served: served.current, start: start || undefined, ...who });
    busy.current = false;
    if (!res || !res.success) { if (reset) setStatus('error'); return; }
    const page = res.data.posts || [];
    served.current = [...served.current, ...page.map((p) => p.id)];
    setPosts((prev) => (reset ? page : [...prev, ...page]));
    setMore(!!res.data.more);
    setStatus('ready');
    if (reset && listRef.current) { try { listRef.current.scrollToOffset({ offset: 0, animated: false }); } catch { /* not mounted */ } }
  }, []);

  // A video tapped elsewhere goes first; otherwise the tab opens on its own order.
  useFocusEffect(useCallback(() => {
    if (startKey && startKey !== lastStart.current) {
      lastStart.current = startKey;
      load(true, route.params.start);
    } else if (!posts.length && status !== 'error') {
      load(true);
    }
  }, [startKey])); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SafeAreaView style={st.safe} edges={['top']} onLayout={(e) => setHeight(Math.max(300, e.nativeEvent.layout.height))}>
      {status === 'loading' ? <Loading dark /> : status === 'error' ? (
        <Empty dark title={CS.loadError} action={CS.retry} onAction={() => load(true)} />
      ) : (
        <FlatList
          ref={listRef}
          data={posts}
          keyExtractor={(p) => p.id}
          renderItem={({ item, index }) => <Reel post={item} height={height} nav={nav} index={index} active={playingId === item.id} sound={sound} onSound={onSound} />}
          windowSize={3}
          initialNumToRender={2}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
          onEndReached={() => { if (more) load(false); }}
          onEndReachedThreshold={1.5}
          ListEmptyComponent={<View style={{ height }}><Empty dark title={CS.noVideos} sub={CS.noVideosSub} testID="play-empty" /></View>}
          testID="play-feed"
          {...seenProps}
        />
      )}
      <ShopSheet post={nav.shopPost} visible={!!nav.shopPost} onClose={nav.closeShop} surface="play" />
      <SignInSheet visible={nav.signIn} onClose={nav.closeSignIn} onSignIn={nav.goSignIn} />
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.dark },
  rail: { position: 'absolute', right: 10, bottom: 130, gap: 14, alignItems: 'center' },
  railBtn: { alignItems: 'center', gap: 2 },
  railIc: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  railN: { color: '#fff', fontFamily: fonts.sansBold, fontSize: 10.5 },
  who: { position: 'absolute', left: 12, right: 64, bottom: 70, gap: 4 },
  whoName: { color: '#fff', fontFamily: fonts.sansBold, fontSize: 13 },
  whoCap: { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.sansRegular, fontSize: 12 },
  badge: { alignSelf: 'flex-start', backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontFamily: fonts.sansBold, fontSize: 10.5, color: C.ink },
  shop: { position: 'absolute', left: 12, right: 12, bottom: 14, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, flexDirection: 'row', justifyContent: 'space-between' },
  shopText: { fontFamily: fonts.sansBold, fontSize: 12.5, color: C.ink },
});
