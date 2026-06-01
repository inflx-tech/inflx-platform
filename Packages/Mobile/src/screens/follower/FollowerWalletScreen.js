/**
 * FollowerWalletScreen — Wave 4 PR 4.4 (mockup Flow 4.x wallet).
 *
 * New surface. Follower-side wallet is a scaffolded placeholder today
 * because the schema doesn't yet carry a follower wallet table. The
 * visual lives here so the redesign feels complete; data wires up when
 * the backend lands `/follower/wallet` + `follower_wallet_transactions`
 * (post Wave 4).
 *
 * Layout:
 *   - App bar
 *   - Balance card (big number) — defaults to ₹0
 *   - Earn breakdown row (lifetime · pending · available)
 *   - Transactions list (empty state for now)
 *   - "How does cashback work?" footer card
 *
 * Future wiring:
 *   - GET /follower/wallet            → { balance, pending, lifetime }
 *   - GET /follower/wallet/transactions → [{ amount, brand_name,
 *       influencer_handle, created_at, status }]
 */

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { creatorVibe as C, fonts } from '../../theme/tokens';

// Flow 52.D — Creator Vibe recolor shim. Visual only; wallet scaffold logic unchanged.
const P = {
  white: C.card, black: C.ink, bg: C.screenBg, bg2: C.soft,
  ink: C.ink, ink2: C.ink, muted: C.muted, muted2: C.muted, muted3: C.muted, muted4: C.line,
  border: C.line, borderSoft: C.line,
  yellow: C.brown, yellowHover: C.brownDark, yellowPale: C.soft, yellow50: C.soft, yellowText: C.brown,
  success: '#1E9E5A', successPale: C.soft, successText: '#1E9E5A',
  danger: C.offer, dangerPale: C.soft, dangerText: C.offer,
  conv: C.brown, convPale: C.soft, eng: C.verify, engPale: C.soft, hyb: C.brown, hybPale: C.soft, info: C.verify, infoPale: C.soft,
};
import { followerApi } from '../../services/api';
import { CreatorChip } from '../../components/restaurant';

