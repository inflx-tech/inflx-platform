import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { brandPalette as P, fonts, fmtRupees } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import StatusPill from '../../components/brand/StatusPill';

// Tab definitions (status filters + MCI empty icon per tab).
// 'applied' belongs in Active: influencer is waiting on brand decision.
// 'rejected_by_brand' + 'slots_filled' are open-group closed states — they
// show in Declined so the user knows they didn't get the gig but the offer
// is over.
const TABS = [
  { key: 'active',   label: 'Active',   statusFilter: 'invited,negotiating,applied',          emptyIcon: 'inbox-outline',          emptyMsg: 'No active offers right now',  emptySub: 'New offers from brands will appear here.' },
  { key: 'accepted', label: 'Accepted', statusFilter: 'accepted',                              emptyIcon: 'check-circle-outline',   emptyMsg: 'No accepted offers yet',      emptySub: 'Offers you accept will be shown here. Once signed they unlock content submission.' },
  { key: 'declined', label: 'Declined', statusFilter: 'declined,rejected_by_brand,slots_filled', emptyIcon: 'cancel',               emptyMsg: 'No declined offers',          emptySub: 'Offers you decline will be archived here.' },
  { key: 'expired',  label: 'Expired',  statusFilter: 'expired',                               emptyIcon: 'timer-sand',             emptyMsg: 'No expired offers',           emptySub: 'Offers that lapsed without action appear here.' },
  { key: 'all',      label: 'All',      statusFilter: null,                                    emptyIcon: 'format-list-bulleted',   emptyMsg: 'No offers found',             emptySub: 'Your complete offer history will appear here.' },
];

