import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import { brandPalette as P, fonts, fmtMoney } from '../../theme/tokens';
import { influencerApi } from '../../services/api';

/**
 * TransactionFeedScreen — influencer sees all follower transactions (commissions earned).
 * Shows: who bought what, via which campaign, how much commission earned.
 *
 * Flow 34 restyle (2026-05-27): brandPalette + Outfit/Plus Jakarta Sans/
 * JetBrains Mono fonts. Type emojis 🏪📅📦🔗 KEPT per design call #4
 * (type-icon class, consistent with CATEGORY_EMOJI + DELIVERABLE_ICONS).
 */

const TYPE_CONFIG = {
  pay_at_store:   { label: 'WALK-IN', emoji: '🏪', toneBg: P.successPale, toneFg: P.successText },
  prebook:        { label: 'BOOKING', emoji: '📅', toneBg: P.infoPale,    toneFg: P.info },
  online_order:   { label: 'ORDER',   emoji: '📦', toneBg: P.convPale,    toneFg: P.conv },
  redirect_click: { label: 'CLICK',   emoji: '🔗', toneBg: P.yellowPale,  toneFg: P.yellowText },
};

export default function TransactionFeedScreen({ navigation }) {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await influencerApi.getMyTransactions(1);
      const data = res.data || res;
      setTransactions(data.transactions || []);
      setSummary(data.summary || null);
    } catch (e) {
      console.error('[TransactionFeed] Error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    loadData();
  }, [loadData]));

  const onRefresh = () => { setRefreshing(true); loadData(); };

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={P.yellow} /></View>;
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Icon name="chevron-left" size={18} color={P.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>My Transactions</Text>
          <Text style={s.subtitle}>Commission from follower payments</Text>
        </View>
      </View>

      {/* Summary */}
      {summary && (
        <View style={s.summaryRow}>
          <View style={s.summaryCard}>
            <Text style={[s.summaryVal, { color: P.successText }]}>{fmtMoney(summary.total_commission)}</Text>
            <Text style={s.summaryLabel}>TOTAL COMMISSION</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={[s.summaryVal, { color: P.yellowText }]}>{summary.total_transactions}</Text>
            <Text style={s.summaryLabel}>TOTAL ORDERS</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={[s.summaryVal, { color: P.info }]}>{fmtMoney(summary.today_commission)}</Text>
            <Text style={s.summaryLabel}>TODAY</Text>
          </View>
        </View>
      )}

      <FlatList
        data={transactions}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[P.yellow]} />}
        contentContainerStyle={{ padding: 14, paddingBottom: 100 }}
        renderItem={({ item: tx }) => {
          const cfg = TYPE_CONFIG[tx.transaction_type] || { label: (tx.transaction_type || '').toUpperCase(), emoji: '•', toneBg: P.bg2, toneFg: P.muted };
          return (
            <View style={s.txCard}>
              <View style={s.txRow}>
                <View style={[s.typeBadge, { backgroundColor: cfg.toneBg }]}>
                  <Text style={[s.typeText, { color: cfg.toneFg }]}>{cfg.emoji} {cfg.label}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 10, minWidth: 0 }}>
                  <Text style={s.txName} numberOfLines={1}>{tx.follower_name || 'Customer'}</Text>
                  <Text style={s.txMeta} numberOfLines={1}>
                    {(tx.brand_name || '').toUpperCase()} {tx.product_name ? `· ${tx.product_name.toUpperCase()}` : ''}
                  </Text>
                  <Text style={s.txDate} numberOfLines={1}>
                    {(tx.campaign_name || '').toUpperCase()} · {new Date(tx.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }).toUpperCase()}, {new Date(tx.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.txAmount}>+{fmtMoney(tx.influencer_commission)}</Text>
                  <Text style={s.txNet}>SALE: {fmtMoney(tx.net_amount)}</Text>
                </View>
              </View>
              {tx.booking_ref && (
                <View style={s.txExtra}>
                  <Text style={s.txExtraText}>REF: {tx.booking_ref} · {tx.booking_date} {tx.booking_time}</Text>
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>📊</Text>
            <Text style={s.emptyTitle}>No transactions yet</Text>
            <Text style={s.emptyText}>When followers make payments using your deals, they'll appear here with your commission details.</Text>
          </View>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: P.bg },

  header: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 11,
    paddingHorizontal: 18, paddingTop: 50, paddingBottom: 14,
    backgroundColor: P.white, borderBottomWidth: 1, borderBottomColor: P.border,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: P.bg2, alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '800', color: P.ink, fontFamily: fonts.displayBlack },
  subtitle: { fontSize: 10.5, color: P.muted2, marginTop: 3, fontFamily: fonts.monoMedium },

  summaryRow: {
    flexDirection: 'row', gap: 8, padding: 14,
    backgroundColor: P.white, borderBottomWidth: 1, borderBottomColor: P.border,
  },
  summaryCard: {
    flex: 1, alignItems: 'center',
    backgroundColor: P.bg2, borderRadius: 11, padding: 12,
  },
  summaryVal: { fontSize: 15, fontWeight: '900', fontFamily: fonts.monoBold },
  summaryLabel: {
    fontSize: 8.5, color: P.muted2, marginTop: 3,
    textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: '800',
    fontFamily: fonts.monoBold,
  },

  txCard: {
    backgroundColor: P.white, borderRadius: 11, padding: 11, marginBottom: 8,
    borderWidth: 1, borderColor: P.border,
  },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  typeBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7 },
  typeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.2, fontFamily: fonts.monoBold },
  txName: { fontSize: 12.5, fontWeight: '800', color: P.ink, fontFamily: fonts.displayBold },
  txMeta: { fontSize: 10, color: P.muted, marginTop: 2, fontWeight: '700', letterSpacing: 0.2, fontFamily: fonts.monoMedium },
  txDate: { fontSize: 9.5, color: P.muted2, marginTop: 2, fontWeight: '700', letterSpacing: 0.2, fontFamily: fonts.monoMedium },
  txAmount: { fontSize: 13.5, fontWeight: '900', color: P.successText, fontFamily: fonts.monoBold },
  txNet: { fontSize: 9.5, color: P.muted2, marginTop: 2, fontWeight: '700', letterSpacing: 0.2, fontFamily: fonts.monoMedium },
  txExtra: { marginTop: 7, paddingTop: 7, borderTopWidth: 1, borderTopColor: P.borderSoft },
  txExtraText: { fontSize: 9.5, color: P.muted, fontWeight: '700', letterSpacing: 0.2, fontFamily: fonts.monoMedium },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 28 },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: P.ink, marginBottom: 4, fontFamily: fonts.displayBold },
  emptyText: { fontSize: 11.5, color: P.muted2, textAlign: 'center', lineHeight: 17, fontFamily: fonts.sansRegular },
});
