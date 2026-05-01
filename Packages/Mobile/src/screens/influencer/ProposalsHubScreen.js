import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, TextInput, Image,
} from 'react-native';
import { colors, spacing, radius, fmtRupees } from '../../theme/tokens';
import { influencerApi } from '../../services/api';

const TABS = [
  { key: 'discover', label: 'Discover' },
  { key: 'mine',     label: 'My Proposals' },
];

const STATUS_PILL = {
  sent:      { bg: '#FFF4D6', fg: '#7A5500', label: 'Sent' },
  viewed:    { bg: '#DBE5FF', fg: '#1B2D5E', label: 'Viewed' },
  countered: { bg: '#EEEDFE', fg: '#5C50C8', label: 'Countered' },
  accepted:  { bg: '#E0FAF5', fg: '#007A63', label: 'Accepted' },
  rejected:  { bg: '#FDEEE9', fg: '#E8401A', label: 'Rejected' },
  expired:   { bg: '#F2F4F9', fg: '#8B91AD', label: 'Expired' },
  withdrawn: { bg: '#F2F4F9', fg: '#8B91AD', label: 'Withdrawn' },
};

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ProposalsHubScreen({ navigation }) {
  const [tab, setTab] = useState('discover');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Brand Proposals</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.tabs}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key} style={[styles.tab, tab === t.key && styles.tabActive]} onPress={() => setTab(t.key)}>
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'discover' ? <DiscoverTab navigation={navigation} /> : <MyProposalsTab navigation={navigation} />}
    </View>
  );
}

function DiscoverTab({ navigation }) {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    const res = await influencerApi.discoverBrands(search.trim() || null);
    if (res.success) setBrands(res.data?.brands || []);
    setLoading(false);
    setRefreshing(false);
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.navy} /></View>;

  return (
    <FlatList
      data={brands}
      keyExtractor={b => b.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      ListHeaderComponent={
        <View>
          <View style={styles.toolbar}>
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search brands…"
              placeholderTextColor={colors.t3}
            />
          </View>
          <View style={styles.discoverIntro}>
            <Text style={styles.discoverTitle}>Pitch a brand</Text>
            <Text style={styles.discoverBody}>
              These brands accept influencer proposals. Tap one to see their criteria and send a pitch.
              You can have up to 5 active proposals at once.
            </Text>
          </View>
        </View>
      }
      renderItem={({ item: b }) => (
        <TouchableOpacity
          style={styles.brandCard}
          onPress={() => navigation.navigate('SendProposal', { brandId: b.id, brandName: b.business_name })}>
          <View style={styles.brandLogoBox}>
            {b.logo_url
              ? <Image source={{ uri: b.logo_url }} style={styles.brandLogo} />
              : <Text style={styles.brandLogoPlaceholder}>{(b.business_name || 'X').slice(0, 2).toUpperCase()}</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.brandName}>{b.business_name}</Text>
            <Text style={styles.brandMeta}>{b.category || '—'}{b.brand_city ? ` · ${b.brand_city}` : ''}</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </TouchableOpacity>
      )}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyTitle}>No brands accepting proposals</Text>
          <Text style={styles.emptySub}>Check back later — brands turn this on as they're ready for pitches.</Text>
        </View>
      }
      contentContainerStyle={{ paddingBottom: spacing.xxl }}
    />
  );
}

