import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ig, IG_TONE } from '../../theme/ig';
import { fmtRupees } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import { deriveStage, whoseTurn } from '../../utils/collabStages';
import { heroFor, sectionsFor, spineFor } from '../../utils/collabDetailModel';

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

  const load = useCallback(async () => {
    setError(null);
    const res = await influencerApi.getMyCampaignDetail(ciId);
    setLoading(false);
    if (res.success) setData(res.data);
    else setError(res.error?.message || 'Could not load this collab');
  }, [ciId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

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
  };
  const pendingDeliverable = deliverables.some(
    d => d.status === 'pending' || d.status === 'revision_requested' || (d.status === 'approved' && !d.live_confirmed_at),
  );

  const hero = heroFor({ ...record, pendingDeliverable });
  const sections = sectionsFor(record);
  const spine = spineFor(record.stage);
  const tone = IG_TONE[hero.tone] || IG_TONE.neutral;

  const campaignName = c.campaign_name;
  const brandName = c.brand_name;

  // ── action dispatch ──────────────────────────────────────────────────────
  function go(key) {
    switch (key) {
      case 'negotiate': navigation.navigate('Negotiation', { campaign_influencer_id: ciId }); break;
      case 'sign':      navigation.navigate('Contract', { campaignInfluencerId: ciId }); break;
      case 'contract':  navigation.navigate('Contract', { campaignInfluencerId: ciId }); break;
      case 'logistics': navigation.navigate('Contract', { campaignInfluencerId: ciId }); break;
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
    Alert.alert('Accept this offer?', `${brandName} · ${fmtRupees(c.agreed_fee || c.influencer_budget || 0)}`, [
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
    Alert.alert('Pass on this offer?', 'This declines the invite.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Not a fit', style: 'destructive', onPress: () => submitDecline('not_a_fit') },
      { text: 'Fee too low', style: 'destructive', onPress: () => submitDecline('fee_too_low') },
    ]);
  }
  async function submitDecline(reason) {
    setBusy(true);
    const res = await influencerApi.declineOffer(ciId, { reason });
    setBusy(false);
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
          {fmtRupees(c.agreed_fee || c.influencer_budget || 0)}
          {prettyGoal(c.goal) ? ` · ${prettyGoal(c.goal)}` : ''}
          {c.start_date ? ` · ${fmtDate(c.start_date)}–${fmtDate(c.end_date)}` : ''}
        </Text>

        {/* progress spine */}
        <View style={styles.spine}>
          {spine.map(n => (
            <View key={n.key} style={styles.spineNode}>
              <View style={[styles.spineBar, n.state === 'done' && styles.spineBarDone, n.state === 'current' && styles.spineBarCur]} />
              <Text style={[styles.spineTxt, n.state === 'current' && styles.spineTxtCur]}>{n.label}</Text>
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
            {hero.actions.map(a => {
              const primary = a === 'accept' || a === 'sign' || a === 'deliverables' || a === 'earnings' || (a === 'negotiate' && hero.tone === 'nego');
              const danger = a === 'pass';
              const label = { accept: 'Accept', negotiate: 'Negotiate', pass: 'Pass',
                sign: 'Review & sign', deliverables: pendingDeliverable ? 'Upload content' : 'View deliverables', earnings: 'View earnings' }[a];
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
                <Text style={styles.termsTitle}>Terms & brief</Text>
                <View style={styles.termsRow}><Text style={styles.tl}>Fee</Text><Text style={styles.tv}>{fmtRupees(c.agreed_fee || c.influencer_budget || 0)}</Text></View>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ig.bg },
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
