/**
 * CreateHomeScreen — P1, the Create tab: collaborations still needing a shoppable post (counted
 * against each one's minimum, before its posting date), "New shoppable post" / "New collection",
 * her latest posts and her collections. The "+" asks post or collection (P16).
 * Contract: features/shoppable-posts-v2 · rules §4.1, §4.10
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import { Skeleton, LoadError } from '../../components/settings/feedback';
import { PrimaryButton, SecondaryButton } from '../../components/settings/primitives';
import { CP } from '../../components/create/copyCreate';
import { StateChip, ChoiceCard, initialsOf, routeFor, s as b } from '../../components/create/bitsCreate';

export function PostRow({ post, onPress, testID }) {
  const line = post.state === 'draft'
    ? CP.savedAt(post.draft_step || 3, String(post.updated_at || '').slice(0, 10))
    : post.state === 'removed' && post.removed && post.removed.reason === 'offer_ended'
      ? CP.offerEndedRow(post.removed.offer_ended_on)
      : post.kind === 'offer' && post.offer ? CP.offerRow(post.offer) : CP.priceRow;
  return (
    <TouchableOpacity style={h.post} onPress={onPress} testID={testID || `post-${post.id}`}>
      <View style={h.cover} />
      <View style={{ flex: 1 }}>
        <Text style={h.postTitle} numberOfLines={1}>{post.title}</Text>
        <Text style={h.postLine} numberOfLines={2}>{line}{post.state === 'draft' || post.state === 'in_review' ? '' : ` · ${post.sales_words}`}</Text>
      </View>
      <StateChip state={post.state} />
    </TouchableOpacity>
  );
}

export default function CreateHomeScreen({ navigation }) {
  const [d, setD] = useState(null);
  const [status, setStatus] = useState('loading');
  const [chooser, setChooser] = useState(false);
  const [pick, setPick] = useState('post');

  const load = useCallback(async () => {
    const r = await influencerApi.createHome();
    if (!r.success) { setStatus('error'); return; }
    setD(r.data); setStatus('ready');
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function start(n) {
    const r = await influencerApi.createPost(n.campaign_influencer_id);
    if (r.success) navigation.navigate('PostType', { postId: r.data.post.id });
  }
  function go(which) {
    setChooser(false);
    navigation.navigate(which === 'collection' ? 'NewCollection' : 'PostBrand');
  }

  if (status !== 'ready') {
    return (
      <View style={h.screen}>
        <Text style={h.tabTitle}>{CP.create}</Text>
        {status === 'error' ? <LoadError onRetry={load} /> : <Skeleton />}
      </View>
    );
  }

  return (
    <View style={h.screen} testID="create-home">
      <View style={h.titleRow}>
        <Text style={h.tabTitle}>{CP.create}</Text>
        <TouchableOpacity onPress={() => setChooser(true)} style={h.plus} accessibilityLabel="Make something" testID="create-plus"><Text style={h.plusText}>+</Text></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {d.needs.length ? (
          <View style={h.needs} testID="needs">
            <Text style={b.label}>{CP.needs(d.needs.length)}</Text>
            {d.needs.map(n => (
              <View key={n.campaign_influencer_id} style={h.needRow}>
                <View style={h.logo}><Text style={h.initials}>{initialsOf(n.brand_name)}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={h.postTitle}>{n.brand_name} · {n.set_name}</Text>
                  <Text style={h.postLine}>{CP.needsLine(n.done, n.min, n.posting_date)}</Text>
                </View>
                <TouchableOpacity onPress={() => start(n)} style={h.startBtn} testID={`start-${n.campaign_influencer_id}`}><Text style={h.startText}>{CP.start}</Text></TouchableOpacity>
              </View>
            ))}
          </View>
        ) : null}

        <PrimaryButton label={CP.newPost} onPress={() => navigation.navigate('PostBrand')} disabled={!d.can_post} testID="new-post" />
        {!d.can_post ? <Text style={b.hint}>{CP.cantPostYet}</Text> : null}
        <View style={{ height: 8 }} />
        <SecondaryButton label={CP.newCollection} onPress={() => navigation.navigate('NewCollection')} testID="new-collection" />

        <View style={h.sectionHead}>
          <Text style={b.label}>{CP.yourPosts(d.total)}</Text>
          {d.total ? <TouchableOpacity onPress={() => navigation.navigate('MyPosts')} testID="see-all"><Text style={h.link}>{CP.seeAll}</Text></TouchableOpacity> : null}
        </View>
        {d.recent.length ? d.recent.map(p => (
          <PostRow key={p.id} post={p} onPress={() => { const r = routeFor(p); navigation.navigate(r.name, r.params); }} />
        )) : <Text style={b.hint}>{CP.nothingYet}</Text>}

        <TouchableOpacity style={h.collections} onPress={() => navigation.navigate('Collections')} testID="collections">
          <View style={{ flex: 1 }}>
            <Text style={h.postTitle}>{CP.collections(d.collections)}</Text>
            <Text style={h.postLine}>{CP.collectionsSub}</Text>
          </View>
          <Text style={h.chev}>›</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={chooser} transparent animationType="slide" onRequestClose={() => setChooser(false)}>
        <TouchableOpacity style={h.dim} activeOpacity={1} onPress={() => setChooser(false)}>
          <TouchableOpacity activeOpacity={1} style={h.sheet} testID="make-sheet">
            <Text style={[b.q, { marginBottom: 12 }]}>{CP.whatMake}</Text>
            <ChoiceCard title={CP.makePost} sub={CP.makePostSub} selected={pick === 'post'} onPress={() => setPick('post')} testID="make-post" />
            <ChoiceCard title={CP.makeCollection} sub={CP.makeCollectionSub} selected={pick === 'collection'} onPress={() => setPick('collection')} testID="make-collection" />
            <PrimaryButton label={CP.next} onPress={() => go(pick)} disabled={pick === 'post' && !d.can_post} testID="make-next" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const h = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  titleRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 6 },
  tabTitle: { fontFamily: fonts.sansBold, fontSize: 24, color: T.ink, flex: 1, paddingTop: 0 },
  plus: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  plusText: { fontFamily: fonts.sansBold, fontSize: 22, color: T.ink, marginTop: -2 },
  needs: { borderWidth: 1, borderColor: T.border, borderRadius: 14, padding: 12, marginBottom: 14 },
  needRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  logo: { width: 36, height: 36, borderRadius: 18, backgroundColor: T.surface, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  initials: { fontFamily: fonts.sansBold, fontSize: 12, color: T.ink2 },
  startBtn: { borderWidth: 1, borderColor: T.ink, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  startText: { fontFamily: fonts.sansBold, fontSize: 12.5, color: T.ink },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  link: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: T.ink2, marginTop: 4 },
  post: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.border },
  cover: { width: 44, height: 56, borderRadius: 8, backgroundColor: T.surface, marginRight: 10 },
  postTitle: { fontFamily: fonts.sansBold, fontSize: 13.5, color: T.ink },
  postLine: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, marginTop: 2, marginRight: 8 },
  collections: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: T.border, borderRadius: 14, padding: 12, marginTop: 16 },
  chev: { fontSize: 18, color: T.ink3 },
  dim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: T.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, paddingBottom: 30 },
});
