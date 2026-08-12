import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, TextInput, Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { brandPalette as P, fonts, fmtRupees } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import StatusPill from '../../components/brand/StatusPill';

const TABS = [
  { key: 'discover', label: 'DISCOVER' },
  { key: 'mine',     label: 'MY PITCHES' },
  // collab-part2 — brands can now ask YOU. Separate list from your pitches: a pitch
  // says "I want to work with you", a request says "I want you for something".
  { key: 'requests', label: 'REQUESTS' },
];

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
}

/**
 * ProposalsHubScreen — 2-tab outbound proposals hub.
 *
 * Flow 36 restyle (2026-05-27): brandPalette + Outfit/PJS/Mono fonts.
 * Yellow-underline active tab + Outfit-Black UPPERCASE labels per design call #1.
 * Yellow brand-logo tile with ink Outfit-Black initials per design call #2.
 * 'sent' status rendered inline as yellowPale 'SENT' pill (sender-POV) per
 * design call #3; canonical StatusPill for other 6 statuses.
 * Counter Accept CTA = ink/yellow + ghost-ink Decline per design call #4.
 */

export default function ProposalsHubScreen({ navigation }) {
  const [tab, setTab] = useState('discover');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="chevron-left" size={18} color={P.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Brand Proposals</Text>
        <View style={{ width: 34 }} />
      </View>

      <View style={styles.tabs}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key} style={[styles.tab, tab === t.key && styles.tabActive]} onPress={() => setTab(t.key)}>
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'discover' ? <DiscoverTab navigation={navigation} />
        : tab === 'requests' ? <BrandRequestsTab navigation={navigation} />
        : <MyProposalsTab navigation={navigation} />}
    </View>
  );
}

// collab-part2 — incoming brand requests. Rows summarise money + time; the detail
// screen carries the full terms model, the counter composer and one-tap accept.
function BrandRequestsTab({ navigation }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await influencerApi.listCollabRequests();
    if (res.success) setRequests(res.data?.requests || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const summary = (r) => {
    const t = r.terms_json || {};
    const bits = [];
    if (t.money?.commission_pct != null) bits.push(`${t.money.commission_pct}%`);
    if (t.money?.fee != null) bits.push(`₹${Number(t.money.fee).toLocaleString('en-IN')}`);
    if (t.time?.post_by) bits.push(`post by ${String(t.time.post_by).slice(0, 10)}`);
    else if (t.time?.window_end) bits.push(`by ${String(t.time.window_end).slice(0, 10)}`);
    return bits.join(' · ') || '—';
  };

  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={P.yellow} /></View>;

  return (
    <FlatList
      data={requests}
      keyExtractor={r => r.id}
      contentContainerStyle={{ paddingVertical: 14, paddingBottom: 30 }}
      refreshing={refreshing}
      onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.brandCard}
          onPress={() => navigation.navigate('CollabRequestDetail', { requestId: item.id })}>
          <View style={styles.brandLogoBox}><Text style={styles.brandLogoPlaceholder}>{(item.business_name || '?').slice(0, 2).toUpperCase()}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.brandName}>{item.business_name}</Text>
            <Text style={styles.brandMeta}>{summary(item)}</Text>
          </View>
          <Text style={[styles.reqStatus, item.status === 'agreed' && { color: '#047857' }]}>{item.status.toUpperCase()}</Text>
        </TouchableOpacity>
      )}
      ListHeaderComponent={
        <TouchableOpacity style={styles.prefRow} onPress={() => navigation.navigate('CollabPreferences')}>
          <Text style={styles.prefTxt}>⚙ Who can ask me, and my minimums</Text>
        </TouchableOpacity>
      }
      ListEmptyComponent={
        <View style={{ alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 }}>
          <Text style={styles.emptyTitle}>No brand requests yet</Text>
          <Text style={styles.emptySub}>When a brand wants to work with you, their request lands here — money and timing are always negotiable.</Text>
        </View>
      }
    />
  );
}

