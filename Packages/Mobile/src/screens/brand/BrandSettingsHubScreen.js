import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, Alert, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { brandPalette as P, fonts, fmtMoney } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { API_BASE_URL } from '../../config/api';
import { openWebDashboard } from '../../utils/openWebDashboard';

/**
 * Settings hub — mobile mirror of brand-web /dashboard/settings/{subscription,
 * billing,payouts}: current plan + usage, invoice list (PDF opens in browser
 * with a download token), payout account status/connect. Plan UPGRADES link
 * out to web in v1 (Razorpay mandate checkout needs the native SDK — phase 2).
 * Contract: features/brand-mobile-parity-pack.
 */

const SUB_PILL = {
  active:    { bg: P.successPale, fg: P.successText },
  past_due:  { bg: P.dangerPale,  fg: P.dangerText },
  cancelled: { bg: P.bg2,         fg: P.muted },
  pending_mandate: { bg: P.warnPale, fg: P.warnText },
};
const INV_PILL = {
  paid:    { bg: P.successPale, fg: P.successText },
  pending: { bg: P.warnPale,  fg: P.warnText },
  failed:  { bg: P.dangerPale,  fg: P.dangerText },
};
const PAYOUT_LABEL = {
  activated: { label: 'Connected & active', pill: { bg: P.successPale, fg: P.successText } },
  created:   { label: 'Being verified by Razorpay', pill: { bg: P.warnPale, fg: P.warnText } },
  needs_clarification: { label: 'Razorpay needs more details', pill: { bg: P.dangerPale, fg: P.dangerText } },
  suspended: { label: 'Suspended', pill: { bg: P.dangerPale, fg: P.dangerText } },
};

export default function BrandSettingsHubScreen({ navigation }) {
  const [sub, setSub]           = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [payout, setPayout]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing]     = useState(false);

  async function load() {
    const [sr, ir, pr] = await Promise.all([
      brandApi.getSubscription(), brandApi.listInvoices(), brandApi.getPayoutAccount(),
    ]);
    if (sr?.success) setSub(sr.data || null);
    if (ir?.success) setInvoices(ir.data?.invoices || []);
    if (pr?.success) setPayout(pr.data || null);
    setLoading(false); setRefreshing(false);
  }
  useFocusEffect(useCallback(() => { setLoading(true); load(); }, []));

  async function openInvoicePdf(id) {
    const token = await AsyncStorage.getItem('inflx_token');
    const url = `${API_BASE_URL}/brands/me/billing/invoices/${id}/pdf?download_token=${encodeURIComponent(token || '')}`;
    Linking.openURL(url).catch(() => Alert.alert('Could not open invoice'));
  }

  async function connectPayout() {
    setActing(true);
    const res = await brandApi.createPayoutAccount();
    setActing(false);
    if (res?.success) load();
    else Alert.alert('Could not connect', res?.error?.message || 'Add your bank details in Wallet first, then retry.');
  }

  if (loading) return <View style={{ flex: 1, backgroundColor: P.bg, justifyContent: 'center' }}><ActivityIndicator size="large" color={P.ink} /></View>;

  const subscription = sub?.subscription || {};
  const tier  = sub?.tier || {};
  const usage = sub?.usage || {};
  const subPill = SUB_PILL[subscription.status] || SUB_PILL.active;
  const payoutInfo = PAYOUT_LABEL[payout?.linked_account_status] || null;

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <View style={s.header}>
        <TouchableOpacity style={s.back} onPress={() => navigation.goBack()}>
          <Text style={s.backText}>← BACK</Text>
        </TouchableOpacity>
        <Text style={s.title}>Plan & billing</Text>
        <Text style={s.subtitle}>Subscription, invoices and payout account</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={P.ink} />}
      >
        {/* ── Subscription ── */}
        <Text style={s.section}>SUBSCRIPTION</Text>
        <View style={s.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={s.planName}>{(tier.name || subscription.tier_key || 'Free').toUpperCase()}</Text>
            <View style={[s.pill, { backgroundColor: subPill.bg }]}>
              <Text style={[s.pillTxt, { color: subPill.fg }]}>{String(subscription.status || 'active').toUpperCase()}</Text>
            </View>
          </View>
          {!!subscription.billing_period && (
            <Text style={s.meta}>{subscription.billing_period} · cycle {fmtDate(subscription.current_cycle_start)} → {fmtDate(subscription.current_cycle_end)}</Text>
          )}
          {!!subscription.next_charge_at && <Text style={s.meta}>Next charge: {fmtDate(subscription.next_charge_at)}</Text>}

          {(usage.campaigns != null || usage.products != null) && (
            <View style={{ marginTop: 10 }}>
              <UsageBar label="Campaigns" used={usage.campaigns} max={tier.max_campaigns} />
              <UsageBar label="Products" used={usage.products} max={tier.max_products} />
              <UsageBar label="Creator invites this cycle" used={usage.influencer_invites_this_cycle} max={tier.max_influencers_per_cycle} />
            </View>
          )}

          <TouchableOpacity style={s.btnFill} onPress={() => openWebDashboard('/dashboard/settings/subscription')}>
            <Text style={s.btnFillTxt}>Change plan (opens web) ↗</Text>
          </TouchableOpacity>
        </View>

        {/* ── Invoices ── */}
        <Text style={s.section}>INVOICES</Text>
        <View style={s.card}>
          {invoices.length === 0 ? (
            <Text style={s.emptyLine}>No invoices yet — they appear after your first paid cycle.</Text>
          ) : invoices.slice(0, 12).map(inv => {
            const pill = INV_PILL[inv.status] || INV_PILL.pending;
            return (
              <TouchableOpacity key={inv.id} style={s.invRow}
                disabled={inv.status !== 'paid'} onPress={() => openInvoicePdf(inv.id)}>
                <View style={{ flex: 1 }}>
                  <Text style={s.invTier}>{String(inv.tier_key || '').toUpperCase()} · {fmtDate(inv.period_start)} → {fmtDate(inv.period_end)}</Text>
                  <Text style={s.meta}>{fmtMoney(inv.total_inr ?? (Number(inv.amount_inr || 0) + Number(inv.gst_amount_inr || 0)))} incl. GST</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 3 }}>
                  <View style={[s.pill, { backgroundColor: pill.bg }]}>
                    <Text style={[s.pillTxt, { color: pill.fg }]}>{String(inv.status || '').toUpperCase()}</Text>
                  </View>
                  {inv.status === 'paid' && <Text style={s.pdfLink}>PDF ↗</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Payout account ── */}
        <Text style={s.section}>PAYOUT ACCOUNT</Text>
        <View style={s.card}>
          {payoutInfo ? (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={s.planName}>{payoutInfo.label}</Text>
                <View style={[s.pill, { backgroundColor: payoutInfo.pill.bg }]}>
                  <Text style={[s.pillTxt, { color: payoutInfo.pill.fg }]}>{String(payout.linked_account_status).toUpperCase()}</Text>
                </View>
              </View>
              {!!payout.bank_last4 && <Text style={s.meta}>Bank •••• {payout.bank_last4}{payout.bank_ifsc ? ` · ${payout.bank_ifsc}` : ''}</Text>}
              {!!payout.linked_account_id && <Text style={[s.meta, { fontFamily: fonts.monoMedium }]}>{payout.linked_account_id}</Text>}
            </>
          ) : payout?.has_bank_details ? (
            <>
              <Text style={s.meta}>Your bank details are saved. Connect your payout account so customer payments settle straight to your bank.</Text>
              <TouchableOpacity style={s.btnFill} disabled={acting} onPress={connectPayout}>
                <Text style={s.btnFillTxt}>{acting ? 'Connecting…' : 'Connect payout account'}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={s.meta}>Add your bank account first — it takes a minute in Wallet.</Text>
              <TouchableOpacity style={s.btnGhost} onPress={() => navigation.navigate('Wallet')}>
                <Text style={s.btnGhostTxt}>Go to Wallet → bank details</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

      </ScrollView>
    </View>
  );
}

function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }); }
  catch { return String(d).slice(0, 10); }
}