function MyProposalsTab({ navigation }) {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await influencerApi.listMyProposals();
    if (res.success) setProposals(res.data?.proposals || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function withdraw(p) {
    Alert.alert('Withdraw proposal?', 'You can pitch this brand again later if their criteria still match.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Withdraw', style: 'destructive', onPress: async () => {
        const res = await influencerApi.withdrawProposal(p.id);
        if (res.success) load();
        else Alert.alert('Failed', res.error?.message || 'Could not withdraw');
      }},
    ]);
  }

  async function respondCounter(p, action) {
    const res = await influencerApi.respondCounter(p.id, action);
    if (res.success) load();
    else Alert.alert('Failed', res.error?.message || 'Could not respond');
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.navy} /></View>;

  return (
    <FlatList
      data={proposals}
      keyExtractor={p => p.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      renderItem={({ item: p }) => {
        const pill = STATUS_PILL[p.status] || STATUS_PILL.sent;
        const canWithdraw = ['sent', 'viewed', 'countered'].includes(p.status);
        return (
          <View style={styles.proposalCard}>
            <View style={styles.proposalHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.proposalTitle} numberOfLines={1}>{p.pitch_title}</Text>
                <Text style={styles.proposalBrand} numberOfLines={1}>To: {p.brand_name}</Text>
              </View>
              <View style={[styles.pill, { backgroundColor: pill.bg }]}>
                <Text style={[styles.pillTxt, { color: pill.fg }]}>{pill.label}</Text>
              </View>
            </View>

            <Text style={styles.proposalMsg} numberOfLines={3}>{p.pitch_message}</Text>

            <View style={styles.proposalFoot}>
              {p.proposed_fee ? <Text style={styles.proposalAsk}>{fmtRupees(p.proposed_fee)}</Text> : null}
              {p.proposed_commission_pct ? <Text style={styles.proposalAsk}>{p.proposed_commission_pct}% commission</Text> : null}
              <Text style={styles.proposalDate}>{fmtDate(p.created_at)}</Text>
            </View>

            {p.status === 'rejected' && p.brand_response_message && (
              <View style={styles.rejectBox}>
                <Text style={styles.rejectLabel}>Reason from brand</Text>
                <Text style={styles.rejectMsg}>{p.brand_response_message}</Text>
              </View>
            )}

            {p.status === 'countered' && (
              <View style={styles.counterBox}>
                <Text style={styles.counterLabel}>Brand sent a counter</Text>
                {p.brand_response_message && <Text style={styles.counterMsg}>{p.brand_response_message}</Text>}
                {p.counter_terms && (
                  <View style={{ marginTop: 6 }}>
                    {p.counter_terms.proposed_fee && <Text style={styles.counterTerm}>Fee: {fmtRupees(p.counter_terms.proposed_fee)}</Text>}
                    {p.counter_terms.proposed_commission_pct && <Text style={styles.counterTerm}>Commission: {p.counter_terms.proposed_commission_pct}%</Text>}
                  </View>
                )}
                <View style={styles.counterActions}>
                  <TouchableOpacity style={styles.counterBtnAlt} onPress={() => respondCounter(p, 'decline')}>
                    <Text style={styles.counterBtnAltTxt}>Decline</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.counterBtnPrimary} onPress={() => respondCounter(p, 'accept')}>
                    <Text style={styles.counterBtnPrimaryTxt}>Accept counter</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {canWithdraw && (
              <TouchableOpacity onPress={() => withdraw(p)} style={styles.withdrawLink}>
                <Text style={styles.withdrawText}>Withdraw</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      }}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📨</Text>
          <Text style={styles.emptyTitle}>No proposals yet</Text>
          <Text style={styles.emptySub}>Browse brands in the Discover tab and send your first pitch.</Text>
        </View>
      }
      contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}
    />
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.bg },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backIcon:     { fontSize: 28, color: colors.t1, fontWeight: '400' },
  headerTitle:  { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: colors.t1 },

  tabs:         { flexDirection: 'row', backgroundColor: colors.surface, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab:          { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive:    { borderBottomColor: colors.navy },
  tabLabel:     { fontSize: 13, fontWeight: '600', color: colors.t3 },
  tabLabelActive:{ color: colors.navy },

  toolbar:      { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  searchInput:  { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: 13, color: colors.t1 },

  discoverIntro:{ paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  discoverTitle:{ fontSize: 13, fontWeight: '700', color: colors.t1, marginBottom: 4 },
  discoverBody: { fontSize: 11, color: colors.t3, lineHeight: 16 },

  brandCard:    { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginHorizontal: spacing.md, marginBottom: spacing.sm },
  brandLogoBox: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  brandLogo:    { width: '100%', height: '100%' },
  brandLogoPlaceholder: { fontSize: 12, fontWeight: '800', color: colors.navy },
  brandName:    { fontSize: 14, fontWeight: '700', color: colors.t1 },
  brandMeta:    { fontSize: 11, color: colors.t3, marginTop: 2 },
  chev:         { fontSize: 22, color: colors.t3, fontWeight: '300' },

  proposalCard: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  proposalHead: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  proposalTitle:{ fontSize: 13, fontWeight: '700', color: colors.t1 },
  proposalBrand:{ fontSize: 11, color: colors.t3, marginTop: 2 },
  pill:         { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginLeft: 8 },
  pillTxt:      { fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  proposalMsg:  { fontSize: 11, color: colors.t2, lineHeight: 16, marginVertical: 4 },
  proposalFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border, flexWrap: 'wrap', gap: 6 },
  proposalAsk:  { fontSize: 12, fontWeight: '700', color: colors.navy },
  proposalDate: { fontSize: 10, color: colors.t3, marginLeft: 'auto' },

  rejectBox:    { marginTop: 10, padding: 10, backgroundColor: '#FDEEE9', borderRadius: radius.sm, borderWidth: 1, borderColor: '#F0C0B0' },
  rejectLabel:  { fontSize: 9, fontWeight: '800', color: '#A03020', textTransform: 'uppercase', marginBottom: 2 },
  rejectMsg:    { fontSize: 11, color: '#80201A' },

  counterBox:   { marginTop: 10, padding: 10, backgroundColor: '#EEEDFE', borderRadius: radius.sm, borderWidth: 1, borderColor: '#C8C5F0' },
  counterLabel: { fontSize: 10, fontWeight: '800', color: '#5C50C8', textTransform: 'uppercase', marginBottom: 4 },
  counterMsg:   { fontSize: 11, color: '#3F3590' },
  counterTerm:  { fontSize: 11, fontWeight: '700', color: '#3F3590' },
  counterActions:{ flexDirection: 'row', gap: 8, marginTop: 8 },
  counterBtnAlt:{ flex: 1, paddingVertical: 9, backgroundColor: colors.white, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  counterBtnAltTxt:{ fontSize: 11, fontWeight: '800', color: colors.t2 },
  counterBtnPrimary: { flex: 1, paddingVertical: 9, backgroundColor: colors.navy, borderRadius: 8, alignItems: 'center' },
  counterBtnPrimaryTxt: { fontSize: 11, fontWeight: '800', color: colors.white },

  withdrawLink: { paddingVertical: 6, alignSelf: 'flex-start' },
  withdrawText: { fontSize: 10, color: colors.red, fontWeight: '700' },

  empty:        { alignItems: 'center', padding: spacing.xxl * 2 },
  emptyIcon:    { fontSize: 40, marginBottom: spacing.md },
  emptyTitle:   { fontSize: 14, fontWeight: '700', color: colors.t1, marginBottom: 4 },
  emptySub:     { fontSize: 11, color: colors.t3, textAlign: 'center', paddingHorizontal: spacing.xl },
});
