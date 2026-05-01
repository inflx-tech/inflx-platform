import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, TextInput, Modal,
  ScrollView, Linking, KeyboardAvoidingView, Platform,
} from 'react-native';
import { colors, spacing, radius, fmtRupees } from '../../theme/tokens';
import { brandApi } from '../../services/api';

const STATUS_TABS = [
  { key: '',          label: 'All' },
  { key: 'sent',      label: 'New' },
  { key: 'viewed',    label: 'Viewed' },
  { key: 'countered', label: 'Countered' },
  { key: 'accepted',  label: 'Accepted' },
  { key: 'rejected',  label: 'Rejected' },
];
const STATUS_PILL = {
  sent:      { bg: '#FFF4D6', fg: '#7A5500', label: 'New' },
  viewed:    { bg: '#DBE5FF', fg: '#1B2D5E', label: 'Viewed' },
  countered: { bg: '#EEEDFE', fg: '#5C50C8', label: 'Countered' },
  accepted:  { bg: '#E0FAF5', fg: '#007A63', label: 'Accepted' },
  rejected:  { bg: '#FDEEE9', fg: '#E8401A', label: 'Rejected' },
  expired:   { bg: '#F2F4F9', fg: '#8B91AD', label: 'Expired' },
  withdrawn: { bg: '#F2F4F9', fg: '#8B91AD', label: 'Withdrawn' },
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
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Proposals</Text>
        <View style={{ width: 36 }} />
      </View>

      {settings && !settings.accepts_proposals && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>You're not accepting proposals yet.</Text>
          <TouchableOpacity onPress={toggleAccepts} style={styles.bannerBtn}>
            <Text style={styles.bannerBtnTxt}>Turn on</Text>
          </TouchableOpacity>
        </View>
      )}

      {settings?.accepts_proposals && (
        <View style={styles.acceptedBar}>
          <Text style={styles.acceptedTxt}>✓ Accepting proposals · Adjust filters on the web dashboard.</Text>
          <TouchableOpacity onPress={toggleAccepts}>
            <Text style={styles.acceptedToggle}>Pause</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.tabsScrollWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {STATUS_TABS.map(t => (
            <TouchableOpacity key={t.key} style={[styles.tab, tab === t.key && styles.tabActive]} onPress={() => setTab(t.key)}>
              <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.navy} /></View>
      ) : (
        <FlatList
          data={proposals}
          keyExtractor={p => p.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          renderItem={({ item: p }) => {
            const pill = STATUS_PILL[p.status] || STATUS_PILL.sent;
            return (
              <TouchableOpacity style={styles.card} onPress={() => setActive(p)}>
                <View style={styles.cardHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{p.pitch_title}</Text>
                    <Text style={styles.cardInf}>{p.influencer_name} · @{p.influencer_handle} · {tierFromFollowers(p.followers_count)}</Text>
                  </View>
                  <View style={[styles.pill, { backgroundColor: pill.bg }]}>
                    <Text style={[styles.pillTxt, { color: pill.fg }]}>{pill.label}</Text>
                  </View>
                </View>
                <Text style={styles.cardMsg} numberOfLines={2}>{p.pitch_message}</Text>
                <View style={styles.cardFoot}>
                  {p.proposed_fee ? <Text style={styles.cardAsk}>{fmtRupees(p.proposed_fee)}</Text> : null}
                  {p.proposed_commission_pct ? <Text style={styles.cardAsk}>{p.proposed_commission_pct}%</Text> : null}
                  <Text style={styles.cardDate}>{fmtDate(p.created_at)}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📨</Text>
              <Text style={styles.emptyTitle}>No proposals here</Text>
              <Text style={styles.emptySub}>{settings?.accepts_proposals ? 'No matches in this tab. Try All.' : 'Turn on proposals to start receiving pitches.'}</Text>
            </View>
          }
          contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}
        />
      )}

      {active && <ProposalModal proposal={active} onClose={() => setActive(null)} onChanged={() => { setActive(null); load(); }} />}
    </View>
  );
}

function ProposalModal({ proposal, onClose, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState(null); // 'reject' | 'counter' | null
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
      <KeyboardAvoidingView style={modalStyles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={modalStyles.body}>
          <View style={modalStyles.head}>
            <View style={{ flex: 1 }}>
              <Text style={modalStyles.title} numberOfLines={1}>{proposal.pitch_title}</Text>
              <Text style={modalStyles.sub}>{proposal.influencer_name} · @{proposal.influencer_handle}</Text>
            </View>
            <TouchableOpacity onPress={onClose}><Text style={modalStyles.close}>×</Text></TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 460 }}>
            <View style={modalStyles.statsRow}>
              <Stat label="Followers" value={Number(proposal.followers_count || 0).toLocaleString('en-IN')} />
              <Stat label="ER" value={`${proposal.engagement_rate || 0}%`} />
              <Stat label="Tier" value={tierFromFollowers(proposal.followers_count)} />
            </View>

            <Text style={modalStyles.sectionLabel}>Pitch</Text>
            <Text style={modalStyles.body2}>{proposal.pitch_message}</Text>

            <Text style={modalStyles.sectionLabel}>Proposed terms</Text>
            <Row label="Goal" value={proposal.goal || '—'} />
            {proposal.proposed_fee ? <Row label="Fee" value={fmtRupees(proposal.proposed_fee)} /> : null}
            {proposal.proposed_commission_pct ? <Row label="Commission" value={`${proposal.proposed_commission_pct}%`} /> : null}
            {proposal.proposed_deliverables && (
              <Row label="Deliverables" value={
                (Array.isArray(proposal.proposed_deliverables) ? proposal.proposed_deliverables : [])
                  .map(d => `${d.count || 1} × ${d.type}`).join(', ')
              } />
            )}

            {(proposal.portfolio_links || []).length > 0 && (
              <>
                <Text style={modalStyles.sectionLabel}>Portfolio samples</Text>
                {proposal.portfolio_links.map((u, i) => (
                  <TouchableOpacity key={i} onPress={() => Linking.openURL(u)}>
                    <Text style={modalStyles.linkRow} numberOfLines={1}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {proposal.status === 'rejected' && proposal.brand_response_message && (
              <View style={modalStyles.rejectBox}>
                <Text style={modalStyles.rejectLabel}>You declined</Text>
                <Text style={modalStyles.rejectMsg}>{proposal.brand_response_message}</Text>
              </View>
            )}
          </ScrollView>

          {canDecide && !mode && (
            <View style={modalStyles.actionRow}>
              <TouchableOpacity disabled={busy} style={modalStyles.btnAlt} onPress={() => setMode('reject')}>
                <Text style={modalStyles.btnAltTxt}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={busy} style={modalStyles.btnCounter} onPress={() => setMode('counter')}>
                <Text style={modalStyles.btnCounterTxt}>Counter</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={busy} style={modalStyles.btnAccept} onPress={accept}>
                <Text style={modalStyles.btnAcceptTxt}>Accept</Text>
              </TouchableOpacity>
            </View>
          )}

          {mode === 'reject' && (
            <View style={modalStyles.formBox}>
              <Text style={modalStyles.formLabel}>Optional message</Text>
              <TextInput style={modalStyles.formInput} multiline value={rejectMsg} onChangeText={setRejectMsg}
                placeholder="Why this isn't a fit (visible to influencer)" placeholderTextColor={colors.t3} />
              <View style={modalStyles.actionRow}>
                <TouchableOpacity style={modalStyles.btnAlt} onPress={() => setMode(null)}>
                  <Text style={modalStyles.btnAltTxt}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity disabled={busy} style={modalStyles.btnRejectConfirm} onPress={submitReject}>
                  <Text style={modalStyles.btnAcceptTxt}>{busy ? '…' : 'Confirm reject'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {mode === 'counter' && (
            <View style={modalStyles.formBox}>
              <Text style={modalStyles.formLabel}>Counter fee (₹)</Text>
              <TextInput style={modalStyles.formInputSmall} keyboardType="numeric" value={counterFee} onChangeText={setCounterFee}
                placeholder="0" placeholderTextColor={colors.t3} />
              <Text style={modalStyles.formLabel}>Counter commission %</Text>
              <TextInput style={modalStyles.formInputSmall} keyboardType="numeric" value={counterPct} onChangeText={setCounterPct}
                placeholder="0" placeholderTextColor={colors.t3} />
              <Text style={modalStyles.formLabel}>Note</Text>
              <TextInput style={modalStyles.formInput} multiline value={counterMsg} onChangeText={setCounterMsg}
                placeholder="Why this counter (visible to influencer)" placeholderTextColor={colors.t3} />
              <View style={modalStyles.actionRow}>
                <TouchableOpacity style={modalStyles.btnAlt} onPress={() => setMode(null)}>
                  <Text style={modalStyles.btnAltTxt}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity disabled={busy} style={modalStyles.btnCounter} onPress={submitCounter}>
                  <Text style={modalStyles.btnCounterTxt}>{busy ? '…' : 'Send counter'}</Text>
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
    <View style={modalStyles.stat}>
      <Text style={modalStyles.statValue}>{value}</Text>
      <Text style={modalStyles.statLabel}>{label}</Text>
    </View>
  );
}
function Row({ label, value }) {
  return (
    <View style={modalStyles.row}>
      <Text style={modalStyles.rowLabel}>{label}</Text>
      <Text style={modalStyles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.bg },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backIcon:     { fontSize: 28, color: colors.t1, fontWeight: '400' },
  headerTitle:  { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: colors.t1 },

  banner:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF4D6', borderBottomWidth: 1, borderBottomColor: '#F0D987', paddingHorizontal: spacing.md, paddingVertical: 10 },
  bannerText:   { fontSize: 11, color: '#7A5500', flex: 1 },
  bannerBtn:    { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#B8860B', borderRadius: 6 },
  bannerBtnTxt: { color: colors.white, fontSize: 11, fontWeight: '800' },

  acceptedBar:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.tealPale, borderBottomWidth: 1, borderBottomColor: colors.teal, paddingHorizontal: spacing.md, paddingVertical: 8 },
  acceptedTxt:  { fontSize: 11, color: colors.tealDeep, flex: 1 },
  acceptedToggle:{ fontSize: 11, color: colors.tealDeep, fontWeight: '800' },

  tabsScrollWrap:{ backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabs:         { paddingHorizontal: spacing.md },
  tab:          { paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive:    { borderBottomColor: colors.navy },
  tabLabel:     { fontSize: 12, fontWeight: '600', color: colors.t3 },
  tabLabelActive:{ color: colors.navy },

  card:         { padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  cardHead:     { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  cardTitle:    { fontSize: 13, fontWeight: '700', color: colors.t1 },
  cardInf:      { fontSize: 11, color: colors.t3, marginTop: 2 },
  pill:         { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginLeft: 8 },
  pillTxt:      { fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  cardMsg:      { fontSize: 11, color: colors.t2, lineHeight: 16, marginVertical: 4 },
  cardFoot:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border, gap: 8, flexWrap: 'wrap' },
  cardAsk:      { fontSize: 12, fontWeight: '700', color: colors.navy },
  cardDate:     { fontSize: 10, color: colors.t3, marginLeft: 'auto' },

  empty:        { alignItems: 'center', padding: spacing.xxl * 2 },
  emptyIcon:    { fontSize: 40, marginBottom: spacing.md },
  emptyTitle:   { fontSize: 14, fontWeight: '700', color: colors.t1, marginBottom: 4 },
  emptySub:     { fontSize: 11, color: colors.t3, textAlign: 'center', paddingHorizontal: spacing.xl },
});

const modalStyles = StyleSheet.create({
  wrap:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  body:         { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.lg, paddingBottom: 32 },
  head:         { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md },
  title:        { fontSize: 16, fontWeight: '800', color: colors.t1 },
  sub:          { fontSize: 11, color: colors.t3, marginTop: 2 },
  close:        { fontSize: 24, color: colors.t3, fontWeight: '300', marginLeft: 8 },

  statsRow:     { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  stat:         { flex: 1, padding: 10, borderRadius: 10, backgroundColor: colors.surface2, alignItems: 'center' },
  statValue:    { fontSize: 14, fontWeight: '800', color: colors.t1 },
  statLabel:    { fontSize: 9, color: colors.t3, textTransform: 'uppercase', marginTop: 2 },

  sectionLabel: { fontSize: 10, fontWeight: '800', color: colors.t3, textTransform: 'uppercase', marginTop: spacing.md, marginBottom: 4 },
  body2:        { fontSize: 12, color: colors.t1, lineHeight: 18 },
  row:          { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel:     { fontSize: 11, color: colors.t3 },
  rowValue:     { fontSize: 11, fontWeight: '700', color: colors.t1, textAlign: 'right', flex: 1, marginLeft: 8 },
  linkRow:      { fontSize: 11, color: colors.navy, paddingVertical: 4 },
  rejectBox:    { marginTop: 10, padding: 10, backgroundColor: '#FDEEE9', borderRadius: 10 },
  rejectLabel:  { fontSize: 9, fontWeight: '800', color: '#A03020', textTransform: 'uppercase', marginBottom: 2 },
  rejectMsg:    { fontSize: 11, color: '#80201A' },

  actionRow:    { flexDirection: 'row', gap: 8, marginTop: spacing.md },
  btnAlt:       { flex: 1, paddingVertical: 11, backgroundColor: colors.surface2, borderRadius: 10, alignItems: 'center' },
  btnAltTxt:    { color: colors.t2, fontSize: 12, fontWeight: '800' },
  btnCounter:   { flex: 1, paddingVertical: 11, backgroundColor: '#5C50C8', borderRadius: 10, alignItems: 'center' },
  btnCounterTxt:{ color: colors.white, fontSize: 12, fontWeight: '800' },
  btnAccept:    { flex: 1, paddingVertical: 11, backgroundColor: colors.teal, borderRadius: 10, alignItems: 'center' },
  btnAcceptTxt: { color: colors.white, fontSize: 12, fontWeight: '800' },
  btnRejectConfirm: { flex: 1, paddingVertical: 11, backgroundColor: colors.red, borderRadius: 10, alignItems: 'center' },

  formBox:      { marginTop: spacing.md, padding: 10, backgroundColor: colors.surface2, borderRadius: 12 },
  formLabel:    { fontSize: 10, fontWeight: '800', color: colors.t3, textTransform: 'uppercase', marginTop: 6, marginBottom: 4 },
  formInput:    { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, fontSize: 12, color: colors.t1, minHeight: 60, textAlignVertical: 'top' },
  formInputSmall:{ backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, fontSize: 12, color: colors.t1 },
});