function UsageBar({ label, used, max }) {
  if (used == null) return null;
  const unlimited = max == null || Number(max) <= 0;
  const pct = unlimited ? 0 : Math.min(100, Math.round((Number(used) / Number(max)) * 100));
  return (
    <View style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={s.usageLbl}>{label}</Text>
        <Text style={s.usageVal}>{used}{unlimited ? '' : ` / ${max}`}</Text>
      </View>
      {!unlimited && (
        <View style={s.track}><View style={[s.fill, { width: `${pct}%` }, pct >= 90 && { backgroundColor: P.danger }]} /></View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header:    { backgroundColor: P.white, paddingHorizontal: 18, paddingTop: 52, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.border },
  back:      { paddingBottom: 6 },
  backText:  { fontFamily: fonts.sansMedium, fontSize: 11.5, fontWeight: '600', color: P.muted2 },
  title:     { fontFamily: fonts.displayBold, fontSize: 22, fontWeight: '700', color: P.ink, letterSpacing: -0.3 },
  subtitle:  { fontFamily: fonts.sansMedium, fontSize: 11, color: P.muted2, marginTop: 6 },
  section:   { fontSize: 10.5, fontWeight: '800', color: P.muted2, letterSpacing: 0.6, marginTop: 14, marginBottom: 6, paddingHorizontal: 2 },
  card:      { backgroundColor: P.white, borderWidth: 1, borderColor: P.border, borderRadius: 12, padding: 14 },
  planName:  { fontSize: 15, fontWeight: '800', color: P.ink },
  meta:      { fontSize: 12, color: P.muted2, marginTop: 4 },
  pill:      { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  pillTxt:   { fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
  usageLbl:  { fontSize: 11.5, color: P.muted },
  usageVal:  { fontSize: 11.5, fontWeight: '700', color: P.ink2 },
  track:     { height: 5, backgroundColor: P.bg2, borderRadius: 3, marginTop: 3 },
  fill:      { height: 5, backgroundColor: P.ink, borderRadius: 3 },
  btnFill:   { backgroundColor: P.ink, borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginTop: 12 },
  btnFillTxt:{ fontSize: 13, fontWeight: '800', color: P.white},
  btnGhost:  { backgroundColor: P.white, borderWidth: 1, borderColor: P.border, borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginTop: 12 },
  btnGhostTxt:{ fontSize: 13, fontWeight: '700', color: P.ink2 },
  invRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: P.borderSoft },
  invTier:   { fontSize: 12.5, fontWeight: '700', color: P.ink },
  pdfLink:   { fontSize: 11, fontWeight: '700', color: P.ink },
  emptyLine: { fontSize: 12.5, color: P.muted3 },
});