export default function OfferListScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('active');
  // Per-tab data cache
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
  const activeCount = tabData.active.loaded ? tabData.active.offers.length : null;
  const expiringSoonCount = tabData.active.loaded
    ? tabData.active.offers.filter(o => o.offer_expires_at && (new Date(o.offer_expires_at) - Date.now()) < 24 * 3600 * 1000).length
    : 0;

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function formatDeclineReason(reason) {
    if (!reason) return '';
    return reason.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function renderSubLine() {
    if (activeTab === 'active' && activeCount != null) {
      if (activeCount === 0) return 'No active offers right now';
      const exp = expiringSoonCount;
      return `${activeCount} active${exp > 0 ? ` · ${exp} expiring soon` : ''}`;
    }
    if (currentData.loaded) {
      const n = currentData.offers.length;
      return n === 0 ? `No ${activeTab} offers yet` : `${n} ${activeTab}`;
    }
    return 'Loading…';
  }

  function renderOfferCard(offer) {
    const isActive   = activeTab === 'active';
    const isAccepted = activeTab === 'accepted';
    const isDeclined = activeTab === 'declined';
    const isExpired  = activeTab === 'expired';

    const fee = offer.agreed_fee || offer.influencer_budget || offer.per_influencer_budget || offer.set_budget || 0;
    let countdownHours = null;
    if (isActive && offer.offer_expires_at) {
      countdownHours = Math.max(0, Math.ceil((new Date(offer.offer_expires_at) - Date.now()) / 3600000));
    }
    const countdownLabel = countdownHours == null
      ? null
      : countdownHours < 24
        ? `${countdownHours}h`
        : `${Math.ceil(countdownHours / 24)}d`;
    const countdownDanger = countdownHours != null && countdownHours <= 6;

    return (
      <TouchableOpacity key={offer.id} style={styles.offerCard} onPress={() => navigation.navigate('OfferDetail', { offer })}>
        <View style={styles.cardHead}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.brandName} numberOfLines={1}>{offer.brand_name || offer.business_name || 'Brand'}</Text>
            <Text style={styles.campaignName} numberOfLines={1}>{offer.campaign_name}</Text>
          </View>
          <StatusPill status={offer.status} />
        </View>

        <View style={styles.statsRow}>
          <View>
            <Text style={styles.statL}>Fee</Text>
            <Text style={styles.statV}>{fmtRupees(fee)}</Text>
          </View>
          <View>
            <Text style={styles.statL}>Deliverable</Text>
            <Text style={styles.statV}>{offer.deliverable_type || 'reel'}</Text>
          </View>

          {isActive && countdownLabel != null && (
            <View>
              <Text style={styles.statL}>Expires</Text>
              <Text style={[styles.statV, countdownDanger && styles.statVDanger]}>{countdownLabel}</Text>
            </View>
          )}

          {isAccepted && (
            <View>
              <Text style={styles.statL}>Accepted</Text>
              <Text style={[styles.statV, styles.statVMuted]}>{formatDate(offer.contract_signed_at || offer.created_at)}</Text>
            </View>
          )}

          {isDeclined && (
            <View>
              <Text style={styles.statL}>Date</Text>
              <Text style={[styles.statV, styles.statVMuted]}>{formatDate(offer.created_at)}</Text>
            </View>
          )}

          {isExpired && (
            <View>
              <Text style={styles.statL}>Expired</Text>
              <Text style={[styles.statV, styles.statVMuted]}>{formatDate(offer.offer_expires_at || offer.created_at)}</Text>
            </View>
          )}
        </View>

        {isDeclined && offer.declined_reason && (
          <View style={styles.reasonRow}>
            <Text style={styles.reasonL}>Reason</Text>
            <Text style={styles.reasonV}>{formatDeclineReason(offer.declined_reason)}</Text>
          </View>
        )}

        {offer.status === 'invited' && isActive && (
          <View style={styles.tapHintRow}>
            <Text style={styles.tapHintText}>Tap to view details ›</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      {/* Ink topbar */}
      <View style={styles.topbar}>
        <Text style={styles.topTitle}>Offers</Text>
        <Text style={styles.topSub}>{renderSubLine()}</Text>
        <View style={styles.topRule} />
      </View>

      {/* Tab pills */}
      <View style={styles.tabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
          {TABS.map(t => {
            const count = tabData[t.key].loaded ? tabData[t.key].offers.length : null;
            const isActive = activeTab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                onPress={() => setActiveTab(t.key)}
                style={[styles.tabPill, isActive && styles.tabPillActive]}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {t.label}{count !== null ? ` (${count})` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={P.ink} />}
      >
        {currentData.loading && !currentData.loaded ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={P.ink} />
            <Text style={styles.loadingText}>Loading offers...</Text>
          </View>
        ) : currentData.offers.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyTile}>
              <Icon name={currentTab.emptyIcon} size={32} color={P.yellowText} />
            </View>
            <Text style={styles.emptyTitle}>{currentTab.emptyMsg}</Text>
            <Text style={styles.emptyMsg}>{currentTab.emptySub}</Text>
          </View>
        ) : (
          currentData.offers.map(offer => renderOfferCard(offer))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.bg },

  // Topbar (ink)
  topbar:    { backgroundColor: P.ink, paddingHorizontal: 18, paddingTop: 50, paddingBottom: 16, position: 'relative' },
  topTitle:  { fontFamily: fonts.displayBold, fontSize: 22, fontWeight: '800', color: P.white },
  topSub:    { fontFamily: fonts.monoBold, fontSize: 10.5, color: 'rgba(255,255,255,0.55)', marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: '700' },
  topRule:   { position: 'absolute', left: 18, bottom: 6, width: 30, height: 3, backgroundColor: P.yellow, borderRadius: 2 },

  // Tab pills (ink-active + bg2-inactive per locked design call #2)
  tabsWrap:  { backgroundColor: P.white, borderBottomWidth: 1, borderBottomColor: P.border },
  tabsRow:   { paddingHorizontal: 14, paddingVertical: 10, gap: 7 },
  tabPill:   {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: P.bg2,
    borderWidth: 1,
    borderColor: P.border,
  },
  tabPillActive: { backgroundColor: P.ink, borderColor: P.ink },
  tabText:       { fontFamily: fonts.monoBold, fontSize: 10.5, fontWeight: '800', color: P.muted2, letterSpacing: 0.3 },
  tabTextActive: { color: P.yellow },

  // Offer card
  offerCard: {
    backgroundColor: P.white,
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 14,
    marginHorizontal: 14,
    marginBottom: 8,
    padding: 14,
  },
  cardHead:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 11 },
  brandName:  { fontFamily: fonts.displayBold, fontSize: 14.5, fontWeight: '800', color: P.ink, lineHeight: 18 },
  campaignName: { fontFamily: fonts.monoBold, fontSize: 10.5, color: P.muted2, marginTop: 3 },

  statsRow:  { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  statL:     { fontFamily: fonts.monoBold, fontSize: 9, color: P.muted2, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: '700' },
  statV:     { fontFamily: fonts.monoBold, fontSize: 13.5, fontWeight: '800', color: P.ink, marginTop: 2 },
  statVDanger: { color: P.dangerText },
  statVMuted:  { color: P.muted },

  reasonRow: {
    marginTop: 9, paddingTop: 9,
    borderTopWidth: 1, borderTopColor: P.borderSoft,
    flexDirection: 'row', gap: 6,
  },
  reasonL:   { fontFamily: fonts.monoBold, fontSize: 9.5, color: P.muted2, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: '700' },
  reasonV:   { fontFamily: fonts.sansMedium, fontSize: 11, color: P.muted, flex: 1 },

  tapHintRow: {
    marginTop: 9, paddingTop: 9,
    borderTopWidth: 1, borderTopColor: P.borderSoft,
    alignItems: 'flex-end',
  },
  tapHintText: {
    fontFamily: fonts.monoBold,
    fontSize: 10, fontWeight: '800',
    color: P.ink,
    borderBottomWidth: 1,
    borderBottomColor: P.ink,
    borderStyle: 'dashed',
  },

  // Empty (canonical pattern)
  empty:     { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 28 },
  emptyTile: {
    width: 66, height: 66, borderRadius: 14,
    backgroundColor: P.yellowPale,
    borderWidth: 1.5, borderColor: P.yellow, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontFamily: fonts.displayBold, fontSize: 14, fontWeight: '800', color: P.ink, textAlign: 'center', marginBottom: 6 },
  emptyMsg:   { fontFamily: fonts.sansMedium, fontSize: 11.5, color: P.muted, textAlign: 'center', lineHeight: 17, maxWidth: 260 },

  // Loading
  loadingContainer: { alignItems: 'center', paddingVertical: 60 },
  loadingText:      { fontFamily: fonts.sansMedium, marginTop: 12, color: P.muted2, fontSize: 13 },
});
