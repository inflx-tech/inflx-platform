import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius, fmtMoney } from '../../theme/tokens';
import { influencerApi } from '../../services/api';

/**
 * TransactionFeedScreen — influencer sees all follower transactions (commissions earned).
 * Shows: who bought what, via which campaign, how much commission earned.
 */

const TYPE_LABELS = {
  pay_at_store: '🏪 Walk-in',
  prebook: '📅 Booking',
  online_order: '📦 Order',
  redirect_click: '🔗 Click',
};

const TYPE_COLORS = {
  pay_at_store: colors.teal,
  prebook: '#3b82f6',
  online_order: colors.purple,
};

export default function TransactionFeedScreen({ navigation }) {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);

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
    return <View style={s.center}><ActivityIndicator size="large" color={colors.orange} /></View>;
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={{ fontSize: 16 }}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>My Transactions</Text>
          <Text style={s.subtitle}>Commission earned from follower payments</Text>
        </View>
      </View>

      {/* Summary */}
      {summary && (
        <View style={s.summaryRow}>
          <View style={s.summaryCard}>
            <Text style={[s.summaryVal, { color: colors.tealDeep }]}>{fmtMoney(summary.total_commission)}</Text>
            <Text style={s.summaryLabel}>Total Commission</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={[s.summaryVal, { color: colors.orange }]}>{summary.total_transactions}</Text>
            <Text style={s.summaryLabel}>Total Orders</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={[s.summaryVal, { color: '#3b82f6' }]}>{fmtMoney(summary.today_commission)}</Text>
            <Text style={s.summaryLabel}>Today</Text>
          </View>
        </View>
      )}

      <FlatList
        data={transactions}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.orange]} />}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
        renderItem={({ item: tx }) => {
          const typeLabel = TYPE_LABELS[tx.transaction_type] || tx.transaction_type;
          const typeColor = TYPE_COLORS[tx.transaction_type] || colors.t2;
          return (
            <View style={s.txCard}>
              <View style={s.txRow}>
                <View style={[s.typeBadge, { backgroundColor: typeColor + '15' }]}>
                  <Text style={[s.typeText, { color: typeColor }]}>{typeLabel}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={s.txName}>{tx.follower_name || 'Customer'}</Text>
                  <Text style={s.txMeta}>
                    {tx.brand_name} {tx.product_name ? `· ${tx.product_name}` : ''}
                  </Text>
                  <Text style={s.txDate}>{tx.campaign_name} · {new Date(tx.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.txAmount}>+{fmtMoney(tx.influencer_commission)}</Text>
                  <Text style={s.txNet}>Sale: {fmtMoney(tx.net_amount)}</Text>
                </View>
              </View>
              {tx.booking_ref && (
                <View style={s.txExtra}>
                  <Text style={s.txExtraText}>📋 Ref: {tx.booking_ref} · {tx.booking_date} {tx.booking_time}</Text>
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
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: spacing.lg, paddingTop: 50, paddingBottom: spacing.md,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '700', color: colors.t1 },
  subtitle: { fontSize: 11, color: colors.t3 },
  summaryRow: { flexDirection: 'row', gap: 8, padding: spacing.lg, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  summaryCard: { flex: 1, alignItems: 'center', backgroundColor: colors.surface2, borderRadius: radius.md, padding: 10 },
  summaryVal: { fontSize: 16, fontWeight: '800' },
  summaryLabel: { fontSize: 9, color: colors.t3, marginTop: 2, textTransform: 'uppercase' },
  txCard: {
    backgroundColor: colors.white, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: 8, overflow: 'hidden',
  },
  txRow: { flexDirection: 'row', padding: 12, alignItems: 'center' },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  typeText: { fontSize: 10, fontWeight: '700' },
  txName: { fontSize: 13, fontWeight: '700', color: colors.t1 },
  txMeta: { fontSize: 11, color: colors.t3, marginTop: 1 },
  txDate: { fontSize: 10, color: colors.t3, marginTop: 2 },
  txAmount: { fontSize: 14, fontWeight: '800', color: colors.tealDeep },
  txNet: { fontSize: 10, color: colors.t3, marginTop: 2 },
  txExtra: { paddingHorizontal: 12, paddingBottom: 8 },
  txExtraText: { fontSize: 10, color: colors.t2 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.t1, marginBottom: 4 },
  emptyText: { fontSize: 12, color: colors.t3, textAlign: 'center', paddingHorizontal: 40, lineHeight: 18 },
});
