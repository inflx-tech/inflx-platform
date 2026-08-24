import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, TextInput, Modal,
  ScrollView, Linking, KeyboardAvoidingView, Platform,
} from 'react-native';
import { brandPalette as P, fonts, fmtRupees } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import ProposalFiltersSheet from '../../components/brand/ProposalFiltersSheet';

/**
 * BrandProposalInboxScreen — proposals from influencers + accept/reject/counter.
 * Flow 20 (2026-05-25): navy + 7 ad-hoc status pills → brandPalette + canonical map.
 */

const STATUS_TABS = [
  { key: '',          label: 'All' },
  { key: 'sent',      label: 'New' },
  { key: 'viewed',    label: 'Viewed' },
  { key: 'countered', label: 'Countered' },
  { key: 'accepted',  label: 'Accepted' },
  { key: 'rejected',  label: 'Rejected' },
];

// Canonical status → palette (Flow 20)
const STATUS_PILL = {
  sent:      { bg: P.warnPale,  fg: P.warnText,  label: 'New' },
  viewed:    { bg: P.infoPale,    fg: P.info,        label: 'Viewed' },
  countered: { bg: P.convPale,    fg: P.conv,        label: 'Countered' },
  accepted:  { bg: P.successPale, fg: P.successText, label: 'Accepted' },
  rejected:  { bg: P.dangerPale,  fg: P.dangerText,  label: 'Rejected' },
  expired:   { bg: P.bg2,         fg: P.muted2,      label: 'Expired' },
  withdrawn: { bg: P.bg2,         fg: P.muted2,      label: 'Withdrawn' },
};