export default function FollowerWalletScreen({ navigation }) {
  // Path C-2 — real wallet (reward balance derived from creator-attributed
  // transactions server-side; ledger for redeem/adjust).
  const [wallet, setWallet] = useState({
    balance: 0, pending: 0, lifetime: 0, transactions: [],
  });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [w, t] = await Promise.all([
        followerApi.getWallet().catch(() => null),
        followerApi.getWalletTransactions().catch(() => null),
      ]);
      const ww = (w?.data || w)?.wallet || {};
      const tx = (t?.data || t)?.transactions || [];
      setWallet({
        balance:  ww.available ?? 0,
        pending:  ww.pending ?? 0,
        lifetime: ww.lifetime ?? 0,
        transactions: tx.map(r => ({
          id: r.id,
          brand_name: r.brand_name || (r.kind === 'redeem' ? 'Redeemed' : r.kind === 'adjust' ? 'Adjustment' : 'Reward'),
          influencer_handle: r.influencer_handle,
          amount: r.amount,
          status: r.status,
          created_at: r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '',
          negative: r.kind === 'redeem',
        })),
      });
    } catch { /* keep zeros */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.appbar}>
        {navigation?.canGoBack?.() ? (
          <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn} hitSlop={6}>
            <Text style={styles.iconBtnGlyph}>←</Text>
          </Pressable>
        ) : <View style={{ width: 36 }} />}
        <Text style={styles.appbarTitle}>Wallet</Text>
        <View style={{ width: 36 }} />
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={P.ink} />}>
        {/* Balance card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>AVAILABLE BALANCE</Text>
          <Text style={styles.balanceBig}>₹ {wallet.balance.toLocaleString('en-IN')}</Text>
          <View style={styles.balanceBreakdown}>
            <View style={styles.balanceCol}>
              <Text style={styles.balanceColValue}>₹ {wallet.pending}</Text>
              <Text style={styles.balanceColLabel}>PENDING</Text>
            </View>
            <View style={styles.balanceColDivider} />
            <View style={styles.balanceCol}>
              <Text style={styles.balanceColValue}>₹ {wallet.lifetime}</Text>
              <Text style={styles.balanceColLabel}>LIFETIME</Text>
            </View>
          </View>
        </View>

        {/* Transactions */}
        <SectionH title="Recent activity" />
        {wallet.transactions.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>💰</Text>
            <Text style={styles.emptyTitle}>No rewards yet</Text>
            <Text style={styles.emptyBody}>
              Pay via INFLX at any partner brand — you'll earn cashback automatically.
              Show your creator's tracking code at the venue and INFLX credits the rewards here.
            </Text>
            <Pressable style={styles.emptyBtn}>
              <Text style={styles.emptyBtnText}>Browse partners →</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.section}>
            {wallet.transactions.map(t => (
              <View key={t.id} style={styles.txRow}>
                <View style={[styles.txIco, t.negative && styles.txIcoNeg]}>
                  <Icon name={t.negative ? 'arrow-up' : 'gift-outline'} size={19} color={t.negative ? P.muted : P.successText} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.txTitle} numberOfLines={1}>
                    {t.negative ? t.brand_name : `Cashback from ${t.brand_name}`}
                  </Text>
                  <View style={styles.txMeta}>
                    {t.influencer_handle && (
                      <CreatorChip handle={t.influencer_handle} verified size="sm" />
                    )}
                    <Text style={styles.txDate}>{t.created_at}</Text>
                  </View>
                </View>
                <Text style={[
                  styles.txAmount,
                  { color: t.negative ? P.muted : P.successText },
                ]}>
                  {t.negative ? '−' : '+'} ₹{Math.round(t.amount)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* How it works footer */}
        <View style={styles.howCard}>
          <Text style={styles.howTitle}>How rewards work</Text>
          <View style={styles.howRow}>
            <Text style={styles.howNum}>1</Text>
            <Text style={styles.howText}>
              Tap a creator's share link or scan their store — your visit gets tracked.
            </Text>
          </View>
          <View style={styles.howRow}>
            <Text style={styles.howNum}>2</Text>
            <Text style={styles.howText}>
              Pay via INFLX at the brand. The follower discount is auto-applied at the bill.
            </Text>
          </View>
          <View style={styles.howRow}>
            <Text style={styles.howNum}>3</Text>
            <Text style={styles.howText}>
              A portion comes back here as wallet rewards. Use it on your next visit.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function SectionH({ title }) {
  return (
    <View style={styles.sectionH}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.bg },

  appbar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 8,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: P.bg2,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnGlyph: { fontSize: 16, color: P.ink },
  appbarTitle: {
    flex: 1, textAlign: 'center',
    fontFamily: fonts.displayBold, fontSize: 17,
    color: P.ink, letterSpacing: -0.2,
  },

  balanceCard: {
    marginHorizontal: 16, marginTop: 10,
    backgroundColor: P.ink,
    borderRadius: 16, padding: 20,
  },
  balanceLabel: {
    fontFamily: fonts.monoBold, fontSize: 10,
    color: P.yellow, letterSpacing: 0.6,
  },
  balanceBig: {
    fontFamily: fonts.displayBlack, fontSize: 40,
    color: P.white, letterSpacing: -1, marginTop: 8,
  },
  balanceBreakdown: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 18, paddingTop: 14,
    borderTopColor: 'rgba(255,255,255,0.12)', borderTopWidth: 1,
  },
  balanceCol: { flex: 1 },
  balanceColValue: {
    fontFamily: fonts.monoBold, fontSize: 15, color: P.white,
  },
  balanceColLabel: {
    fontFamily: fonts.monoMedium, fontSize: 9,
    color: P.yellowPale, marginTop: 4, letterSpacing: 0.5,
  },
  balanceColDivider: {
    width: 1, height: 32,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: 16,
  },

  sectionH: { paddingHorizontal: 16, marginTop: 22, marginBottom: 10 },
  sectionTitle: {
    fontFamily: fonts.displayBold, fontSize: 17,
    color: P.ink, letterSpacing: -0.3,
  },

  empty: {
    marginHorizontal: 16, paddingHorizontal: 18, paddingVertical: 28,
    alignItems: 'center', backgroundColor: P.white,
    borderColor: P.border, borderWidth: 1,
    borderStyle: 'dashed', borderRadius: 14,
  },
  emptyEmoji: { fontSize: 42, marginBottom: 8 },
  emptyTitle: {
    fontFamily: fonts.displayBold, fontSize: 17,
    color: P.ink, letterSpacing: -0.2,
  },
  emptyBody: {
    fontFamily: fonts.sansMedium, fontSize: 12,
    color: P.muted, textAlign: 'center',
    marginTop: 6, lineHeight: 17,
  },
  emptyBtn: {
    marginTop: 14, backgroundColor: P.yellow,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8,
  },
  emptyBtnText: {
    fontFamily: fonts.sansBold, fontSize: 12, color: P.ink,
  },

  section: { paddingHorizontal: 16 },
  txRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12,
    borderBottomColor: P.border, borderBottomWidth: 1,
  },
  txIco: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: P.successPale,
    alignItems: 'center', justifyContent: 'center',
  },
  txIcoNeg: { backgroundColor: P.bg2 },
  txTitle: { fontFamily: fonts.sansBold, fontSize: 13, color: P.ink },
  txMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  txDate: { fontFamily: fonts.monoMedium, fontSize: 10, color: P.muted },
  txAmount: { fontFamily: fonts.monoBold, fontSize: 14 },

  howCard: {
    marginHorizontal: 16, marginTop: 22,
    backgroundColor: P.bg2,
    borderRadius: 12, padding: 16,
  },
  howTitle: {
    fontFamily: fonts.displayBold, fontSize: 14,
    color: P.ink, marginBottom: 10, letterSpacing: -0.1,
  },
  howRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginBottom: 10, gap: 10,
  },
  howNum: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: P.yellow,
    color: P.ink, textAlign: 'center',
    fontFamily: fonts.displayBlack, fontSize: 11,
    lineHeight: 22,
  },
  howText: {
    flex: 1, fontFamily: fonts.sansMedium,
    fontSize: 12, color: P.ink2, lineHeight: 17,
  },
});
