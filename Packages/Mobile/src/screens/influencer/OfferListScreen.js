import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { colors, fmtMoney } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import StatusBadge from '../../components/StatusBadge';

export default function OfferListScreen({ navigation }) {
  const [offers, setOffers] = useState([]);
  const [tab, setTab] = useState('invited');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    const res = await influencerApi.getOffers();
    setLoading(false);
    if (res.success) setOffers(res.data?.offers || res.data || []);
  }

  useEffect(() => { load(); }, []);
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, []);

  const tabs = ['invited', 'negotiating', 'accepted', 'expired', 'declined'];
  const filtered = offers.filter(o => o.status === tab);

  return (
    <View style={styles.container}>
      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 10 }}>
        {tabs.map(t => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tabBtn, tab === t && styles.tabBtnActive]}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)} ({offers.filter(o => o.status === t).length})
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={{ flex: 1 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {loading ? (
          <Text style={styles.emptyText}>Loading offers...</Text>
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📩</Text>
            <Text style={styles.emptyTitle}>No {tab} offers</Text>
          </View>
        ) : (
          filtered.map(offer => (
            <TouchableOpacity key={offer.id} style={styles.offerCard} onPress={() => navigation.navigate('OfferDetail', { offer })}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.brandName}>{offer.brand_name || 'Brand'}</Text>
                  <Text style={styles.campaignName}>{offer.campaign_name}</Text>
                </View>
                <StatusBadge status={offer.status} />
              </View>
              <View style={styles.offerRow}>
                <View style={styles.offerStat}>
                  <Text style={styles.offerStatLabel}>Fee</Text>
                  <Text style={styles.offerStatVal}>{fmtMoney(offer.agreed_fee || offer.proposed_fee)}</Text>
                </View>
                <View style={styles.offerStat}>
                  <Text style={styles.offerStatLabel}>Deliverable</Text>
                  <Text style={styles.offerStatVal}>{offer.deliverable_type || 'reel'}</Text>
                </View>
                {offer.expires_at && (
                  <View style={styles.offerStat}>
                    <Text style={styles.offerStatLabel}>Expires</Text>
                    <Text style={[styles.offerStatVal, { color: colors.red }]}>
                      {Math.max(0, Math.ceil((new Date(offer.expires_at) - Date.now()) / 3600000))}h
                    </Text>
                  </View>
                )}
              </View>
              {offer.status === 'invited' && (
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.acceptBtn} onPress={async () => { await influencerApi.acceptOffer(offer.id); load(); }}>
                    <Text style={styles.acceptBtnText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.declineBtn} onPress={async () => { await influencerApi.declineOffer(offer.id); load(); }}>
                    <Text style={styles.declineBtnText}>Decline</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.negotiateBtn} onPress={() => navigation.navigate('OfferDetail', { offer })}>
                    <Text style={styles.negotiateBtnText}>Negotiate</Text>
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  tabBar: { backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border, flexGrow: 0 },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surface2 },
  tabBtnActive: { backgroundColor: colors.navy },
  tabText: { fontSize: 11, fontWeight: '600', color: colors.t3 },
  tabTextActive: { color: colors.white },
  offerCard: { backgroundColor: colors.white, margin: 16, marginBottom: 0, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  brandName: { fontSize: 15, fontWeight: '700', color: colors.t1 },
  campaignName: { fontSize: 12, color: colors.t3, marginTop: 2 },
  offerRow: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  offerStat: {},
  offerStatLabel: { fontSize: 9, fontWeight: '700', color: colors.t3, textTransform: 'uppercase', letterSpacing: 0.5 },
  offerStatVal: { fontSize: 14, fontWeight: '700', color: colors.t1, marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 8 },
  acceptBtn: { flex: 1, backgroundColor: colors.teal, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  acceptBtnText: { fontSize: 12, fontWeight: '700', color: colors.white },
  declineBtn: { flex: 1, backgroundColor: colors.redPale, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  declineBtnText: { fontSize: 12, fontWeight: '700', color: colors.red },
  negotiateBtn: { flex: 1, backgroundColor: colors.navyPale, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  negotiateBtnText: { fontSize: 12, fontWeight: '700', color: colors.navy },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.t1 },
  emptyText: { textAlign: 'center', marginTop: 40, color: colors.t3, fontSize: 14 },
});
