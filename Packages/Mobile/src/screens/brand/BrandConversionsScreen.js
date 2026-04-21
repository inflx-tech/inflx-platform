import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fmtMoney } from '../../theme/tokens';
import { brandApi } from '../../services/api';

const TYPE_FILTERS = [
  { key: 'all',          label: 'All' },
  { key: 'pay_at_store', label: 'Walk-in' },
  { key: 'prebook',      label: 'Pre-book' },
  { key: 'online_order', label: 'Online' },
];

const TYPE_LABELS = {
  pay_at_store: 'Walk-in',
  prebook:      'Pre-booking',
  online_order: 'Online order',
};

const STATUS_STYLES = {
  completed: { bg: '#ECFDF5', fg: '#047857' },
  pending:   { bg: '#FFF7ED', fg: '#C2410C' },
  cancelled: { bg: '#FEF2F2', fg: '#991B1B' },
  refunded:  { bg: '#F3F4F6', fg: '#4B5563' },
};

export default function BrandConversionsScreen({ route, navigation }) {
  const { campaignId, campaignName } = route?.params || {};
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [type, setType]           = useState('all');
  const [expandedId, setExpandedId] = useState(null);

  async function load() {
    const params = {};
    if (type !== 'all') params.type = type;
    if (campaignId) params.campaign_id = campaignId;
    const res = await brandApi.listTransactions(params);
    setLoading(false);
    if (res?.success) {
      setTransactions(res.data?.transactions || []);
      setSummary(res.data?.summary || null);
    }
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, [type, campaignId])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [type, campaignId]);

  function StatusPill({ status }) {
    const s = STATUS_STYLES[status] || STATUS_STYLES.pending;
    return (
      <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
        <Text style={[styles.statusPillText, { color: s.fg }]}>{status}</Text>
      </View>
    );
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.navy} /></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>{'<'} Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Conversions</Text>
        <Text style={styles.subtitle}>
          {campaignId
            ? `Transactions for ${campaignName || 'this campaign'}`
            : 'Every transaction your influencers have driven'}
        </Text>
      </View>

      {/* Summary tiles */}
      {summary && (
        <View style={styles.summaryGrid}>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryLabel}>Transactions</Text>
            <Text style={styles.summaryValue}>{Number(summary.total_transactions || 0).toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryLabel}>Revenue</Text>
            <Text style={styles.summaryValue}>{fmtMoney(summary.total_revenue || 0)}</Text>
          </View>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryLabel}>Commission Paid</Text>
            <Text style={styles.summaryValue}>{fmtMoney(summary.total_commission || 0)}</Text>
          </View>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryLabel}>Brand Net</Text>
            <Text style={styles.summaryValue}>{fmtMoney(summary.total_brand_net || 0)}</Text>
          </View>
        </View>
      )}

      {/* Channel counts */}
      {summary && (
        <View style={styles.channelRow}>
          <View style={styles.channelTile}>
            <Text style={styles.channelCount}>{summary.pay_at_store_count || 0}</Text>
            <Text style={styles.channelLabel}>Walk-in</Text>
          </View>
          <View style={styles.channelTile}>
            <Text style={styles.channelCount}>{summary.prebook_count || 0}</Text>
            <Text style={styles.channelLabel}>Pre-book</Text>
          </View>
          <View style={styles.channelTile}>
            <Text style={styles.channelCount}>{summary.online_order_count || 0}</Text>
            <Text style={styles.channelLabel}>Online</Text>
          </View>
        </View>
      )}

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {TYPE_FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.chip, type === f.key && styles.chipActive]}
            onPress={() => setType(f.key)}
          >
            <Text style={[styles.chipText, type === f.key && styles.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Transaction list */}
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.navy} />}
      >
        {transactions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No transactions yet</Text>
            <Text style={styles.emptySub}>
              Transactions appear here after a follower pays, books, or orders through an influencer's tracking link.
            </Text>
          </View>
        ) : (
          transactions.map(t => {
            const isOpen = expandedId === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => setExpandedId(isOpen ? null : t.id)}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.typeLabel}>{TYPE_LABELS[t.transaction_type] || t.transaction_type}</Text>
                  <StatusPill status={t.status} />
                </View>
                <View style={styles.cardBodyRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.followerName} numberOfLines={1}>{t.follower_name || 'Customer'}</Text>
                    {t.instagram_handle && (
                      <Text style={styles.influencerLabel}>via @{t.instagram_handle}</Text>
                    )}
                    {!campaignId && t.campaign_name && (
                      <Text style={styles.campaignLabel} numberOfLines={1}>{t.campaign_name}</Text>
                    )}
                    {t.product_name && (
                      <Text style={styles.productLabel} numberOfLines={1}>{t.product_name}</Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.amount}>{fmtMoney(t.net_amount || 0)}</Text>
                    <Text style={styles.date}>{t.created_at ? new Date(t.created_at).toLocaleDateString('en-IN') : ''}</Text>
                  </View>
                </View>

                {isOpen && (
                  <View style={styles.detailBlock}>
                    {t.gross_amount != null && <DetailRow label="Bill amount" value={fmtMoney(t.gross_amount)} />}
                    {t.discount_amount != null && t.discount_amount > 0 && <DetailRow label="Discount" value={`− ${fmtMoney(t.discount_amount)}`} />}
                    {t.net_amount != null && <DetailRow label="Customer paid" value={fmtMoney(t.net_amount)} bold />}
                    {t.platform_fee != null && <DetailRow label="Platform fee" value={fmtMoney(t.platform_fee)} />}
                    {t.influencer_commission != null && <DetailRow label="Influencer commission" value={fmtMoney(t.influencer_commission)} />}
                    {t.brand_net != null && <DetailRow label="Your net" value={fmtMoney(t.brand_net)} bold />}
                    {t.coupon_code_used && <DetailRow label="Coupon" value={t.coupon_code_used} />}
                    {t.booking_ref && <DetailRow label="Booking ref" value={t.booking_ref} />}
                    {t.booking_date && <DetailRow label="Booking date" value={new Date(t.booking_date).toLocaleDateString('en-IN')} />}
                    {t.booking_time && <DetailRow label="Booking time" value={t.booking_time} />}
                    {t.order_status && <DetailRow label="Order status" value={t.order_status} />}
                    {t.razorpay_payment_id && <DetailRow label="Payment ID" value={t.razorpay_payment_id} />}
                    {t.follower_phone && <DetailRow label="Customer phone" value={t.follower_phone} />}
                    <Text style={styles.detailTimestamp}>
                      Created: {t.created_at ? new Date(t.created_at).toLocaleString('en-IN') : ''}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

function DetailRow({ label, value, bold }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, bold && styles.detailValueBold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center:   { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header:   { backgroundColor: colors.navyDeep, paddingHorizontal: 20, paddingTop: 52, paddingBottom: 16 },
  back:     { marginBottom: 8 },
  backText: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  title:    { fontSize: 22, fontWeight: '800', color: colors.white },
  subtitle: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4 },

  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingTop: 12, gap: 8 },
  summaryTile: { width: '48%', backgroundColor: colors.white, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border },
  summaryLabel:{ fontSize: 10, fontWeight: '800', color: colors.t3, textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryValue:{ fontSize: 17, fontWeight: '900', color: colors.t1, marginTop: 4 },

  channelRow:  { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 8 },
  channelTile: { flex: 1, backgroundColor: colors.navyPale || '#EDF1FA', borderRadius: 12, padding: 10, alignItems: 'center' },
  channelCount:{ fontSize: 16, fontWeight: '900', color: colors.navy },
  channelLabel:{ fontSize: 10, color: colors.t2, marginTop: 2, fontWeight: '700' },

  chipsRow:    { backgroundColor: colors.white, paddingVertical: 10, marginTop: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, maxHeight: 48 },
  chip:        { backgroundColor: colors.bg, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: colors.border },
  chipActive:  { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText:    { fontSize: 11, fontWeight: '700', color: colors.t2 },
  chipTextActive: { color: colors.white },

  emptyCard: { margin: 16, backgroundColor: colors.white, borderRadius: 16, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  emptyText: { fontSize: 14, fontWeight: '700', color: colors.t1, marginBottom: 6 },
  emptySub:  { fontSize: 11, color: colors.t3, textAlign: 'center', lineHeight: 16 },

  card:       { backgroundColor: colors.white, borderRadius: 14, padding: 14, marginHorizontal: 16, marginTop: 10, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  typeLabel:  { fontSize: 11, fontWeight: '800', color: colors.navy, textTransform: 'uppercase', letterSpacing: 0.5 },
  cardBodyRow:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  followerName:{ fontSize: 14, fontWeight: '700', color: colors.t1 },
  influencerLabel:{ fontSize: 11, color: colors.t2, marginTop: 2 },
  campaignLabel:{ fontSize: 10, color: colors.t3, marginTop: 2 },
  productLabel:{ fontSize: 11, color: colors.orange, fontWeight: '600', marginTop: 2 },
  amount:     { fontSize: 15, fontWeight: '900', color: colors.t1 },
  date:       { fontSize: 10, color: colors.t3, marginTop: 2 },

  statusPill:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusPillText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },

  detailBlock: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  detailRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  detailLabel: { fontSize: 11, color: colors.t3, fontWeight: '600' },
  detailValue: { fontSize: 12, color: colors.t1, fontWeight: '600' },
  detailValueBold: { fontWeight: '900', color: colors.navy },
  detailTimestamp:{ fontSize: 10, color: colors.t3, marginTop: 6, textAlign: 'right' },
});
