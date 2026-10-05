/**
 * F5 Play — full-screen videos only, all creators, swipe up for the next (like Reels).
 * Contract: features/follower-app-v2 · board F5 · rules v1.7 §4.7, §5.7
 *
 * The ▶ tab, and any video tapped in the feed (it goes first). Each video shows the creator and
 * brand (their stores), the offer, Shop this video, and like · comment · share · save. Until the
 * Play Store build brings the player, a video shows its picture with "Update INFLX to play
 * videos" (VideoView) — the order, the actions and the recording already work.
 *
 * shopper-walk-fixes · board V2: the video that plays changes the moment a swipe lands (useAutoplay);
 * a tap pauses here and only here; and the bag with its count sits beside the sound button.
 *
 * shopper-app-fixes:
 *   F5  Coming back to Play (from comments, a store, the bag, a product page) she is on the video
 *       she left. The list is asked for when the tab first opens and when a NEW video is tapped —
 *       not on every return. (It used to start again from the top of a fresh list each time, and
 *       the video she had tapped was no longer first.)
 *   F8  This screen is registered twice: `PlayTab` (the ▶ tab) and `PlayOver`, which is pushed on
 *       top of a store, search, a post's page… and has a Back arrow, top-left. Nothing else differs.
 *   F11 Her Welcome choices changed since this list was asked for: it is asked for again.
 */
import React, { useCallback, useRef, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { followerApi } from '../../services/api';
import { CS, fmtCount } from '../../components/shop/copyShop';
import { VideoView, ShopSheet, SignInSheet, Loading, Empty, usePostActions, C } from '../../components/shop/bitsShop';
import { BagButton } from '../../components/shop/orderBits';
import { hasPlayer } from '../../components/shop/ShopVideo';
import { useShopNav, PLAY_OVER } from '../../components/shop/useShopNav';
import { useAutoplay } from '../../components/shop/useAutoplay';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { whoParams, ensureDeviceHeader, choicesKey } from '../../components/shop/shopStore';
import { track } from '../../services/events';
import useTopInset from '../../hooks/useTopInset';
import { fonts } from '../../theme/tokens';

function Reel({ post, height, nav, index, active, sound, onSound }) {
  const a = usePostActions(post, { surface: 'play', onNeedSignIn: nav.needSignIn });
  const n = post.products ? post.products.length : 0;
  return (
    <View style={{ height, backgroundColor: C.dark }} testID={`reel-${post.id}`}>
      <VideoView post={post} height={height} active={active} muted={!sound} surface="play" soundToggle tapToPause onSoundChange={onSound} />
      {/* The bag beside the sound button (which only a phone with the player draws). */}
      <View style={[st.bag, { right: hasPlayer() ? 56 : 12 }]} testID={`reel-bag-${post.id}`}><BagButton overlay="dark" /></View>
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
  const over = !!(route && route.name === PLAY_OVER);     // pushed on top of another screen (F8)
  const backTop = useTopInset(12);                        // the Back arrow clears the status bar on an edge-to-edge phone
  const nav = useShopNav(navigation, { tab: !over });
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
  const tapped = route && route.params && route.params.start ? route.params.start : null;
  const startKey = tapped ? `${tapped}:${route.params.at}` : null;
  const lastStart = useRef(null);
  const listRef = useRef(null);
  const asked = useRef(false);      // the list has been asked for at least once (F5)
  const turn = useRef(0);           // which "from the top" request is the newest
  const choices = useRef(null);     // her Welcome choices when the list was last asked for (F11)

  const load = useCallback(async (reset, start) => {
    // The next page waits its turn. A list from the top never waits: a video she has just tapped
    // must not be lost behind a page that is still on its way.
    if (!reset && busy.current) return;
    if (reset) turn.current += 1;
    const mine = turn.current;
    busy.current = true;
    asked.current = true;
    if (reset) served.current = [];
    await ensureDeviceHeader();
    if (reset) choices.current = await choicesKey();
    const who = await whoParams();
    const res = await followerApi.feed({ mode: 'play', served: served.current, start: start || undefined, ...who });
    if (mine !== turn.current) return;                    // a newer list has been asked for since
    busy.current = false;
    if (!res || !res.success) { if (reset) setStatus('error'); return; }
    const page = res.data.posts || [];
    served.current = [...served.current, ...page.map((p) => p.id)];
    setPosts((prev) => (reset ? page : [...prev, ...page]));
    setMore(!!res.data.more);
    setStatus('ready');
    if (reset && listRef.current) { try { listRef.current.scrollToOffset({ offset: 0, animated: false }); } catch { /* not mounted */ } }
  }, []);

  // A video tapped elsewhere goes first; otherwise the tab opens on its own order — once. Every
  // later return leaves the list, and where she is in it, alone (F5): the refs say what has been
  // asked for, so nothing here depends on what this effect saw when it was first made.
  useFocusEffect(useCallback(() => {
    if (startKey && startKey !== lastStart.current) {
      lastStart.current = startKey;
      load(true, tapped);
      return undefined;
    }
    if (!asked.current) { load(true); return undefined; }
    // F11: back with different Welcome choices — her feed is not the one on screen any more.
    let alive = true;
    choicesKey().then((now) => { if (alive && choices.current !== null && now !== choices.current) load(true); }).catch(() => {});
    return () => { alive = false; };
  }, [startKey])); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SafeAreaView style={st.safe} edges={['top']} onLayout={(e) => setHeight(Math.max(300, e.nativeEvent.layout.height))}>
      {status === 'loading' ? <Loading dark /> : status === 'error' ? (
        <Empty dark title={CS.loadError} action={CS.retry} onAction={() => load(true, tapped)} />
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
      {/* F8 · X4 — pushed on top of another screen: the one new control, a Back arrow, top-left. */}
      {over ? (
        <TouchableOpacity onPress={() => navigation.goBack()} style={[st.back, { top: backTop }]} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          testID="play-back" accessibilityRole="button" accessibilityLabel="Back">
          <Icon name="chevron-left" size={24} color="#fff" />
        </TouchableOpacity>
      ) : null}
      <ShopSheet post={nav.shopPost} visible={!!nav.shopPost} onClose={nav.closeShop} surface="play" />
      <SignInSheet visible={nav.signIn} onClose={nav.closeSignIn} onSignIn={nav.goSignIn} />
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.dark },
  bag: { position: 'absolute', top: 12 },
  // The Back arrow of a Play pushed on top (F8): the same dark round as the bag over a video.
  back: { position: 'absolute', top: 12, left: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
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