function DiscoverTab({ navigation }) {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  // collab-part6 §6.2 — facets come from the server so a filter that would return
  // nothing is never offered.
  const [facets, setFacets] = useState({ categories: [], cities: [] });
  const [category, setCategory] = useState(null);
  const [city, setCity] = useState(null);

  const load = useCallback(async () => {
    const res = await influencerApi.discoverBrands(search.trim() || null, category, city);
    if (res.success) {
      setBrands(res.data?.brands || []);
      if (res.data?.facets) setFacets(res.data.facets);
    }
    setLoading(false);
    setRefreshing(false);
  }, [search, category, city]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={P.yellow} /></View>;

  return (
    <FlatList
      data={brands}
      keyExtractor={b => b.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[P.yellow]} />}
      ListHeaderComponent={
        <View>
          <View style={styles.toolbar}>
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search brands…"
              placeholderTextColor={P.muted3}
            />
          </View>
          {(facets.categories.length > 0 || facets.cities.length > 0) && (
            <View style={styles.filterWrap}>
              {facets.categories.map(cat => (
                <TouchableOpacity key={`c-${cat}`}
                  style={[styles.fchip, category === cat && styles.fchipOn]}
                  onPress={() => setCategory(category === cat ? null : cat)}>
                  <Text style={[styles.fchipTxt, category === cat && styles.fchipTxtOn]}>
                    {cat}{category === cat ? '  ✕' : ''}
                  </Text>
                </TouchableOpacity>
              ))}
              {facets.cities.map(ct => (
                <TouchableOpacity key={`t-${ct}`}
                  style={[styles.fchip, city === ct && styles.fchipOn]}
                  onPress={() => setCity(city === ct ? null : ct)}>
                  <Text style={[styles.fchipTxt, city === ct && styles.fchipTxtOn]}>
                    {ct}{city === ct ? '  ✕' : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={styles.discoverIntro}>
            <Text style={styles.discoverTitle}>Pitch a brand</Text>
            <Text style={styles.discoverBody}>
              These brands accept influencer proposals. Tap one to see their criteria and send a pitch. You can have up to 5 active proposals at once.
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
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.brandName} numberOfLines={1}>{b.business_name}</Text>
            <Text style={styles.brandMeta} numberOfLines={1}>
              {(b.category || '—').toUpperCase()}{b.brand_city ? ` · ${b.brand_city.toUpperCase()}` : ''}
            </Text>
          </View>
          <Icon name="chevron-right" size={14} color={P.muted3} />
        </TouchableOpacity>
      )}
      ListEmptyComponent={
        <View style={styles.empty}>
          <View style={styles.emptyTile}>
            <Text style={{ fontSize: 30 }}>🔍</Text>
          </View>
          <Text style={styles.emptyTitle}>No brands accepting proposals</Text>
          <Text style={styles.emptySub}>Check back later — brands turn this on as they're ready for pitches.</Text>
        </View>
      }
      contentContainerStyle={{ paddingBottom: 40 }}
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

  if (loading) return <View style={styles.center}><ActivityIndicator color={P.yellow} /></View>;

  return (
    <FlatList
      data={proposals}
      keyExtractor={p => p.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[P.yellow]} />}
      renderItem={({ item: p }) => {
        const canWithdraw = ['sent', 'viewed', 'countered'].includes(p.status);
        return (
          <View style={styles.proposalCard}>
            <View style={styles.proposalHead}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.proposalTitle} numberOfLines={1}>{p.pitch_title}</Text>
                <Text style={styles.proposalBrand} numberOfLines={1}>TO: {(p.brand_name || '').toUpperCase()}</Text>
              </View>
              {/* 'sent' renders inline (sender-POV); other 6 use canonical StatusPill */}
              {p.status === 'sent' ? (
                <View style={styles.sentPill}>
                  <Text style={styles.sentPillText}>SENT</Text>
                </View>
              ) : (
                <StatusPill status={p.status} />
              )}
            </View>

            <Text style={styles.proposalMsg} numberOfLines={3}>{p.pitch_message}</Text>

            <View style={styles.proposalFoot}>
              {p.proposed_fee ? <Text style={styles.proposalAsk}>{fmtRupees(p.proposed_fee)}</Text> : null}
              {p.proposed_commission_pct ? <Text style={styles.proposalAsk}>{p.proposed_commission_pct}% COMMISSION</Text> : null}
              <Text style={styles.proposalDate}>{fmtDate(p.created_at)}</Text>
            </View>

            {p.status === 'rejected' && p.brand_response_message && (
              <View style={styles.rejectBox}>
                <Text style={styles.rejectLabel}>REASON FROM BRAND</Text>
                <Text style={styles.rejectMsg}>{p.brand_response_message}</Text>
              </View>
            )}

            {p.status === 'countered' && (
              <View style={styles.counterBox}>
                <Text style={styles.counterLabel}>BRAND SENT A COUNTER</Text>
                {p.brand_response_message && <Text style={styles.counterMsg}>{p.brand_response_message}</Text>}
                {p.counter_terms && (
                  <View style={{ marginTop: 6 }}>
                    {p.counter_terms.proposed_fee && <Text style={styles.counterTerm}>FEE: {fmtRupees(p.counter_terms.proposed_fee)}</Text>}
                    {p.counter_terms.proposed_commission_pct && <Text style={styles.counterTerm}>COMMISSION: {p.counter_terms.proposed_commission_pct}%</Text>}
                  </View>
                )}
                <View style={styles.counterActions}>
                  <TouchableOpacity style={styles.counterBtnAlt} onPress={() => respondCounter(p, 'decline')}>
                    <Text style={styles.counterBtnAltTxt}>DECLINE</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.counterBtnPrimary} onPress={() => respondCounter(p, 'accept')}>
                    <Text style={styles.counterBtnPrimaryTxt}>ACCEPT COUNTER</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {canWithdraw && (
              <TouchableOpacity onPress={() => withdraw(p)} style={styles.withdrawLink}>
                <Text style={styles.withdrawText}>WITHDRAW</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      }}
      ListEmptyComponent={
        <View style={styles.empty}>
          <View style={styles.emptyTile}>
            <Text style={{ fontSize: 30 }}>📨</Text>
          </View>
          <Text style={styles.emptyTitle}>No proposals yet</Text>
          <Text style={styles.emptySub}>Browse brands in the Discover tab and send your first pitch.</Text>
        </View>
      }
      contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
    />
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: P.bg },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingTop: 50, paddingBottom: 14,
    backgroundColor: P.white, borderBottomWidth: 1, borderBottomColor: P.border,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: P.bg2, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800', color: P.ink, fontFamily: fonts.displayBlack },

  tabs: {
    flexDirection: 'row', backgroundColor: P.white,
    paddingHorizontal: 18,
    borderBottomWidth: 1, borderBottomColor: P.border,
  },
  tab: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: P.yellow },
  tabLabel: { fontSize: 12.5, fontWeight: '800', color: P.muted2, letterSpacing: 0.2, fontFamily: fonts.displayBold },
  tabLabelActive: { color: P.ink, fontWeight: '900', fontFamily: fonts.displayBlack },

  // Discover
  toolbar: { paddingHorizontal: 14, paddingTop: 13 },
  searchInput: {
    backgroundColor: P.white, borderRadius: 10,
    borderWidth: 1, borderColor: P.border,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 12, color: P.ink, fontFamily: fonts.sansRegular,
  },

  discoverIntro: { paddingHorizontal: 14, paddingTop: 13, paddingBottom: 8 },
  discoverTitle: { fontSize: 13, fontWeight: '800', color: P.ink, marginBottom: 4, fontFamily: fonts.displayBold },
  discoverBody: { fontSize: 11, color: P.muted, lineHeight: 16, fontFamily: fonts.sansRegular },

  brandCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 13,
    backgroundColor: P.white, borderRadius: 11,
    borderWidth: 1, borderColor: P.border,
    marginHorizontal: 14, marginBottom: 7,
  },
  brandLogoBox: {
    width: 44, height: 44, borderRadius: 11,
    backgroundColor: P.yellow,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  brandLogo: { width: '100%', height: '100%' },
  brandLogoPlaceholder: { fontSize: 13, fontWeight: '900', color: P.ink, fontFamily: fonts.displayBlack },
  brandName: { fontSize: 13.5, fontWeight: '800', color: P.ink, fontFamily: fonts.displayBold },
  brandMeta: { fontSize: 10, color: P.muted2, marginTop: 2, fontWeight: '700', letterSpacing: 0.2, fontFamily: fonts.monoMedium },

  // Proposal card
  proposalCard: {
    backgroundColor: P.white, borderRadius: 12,
    borderWidth: 1, borderColor: P.border,
    padding: 14, marginBottom: 8,
  },
  proposalHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 7 },
  proposalTitle: { fontSize: 13.5, fontWeight: '800', color: P.ink, fontFamily: fonts.displayBold },
  proposalBrand: { fontSize: 10.5, color: P.muted2, marginTop: 2, fontWeight: '700', letterSpacing: 0.2, fontFamily: fonts.monoMedium },

  // Inline 'SENT' pill (sender-POV per design call #3)
  sentPill: {
    backgroundColor: P.yellowPale,
    paddingHorizontal: 9, paddingVertical: 3,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  sentPillText: {
    fontSize: 9.5, fontWeight: '800', color: P.yellowText,
    textTransform: 'uppercase', letterSpacing: 0.3, fontFamily: fonts.monoBold,
  },

  proposalMsg: { fontSize: 11.5, color: P.muted, lineHeight: 17, marginBottom: 9, fontFamily: fonts.sansRegular },
  proposalFoot: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 9,
    borderTopWidth: 1, borderTopColor: P.borderSoft,
    flexWrap: 'wrap', gap: 6,
  },
  proposalAsk: { fontSize: 11.5, fontWeight: '900', color: P.ink, fontFamily: fonts.monoBold },
  proposalDate: { fontSize: 9.5, color: P.muted2, fontWeight: '700', letterSpacing: 0.2, marginLeft: 'auto', fontFamily: fonts.monoMedium },

  // Reject box — dangerPale
  rejectBox: {
    marginTop: 10, padding: 11,
    backgroundColor: P.dangerPale, borderRadius: 10,
    borderWidth: 1, borderColor: '#F8D0C2',
  },
  rejectLabel: {
    fontSize: 9.5, fontWeight: '800', color: P.dangerText,
    textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4,
    fontFamily: fonts.monoBold,
  },
  rejectMsg: { fontSize: 11.5, color: P.ink, lineHeight: 17, fontFamily: fonts.sansRegular },

  // Counter box — convPale (canonical conv for negotiation/counter)
  counterBox: {
    marginTop: 10, padding: 11,
    backgroundColor: P.convPale, borderRadius: 10,
    borderWidth: 1, borderColor: '#DECDF0',
  },
  counterLabel: {
    fontSize: 10, fontWeight: '900', color: P.conv,
    textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 5,
    fontFamily: fonts.displayBlack,
  },
  counterMsg: { fontSize: 11.5, color: P.ink, lineHeight: 17, marginBottom: 6, fontFamily: fonts.sansRegular },
  counterTerm: { fontSize: 11, fontWeight: '800', color: P.ink, marginBottom: 2, letterSpacing: 0.2, fontFamily: fonts.monoBold },
  counterActions: { flexDirection: 'row', gap: 8, marginTop: 9 },
  counterBtnAlt: {
    flex: 1, backgroundColor: P.white,
    borderWidth: 1.5, borderColor: P.ink,
    paddingVertical: 9, borderRadius: 9, alignItems: 'center',
  },
  counterBtnAltTxt: { fontSize: 11.5, fontWeight: '800', color: P.ink, textTransform: 'uppercase', letterSpacing: 0.3, fontFamily: fonts.displayBold },
  counterBtnPrimary: { flex: 1, backgroundColor: P.ink, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  counterBtnPrimaryTxt: { fontSize: 11.5, fontWeight: '900', color: P.yellow, textTransform: 'uppercase', letterSpacing: 0.3, fontFamily: fonts.displayBlack },

  // Withdraw link
  withdrawLink: { paddingVertical: 7, alignSelf: 'flex-start', marginTop: 4 },
  withdrawText: {
    fontSize: 10, color: P.dangerText, fontWeight: '800',
    textTransform: 'uppercase', letterSpacing: 0.3,
    borderBottomWidth: 1, borderStyle: 'dashed', borderBottomColor: P.dangerText,
    fontFamily: fonts.monoBold,
  },

  // Empty state
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 28 },
  emptyTile: {
    width: 66, height: 66, borderRadius: 14,
    backgroundColor: P.yellowPale,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: P.yellow,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  reqStatus: { fontFamily: fonts.monoBold, fontSize: 8.5, color: P.muted2, letterSpacing: 0.4 },
  prefRow: { backgroundColor: P.bg2, borderRadius: 10, padding: 11, marginHorizontal: 14, marginBottom: 10 },
  prefTxt: { fontFamily: fonts.sansBold, fontSize: 11.5, color: P.muted },
  filterWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 14, marginBottom: 4 },
  fchip: { backgroundColor: P.white, borderWidth: 1, borderColor: P.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  fchipOn: { backgroundColor: P.ink, borderColor: P.ink },
  fchipTxt: { fontSize: 10.5, fontWeight: '700', color: P.muted, fontFamily: fonts.sansBold },
  fchipTxtOn: { color: P.yellow },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: P.ink, marginBottom: 6, fontFamily: fonts.displayBold },
  emptySub: { fontSize: 11.5, color: P.muted, textAlign: 'center', lineHeight: 17, fontFamily: fonts.sansRegular },
});
