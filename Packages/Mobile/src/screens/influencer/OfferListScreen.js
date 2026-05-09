import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { colors, fmtMoney, fmtRupees } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import StatusBadge from '../../components/StatusBadge';

const TABS = [
  { key: 'active',   label: 'Active',   statusFilter: 'invited,negotiating', emptyIcon: '📩', emptyMsg: 'No active offers right now' },
  { key: 'accepted', label: 'Accepted', statusFilter: 'accepted',           emptyIcon: '✅', emptyMsg: 'No accepted offers yet' },
  { key: 'declined', label: 'Declined', statusFilter: 'declined',           emptyIcon: '🚫', emptyMsg: 'No declined offers' },
  { key: 'expired',  label: 'Expired',  statusFilter: 'expired',            emptyIcon: '⏰', emptyMsg: 'No expired offers' },
  { key: 'all',      label: 'All',      statusFilter: null,                 emptyIcon: '📋', emptyMsg: 'No offers found' },
];

export default function OfferListScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('active');
  // Per-tab data cache: { active: { offers: [], loading: true, loaded: false }, ... }
  const [tabData, setTabData] = useState(() => {
    const initial = {};
    TABS.forEach(t => { initial[t.key] = { offers: [], loading: false, loaded: false }; });
    return initial;
  });
  const [refreshing, setRefreshing] = useState(false);

  const loadTab = useCallback(async (tabKey, isRefresh = false) => {
    const tabDef = TABS.find(t => t.key === tabKey);
    if (!tabDef) return;

    setTabData(prev => ({
      ...prev,
      [tabKey]: { ...prev[tabKey], loading: !isRefresh, loaded: prev[tabKey].loaded },
    }));

    const res = await influencerApi.getOffers(tabDef.statusFilter);
    const offers = res.success ? (res.data?.offers || res.data || []) : [];

    setTabData(prev => ({
      ...prev,
      [tabKey]: { offers, loading: false, loaded: true },
    }));
  }, []);

  // Load active tab on mount
  useEffect(() => { loadTab('active'); }, [loadTab]);

  // Load tab data when switching to a tab that hasn't been loaded yet
  useEffect(() => {
    if (!tabData[activeTab].loaded && !tabData[activeTab].loading) {
      loadTab(activeTab);
    }
  }, [activeTab, tabData, loadTab]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTab(activeTab, true);
    setRefreshing(false);
  }, [activeTab, loadTab]);

  const currentTab = TABS.find(t => t.key === activeTab);
  const currentData = tabData[activeTab];

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function formatDeclineReason(reason) {
    if (!reason) return '';
    return reason.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function renderOfferCard(offer) {
    const isActive = activeTab === 'active';
    const isAccepted = activeTab === 'accepted';
    const isDeclined = activeTab === 'declined';
    const isExpired = activeTab === 'expired';

    return (
      <TouchableOpacity key={offer.id} style={styles.offerCard} onPress={() => navigation.navigate('OfferDetail', { offer })}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.brandName}>{offer.brand_name || offer.business_name || 'Brand'}</Text>
            <Text style={styles.campaignName}>{offer.campaign_name}</Text>
          </View>
          <StatusBadge status={offer.status} />
        </View>

        <View style={styles.offerRow}>
          <View style={styles.offerStat}>
            <Text style={styles.offerStatLabel}>Fee</Text>
            <Text style={styles.offerStatVal}>{fmtRupees(offer.agreed_fee || offer.influencer_budget || offer.per_influencer_budget || offer.set_budget || 0)}</Text>
          </View>
          <View style={styles.offerStat}>
            <Text style={styles.offerStatLabel}>Deliverable</Text>
            <Text style={styles.offerStatVal}>{offer.deliverable_type || 'reel'}</Text>
          </View>

          {/* Active tab: show expiry countdown */}
          {isActive && offer.offer_expires_at && (
            <View style={styles.offerStat}>
              <Text style={styles.offerStatLabel}>Expires</Text>
              <Text style={[styles.offerStatVal, { color: colors.red }]}>
                {Math.max(0, Math.ceil((new Date(offer.offer_expires_at) - Date.now()) / 3600000))}h
              </Text>
            </View>
          )}

          {/* Accepted tab: show accepted date */}
          {isAccepted && (
            <View style={styles.offerStat}>
              <Text style={styles.offerStatLabel}>Accepted</Text>
              <Text style={styles.offerStatVal}>{formatDate(offer.contract_signed_at || offer.created_at)}</Text>
            </View>
          )}

          {/* Declined tab: show declined date */}
          {isDeclined && (
            <View style={styles.offerStat}>
              <Text style={styles.offerStatLabel}>Date</Text>
              <Text style={styles.offerStatVal}>{formatDate(offer.created_at)}</Text>
            </View>
          )}

          {/* Expired tab: show expired date */}
          {isExpired && (
            <View style={styles.offerStat}>
              <Text style={styles.offerStatLabel}>Expired</Text>
              <Text style={styles.offerStatVal}>{formatDate(offer.offer_expires_at || offer.created_at)}</Text>
            </View>
          )}
        </View>

        {/* Declined reason */}
        {isDeclined && offer.declined_reason && (
          <View style={styles.reasonRow}>
            <Text style={styles.reasonLabel}>Reason:</Text>
            <Text style={styles.reasonText}>{formatDeclineReason(offer.declined_reason)}</Text>
          </View>
        )}

        {/* Tap card to open full details + actions */}
        {offer.status === 'invited' && isActive && (
          <View style={styles.tapHintRow}>
            <Text style={styles.tapHintText}>Tap to view details →</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 10 }}>
        {TABS.map(t => {
          const count = tabData[t.key].loaded ? tabData[t.key].offers.length : null;
          const isActive = activeTab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              onPress={() => setActiveTab(t.key)}
              style={[styles.tabBtn, isActive && styles.tabBtnActive]}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {t.label}{count !== null ? ` (${count})` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView style={{ flex: 1 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {currentData.loading && !currentData.loaded ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.navy} />
            <Text style={styles.loadingText}>Loading offers...</Text>
          </View>
        ) : currentData.offers.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>{currentTab.emptyIcon}</Text>
            <Text style={styles.emptyTitle}>{currentTab.emptyMsg}</Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === 'active' ? 'New offers from brands will appear here' :
               activeTab === 'accepted' ? 'Offers you accept will be shown here' :
               activeTab === 'declined' ? 'Offers you decline will be archived here' :
               activeTab === 'expired' ? 'Expired offers will be shown here' :
               'Your complete offer history will appear here'}
            </Text>
          </View>
        ) : (
          currentData.offers.map(offer => renderOfferCard(offer))
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
  tapHintRow: { marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'flex-end' },
  tapHintText: { fontSize: 11, fontWeight: '700', color: colors.navy },
  acceptBtn: { flex: 1, backgroundColor: colors.teal, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  acceptBtnText: { fontSize: 12, fontWeight: '700', color: colors.white },
  declineBtn: { flex: 1, backgroundColor: colors.redPale, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  declineBtnText: { fontSize: 12, fontWeight: '700', color: colors.red },
  negotiateBtn: { flex: 1, backgroundColor: colors.navyPale, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  negotiateBtnText: { fontSize: 12, fontWeight: '700', color: colors.navy },
  reasonRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingTop: 4, borderTopWidth: 1, borderTopColor: colors.border },
  reasonLabel: { fontSize: 11, fontWeight: '700', color: colors.t3, marginRight: 6 },
  reasonText: { fontSize: 11, color: colors.t2 },
  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.t1, textAlign: 'center' },
  emptySubtitle: { fontSize: 13, color: colors.t3, marginTop: 6, textAlign: 'center' },
  loadingContainer: { alignItems: 'center', paddingVertical: 60 },
  loadingText: { textAlign: 'center', marginTop: 12, color: colors.t3, fontSize: 14 },
});
