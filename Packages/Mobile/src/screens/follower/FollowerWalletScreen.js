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

import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { lightColors, fonts } from '../../theme/tokens';
import { CreatorChip } from '../../components/restaurant';

export default function FollowerWalletScreen({ navigation }) {
  // Placeholder data — replace with API call once backend lands.
  const wallet = {
    balance:  0,
    pending:  0,
    lifetime: 0,
    transactions: [],
  };

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

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
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
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.txTitle} numberOfLines={1}>
                    Cashback from {t.brand_name}
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
                  { color: t.status === 'pending' ? lightColors.muted : lightColors.success },
                ]}>
                  + ₹{Math.round(t.amount)}
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
  root: { flex: 1, backgroundColor: lightColors.bg },

  appbar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 8,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: lightColors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnGlyph: { fontSize: 16, color: lightColors.ink },
  appbarTitle: {
    flex: 1, textAlign: 'center',
    fontFamily: fonts.displayBold, fontSize: 17,
    color: lightColors.ink, letterSpacing: -0.2,
  },

  balanceCard: {
    marginHorizontal: 16, marginTop: 10,
    backgroundColor: lightColors.ink,
    borderRadius: 16, padding: 20,
  },
  balanceLabel: {
    fontFamily: fonts.monoBold, fontSize: 10,
    color: lightColors.yellow, letterSpacing: 0.6,
  },
  balanceBig: {
    fontFamily: fonts.displayBlack, fontSize: 40,
    color: lightColors.white, letterSpacing: -1, marginTop: 8,
  },
  balanceBreakdown: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 18, paddingTop: 14,
    borderTopColor: 'rgba(255,255,255,0.12)', borderTopWidth: 1,
  },
  balanceCol: { flex: 1 },
  balanceColValue: {
    fontFamily: fonts.monoBold, fontSize: 15, color: lightColors.white,
  },
  balanceColLabel: {
    fontFamily: fonts.monoMedium, fontSize: 9,
    color: lightColors.yellow100, marginTop: 4, letterSpacing: 0.5,
  },
  balanceColDivider: {
    width: 1, height: 32,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: 16,
  },

  sectionH: { paddingHorizontal: 16, marginTop: 22, marginBottom: 10 },
  sectionTitle: {
    fontFamily: fonts.displayBold, fontSize: 17,
    color: lightColors.ink, letterSpacing: -0.3,
  },

  empty: {
    marginHorizontal: 16, paddingHorizontal: 18, paddingVertical: 28,
    alignItems: 'center', backgroundColor: lightColors.paper,
    borderColor: lightColors.border, borderWidth: 1,
    borderStyle: 'dashed', borderRadius: 14,
  },
  emptyEmoji: { fontSize: 42, marginBottom: 8 },
  emptyTitle: {
    fontFamily: fonts.displayBold, fontSize: 17,
    color: lightColors.ink, letterSpacing: -0.2,
  },
  emptyBody: {
    fontFamily: fonts.sansMedium, fontSize: 12,
    color: lightColors.muted, textAlign: 'center',
    marginTop: 6, lineHeight: 17,
  },
  emptyBtn: {
    marginTop: 14, backgroundColor: lightColors.yellow,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8,
  },
  emptyBtnText: {
    fontFamily: fonts.sansBold, fontSize: 12, color: lightColors.ink,
  },

  section: { paddingHorizontal: 16 },
  txRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12,
    borderBottomColor: lightColors.border, borderBottomWidth: 1,
  },
  txTitle: { fontFamily: fonts.sansBold, fontSize: 13, color: lightColors.ink },
  txMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  txDate: { fontFamily: fonts.monoMedium, fontSize: 10, color: lightColors.muted },
  txAmount: { fontFamily: fonts.monoBold, fontSize: 14 },

  howCard: {
    marginHorizontal: 16, marginTop: 22,
    backgroundColor: lightColors.surface,
    borderRadius: 12, padding: 16,
  },
  howTitle: {
    fontFamily: fonts.displayBold, fontSize: 14,
    color: lightColors.ink, marginBottom: 10, letterSpacing: -0.1,
  },
  howRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginBottom: 10, gap: 10,
  },
  howNum: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: lightColors.yellow,
    color: lightColors.ink, textAlign: 'center',
    fontFamily: fonts.displayBlack, fontSize: 11,
    lineHeight: 22,
  },
  howText: {
    flex: 1, fontFamily: fonts.sansMedium,
    fontSize: 12, color: lightColors.ink2, lineHeight: 17,
  },
});
