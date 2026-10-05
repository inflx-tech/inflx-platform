/**
 * F7 · F8 Creator store — her details, INFLX followers and Follow; circles of brands she works with
 * and categories she posted in; Posts · Videos · Collections in a 2 × 2 grid.
 * Contract: features/follower-app-v2 · boards F7, F8 · rules v1.7 §5.9, §4.11
 *
 * Tapping a tile starts a feed from that post. A brand circle opens its store; a category circle
 * filters her store. Guests can follow (kept on the phone, 5.2).
 *
 * shopper-app-fixes (N5): her posts and videos go on past the first 20 — the next ones load as she
 * reaches the end of the page (no button).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { followerApi } from '../../services/api';
import { CS } from '../../components/shop/copyShop';
import { TopBar, Avatar, CircleRow, TileGrid, PrimaryBtn, Loading, Empty, Chip, C, nearEnd } from '../../components/shop/bitsShop';
import { useShopNav } from '../../components/shop/useShopNav';
import { shopStore, isSignedIn, toggleFollowLocal, ensureDeviceHeader } from '../../components/shop/shopStore';
import { track } from '../../services/events';
import { fonts } from '../../theme/tokens';

export default function CreatorStoreScreen({ navigation, route }) {
  const { id } = route.params || {};
  const nav = useShopNav(navigation);
  const [store, setStore] = useState(null);
  const [status, setStatus] = useState('loading');
  const [tab, setTab] = useState('posts');
  const [category, setCategory] = useState(null);
  const [posts, setPosts] = useState(null);
  const [collections, setCollections] = useState(null);
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState(0);
  const page = useRef({ key: null, more: false, next: 0, busy: false });   // N5: where the list shown has got to

  const load = useCallback(async () => {
    await ensureDeviceHeader();
    const st = await shopStore.get();
    const signed = await isSignedIn();
    const res = await followerApi.creatorStore(id, signed ? [] : st.follows);
    if (!res || !res.success) { setStatus('error'); return; }
    setStore(res.data); setFollowing(res.data.following); setFollowers(res.data.followers); setStatus('ready');
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!store) return;
    (async () => {
      if (tab === 'collections') {
        const r = await followerApi.creatorCollections(store.creator.id);
        setCollections(r && r.success ? r.data.collections : []);
      } else {
        const key = `${tab}:${category || ''}`;
        page.current = { key, more: false, next: 0, busy: false };
        setPosts(null);
        const r = await followerApi.creatorPosts(store.creator.id, { tab, category: category || undefined });
        if (page.current.key !== key) return;               // she has chosen another tab or category since
        const first = r && r.success ? r.data.posts || [] : [];
        page.current = { key, more: !!(r && r.success && r.data.more), next: r && r.success && r.data.next != null ? r.data.next : first.length, busy: false };
        setPosts(first);
      }
    })();
  }, [store, tab, category]);

  // N5 — the end of the page: the next posts of the tab and category on screen.
  async function loadMore() {
    const at = page.current;
    if (tab === 'collections' || !store || !at.more || at.busy) return;
    at.busy = true;
    const r = await followerApi.creatorPosts(store.creator.id, { tab, category: category || undefined, offset: at.next });
    if (page.current !== at) return;                        // another list is on screen now
    at.busy = false;
    if (!r || !r.success) return;                           // asked again at the next reach of the end
    const more = r.data.posts || [];
    at.more = !!r.data.more && more.length > 0;
    at.next = r.data.next != null ? r.data.next : at.next + more.length;
    setPosts((prev) => {
      const have = new Set((prev || []).map((p) => p.id));
      return [...(prev || []), ...more.filter((p) => !have.has(p.id))];
    });
  }

  async function follow() {
    const on = !following;
    setFollowing(on); setFollowers((n) => Math.max(0, n + (on ? 1 : -1)));
    if (await isSignedIn()) {
      const r = on ? await followerApi.follow(store.creator.id) : await followerApi.unfollow(store.creator.id);
      if (r && r.success) setFollowers(r.data.followers);
      else { setFollowing(!on); setFollowers((n) => Math.max(0, n + (on ? -1 : 1))); }
    } else {
      await toggleFollowLocal(store.creator.id, on);
    }
  }

  if (status === 'loading') return <SafeAreaView style={st.safe}><TopBar onBack={() => navigation.goBack()} /><Loading /></SafeAreaView>;
  if (status === 'error') return <SafeAreaView style={st.safe}><TopBar onBack={() => navigation.goBack()} /><Empty title={CS.loadError} action={CS.retry} onAction={load} /></SafeAreaView>;

  const c = store.creator;
  const openTile = (p) => { track('open', p.id, 'creator_store'); nav.openPost(p); };

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <TopBar onBack={() => navigation.goBack()} onSearch={() => navigation.navigate('Search')} title=" " />
      <ScrollView contentContainerStyle={{ padding: 14, gap: 14, paddingBottom: 30 }}
        onScroll={(e) => { if (nearEnd(e)) loadMore(); }} scrollEventThrottle={200} testID="creator-store">
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Avatar uri={c.avatar} name={c.name} size={60} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={st.name} testID="creator-name">{c.name}</Text>
            {c.bio || c.city ? <Text style={st.sub} numberOfLines={2}>{[c.bio, c.city].filter(Boolean).join(' · ')}</Text> : null}
            <Text style={st.sub} testID="creator-followers">{CS.followersOnInflx(followers)}</Text>
          </View>
        </View>
        <PrimaryBtn label={following ? CS.following : CS.follow} secondary={following} onPress={follow} testID="follow" />
        <CircleRow label={CS.brandsSheWorksWith} items={store.brands} square onPress={nav.openBrand} testIDPrefix="store-brand" />
        {store.categories.length ? (
          <View style={{ gap: 6 }}>
            <Text style={st.rowLbl}>{CS.categories}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {store.categories.map((x) => (
                <Chip key={x.id} label={x.name} on={category === x.id} onPress={() => { setTab((t) => (t === 'collections' ? 'posts' : t)); setCategory(category === x.id ? null : x.id); }} testID={`cat-${x.name}`} />
              ))}
            </View>
          </View>
        ) : null}
        <View style={st.tabs}>
          {[['posts', CS.posts], ['videos', CS.videos], ['collections', CS.collections]].map(([k, label]) => (
            <TouchableOpacity key={k} style={[st.tab, tab === k && st.tabOn]} onPress={() => setTab(k)} testID={`tab-${k}`}>
              <Text style={[st.tabText, tab === k && { color: C.ink }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {tab === 'collections' ? (
          collections === null ? <Loading /> : collections.length === 0 ? <Text style={st.sub}>{CS.noCollections}</Text> : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {collections.map((x) => (
                <TouchableOpacity key={x.id} style={st.coll} onPress={() => navigation.navigate('Collection', { id: x.id })} testID={`collection-${x.id}`}>
                  {x.cover ? <Image source={{ uri: x.cover }} style={StyleSheet.absoluteFill} /> : null}
                  <Text style={st.collName} numberOfLines={1}>{x.name} · {x.count}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )
        ) : posts === null ? <Loading /> : posts.length === 0 ? <Text style={st.sub}>{CS.noPosts}</Text> : (
          <TileGrid posts={posts} onOpen={openTile} testIDPrefix="creator-tile" />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  name: { fontFamily: fonts.sansBold, fontSize: 17, color: C.ink },
  sub: { fontFamily: fonts.sansRegular, fontSize: 12, color: C.ink2 },
  rowLbl: { fontFamily: fonts.sansBold, fontSize: 10.5, letterSpacing: 0.6, color: C.ink3, textTransform: 'uppercase' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 9, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  tabOn: { borderBottomColor: C.ink },
  tabText: { fontFamily: fonts.sansBold, fontSize: 12.5, color: C.ink3 },
  coll: { width: '48.5%', aspectRatio: 0.8, borderRadius: 12, overflow: 'hidden', backgroundColor: '#E9E8E2', justifyContent: 'flex-end', padding: 6 },
  collName: { alignSelf: 'flex-start', fontFamily: fonts.sansBold, fontSize: 10, color: C.ink, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
});