function tierFromFollowers(n) {
  const v = Number(n || 0);
  if (v < 10000)   return 'nano';
  if (v < 100000)  return 'micro';
  if (v < 1000000) return 'macro';
  return 'mega';
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function BrandProposalInboxScreen({ navigation }) {
  const [tab, setTab] = useState('');
  const [proposals, setProposals] = useState([]);
  const [settings, setSettings]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [active, setActive]       = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const load = useCallback(async () => {
    const [pRes, sRes] = await Promise.all([
      brandApi.listProposals(tab || null),
      brandApi.getProposalSettings(),
    ]);
    if (pRes.success) setProposals(pRes.data?.proposals || []);
    if (sRes.success) setSettings(sRes.data);
    setLoading(false);
    setRefreshing(false);
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  async function toggleAccepts() {
    if (!settings) return;
    const next = !settings.accepts_proposals;
    const res = await brandApi.updateProposalSettings({ accepts_proposals: next });
    if (res.success) load();
    else Alert.alert('Failed', res.error?.message || 'Could not update');
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Proposals</Text>
        <View style={{ width: 36 }} />
      </View>

      {settings && !settings.accepts_proposals && (
        <View style={s.banner}>
          <Text style={s.bannerText}>You're not accepting proposals yet.</Text>
          <TouchableOpacity onPress={toggleAccepts} style={s.bannerBtn}>
            <Text style={s.bannerBtnTxt}>Turn on</Text>
          </TouchableOpacity>
        </View>
      )}

      {settings?.accepts_proposals && (
        <View style={s.acceptedBar}>
          <Text style={s.acceptedTxt}>✓ Accepting proposals</Text>
          <TouchableOpacity onPress={() => setFiltersOpen(true)}>
            <Text style={s.acceptedToggle}>Filters</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleAccepts}>
            <Text style={s.acceptedToggle}>Pause</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Proposal filters — editable on mobile (was "adjust on the web dashboard") */}
      <ProposalFiltersSheet
        visible={filtersOpen}
        settings={settings}
        onClose={() => setFiltersOpen(false)}
        onSaved={() => { setFiltersOpen(false); load(); }}
      />

      <View style={s.tabsScrollWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
          {STATUS_TABS.map(t => (
            <TouchableOpacity key={t.key} style={[s.tab, tab === t.key && s.tabActive]} onPress={() => setTab(t.key)}>
              <Text style={[s.tabLabel, tab === t.key && s.tabLabelActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={P.ink} size="large" /></View>
      ) : (
        <FlatList
          data={proposals}
          keyExtractor={p => p.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={P.ink} colors={[P.ink]} />}
          renderItem={({ item: p }) => {
            const pill = STATUS_PILL[p.status] || STATUS_PILL.sent;
            return (
              <TouchableOpacity style={s.card} onPress={() => setActive(p)} activeOpacity={0.85}>
                <View style={s.cardHead}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.cardTitle} numberOfLines={1}>{p.pitch_title}</Text>
                    <Text style={s.cardInf}>{p.influencer_name} · @{p.influencer_handle} · {tierFromFollowers(p.followers_count)}</Text>
                  </View>
                  <View style={[s.pill, { backgroundColor: pill.bg }]}>
                    <Text style={[s.pillTxt, { color: pill.fg }]}>{pill.label}</Text>
                  </View>
                </View>
                <Text style={s.cardMsg} numberOfLines={2}>{p.pitch_message}</Text>
                <View style={s.cardFoot}>
                  {p.proposed_fee ? <Text style={s.cardAsk}>{fmtRupees(p.proposed_fee)}</Text> : null}
                  {p.proposed_commission_pct ? <Text style={s.cardAsk}>{p.proposed_commission_pct}%</Text> : null}
                  <Text style={s.cardDate}>{fmtDate(p.created_at)}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={s.emptyIcon}><Text style={s.emptyIconText}>[MAIL]</Text></View>
              <Text style={s.emptyTitle}>No proposals here</Text>
              <Text style={s.emptySub}>{settings?.accepts_proposals ? 'No matches in this tab. Try All.' : 'Turn on proposals to start receiving pitches.'}</Text>
            </View>
          }
          contentContainerStyle={{ padding: 14, paddingBottom: 24 }}
        />
      )}

      {active && <ProposalModal proposal={active} onClose={() => setActive(null)} onChanged={() => { setActive(null); load(); }} />}
    </View>
  );
}

function ProposalModal({ proposal, onClose, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState(null);
  const [rejectMsg, setRejectMsg] = useState('');
  const [counterFee, setCounterFee] = useState(String(proposal.proposed_fee || ''));
  const [counterPct, setCounterPct] = useState(String(proposal.proposed_commission_pct || ''));
  const [counterMsg, setCounterMsg] = useState('');

  const canDecide = ['sent', 'viewed'].includes(proposal.status);

  async function accept() {
    Alert.alert('Accept this proposal?', 'A draft contract will be created. You can finalise terms before sending it to the influencer.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Accept', onPress: async () => {
        setBusy(true);
        const res = await brandApi.acceptProposal(proposal.id);
        setBusy(false);
        if (res.success) onChanged();
        else Alert.alert('Failed', res.error?.message || 'Could not accept');
      }},
    ]);
  }
  async function submitReject() {
    setBusy(true);
    const res = await brandApi.rejectProposal(proposal.id, rejectMsg.trim() || null);
    setBusy(false);
    if (res.success) onChanged();
    else Alert.alert('Failed', res.error?.message || 'Could not reject');
  }
  async function submitCounter() {
    setBusy(true);
    const res = await brandApi.counterProposal(proposal.id, {
      proposed_fee:            counterFee === '' ? null : Number(counterFee),
      proposed_commission_pct: counterPct === '' ? null : Number(counterPct),
    }, counterMsg.trim() || null);
    setBusy(false);
    if (res.success) onChanged();
    else Alert.alert('Failed', res.error?.message || 'Could not send counter');
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={ms.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={ms.body}>
          <View style={ms.head}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={ms.title} numberOfLines={1}>{proposal.pitch_title}</Text>
              <Text style={ms.sub}>{proposal.influencer_name} · @{proposal.influencer_handle}</Text>
            </View>
            <TouchableOpacity onPress={onClose}><Text style={ms.close}>×</Text></TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 460 }}>
            <View style={ms.statsRow}>
              <Stat label="Followers" value={Number(proposal.followers_count || 0).toLocaleString('en-IN')} />
              <Stat label="ER" value={`${proposal.engagement_rate || 0}%`} />
              <Stat label="Tier" value={tierFromFollowers(proposal.followers_count)} />
            </View>

            <Text style={ms.sectionLabel}>Pitch</Text>
            <Text style={ms.body2}>{proposal.pitch_message}</Text>

            <Text style={ms.sectionLabel}>Proposed terms</Text>
            <Row label="Goal" value={proposal.goal || '—'} />
            {proposal.proposed_fee ? <Row label="Fee" value={fmtRupees(proposal.proposed_fee)} mono /> : null}
            {proposal.proposed_commission_pct ? <Row label="Commission" value={`${proposal.proposed_commission_pct}%`} mono /> : null}
            {proposal.proposed_deliverables && (
              <Row label="Deliverables" value={
                (Array.isArray(proposal.proposed_deliverables) ? proposal.proposed_deliverables : [])
                  .map(d => `${d.count || 1} × ${d.type}`).join(', ')
              } />
            )}

            {(proposal.portfolio_links || []).length > 0 && (
              <>
                <Text style={ms.sectionLabel}>Portfolio samples</Text>
                {proposal.portfolio_links.map((u, i) => (
                  <TouchableOpacity key={i} onPress={() => Linking.openURL(u)}>
                    <Text style={ms.linkRow} numberOfLines={1}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {proposal.status === 'rejected' && proposal.brand_response_message && (
              <View style={ms.rejectBox}>
                <Text style={ms.rejectLabel}>You declined</Text>
                <Text style={ms.rejectMsg}>{proposal.brand_response_message}</Text>
              </View>
            )}
          </ScrollView>

          {canDecide && !mode && (
            <View style={ms.actionRow}>
              <TouchableOpacity disabled={busy} style={ms.btnAlt} onPress={() => setMode('reject')}>
                <Text style={ms.btnAltTxt}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={busy} style={ms.btnCounter} onPress={() => setMode('counter')}>
                <Text style={ms.btnCounterTxt}>Counter</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={busy} style={ms.btnAccept} onPress={accept}>
                <Text style={ms.btnAcceptTxt}>Accept</Text>
              </TouchableOpacity>
            </View>
          )}

          {mode === 'reject' && (
            <View style={ms.formBox}>
              <Text style={ms.formLabel}>Optional message</Text>
              <TextInput style={ms.formInput} multiline value={rejectMsg} onChangeText={setRejectMsg}
                placeholder="Why this isn't a fit (visible to influencer)" placeholderTextColor={P.muted3} />
              <View style={ms.actionRow}>
                <TouchableOpacity style={ms.btnAlt} onPress={() => setMode(null)}>
                  <Text style={ms.btnAltTxt}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity disabled={busy} style={ms.btnRejectConfirm} onPress={submitReject}>
                  <Text style={ms.btnAcceptTxt}>{busy ? '…' : 'Confirm reject'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {mode === 'counter' && (
            <View style={ms.formBox}>
              <Text style={ms.formLabel}>Counter fee (₹)</Text>
              <TextInput style={ms.formInputSmall} keyboardType="numeric" value={counterFee} onChangeText={setCounterFee}
                placeholder="0" placeholderTextColor={P.muted3} />
              <Text style={ms.formLabel}>Counter commission %</Text>
              <TextInput style={ms.formInputSmall} keyboardType="numeric" value={counterPct} onChangeText={setCounterPct}
                placeholder="0" placeholderTextColor={P.muted3} />
              <Text style={ms.formLabel}>Note</Text>
              <TextInput style={ms.formInput} multiline value={counterMsg} onChangeText={setCounterMsg}
                placeholder="Why this counter (visible to influencer)" placeholderTextColor={P.muted3} />
              <View style={ms.actionRow}>
                <TouchableOpacity style={ms.btnAlt} onPress={() => setMode(null)}>
                  <Text style={ms.btnAltTxt}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity disabled={busy} style={ms.btnCounter} onPress={submitCounter}>
                  <Text style={ms.btnCounterTxt}>{busy ? '…' : 'Send counter'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Stat({ label, value }) {
  return (
    <View style={ms.stat}>
      <Text style={ms.statValue}>{value}</Text>
      <Text style={ms.statLabel}>{label}</Text>
    </View>
  );
}
function Row({ label, value, mono }) {
  return (
    <View style={ms.row}>
      <Text style={ms.rowLabel}>{label}</Text>
      <Text style={[ms.rowValue, mono && { fontFamily: fonts.monoBold }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 52, paddingBottom: 14, backgroundColor: P.white, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.border },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: P.bg2, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontFamily: fonts.monoBold, fontSize: 22, color: P.ink, lineHeight: 22, fontWeight: '400' },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.displayBold, fontSize: 17, fontWeight: '700', color: P.ink },

  banner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: P.warnPale, borderBottomWidth: 1, borderBottomColor: P.warn, paddingHorizontal: 14, paddingVertical: 10 },
  bannerText: { fontFamily: fonts.sansMedium, fontSize: 11, color: P.warnText, flex: 1 },
  bannerBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: P.ink, borderRadius: 99 },
  bannerBtnTxt: { fontFamily: fonts.monoBold, color: P.white, fontSize: 10.5, fontWeight: '800' },

  acceptedBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: P.successPale, borderBottomWidth: 1, borderBottomColor: P.success, paddingHorizontal: 14, paddingVertical: 8 },
  acceptedTxt: { fontFamily: fonts.sansMedium, fontSize: 11, color: P.successText, flex: 1 },
  acceptedToggle: { fontFamily: fonts.monoBold, fontSize: 11, color: P.successText, fontWeight: '800' },

  tabsScrollWrap: { backgroundColor: P.white, borderBottomWidth: 1, borderBottomColor: P.border },
  tabs: { paddingHorizontal: 14 },
  tab: { paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: P.ink },
  tabLabel: { fontFamily: fonts.sansBold, fontSize: 12, fontWeight: '600', color: P.muted2 },
  tabLabelActive: { color: P.ink },

  card: { padding: 12, backgroundColor: P.white, borderRadius: 12, borderWidth: 1, borderColor: P.border, marginBottom: 8 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6, gap: 8 },
  cardTitle: { fontFamily: fonts.displayBold, fontSize: 13, fontWeight: '700', color: P.ink },
  cardInf: { fontFamily: fonts.monoMedium, fontSize: 10.5, color: P.muted2, marginTop: 2 },
  pill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 99, alignSelf: 'flex-start' },
  pillTxt: { fontFamily: fonts.monoBold, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  cardMsg: { fontFamily: fonts.sansMedium, fontSize: 11.5, color: P.muted, lineHeight: 17, marginVertical: 4 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: P.borderSoft, gap: 10 },
  cardAsk: { fontFamily: fonts.monoBold, fontSize: 11.5, fontWeight: '700', color: P.ink },
  cardDate: { fontFamily: fonts.monoMedium, fontSize: 10, color: P.muted3, marginLeft: 'auto' },

  empty: { alignItems: 'center', padding: 30, marginTop: 30, gap: 10 },
  emptyIcon: { width: 52, height: 52, borderRadius: 13, backgroundColor: P.bg2, alignItems: 'center', justifyContent: 'center' },
  emptyIconText: { fontFamily: fonts.monoBold, fontSize: 10.5, fontWeight: '800', color: P.ink, letterSpacing: 0.4 },
  emptyTitle: { fontFamily: fonts.displayBold, fontSize: 14, fontWeight: '700', color: P.ink },
  emptySub: { fontFamily: fonts.sansMedium, fontSize: 11, color: P.muted, textAlign: 'center', maxWidth: 260, lineHeight: 17 },
});

const ms = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  body: { backgroundColor: P.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, paddingBottom: 32 },
  head: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14, gap: 8 },
  title: { fontFamily: fonts.displayBold, fontSize: 16, fontWeight: '800', color: P.ink },
  sub: { fontFamily: fonts.monoMedium, fontSize: 11, color: P.muted2, marginTop: 2 },
  close: { fontFamily: fonts.monoBold, fontSize: 22, color: P.muted2, paddingHorizontal: 4, lineHeight: 22 },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  stat: { flex: 1, padding: 10, borderRadius: 10, backgroundColor: P.bg2, alignItems: 'center' },
  statValue: { fontFamily: fonts.displayBold, fontSize: 14, fontWeight: '800', color: P.ink },
  statLabel: { fontFamily: fonts.monoBold, fontSize: 9, color: P.muted2, textTransform: 'uppercase', marginTop: 2 },

  sectionLabel: { fontFamily: fonts.monoBold, fontSize: 10, fontWeight: '800', color: P.muted2, textTransform: 'uppercase', marginTop: 14, marginBottom: 4, letterSpacing: 0.4 },
  body2: { fontFamily: fonts.sansMedium, fontSize: 12, color: P.ink, lineHeight: 18 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: P.borderSoft },
  rowLabel: { fontFamily: fonts.monoMedium, fontSize: 11, color: P.muted2 },
  rowValue: { fontFamily: fonts.sansBold, fontSize: 11, fontWeight: '700', color: P.ink, textAlign: 'right', flex: 1, marginLeft: 8 },
  linkRow: { fontFamily: fonts.monoMedium, fontSize: 11, color: P.info, paddingVertical: 4 },
  rejectBox: { marginTop: 10, padding: 10, backgroundColor: P.dangerPale, borderRadius: 10 },
  rejectLabel: { fontFamily: fonts.monoBold, fontSize: 9, fontWeight: '800', color: P.dangerText, textTransform: 'uppercase', marginBottom: 2, letterSpacing: 0.4 },
  rejectMsg: { fontFamily: fonts.sansMedium, fontSize: 11, color: P.dangerText },

  actionRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  btnAlt: { flex: 1, paddingVertical: 11, backgroundColor: P.bg2, borderRadius: 10, alignItems: 'center' },
  btnAltTxt: { fontFamily: fonts.sansBold, color: P.muted, fontSize: 12, fontWeight: '800' },
  btnCounter: { flex: 1, paddingVertical: 11, backgroundColor: P.convPale, borderRadius: 10, alignItems: 'center' },
  btnCounterTxt: { fontFamily: fonts.sansBold, color: P.conv, fontSize: 12, fontWeight: '800' },
  btnAccept: { flex: 1, paddingVertical: 11, backgroundColor: P.ink, borderRadius: 10, alignItems: 'center' },
  btnAcceptTxt: { fontFamily: fonts.sansBold, color: P.ink, fontSize: 12, fontWeight: '800' },
  btnRejectConfirm: { flex: 1, paddingVertical: 11, backgroundColor: P.danger, borderRadius: 10, alignItems: 'center' },

  formBox: { marginTop: 14, padding: 10, backgroundColor: P.bg2, borderRadius: 12 },
  formLabel: { fontFamily: fonts.monoBold, fontSize: 10, fontWeight: '800', color: P.muted2, textTransform: 'uppercase', marginTop: 6, marginBottom: 4, letterSpacing: 0.4 },
  formInput: { fontFamily: fonts.sansMedium, backgroundColor: P.white, borderWidth: 1, borderColor: P.border, borderRadius: 8, padding: 10, fontSize: 12, color: P.ink, minHeight: 60, textAlignVertical: 'top' },
  formInputSmall: { fontFamily: fonts.monoMedium, backgroundColor: P.white, borderWidth: 1, borderColor: P.border, borderRadius: 8, padding: 10, fontSize: 12, color: P.ink },
});
