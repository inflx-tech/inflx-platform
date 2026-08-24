import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { brandPalette as P, fonts, fmtMoney } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import ScreenHeader from '../../components/brand/ScreenHeader';
import StatusPill from '../../components/brand/StatusPill';
import EmptyState from '../../components/brand/EmptyState';

/**
 * BrandConversionsScreen — transactions inbox (follower_transactions).
 * Flow 21 (2026-05-25): navy + 4 ad-hoc status pills → brandPalette +
 * canonical StatusPill component + ScreenHeader + EmptyState extracted
 * into Packages/Mobile/src/components/brand/.
 */

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

  useFocusEffect(useCallback(() => { load(); }, [type, campaignId]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [type, campaignId]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: P.bg }}>
        <ScreenHeader
          title="Conversions"
          sub={campaignId ? `Transactions for ${campaignName || 'this campaign'}` : 'Every transaction your influencers have driven'}
          back onBack={() => navigation.goBack()}
        />
        <View style={s.center}><ActivityIndicator color={P.ink} size="large" /></View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScreenHeader
        title="Conversions"
        sub={campaignId ? `Transactions for ${campaignName || 'this campaign'}` : 'Every transaction your influencers have driven'}
        back onBack={() => navigation.goBack()}
      />

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={P.ink} colors={[P.ink]} />}
      >
        {summary && (
          <View style={s.sumGrid}>
            <View style={s.sumTile}>
              <Text style={s.sumLabel}>Transactions</Text>
              <Text style={s.sumValue}>{Number(summary.total_transactions || 0).toLocaleString('en-IN')}</Text>
            </View>
            <View style={s.sumTile}>
              <Text style={s.sumLabel}>Revenue</Text>
              <Text style={s.sumValue}>{fmtMoney(summary.total_revenue || 0)}</Text>
            </View>
            <View style={s.sumTile}>
              <Text style={s.sumLabel}>Commission Paid</Text>
              <Text style={s.sumValue}>{fmtMoney(summary.total_commission || 0)}</Text>
            </View>
            <View style={s.sumTile}>
              <Text style={s.sumLabel}>Brand Net</Text>
              <Text style={s.sumValue}>{fmtMoney(summary.total_brand_net || 0)}</Text>
            </View>
          </View>
        )}

        {summary && (
          <View style={s.channelRow}>
            <View style={s.channelTile}>
              <Text style={s.channelCount}>{summary.pay_at_store_count || 0}</Text>
              <Text style={s.channelLabel}>Walk-in</Text>
            </View>
            <View style={s.channelTile}>
              <Text style={s.channelCount}>{summary.prebook_count || 0}</Text>
              <Text style={s.channelLabel}>Pre-book</Text>
            </View>
            <View style={s.channelTile}>
              <Text style={s.channelCount}>{summary.online_order_count || 0}</Text>
              <Text style={s.channelLabel}>Online</Text>
            </View>
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipsRow} contentContainerStyle={s.chipsRowContent}>
          {TYPE_FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[s.chip, type === f.key && s.chipActive]}
              onPress={() => setType(f.key)}
              activeOpacity={0.7}
            >
              <Text style={[s.chipText, type === f.key && s.chipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={{ paddingHorizontal: 14, paddingTop: 8 }}>
          {transactions.length === 0 ? (
            <View style={{ marginTop: 24 }}>
              <EmptyState
                icon="[$]"
                title="No transactions yet"
                sub="Transactions appear here after a follower pays, books, or orders through an influencer's tracking link."
              />
            </View>
          ) : (
            transactions.map(t => {
              const isOpen = expandedId === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={s.card}
                  activeOpacity={0.85}
                  onPress={() => setExpandedId(isOpen ? null : t.id)}
                >
                  <View style={s.cardHeader}>
                    <Text style={s.typeLabel}>{(TYPE_LABELS[t.transaction_type] || t.transaction_type).toUpperCase()}</Text>
                    <StatusPill status={t.status} mode="transaction" />
                  </View>
                  <View style={s.cardBodyRow}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.followerName} numberOfLines={1}>{t.follower_name || 'Customer'}</Text>
                      {t.instagram_handle && <Text style={s.influencerLabel}>via @{t.instagram_handle}</Text>}
                      {!campaignId && t.campaign_name && <Text style={s.campaignLabel} numberOfLines={1}>{t.campaign_name}</Text>}
                      {t.product_name && <Text style={s.productLabel} numberOfLines={1}>{t.product_name}</Text>}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={s.amount}>{fmtMoney(t.net_amount || 0)}</Text>
                      <Text style={s.date}>{t.created_at ? new Date(t.created_at).toLocaleDateString('en-IN') : ''}</Text>
                    </View>
                  </View>

                  {isOpen && (
                    <View style={s.detailBlock}>
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
                      <Text style={s.detailTimestamp}>
                        Created: {t.created_at ? new Date(t.created_at).toLocaleString('en-IN') : ''}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}
          <View style={{ height: 60 }} />
        </View>
      </ScrollView>
    </View>
  );
}

function DetailRow({ label, value, bold }) {
  return (
    <View style={s.detailRow}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={[s.detailValue, bold && s.detailValueBold]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  sumGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingTop: 12, gap: 8 },
  sumTile: { width: '48%', backgroundColor: P.white, borderRadius: 12, padding: 11, borderWidth: 1, borderColor: P.border },
  sumLabel: { fontFamily: fonts.monoBold, fontSize: 9, fontWeight: '800', color: P.muted2, textTransform: 'uppercase', letterSpacing: 0.5 },
  sumValue: { fontFamily: fonts.monoBold, fontSize: 17, fontWeight: '900', color: P.ink, marginTop: 3 },

  channelRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 8 },
  channelTile: { flex: 1, backgroundColor: P.bg2, borderRadius: 10, padding: 9, alignItems: 'center' },
  channelCount: { fontFamily: fonts.monoBold, fontSize: 15, fontWeight: '900', color: P.ink },
  channelLabel: { fontFamily: fonts.monoBold, fontSize: 9, color: P.muted2, marginTop: 2, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },

  chipsRow: { backgroundColor: P.white, marginTop: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: P.border, maxHeight: 48 },
  chipsRowContent: { paddingHorizontal: 14, gap: 6, alignItems: 'center', paddingVertical: 8 },
  chip: { backgroundColor: P.bg2, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: P.border },
  chipActive: { backgroundColor: P.ink, borderColor: P.ink },
  chipText: { fontFamily: fonts.sansBold, fontSize: 11, fontWeight: '700', color: P.muted },
  chipTextActive: { color: P.white, fontFamily: fonts.monoBold },

  card: { backgroundColor: P.white, borderRadius: 14, padding: 13, marginBottom: 8, borderWidth: 1, borderColor: P.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 },
  typeLabel: { fontFamily: fonts.monoBold, fontSize: 9.5, fontWeight: '800', color: P.ink, textTransform: 'uppercase', letterSpacing: 0.5 },
  cardBodyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  followerName: { fontFamily: fonts.displayBold, fontSize: 13.5, fontWeight: '700', color: P.ink },
  influencerLabel: { fontFamily: fonts.monoMedium, fontSize: 10.5, color: P.muted2, marginTop: 2 },
  campaignLabel: { fontFamily: fonts.sansMedium, fontSize: 10.5, color: P.muted3, marginTop: 2 },
  productLabel: { fontFamily: fonts.sansBold, fontSize: 10.5, color: P.ink, fontWeight: '700', marginTop: 2 },
  amount: { fontFamily: fonts.monoBold, fontSize: 15, fontWeight: '900', color: P.ink },
  date: { fontFamily: fonts.monoMedium, fontSize: 10, color: P.muted3, marginTop: 2 },

  detailBlock: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: P.border },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  detailLabel: { fontFamily: fonts.monoMedium, fontSize: 10.5, color: P.muted2, fontWeight: '600' },
  detailValue: { fontFamily: fonts.monoMedium, fontSize: 11, color: P.ink, fontWeight: '600' },
  detailValueBold: { fontFamily: fonts.monoBold, fontWeight: '900', color: P.ink },
  detailTimestamp: { fontFamily: fonts.monoMedium, fontSize: 10, color: P.muted3, marginTop: 6, textAlign: 'right' },
});
