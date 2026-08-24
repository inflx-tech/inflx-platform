import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, TextInput, Alert, Linking, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { brandPalette as P, fonts, fmtMoney, fmtRupees } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import StatusPill from '../../components/brand/StatusPill';

/**
 * EarningsScreen — withdraw hub with TDS-10% client-side preview.
 *
 * Flow 34 restyle (2026-05-27): brandPalette + Outfit/Plus Jakarta Sans/
 * JetBrains Mono fonts + StatusPill canonical (replaces StatusBadge).
 * White header with ink "Available to Withdraw" amount per design call #1.
 * MCI cellphone/bank method icons per design call #2 (replaces 📱/🏦).
 * TDS 10% client-side math preserved verbatim.
 */

export default function EarningsScreen() {
  const navigation = useNavigation();
  const [earnings, setEarnings] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [campaignEarnings, setCampaignEarnings] = useState([]);
  const [campaignLoading, setCampaignLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Withdrawal form
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('upi');
  const [withdrawing, setWithdrawing] = useState(false);

  async function load() {
    const [er, wr, cr] = await Promise.all([
      influencerApi.getEarnings(),
      influencerApi.getWithdrawals(),
      influencerApi.getCampaignEarnings(),
    ]);
    setLoading(false);
    setCampaignLoading(false);
    if (er.success) setEarnings(er.data);
    if (wr.success) setWithdrawals(wr.data?.withdrawals || wr.data || []);
    if (cr.success) setCampaignEarnings(cr.data?.campaigns || []);
  }

  useEffect(() => { load(); }, []);
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, []);

  async function handleWithdraw() {
    const amtRupees = parseFloat(amount);
    if (!amtRupees || amtRupees < 100) { Alert.alert('Minimum ₹100 withdrawal'); return; }
    setWithdrawing(true);
    // Backend accepts rupees.
    const res = await influencerApi.withdraw({ amount_requested: amtRupees, method });
    setWithdrawing(false);
    if (res.success) {
      Alert.alert('Withdrawal initiated', `Net amount: ${fmtMoney(res.data?.withdrawal?.net_paid)}`);
      setAmount('');
      load();
    } else {
      Alert.alert('Failed', res.error?.message || 'Withdrawal failed');
    }
  }

  // Client-side preview — rupees in, rupees out.
  const amtRupees = parseFloat(amount || '0');
  const tds = amtRupees ? parseFloat((amtRupees * 0.1).toFixed(2)) : 0;
  const net = amtRupees ? parseFloat((amtRupees - tds).toFixed(2)) : 0;

  function getGoalLabel(goal) {
    if (goal === 'engagement') return 'ENGAGEMENT';
    if (goal === 'conversion') return 'CONVERSION';
    if (goal === 'hybrid') return 'HYBRID';
    return (goal || '-').toUpperCase();
  }

  function getGoalStyle(goal) {
    if (goal === 'conversion') return { bg: P.convPale, fg: P.conv };
    return { bg: P.bg2, fg: P.ink };
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[P.ink]} />}
    >
      {/* Hero */}
      <View style={styles.headerCard}>
        <Text style={styles.heroLabel}>YOURS TO KEEP</Text>
        <Text style={styles.heroAmount}>{fmtRupees(earnings?.available_to_withdraw || earnings?.wallet_balance)}</Text>
        <View style={styles.heroMiniRow}>
          <View style={styles.heroMini}>
            <Text style={styles.heroMiniLabel}>IN RETURN WINDOW</Text>
            <Text style={styles.heroMiniVal}>{fmtRupees(earnings?.pending_balance)}</Text>
          </View>
          <View style={styles.heroMini}>
            <Text style={styles.heroMiniLabel}>TDS THIS FY</Text>
            <Text style={styles.heroMiniVal}>{fmtMoney(earnings?.tds_this_financial_year)}</Text>
          </View>
          <View style={styles.heroMini}>
            <Text style={styles.heroMiniLabel}>TOTAL EARNED</Text>
            <Text style={styles.heroMiniVal}>{fmtRupees(earnings?.total_earned)}</Text>
          </View>
        </View>
        {/* collab-phase1 — say WHY money is held. Read as "pending", a creator assumes it
            is arriving next week; when it does not, she stops trusting the number. */}
        <Text style={styles.heroNote}>
          Commission becomes yours 30 days after each sale, once it can no longer be returned.
        </Text>
      </View>

      {/* Refer & Earn entry (Contract 4) */}
      <TouchableOpacity style={styles.referTile} onPress={() => navigation.navigate('ReferAndEarn')} activeOpacity={0.85}>
        <Text style={styles.referEmoji}>🎁</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.referTitle}>Refer & Earn</Text>
          <Text style={styles.referSub}>Share your code — earn for 12 months</Text>
        </View>
        <Icon name="chevron-right" size={22} color={P.ink} />
      </TouchableOpacity>

      {/* Campaign Earnings */}
      <View style={styles.sectionMargin}>
        <Text style={styles.sectionTitle}>Campaign Earnings</Text>
        {campaignLoading ? (
          <ActivityIndicator size="small" color={P.ink} style={{ marginVertical: 16 }} />
        ) : campaignEarnings.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No campaign earnings yet</Text>
            <Text style={styles.emptySub}>Earnings from your campaigns will appear here</Text>
          </View>
        ) : (
          campaignEarnings.map(c => {
            const goalStyle = getGoalStyle(c.goal);
            return (
              <TouchableOpacity
                key={c.campaign_influencer_id}
                style={styles.campaignCard}
                onPress={() => navigation.navigate('CommissionDetail', { campaignInfluencerId: c.campaign_influencer_id, campaignName: c.campaign_name })}
                activeOpacity={0.7}
              >
                <View style={styles.campaignCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.campaignName} numberOfLines={1}>{c.campaign_name}</Text>
                    <Text style={styles.campaignBrand}>{(c.brand_name || '').toUpperCase()}</Text>
                  </View>
                  <View style={[styles.goalBadge, { backgroundColor: goalStyle.bg }]}>
                    <Text style={[styles.goalBadgeText, { color: goalStyle.fg }]}>{getGoalLabel(c.goal)}</Text>
                  </View>
                </View>

                <View style={styles.campaignStatsRow}>
                  <View style={styles.campaignStat}>
                    <Text style={styles.campaignStatLabel}>EARNED</Text>
                    <Text style={[styles.campaignStatVal, { color: P.successText }]}>{fmtRupees(Math.round(c.total_earned))}</Text>
                  </View>
                  <View style={styles.campaignStat}>
                    <Text style={styles.campaignStatLabel}>PENDING</Text>
                    <Text style={[styles.campaignStatVal, { color: P.warnText }]}>{fmtRupees(Math.round(c.total_pending))}</Text>
                  </View>
                  <View style={styles.campaignStat}>
                    <Text style={styles.campaignStatLabel}>TOTAL</Text>
                    <Text style={[styles.campaignStatVal, { color: P.ink }]}>{fmtRupees(Math.round(c.total_earned + c.total_pending))}</Text>
                  </View>
                </View>

                {/* Progress bar — success + amber */}
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { flex: c.total_earned || 0.001 }]} />
                  <View style={[styles.progressBarPending, { flex: c.total_pending || 0.001 }]} />
                </View>

                <View style={styles.campaignFooter}>
                  <Text style={styles.campaignFooterText}>
                    {c.tranche_count > 0 ? `${c.tranche_count} TRANCHES` : ''}
                    {c.tranche_count > 0 && c.commission_count > 0 ? ' + ' : ''}
                    {c.commission_count > 0 ? `${c.commission_count} COMMISSIONS` : ''}
                  </Text>
                  <Text style={styles.campaignChevron}>VIEW DETAILS ›</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {/* Withdrawal form */}
      <View style={styles.sectionMargin}>
        <Text style={styles.sectionTitle}>Withdraw Funds</Text>
        <View style={styles.methodRow}>
          {[
            { key: 'upi', icon: 'cellphone' },
            { key: 'bank', icon: 'bank-outline' },
          ].map(m => {
            const active = method === m.key;
            return (
              <TouchableOpacity key={m.key} onPress={() => setMethod(m.key)} style={[styles.methodCard, active && styles.methodCardActive]}>
                <Icon name={m.icon} size={20} color={active ? P.ink : P.ink} />
                <Text style={[styles.methodLabel, active && { color: P.white }]}>{m.key.toUpperCase()}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.inputWrap}>
          <Text style={styles.rupeeSign}>₹</Text>
          <TextInput
            style={styles.amountInput}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="1000"
            placeholderTextColor={P.muted3}
          />
        </View>

        {amount ? (
          <View style={styles.tdsCard}>
            <View style={styles.tdsRow}>
              <Text style={styles.tdsLabel}>Requested</Text>
              <Text style={styles.tdsVal}>{fmtMoney(parseFloat(amount))}</Text>
            </View>
            <View style={styles.tdsRow}>
              <Text style={styles.tdsLabel}>TDS (10%)</Text>
              <Text style={[styles.tdsVal, { color: P.dangerText }]}>- {fmtMoney(tds)}</Text>
            </View>
            <View style={[styles.tdsRow, styles.tdsRowTotal]}>
              <Text style={[styles.tdsLabel, styles.tdsLabelBold]}>You Receive</Text>
              <Text style={[styles.tdsVal, { color: P.successText, fontWeight: '900' }]}>{fmtMoney(net)}</Text>
            </View>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.withdrawBtn, (withdrawing || !amount) && styles.withdrawBtnDisabled]}
          onPress={handleWithdraw}
          disabled={withdrawing || !amount}
        >
          <Text style={styles.withdrawBtnText}>{withdrawing ? 'PROCESSING…' : 'WITHDRAW NOW'}</Text>
        </TouchableOpacity>
      </View>

      {/* TDS Certificate download */}
      <View style={styles.sectionMargin}>
        <Text style={styles.sectionTitle}>Tax Certificate</Text>
        <TouchableOpacity
          style={styles.tdsCertBtn}
          onPress={() => {
            const url = influencerApi.getTdsCertificateUrl();
            Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open TDS certificate link'));
          }}
        >
          <View style={styles.tdsCertIco}>
            <Icon name="file-document-outline" size={18} color={P.ink} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.tdsCertTitle}>Download TDS Certificate</Text>
            <Text style={styles.tdsCertSub}>FORM 16A · CURRENT FINANCIAL YEAR</Text>
          </View>
          <Icon name="chevron-right" size={16} color={P.muted3} />
        </TouchableOpacity>
      </View>

      {/* Withdrawal history */}
      {withdrawals.length > 0 && (
        <View style={styles.sectionMargin}>
          <Text style={styles.sectionTitle}>Withdrawal History</Text>
          {withdrawals.map(w => (
            <View key={w.withdrawal_id || w.id} style={styles.historyRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.historyAmt}>{fmtMoney(w.net_paid)}</Text>
                <Text style={styles.historySub}>REQUESTED: {fmtMoney(w.amount_requested)} · TDS: {fmtMoney(w.tds_deducted)}</Text>
                <Text style={styles.historySub}>{(w.method || '').toUpperCase()} · {new Date(w.created_at).toLocaleDateString('en-IN').toUpperCase()}</Text>
              </View>
              <StatusPill status={w.status} />
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.bg },
  // Refer & Earn entry tile (Contract 4)
  referTile: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: P.bg2, borderWidth: 1, borderColor: P.ink, borderRadius: 16, padding: 14, marginHorizontal: 16, marginTop: 14 },
  referEmoji: { fontSize: 26 },
  referTitle: { fontFamily: fonts.displayBold, fontSize: 15, color: P.ink },
  referSub: { fontFamily: fonts.sansRegular, fontSize: 12, color: P.ink, marginTop: 1 },

  // Hero
  headerCard: { backgroundColor: P.white, padding: 20, paddingTop: 50, paddingBottom: 22, position: 'relative', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.border },
  heroLabel: {
    fontSize: 10, color: P.muted2, fontWeight: '800',
    textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: fonts.monoBold,
  },
  heroAmount: {
    fontSize: 36, fontWeight: '900', color: P.ink, marginTop: 6,
    letterSpacing: -0.6, fontFamily: fonts.monoBold,
  },
  heroMiniRow: { flexDirection: 'row', gap: 18, marginTop: 14 },
  heroMini: { flexDirection: 'column' },
  heroMiniLabel: {
    fontSize: 9, color: P.muted2, marginBottom: 3,
    textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: '700',
    fontFamily: fonts.monoMedium,
  },
  heroMiniVal: { fontSize: 13, fontWeight: '800', color: P.muted2, fontFamily: fonts.monoBold },
  heroNote: {
    fontSize: 11, color: P.muted2, marginTop: 12, lineHeight: 16,
    fontFamily: fonts.monoMedium,
  },

  // Section
  sectionMargin: { margin: 14, marginBottom: 0, marginTop: 14 },
  sectionTitle: {
    fontSize: 12, fontWeight: '800', color: P.muted2,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
    fontFamily: fonts.displayBold,
  },

  // Empty
  emptyCard: {
    backgroundColor: P.white, borderRadius: 14, padding: 24,
    alignItems: 'center', borderWidth: 1, borderColor: P.border,
  },
  emptyText: { fontSize: 13.5, fontWeight: '800', color: P.muted, marginBottom: 4, fontFamily: fonts.displayBold },
  emptySub: { fontSize: 11.5, color: P.muted2, fontFamily: fonts.sansRegular },

  // Campaign card
  campaignCard: {
    backgroundColor: P.white, borderRadius: 14, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: P.border,
  },
  campaignCardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 11, gap: 8 },
  campaignName: { fontSize: 13.5, fontWeight: '800', color: P.ink, fontFamily: fonts.displayBold },
  campaignBrand: { fontSize: 10.5, color: P.muted2, marginTop: 2, fontWeight: '700', letterSpacing: 0.2, fontFamily: fonts.monoMedium },
  goalBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  goalBadgeText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3, fontFamily: fonts.monoBold },
  campaignStatsRow: { flexDirection: 'row', marginBottom: 10 },
  campaignStat: { flex: 1 },
  campaignStatLabel: {
    fontSize: 9.5, color: P.muted2, marginBottom: 2,
    textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: '700',
    fontFamily: fonts.monoMedium,
  },
  campaignStatVal: { fontSize: 13.5, fontWeight: '900', fontFamily: fonts.monoBold },
  progressBarBg: { flexDirection: 'row', height: 4, borderRadius: 2, backgroundColor: P.border, overflow: 'hidden', marginBottom: 9 },
  progressBarFill: { backgroundColor: P.success, borderRadius: 2 },
  progressBarPending: { backgroundColor: P.warn, borderRadius: 2 },
  campaignFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  campaignFooterText: { fontSize: 10, color: P.muted2, fontWeight: '700', letterSpacing: 0.2, fontFamily: fonts.monoMedium },
  campaignChevron: { fontSize: 10.5, fontWeight: '800', color: P.ink, letterSpacing: 0.2, fontFamily: fonts.monoBold },

  // Method
  methodRow: { flexDirection: 'row', gap: 9, marginBottom: 11 },
  methodCard: {
    flex: 1, backgroundColor: P.white, borderRadius: 11, padding: 14,
    alignItems: 'center', borderWidth: 1.5, borderColor: P.border,
    gap: 6,
  },
  methodCardActive: { backgroundColor: P.ink, borderColor: P.ink },
  methodLabel: {
    fontSize: 11, fontWeight: '800', color: P.muted,
    textTransform: 'uppercase', letterSpacing: 0.3, fontFamily: fonts.monoBold,
  },

  // Amount
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: P.white, borderRadius: 11,
    borderWidth: 1.5, borderColor: P.ink, marginBottom: 11, overflow: 'hidden',
  },
  rupeeSign: { paddingHorizontal: 12, fontSize: 18, fontWeight: '900', color: P.ink, fontFamily: fonts.displayBlack },
  amountInput: {
    flex: 1, paddingVertical: 14, paddingRight: 12,
    fontSize: 20, fontWeight: '900', color: P.ink, fontFamily: fonts.monoBold,
  },

  // TDS preview card — warnPale (state)
  tdsCard: {
    backgroundColor: P.warnPale, borderRadius: 11, padding: 12, marginBottom: 11,
    borderWidth: 1, borderColor: P.warn,
  },
  tdsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  tdsRowTotal: { borderTopWidth: 1, borderTopColor: P.warn, marginTop: 5, paddingTop: 8 },
  tdsLabel: { fontSize: 11.5, color: P.warnText, fontWeight: '600', fontFamily: fonts.sansRegular },
  tdsLabelBold: { fontWeight: '800', color: P.ink, fontFamily: fonts.displayBold },
  tdsVal: { fontSize: 12, fontWeight: '800', color: P.ink, fontFamily: fonts.monoBold },

  // Withdraw CTA
  withdrawBtn: { backgroundColor: P.ink, borderRadius: 11, paddingVertical: 14, alignItems: 'center' },
  withdrawBtnDisabled: { opacity: 0.5 },
  withdrawBtnText: {
    fontSize: 13.5, fontWeight: '900', color: P.white,
    letterSpacing: 0.2, textTransform: 'uppercase', fontFamily: fonts.displayBlack,
  },

  // TDS cert tile
  tdsCertBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: P.white, borderRadius: 14, padding: 13, gap: 11,
    borderWidth: 1, borderColor: P.border,
  },
  tdsCertIco: {
    width: 38, height: 38, borderRadius: 9,
    backgroundColor: P.warnPale,
    alignItems: 'center', justifyContent: 'center',
  },
  tdsCertTitle: { fontSize: 13, fontWeight: '800', color: P.ink, fontFamily: fonts.displayBold },
  tdsCertSub: { fontSize: 9.5, color: P.muted2, marginTop: 2, fontWeight: '700', letterSpacing: 0.2, fontFamily: fonts.monoMedium },

  // History row
  historyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: P.white, borderRadius: 11, padding: 12, marginBottom: 7,
    borderWidth: 1, borderColor: P.border,
  },
  historyAmt: { fontSize: 14, fontWeight: '900', color: P.ink, fontFamily: fonts.monoBold },
  historySub: { fontSize: 9.5, color: P.muted2, marginTop: 2, fontWeight: '700', letterSpacing: 0.2, fontFamily: fonts.monoMedium },
});
