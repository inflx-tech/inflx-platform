/**
 * PostStatusScreen — one post after it is sent: P12 in review (INFLX checks it, not the brand),
 * P13 sent back (what INFLX said, what she can change, fix or start over), approved / live (no edits;
 * she can take it down, founder Q1), and P15 removed (why it left the shop and what it earned).
 * Her "post left the shop" notice opens here.
 * Contract: features/shoppable-posts-v2 · rules §4.1, §4.9
 */
import React, { useEffect, useState } from 'react';
import { View, ScrollView, Text, Alert, StyleSheet } from 'react-native';
import { influencerApi } from '../../services/api';
import { Skeleton, LoadError, useToast } from '../../components/settings/feedback';
import { PrimaryButton, SecondaryButton, DangerButton } from '../../components/settings/primitives';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { CP, rupeesP, dayMonthP } from '../../components/create/copyCreate';
import { CL } from '../../components/create/copyLinks';
import { StateChip, useDraft, routeFor, s as b } from '../../components/create/bitsCreate';

/** Whole days from today to 'YYYY-MM-DD' (phone's calendar). */
export function daysUntil(day, now = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(day || ''));
  if (!m) return null;
  const a = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - a) / 86400000);
}

function Block({ title, children, testID }) {
  return (
    <View style={st.block} testID={testID}>
      <Text style={st.blockTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function PostStatusScreen({ navigation, route }) {
  const { postId } = route.params || {};
  const { post, status, reload } = useDraft(postId);
  const [busy, setBusy] = useState(false);
  const { toast, show } = useToast();
  // A draft carries on where she stopped (4.2), never on this screen.
  useEffect(() => {
    if (post && post.state === 'draft') { const r = routeFor(post); navigation.replace(r.name, r.params); }
  }, [post, navigation]);

  function confirm(title, body, ok, run) {
    Alert.alert(title, body, [{ text: CP.keepIt, style: 'cancel' }, { text: ok, style: 'destructive', onPress: run }]);
  }
  async function takeDown() {
    setBusy(true);
    const r = await influencerApi.takeDownPost(postId);
    setBusy(false);
    if (r.success) { show(CP.takenDown); reload(); } else show(r.error?.message || '');
  }
  async function remove() {
    setBusy(true);
    const r = await influencerApi.deletePost(postId);
    setBusy(false);
    if (r.success) { show(CP.deleted); navigation.goBack(); } else show(r.error?.message || '');
  }
  async function startOver() {
    setBusy(true);
    const r = await influencerApi.createPost(post.collaboration.id);
    setBusy(false);
    if (r.success) navigation.navigate('PostType', { postId: r.data.post.id });
    else show(r.error?.message || '');
  }

  if (status !== 'ready') {
    return <View style={base.screen}><Header title="" onBack={() => navigation.goBack()} />{status === 'error' ? <LoadError onRetry={reload} /> : <Skeleton />}</View>;
  }
  if (post.state === 'draft') return null;

  const posting = post.collaboration.posting_date;
  const title = post.state === 'in_review' ? CP.withInflx : post.state === 'sent_back' ? CP.sentBackTitle : post.title;
  return (
    <View style={base.screen} testID={`post-status-${post.state}`}>
      <Header title={title} onBack={() => navigation.goBack()} right={<StateChip state={post.state} />} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {post.state !== 'removed' ? <Text style={st.eyebrow}>{post.title.toUpperCase()}</Text> : null}

        {post.state === 'in_review' ? (
          <>
            <Block title={CP.inReviewSince(String(post.submitted_at || '').slice(0, 10))} testID="in-review"><Text style={b.hint}>{CP.usually}</Text></Block>
            <Block title={CP.whoChecks}><Text style={b.hint}>{CP.whoChecksBody}</Text></Block>
            <Block title={CP.goesLive}><Text style={b.hint}>{CP.goesLiveBody(posting)}</Text></Block>
          </>
        ) : null}

        {post.state === 'sent_back' ? (
          <>
            <Block title={CP.whatSaid} testID="what-said"><Text style={st.quote}>“{post.sent_back.reason}”</Text></Block>
            <Block title={CP.canChange}><Text style={b.hint}>{CP.canChangeBody}</Text></Block>
            <PrimaryButton label={CP.sendAgain} onPress={() => navigation.navigate('PostReview', { postId, fix: true })} testID="fix" />
            <View style={{ height: 8 }} />
            <SecondaryButton label={CP.startOver} onPress={startOver} testID="start-over" />
            {posting ? <Block title={CP.postingNotMoved}><Text style={b.hint}>{CP.stillOn(posting, daysUntil(posting))}</Text></Block> : null}
            <View style={{ height: 8 }} />
            <DangerButton label={CP.deleteIt} busy={busy} onPress={() => confirm(CP.deleteQ, CP.deleteBody, CP.deleteIt, remove)} testID="delete" />
          </>
        ) : null}

        {post.state === 'approved' || post.state === 'live' ? (
          <>
            <Block title={post.state === 'approved' ? CP.approvedTitle : CP.liveBody} testID="approved">
              {post.state === 'approved' ? <Text style={b.hint}>{CP.approvedBody(post.goes_live_on || posting)}</Text> : <Text style={b.hint}>{post.sales_words}</Text>}
            </Block>
            {/* post-links-codes (L1): the code and links from approval, the stats once live. */}
            {post.code ? <View style={{ flexDirection: 'row', marginBottom: 10 }}>
              <View style={{ flex: 1, marginRight: post.state === 'live' ? 8 : 0 }}><SecondaryButton label={`${CL.share} · ${post.code}`} onPress={() => navigation.navigate('PostShare', { postId })} testID="share" /></View>
              {post.state === 'live' ? <View style={{ flex: 1 }}><SecondaryButton label={CL.stats} onPress={() => navigation.navigate('PostStats', { postId })} testID="stats" /></View> : null}
            </View> : null}
            <Text style={b.hint}>{CP.noEdits}</Text>
            <DangerButton label={CP.takeDown} busy={busy} onPress={() => confirm(CP.takeDownQ, CP.takeDownBody, CP.takeDown, takeDown)} testID="take-down" />
          </>
        ) : null}

        {post.state === 'removed' ? (
          <>
            <Block title={post.removed.at ? CP.removedOn(String(post.removed.at).slice(0, 10)) : CP.removedOn(post.removed.offer_ended_on)} testID="removed">
              <Text style={b.hint}>{post.removed.why}</Text>
            </Block>
            <View style={st.numbers}>
              <View style={st.num}><Text style={st.numLabel}>{CP.salesWhileLive}</Text><Text style={st.numValue}>{post.sales.orders}</Text></View>
              <View style={st.num}><Text style={st.numLabel}>{CP.youEarned}</Text><Text style={st.numValue}>{rupeesP(post.sales.commission)}</Text></View>
            </View>
            <Text style={b.hint}>{CP.otherReasons}</Text>
            <Text style={b.hint}>{CP.returnWindow}</Text>
          </>
        ) : null}

        <Text style={[b.hint, { marginTop: 14 }]}>{post.collaboration.brand_name} · {post.collaboration.campaign_name} · {post.collaboration.set_name}{posting ? ` · ${dayMonthP(posting)}` : ''}</Text>
      </ScrollView>
      {toast}
    </View>
  );
}

const st = StyleSheet.create({
  eyebrow: { fontFamily: fonts.sansBold, fontSize: 12, color: T.ink3, letterSpacing: 0.8, marginBottom: 8 },
  block: { borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 12, marginBottom: 10 },
  blockTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: T.ink, marginBottom: 2 },
  quote: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink, lineHeight: 18, marginTop: 4 },
  numbers: { flexDirection: 'row', marginBottom: 10 },
  num: { flex: 1, borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 12, marginRight: 8 },
  numLabel: { fontFamily: fonts.sansSemiBold, fontSize: 11.5, color: T.ink3 },
  numValue: { fontFamily: fonts.sansBold, fontSize: 18, color: T.ink, marginTop: 4 },
});
