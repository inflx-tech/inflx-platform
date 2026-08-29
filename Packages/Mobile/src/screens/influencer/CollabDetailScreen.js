import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ig, IG_TONE } from '../../theme/ig';
import { fmtRupees } from '../../theme/tokens';
import { describePay } from '../../utils/collabPay';
import { influencerApi } from '../../services/api';
import { deriveStage, whoseTurn } from '../../utils/collabStages';
import { heroFor, sectionsFor } from '../../utils/collabDetailModel';
// Stage 3 — the six steps come from the SERVER now, so her screen and the brand's cannot
// disagree about the same collaboration. The old client-side spine is deleted, not fixed:
// it matched on stage names Stage 1 renamed and highlighted nothing.
// Contract: features/stage-3-watch-the-work-happen
import { useCreatorSteps, stepFor } from '../../utils/creatorSteps';
import { STEP_LABELS_CREATOR, turnLabel, turnTone } from '../../components/brand/NeedsYou';
// One decline, one set of reasons, one note — shared with ContractScreen, which can now decline
// too. Contract: features/brief-straight-to-signing
import DeclineSheet, { askDeclineReason } from '../../components/influencer/DeclineSheet';

/* ════════════════════════════════════════════════════════════════════════
   CollabDetailScreen — features/collab-detail. The unified engagement hub
   (replaces OfferDetail + CampaignDetail). Loads by campaign_influencer_id;
   orchestrates the existing sub-screens for heavy actions.
   ══════════════════════════════════════════════════════════════════════ */

const SECTION_ICON = {
  terms: 'file-document-outline', contract: 'file-sign', logistics: 'truck-outline',
  deliverables: 'image-multiple-outline', earnings: 'currency-inr', products: 'shopping-outline',
};

function prettyGoal(g) {
  if (!g) return null;
  return String(g).replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
}

function fmtDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function CollabDetailScreen({ route, navigation }) {
  const ciId = route.params?.campaignInfluencerId || route.params?.offerId;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  // Founder, 2026-08-28: sign or decline, "with clear remarks from creator". She is declining a
  // deal she had already agreed, so WHY matters far more than which of five boxes she ticked —
  // a brand who reads "the store visit is 40km from me" can fix it.
  const [declining, setDeclining] = useState(null);   // the reason key, while she writes a note

  const load = useCallback(async () => {
    setError(null);
    const res = await influencerApi.getMyCampaignDetail(ciId);
    setLoading(false);
    if (res.success) setData(res.data);
    else setError(res.error?.message || 'Could not load this collab');
  }, [ciId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  // ⚠️ THIS HOOK MUST STAY ABOVE THE EARLY RETURNS BELOW.
  //
  // It used to sit further down, after "if (loading) return" and "if (!data) return". The first
  // render stopped at the spinner and never called it; the second render did. React counted 8
  // hooks then 9, threw "Rendered more hooks than during the previous render", and the screen
  // rendered NOTHING — the blank page the founder reported twice.
  //
  // It had nothing to do with her data. It fired on every stage, for every creator, every time.
  // Contract: features/brief-straight-to-signing
  const { data: stepData, failed: stepsFailed } = useCreatorSteps();

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={ig.text} /></View>;
  }
  if (error || !data) {
    return (
      <View style={styles.center}>
        <Icon name="alert-circle-outline" size={30} color={ig.mut2} />
        <Text style={styles.errTitle}>{error || 'Not found'}</Text>
        <TouchableOpacity style={styles.errBtn} onPress={() => { setLoading(true); load(); }}>
          <Text style={styles.errBtnTxt}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.backLink}>Go back</Text></TouchableOpacity>
      </View>
    );
  }

  const c = data.campaign || {};
  const deliverables = data.deliverables || [];
  const status = c.influencer_status;
  const dCount = deliverables.length;
  const dApproved = deliverables.filter(d => d.status === 'approved' || d.status === 'live' || d.live_confirmed_at).length;

  const record = {
    status,
    stage: deriveStage({ status, deliverable_count: dCount, approved_count: dApproved }),
    turn: whoseTurn({ status, deliverable_count: dCount, approved_count: dApproved }),
    physical_delivery: c.physical_delivery,
    products_total: data.products_total,
    // A commission collaboration buys no content, so it has no deliverables — and deriveStage's
    // only exit from 'shoot' is deliverable progress she will never have. Without these two the
    // hero would tell her to "settle the time and shoot" for the rest of the campaign.
    // Contract: features/deliverables-only-when-buying-content
    sellsOnly: dCount === 0 && String(c.goal || '').toLowerCase() === 'conversion',
    // ⚠️ `data.production_event` was not in this payload at all, so hasShoot was ALWAYS false
    // and a creator with a store visit to arrange was told "You are live" and shown no way to
    // reach it. The server now returns it. Contract: features/shoot-plan-you-can-actually-see
    hasShoot: !!c.physical_delivery || !!data.production_event,
  };
  const pendingDeliverable = deliverables.some(
    d => d.status === 'pending' || d.status === 'revision_requested' || (d.status === 'approved' && !d.live_confirmed_at),
  );

  const hero = heroFor({ ...record, pendingDeliverable });
  const sections = sectionsFor(record);
  // Stage 3 — where this collaboration has actually got to, decided once on the server.
  // stepFor is a plain function, not a hook, so it is fine here; useCreatorSteps is not and
  // now sits with the other hooks at the top.
  const mine = stepFor(stepData, ciId);
  const tone = IG_TONE[hero.tone] || IG_TONE.neutral;

  // What she actually earns, in the shape the deal has. Lives in utils/collabPay so a
  // figure that decides whether someone accepts work can be checked without a handset.
  // Contract: features/collab-terms-by-aim (item 1)
  const pay = describePay(c);

  const campaignName = c.campaign_name;
  const brandName = c.brand_name;

  // ── action dispatch ──────────────────────────────────────────────────────
  function go(key) {
    switch (key) {
      case 'negotiate': navigation.navigate('Negotiation', { campaign_influencer_id: ciId }); break;
      case 'sign':      navigation.navigate('Contract', { campaignInfluencerId: ciId }); break;
      case 'contract':  navigation.navigate('Contract', { campaignInfluencerId: ciId }); break;
      // Stage 4 — this used to drop her on the contract page and leave her to scroll to a
      // panel three-quarters of the way down. The shoot has its own screen now.
      case 'logistics':
        if (data?.contract?.id) {
          navigation.navigate('Shoot', {
            contractId: data.contract.id,
            campaignInfluencerId: ciId,
            campaignName,
            brandName,
          });
        } else {
          // No contract yet means nothing to arrange. The contract page is the honest place.
          navigation.navigate('Contract', { campaignInfluencerId: ciId });
        }
        break;
      case 'deliverables':
        navigation.navigate('DeliverableList', { campaign_influencer_id: ciId, campaign_name: campaignName, brand_name: brandName });
        break;
      case 'earnings':  navigation.navigate('CommissionDetail', { campaignInfluencerId: ciId, campaignName }); break;
      case 'products':  navigation.navigate('CampaignProducts', { campaignInfluencerId: ciId, campaignName }); break;
      case 'tracking':  navigation.navigate('CollabTracking', { campaignInfluencerId: ciId, campaignName, brandName }); break;
      default: break;
    }
  }

  function doAction(key) {
    if (key === 'accept') return confirmAccept();
    if (key === 'pass')   return confirmPass();
    return go(key);
  }

  function confirmAccept() {
    Alert.alert('Accept this offer?', `${brandName} · ${pay.short}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Accept', onPress: async () => {
        setBusy(true);
        const res = await influencerApi.acceptOffer(ciId);
        setBusy(false);
        if (res.success) load();
        else Alert.alert('Could not accept', res.error?.message || 'Please try again.');
      } },
    ]);
  }

  function confirmPass() {
    // ⚠️ 'not_a_fit' was sent here and the server has never accepted it — the button returned a
    // 422 every single time anyone tapped it. The five valid keys now live in ONE place,
    // DECLINE_REASONS, which is the only reason that cannot happen again.
    askDeclineReason({ payLabel: pay.label, onPick: setDeclining });
  }

  async function submitDecline(reason, note) {
    setBusy(true);
    const res = await influencerApi.declineOffer(ciId, { reason, note: note || undefined });
    setBusy(false);
    setDeclining(null);
    if (res.success) navigation.goBack();
    else Alert.alert('Could not pass', res.error?.message || 'Please try again.');
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ig.text} />}
    >
      {/* header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Icon name="chevron-left" size={18} color={ig.mut} /><Text style={styles.backTxt}>Collabs</Text>
        </TouchableOpacity>
        <Text style={styles.brand}>{brandName}</Text>
        <Text style={styles.camp}>{campaignName}</Text>
        <Text style={styles.meta}>
          {pay.headline}
          {pay.note ? ` ${pay.note}` : ''}
          {prettyGoal(c.goal) ? ` · ${prettyGoal(c.goal)}` : ''}
          {/* collab-part5 — "Ongoing" tells the creator their links keep working, which is
              the whole point of an open-ended sales collaboration. */}
          {c.start_date ? ` · ${fmtDate(c.start_date)}–${c.end_date ? fmtDate(c.end_date) : 'Ongoing'}` : ''}
        </Text>

        {/* Stage 3 — the same six steps the brand sees, with the same current step. When
            he rings and says "we're stuck on step 3", you are both looking at one fact. */}
        <View style={styles.spine}>
          {[1, 2, 3, 4, 5, 6].map(n => (
            <View key={n} style={styles.spineNode}>
              <View style={[styles.spineBar, mine && n < mine.step && styles.spineBarDone, mine && n === mine.step && styles.spineBarCur]} />
              <Text style={[styles.spineTxt, mine && n === mine.step && styles.spineTxtCur]}>{STEP_LABELS_CREATOR[n]}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* hero */}
      <View style={[styles.hero, { borderColor: tone.dot }]}>
        <View style={styles.heroTagRow}>
          <View style={[styles.dot, { backgroundColor: tone.dot }]} />
          <Text style={[styles.heroTag, { color: tone.fg }]}>
            {hero.tone === 'you' || hero.tone === 'nego' ? 'Your turn' : hero.tone === 'brand' ? 'Waiting' : hero.tone === 'done' ? 'Done' : 'Closed'}
          </Text>
        </View>
        <Text style={styles.heroTitle}>{hero.label}</Text>
        <Text style={styles.heroSub}>{hero.sub}</Text>
        {hero.actions.length > 0 && (
          <View style={styles.heroBtns}>
            {hero.actions
              // collab-part6 §6.1 — an agreement-backed collaboration cannot be
              // renegotiated: the server refuses it (Part 2). Showing the button offered
              // the creator something that would fail, so it goes — for these only. A
              // cold invite keeps every action exactly as today.
              .filter(a => !(a === 'negotiate' && c.settled_terms))
              .map(a => {
              const primary = a === 'accept' || a === 'sign' || a === 'deliverables' || a === 'earnings' || (a === 'negotiate' && hero.tone === 'nego');
              const danger = a === 'pass';
              // ⚠️ 'logistics' HAS NEVER BEEN IN THIS MAP.
              //
              // Stage 4 gave the shoot a hero action and wired it in go(). Nobody gave it a
              // LABEL, so the one button that opens the shoot has rendered with no text on it
              // since the day it shipped — a blank grey rectangle. That is a large part of
              // "I am not able to see the shoot plan": the door was there and unmarked.
              //
              // The existing test asserted every emitted action is WIRED. Being wired and being
              // legible are different things, and it only checked the first.
              // Contract: features/shoot-plan-you-can-actually-see
              const label = { accept: 'Accept', negotiate: 'Negotiate', pass: 'Pass',
                sign: 'Review & sign', logistics: 'Plan the shoot', tracking: 'See your link',
                deliverables: pendingDeliverable ? 'Upload content' : 'View deliverables',
                earnings: 'View earnings' }[a];
              return (
                <TouchableOpacity key={a} disabled={busy}
                  style={[styles.hbtn, primary && styles.hbtnPrimary, danger && styles.hbtnDanger]}
                  onPress={() => doAction(a)}>
                  <Text style={[styles.hbtnTxt, primary && styles.hbtnTxtPrimary, danger && styles.hbtnTxtDanger]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* sections */}
      <View style={styles.sections}>
        {sections.map(s => {
          if (s.key === 'terms') {
            return (
              <View key="terms" style={styles.termsCard}>
                {/* collab-part6 §6.1 — a creator who spent days agreeing terms used to
                    open this screen and see a fresh-looking offer. Settled terms now show
                    as settled, with the date, and only the rest is up for reading. */}
                {c.settled_terms ? (
                  <View style={styles.agreedCard}>
                    <Text style={styles.agreedTitle}>✓ Already agreed with you</Text>
                    {c.settled_terms.items.map(it => (
                      <View key={it.key} style={styles.termsRow}>
                        <Text style={styles.tl}>{it.label}</Text>
                        <Text style={styles.tv}>{it.value}</Text>
                      </View>
                    ))}
                    <Text style={styles.agreedNote}>
                      Settled with {brandName}{c.settled_terms.agreed_at ? ` on ${fmtDate(c.settled_terms.agreed_at)}` : ''}. Nothing to decide again.
                    </Text>
                  </View>
                ) : null}

                <Text style={styles.termsTitle}>{c.settled_terms ? 'New in this campaign' : 'Terms & brief'}</Text>
                {!c.settled_terms ? (
                  <View style={styles.termsRow}><Text style={styles.tl}>{pay.label}</Text><Text style={styles.tv}>{pay.value}</Text></View>
                ) : null}
                {/* collab-part6 §6.1 — what she may sell. 'Their whole store' and a
                    category keep absorbing new arrivals; a hand-picked list never does,
                    and that difference was invisible until now. */}
                {c.allocation_summary ? (
                  <View style={styles.termsRow}>
                    <Text style={styles.tl}>You can sell</Text>
                    <Text style={styles.tv}>{c.allocation_summary.label}</Text>
                  </View>
                ) : null}
                {c.coupon_code ? <View style={styles.termsRow}><Text style={styles.tl}>Your code</Text><Text style={styles.tv}>{c.coupon_code}</Text></View> : null}
                {prettyGoal(c.goal) ? <View style={styles.termsRow}><Text style={styles.tl}>Goal</Text><Text style={styles.tv}>{prettyGoal(c.goal)}</Text></View> : null}
                {dCount > 0 ? <View style={styles.termsRow}><Text style={styles.tl}>Deliverables</Text><Text style={styles.tv}>{dApproved}/{dCount} done</Text></View> : null}
                {c.posting_date ? <View style={styles.termsRow}><Text style={styles.tl}>Posting date</Text><Text style={styles.tv}>{fmtDate(c.posting_date)}</Text></View> : null}
                {c.brief ? <Text style={styles.brief} numberOfLines={4}>{c.brief}</Text> : null}
              </View>
            );
          }
          return (
            <TouchableOpacity key={s.key} style={styles.secRow} onPress={() => go(s.key)}>
              <View style={styles.secIco}><Icon name={SECTION_ICON[s.key] || 'chevron-right'} size={17} color={ig.text2} /></View>
              <Text style={styles.secLabel}>{s.label}</Text>
              <Icon name="chevron-right" size={18} color={ig.mut2} />
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ height: 32 }} />

      {/* Sign or decline — and if she declines, in her own words. The sheet is shared with
          ContractScreen so the two places she can say no say it identically.
          Contract: features/brief-straight-to-signing */}
      <DeclineSheet
        reason={declining}
        brandName={brandName}
        busy={busy}
        onCancel={() => setDeclining(null)}
        onSubmit={submitDecline}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ig.bg },
  // collab-part6 §6.1
  agreedCard: { backgroundColor: '#F7FEF9', borderWidth: 1, borderColor: '#A7F3D0', borderRadius: 10, padding: 11, marginBottom: 12 },
  agreedTitle: { fontSize: 11, fontWeight: '800', color: '#047857', letterSpacing: 0.3, marginBottom: 6 },
  agreedNote: { fontSize: 10.5, color: '#047857', marginTop: 6, lineHeight: 15 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: ig.bg, padding: 30 },
  errTitle: { fontSize: 14, fontWeight: '700', color: ig.text, marginTop: 12 },
  errBtn: { marginTop: 14, backgroundColor: ig.text, borderRadius: 9, paddingHorizontal: 20, paddingVertical: 10 },
  errBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 12.5 },
  backLink: { marginTop: 14, color: ig.mut, fontSize: 12.5, fontWeight: '600' },

  header: { backgroundColor: ig.bg, paddingHorizontal: 16, paddingTop: 50, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: ig.line },
  back: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginLeft: -4 },
  backTxt: { fontSize: 12.5, color: ig.mut, fontWeight: '600' },
  brand: { fontSize: 19, fontWeight: '800', color: ig.text, letterSpacing: -0.2 },
  camp: { fontSize: 13, color: ig.text2, marginTop: 2 },
  meta: { fontSize: 11.5, color: ig.mut, marginTop: 4 },

  spine: { flexDirection: 'row', gap: 5, marginTop: 14 },
  spineNode: { flex: 1, alignItems: 'center' },
  spineBar: { height: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: ig.lineSoft },
  spineBarDone: { backgroundColor: ig.text },
  spineBarCur: { backgroundColor: ig.y },
  spineTxt: { fontSize: 8, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.2, color: ig.mut2, marginTop: 5 },
  spineTxtCur: { color: ig.yInk, fontWeight: '700' },

  hero: { margin: 14, borderWidth: 1, borderRadius: 14, padding: 15, backgroundColor: ig.bg },
  heroTagRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  heroTag: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  heroTitle: { fontSize: 16, fontWeight: '800', color: ig.text, marginTop: 5 },
  heroSub: { fontSize: 12, color: ig.mut, marginTop: 3, lineHeight: 17 },
  heroBtns: { flexDirection: 'row', gap: 8, marginTop: 13, flexWrap: 'wrap' },
  hbtn: { flexGrow: 1, alignItems: 'center', borderWidth: 1, borderColor: ig.line, borderRadius: 9, paddingVertical: 11, paddingHorizontal: 12, backgroundColor: ig.bg },
  hbtnPrimary: { backgroundColor: ig.text, borderColor: ig.text },
  hbtnDanger: { borderColor: '#EFD3CC' },
  hbtnTxt: { fontSize: 12, fontWeight: '700', color: ig.text },
  hbtnTxtPrimary: { color: '#fff' },
  hbtnTxtDanger: { color: ig.red },

  sections: { marginHorizontal: 14, gap: 8 },
  termsCard: { borderWidth: 1, borderColor: ig.line, borderRadius: 12, padding: 13 },
  termsTitle: { fontSize: 12.5, fontWeight: '800', color: ig.text, marginBottom: 8 },
  termsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  tl: { fontSize: 12, color: ig.mut },
  tv: { fontSize: 12.5, fontWeight: '700', color: ig.text },
  brief: { fontSize: 12, color: ig.text2, marginTop: 8, lineHeight: 17 },

  secRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: ig.line, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 13 },
  secIco: { width: 32, height: 32, borderRadius: 8, backgroundColor: ig.bgSoft, alignItems: 'center', justifyContent: 'center' },
  secLabel: { flex: 1, fontSize: 13, fontWeight: '700', color: ig.text },

});
