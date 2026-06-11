import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { brandPalette as P, fonts, fmtMoney } from '../../theme/tokens';
import { brandApi, mealsApi } from '../../services/api';

/**
 * Meals board — mobile mirror of brand-web /dashboard/meals daily operations:
 * Today tab (orders + prep + deliver) and Offers tab (accept/reject/archive
 * offer rules, AI suggest). Offer CREATION by chat + menu costs + config stay
 * web-only in v1. Restaurant-category brands only (self-gated).
 * Contract: features/brand-mobile-parity-pack.
 */

const PARTY = [
  { key: 'all', label: 'All' },
  { key: 'single', label: 'Single' }, { key: 'duo', label: 'Duo' },
  { key: 'trio', label: 'Trio' }, { key: 'family', label: 'Family' }, { key: 'office', label: 'Office' },
];

const RULE_PILL = {
  suggested: { bg: P.infoPale,    fg: P.info,        label: 'SUGGESTED' },
  active:    { bg: P.successPale, fg: P.successText, label: 'ACTIVE' },
  rejected:  { bg: P.dangerPale,  fg: P.dangerText,  label: 'REJECTED' },
  archived:  { bg: P.bg2,         fg: P.muted,       label: 'ARCHIVED' },
};

export default function BrandMealsBoardScreen({ navigation }) {
  const [tab, setTab]               = useState('today');
  const [isRestaurant, setIsRestaurant] = useState(null);
  const [dash, setDash]             = useState(null);
  const [rules, setRules]           = useState([]);
  const [party, setParty]           = useState('all');
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing]         = useState(null);

  async function load() {
    const me = await brandApi.getMe();
    const cat = me?.data?.brand?.category || me?.data?.category;
    const ok = cat === 'restaurant';
    setIsRestaurant(ok);
    if (ok) {
      const [d, r] = await Promise.all([mealsApi.getDashboard(), mealsApi.getOfferRules()]);
      if (d?.success) setDash(d.data || null);
      if (r?.success) setRules(r.data?.offer_rules || []);
    }
    setLoading(false); setRefreshing(false);
  }

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, []));

  async function deliver(id) {
    setActing(id);
    const res = await mealsApi.deliverOrder(id);
    setActing(null);
    if (res?.success) load();
    else Alert.alert('Failed', res?.error?.message || 'Could not mark delivered.');
  }

  async function setRule(id, patch, confirmTitle) {
    const run = async () => {
      setActing(id);
      const res = await mealsApi.updateOfferRule(id, patch);
      setActing(null);
      if (res?.success) load();
      else Alert.alert('Failed', res?.error?.message || 'Could not update the offer.');
    };
    if (confirmTitle) Alert.alert(confirmTitle, undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Yes', onPress: run }]);
    else run();
  }

  async function suggest() {
    setActing('suggest');
    const res = await mealsApi.suggestOffers();
    setActing(null);
    if (res?.success) load();
    else Alert.alert('Failed', res?.error?.message || 'Could not generate suggestions.');
  }

  if (loading) return <View style={{ flex: 1, backgroundColor: P.bg, justifyContent: 'center' }}><ActivityIndicator size="large" color={P.yellow} /></View>;

  if (isRestaurant === false) {
    return (
      <View style={{ flex: 1, backgroundColor: P.bg }}>
        <Header navigation={navigation} subtitle="Restaurant daily operations" />
        <View style={s.empty}>
          <Text style={s.emptyIcon}>🍽️</Text>
          <Text style={s.emptyTitle}>For restaurants only</Text>
          <Text style={s.emptyText}>The Meals board is available to restaurant businesses. Your other tools live on Orders, Bookings and Offers.</Text>
        </View>
      </View>
    );
  }

  const visibleRules = rules.filter(r => (party === 'all' || r.party_size === party) && r.status !== 'archived');

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <Header navigation={navigation} subtitle="Today's meal orders + your meal deals" />

      <View style={s.tabs}>
        {[{ key: 'today', label: "Today's board" }, { key: 'offers', label: 'Meal deals' }].map(t => (
          <TouchableOpacity key={t.key} style={[s.tab, tab === t.key && s.tabOn]} onPress={() => setTab(t.key)}>
            <Text style={[s.tabTxt, tab === t.key && s.tabTxtOn]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 14, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={P.yellow} />}
      >
        {tab === 'today' ? (
          <>
            {dash?.stats && (
              <View style={s.statsRow}>
                <Stat label="Confirmed" value={dash.stats.confirmed ?? 0} />
                <Stat label="Capacity left" value={dash.stats.capacity_left ?? '—'} />
                <Stat label="Meals" value={dash.stats.meals ?? 0} />
                <Stat label="Revenue" value={fmtMoney(dash.stats.revenue || 0)} />
              </View>
            )}
            {(dash?.prep_summary || []).length > 0 && (
              <View style={s.prepCard}>
                <Text style={s.prepTitle}>PREP SUMMARY</Text>
                {dash.prep_summary.map((p, i) => (
                  <Text key={i} style={s.prepLine}>• {p.qty || p.count || ''} × {p.name || p.item || JSON.stringify(p)}</Text>
                ))}
              </View>
            )}
            {(dash?.orders || []).length === 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyIcon}>🧾</Text>
                <Text style={s.emptyTitle}>No meal orders yet today</Text>
                <Text style={s.emptyText}>Confirmed meal orders appear here as they come in.</Text>
              </View>
            ) : dash.orders.map(o => (
              <View key={o.id} style={s.card}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={s.cardName} numberOfLines={1}>{o.follower_name || o.customer_name || 'Customer'}</Text>
                  <Text style={s.cardAmt}>{fmtMoney(o.net_amount || o.amount || 0)}</Text>
                </View>
                <Text style={s.cardMeta} numberOfLines={2}>
                  {(o.items_summary || o.items_text || (Array.isArray(o.items) ? o.items.map(i => `${i.qty || 1}× ${i.name}`).join(', ') : '')) || o.offer_name || 'Meal order'}
                </Text>
                <Text style={s.cardMeta}>{(o.order_status || o.status || '').toUpperCase()}{o.delivery_area ? ` · ${o.delivery_area}` : ''}</Text>
                {['paid', 'preparing', 'out_for_delivery', 'confirmed'].includes(o.order_status || o.status) && (
                  <TouchableOpacity style={s.deliverBtn} disabled={acting === o.id} onPress={() => deliver(o.id)}>
                    <Text style={s.deliverTxt}>{acting === o.id ? 'Working…' : 'Mark delivered ✓'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 10 }}>
              {PARTY.map(pz => (
                <TouchableOpacity key={pz.key} style={[s.chip, party === pz.key && s.chipOn]} onPress={() => setParty(pz.key)}>
                  <Text style={[s.chipTxt, party === pz.key && s.chipTxtOn]}>{pz.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {visibleRules.length === 0 && (
              <View style={s.empty}>
                <Text style={s.emptyIcon}>🏷️</Text>
                <Text style={s.emptyTitle}>No meal deals yet</Text>
                <Text style={s.emptyText}>Generate AI suggestions below, or build custom deals on the web dashboard.</Text>
              </View>
            )}

            {visibleRules.map(r => {
              const pill = RULE_PILL[r.status] || RULE_PILL.suggested;
              return (
                <View key={r.id} style={s.card}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={s.cardName} numberOfLines={1}>{r.name}</Text>
                    <View style={[s.pill, { backgroundColor: pill.bg }]}>
                      <Text style={[s.pillTxt, { color: pill.fg }]}>{pill.label}</Text>
                    </View>
                  </View>
                  <Text style={s.cardMeta}>
                    {r.party_size ? `${r.party_size} · ` : ''}
                    {r.base_price != null ? `${fmtMoney(r.base_price)} · ` : ''}
                    {r.discount_type === 'pct' ? `${r.discount_value}% off` : r.discount_value != null ? `${fmtMoney(r.discount_value)} off` : ''}
                    {r.recommended ? ' · ★ recommended' : ''}
                  </Text>
                  {!!r.custom_description && <Text style={s.desc} numberOfLines={2}>{r.custom_description}</Text>}
                  <View style={s.actions}>
                    {r.status === 'suggested' && (
                      <>
                        <TouchableOpacity style={[s.btn, s.btnGhost]} disabled={acting === r.id}
                          onPress={() => setRule(r.id, { status: 'rejected', rejected_reason: 'owner rejected' })}>
                          <Text style={s.btnGhostTxt}>Reject</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[s.btn, s.btnFill]} disabled={acting === r.id}
                          onPress={() => setRule(r.id, { status: 'active' })}>
                          <Text style={s.btnFillTxt}>{acting === r.id ? 'Working…' : 'Make it live'}</Text>
                        </TouchableOpacity>
                      </>
                    )}
                    {r.status === 'active' && (
                      <TouchableOpacity style={[s.btn, s.btnGhost]} disabled={acting === r.id}
                        onPress={() => setRule(r.id, { status: 'archived' }, 'Remove this deal from your store?')}>
                        <Text style={s.btnGhostTxt}>Remove deal</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}

            <TouchableOpacity style={s.suggestBtn} disabled={acting === 'suggest'} onPress={suggest}>
              <Text style={s.suggestTxt}>{acting === 'suggest' ? 'Generating…' : '✨ Generate AI deal suggestions'}</Text>
            </TouchableOpacity>
            <Text style={s.webHint}>Building custom deals by chat, menu costs and delivery settings live on the web dashboard.</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Header({ navigation, subtitle }) {
  return (
    <View style={s.header}>
      <TouchableOpacity style={s.back} onPress={() => navigation.goBack()}>
        <Text style={s.backText}>← BACK</Text>
      </TouchableOpacity>
      <Text style={s.title}>Meals</Text>
      <View style={s.rule} />
      <Text style={s.subtitle}>{subtitle}</Text>
    </View>
  );
}

function Stat({ label, value }) {
  return (
    <View style={s.stat}>
      <Text style={s.statVal}>{value}</Text>
      <Text style={s.statLbl}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  header:    { backgroundColor: P.ink, paddingHorizontal: 18, paddingTop: 52, paddingBottom: 14 },
  back:      { paddingBottom: 6 },
  backText:  { fontFamily: fonts.sansMedium, fontSize: 11.5, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  title:     { fontFamily: fonts.displayBold, fontSize: 22, fontWeight: '700', color: P.white, letterSpacing: -0.3 },
  rule:      { width: 30, height: 3, backgroundColor: P.yellow, borderRadius: 2, marginTop: 6 },
  subtitle:  { fontFamily: fonts.sansMedium, fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 6 },
  tabs:      { flexDirection: 'row', margin: 14, marginBottom: 0, backgroundColor: P.bg2, borderRadius: 10, padding: 3 },
  tab:       { flex: 1, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  tabOn:     { backgroundColor: P.white },
  tabTxt:    { fontSize: 12.5, fontWeight: '600', color: P.muted2 },
  tabTxtOn:  { color: P.ink, fontWeight: '800' },
  statsRow:  { flexDirection: 'row', gap: 8, marginBottom: 12 },
  stat:      { flex: 1, backgroundColor: P.white, borderWidth: 1, borderColor: P.border, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  statVal:   { fontSize: 13.5, fontWeight: '800', color: P.ink },
  statLbl:   { fontSize: 9.5, color: P.muted2, marginTop: 1 },
  prepCard:  { backgroundColor: P.yellow50, borderWidth: 1, borderColor: P.yellowPale, borderRadius: 12, padding: 12, marginBottom: 12 },
  prepTitle: { fontSize: 10, fontWeight: '800', color: P.yellowText, letterSpacing: 0.5, marginBottom: 4 },
  prepLine:  { fontSize: 12.5, color: P.ink2, marginTop: 2 },
  card:      { backgroundColor: P.white, borderWidth: 1, borderColor: P.border, borderRadius: 12, padding: 14, marginBottom: 10 },
  cardName:  { fontSize: 14, fontWeight: '700', color: P.ink, flex: 1, marginRight: 8 },
  cardAmt:   { fontSize: 14, fontWeight: '800', color: P.ink },
  cardMeta:  { fontSize: 11.5, color: P.muted2, marginTop: 3 },
  desc:      { fontSize: 12, color: P.muted, marginTop: 4 },
  pill:      { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  pillTxt:   { fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
  actions:   { flexDirection: 'row', gap: 8, marginTop: 10 },
  btn:       { flex: 1, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  btnFill:   { backgroundColor: P.yellow },
  btnFillTxt:{ fontSize: 12.5, fontWeight: '800', color: P.ink },
  btnGhost:  { backgroundColor: P.white, borderWidth: 1, borderColor: P.border },
  btnGhostTxt:{ fontSize: 12.5, fontWeight: '700', color: P.dangerText },
  deliverBtn:{ backgroundColor: P.successPale, borderRadius: 10, paddingVertical: 9, alignItems: 'center', marginTop: 10 },
  deliverTxt:{ fontSize: 12.5, fontWeight: '800', color: P.successText },
  suggestBtn:{ backgroundColor: P.ink, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 6 },
  suggestTxt:{ fontSize: 13.5, fontWeight: '800', color: P.yellow },
  webHint:   { fontSize: 11, color: P.muted3, textAlign: 'center', marginTop: 10 },
  empty:     { alignItems: 'center', paddingTop: 50, paddingHorizontal: 30 },
  emptyIcon: { fontSize: 34, marginBottom: 10 },
  emptyTitle:{ fontSize: 15, fontWeight: '700', color: P.ink },
  emptyText: { fontSize: 12.5, color: P.muted2, textAlign: 'center', marginTop: 4 },
});
