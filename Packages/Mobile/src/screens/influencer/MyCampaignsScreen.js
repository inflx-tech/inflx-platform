import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { brandPalette as P, fonts, fmtRupees } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import StatusPill from '../../components/brand/StatusPill';

function formatDate(dateStr) {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const TABS = [
  { key: 'active',    label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'all',       label: 'All' },
];

export default function MyCampaignsScreen({ navigation }) {
  const [campaigns, setCampaigns] = useState([]);
  const [tab, setTab] = useState('active');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  async function load(filter) {
    try {
      setError(null);
      const res = await influencerApi.getMyCampaigns(filter || tab);
      setLoading(false);
      if (res.success) {
        setCampaigns(res.data?.campaigns || []);
      } else {
        setError(res.error?.message || 'Failed to load campaigns');
        Alert.alert('Error', res.error?.message || 'Failed to load campaigns');
      }
    } catch (err) {
      setLoading(false);
      setError(err.message || 'Something went wrong');
      Alert.alert('Error', 'Failed to load campaigns. Please try again.');
    }
  }

  useFocusEffect(
    useCallback(() => {
      load(tab);
    }, [tab])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(tab);
    setRefreshing(false);
  }, [tab]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Icon name="chevron-left" size={16} color="rgba(255,255,255,0.65)" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Campaigns</Text>
        <Text style={styles.headerSub}>Track active and past campaigns</Text>
        <View style={styles.headerRule} />
      </View>

      {/* Tab pills */}
      <View style={styles.tabsWrap}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            onPress={() => { setLoading(true); setTab(t.key); }}
            style={[styles.tabPill, tab === t.key && styles.tabPillActive]}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={P.ink} />}
      >
        {loading ? (
          <View style={styles.centerLoader}>
            <ActivityIndicator size="small" color={P.ink} />
            <Text style={styles.loadingText}>Loading campaigns...</Text>
          </View>
        ) : error ? (
          <View style={styles.empty}>
            <View style={styles.emptyTile}>
              <Icon name="alert-circle-outline" size={32} color={P.dangerText} />
            </View>
            <Text style={styles.emptyTitle}>Something went wrong</Text>
            <Text style={styles.emptySubtext}>{error}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => { setLoading(true); setError(null); load(tab); }}
            >
              <Text style={styles.retryBtnText}>RETRY</Text>
            </TouchableOpacity>
          </View>
        ) : campaigns.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyTile}>
              <Icon name="briefcase-outline" size={32} color={P.yellowText} />
            </View>
            <Text style={styles.emptyTitle}>
              No {tab === 'all' ? '' : tab} campaigns
            </Text>
            <Text style={styles.emptySubtext}>
              Accept offers to start working on campaigns.
            </Text>
          </View>
        ) : (
          campaigns.map(c => (
            <TouchableOpacity
              key={c.campaign_influencer_id}
              style={styles.campaignCard}
              onPress={() => {
                if (c.influencer_status === 'completed') {
                  navigation.navigate('CampaignCompletion', {
                    campaignInfluencerId: c.campaign_influencer_id,
                  });
                } else {
                  navigation.navigate('CampaignDetail', {
                    campaignInfluencerId: c.campaign_influencer_id,
                  });
                }
              }}
            >
              <View style={styles.cardHead}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.brandName} numberOfLines={1}>{c.brand_name || 'Brand'}</Text>
                  <Text style={styles.campaignName} numberOfLines={1}>{c.campaign_name}</Text>
                </View>
                <StatusPill status={c.influencer_status} />
              </View>

              <View style={styles.cardStats}>
                <View>
                  <Text style={styles.statL}>Fee</Text>
                  <Text style={styles.statV}>{fmtRupees(c.agreed_fee)}</Text>
                </View>
                <View>
                  <Text style={styles.statL}>Goal</Text>
                  <Text style={styles.statV}>
                    {(c.goal || '--').replace(/_/g, ' ').replace(/^\w/, ch => ch.toUpperCase())}
                  </Text>
                </View>
                <View>
                  <Text style={styles.statL}>Deliverables</Text>
                  <Text style={styles.statV}>
                    {c.approved_count}/{c.deliverable_count}
                  </Text>
                </View>
              </View>

              <View style={styles.cardDates}>
                <Text style={styles.dateText}>
                  {formatDate(c.start_date)} – {formatDate(c.end_date)}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.bg },

  // Header (ink topbar with yellow rule)
  header:    { backgroundColor: P.ink, paddingHorizontal: 18, paddingTop: 50, paddingBottom: 16, position: 'relative' },
  headerRule:{ position: 'absolute', left: 18, bottom: 6, width: 30, height: 3, backgroundColor: P.yellow, borderRadius: 2 },
  back:      { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  backText:  { fontFamily: fonts.monoBold, fontSize: 10.5, color: 'rgba(255,255,255,0.65)', fontWeight: '700' },
  headerTitle:{ fontFamily: fonts.displayBold, fontSize: 22, fontWeight: '800', color: P.white },
  headerSub: { fontFamily: fonts.sansMedium, fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 3 },

  // Tab pills (ink-active + bg2-inactive)
  tabsWrap:  { flexDirection: 'row', backgroundColor: P.white, borderBottomWidth: 1, borderBottomColor: P.border, paddingHorizontal: 14, paddingVertical: 10, gap: 7 },
  tabPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: P.bg2,
    borderWidth: 1,
    borderColor: P.border,
  },
  tabPillActive: { backgroundColor: P.ink, borderColor: P.ink },
  tabText:       { fontFamily: fonts.monoBold, fontSize: 10.5, fontWeight: '800', color: P.muted2, letterSpacing: 0.3 },
  tabTextActive: { color: P.yellow },

  // Loading
  centerLoader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 8 },
  loadingText:  { fontFamily: fonts.sansMedium, fontSize: 12.5, color: P.muted2 },

  // Empty (canonical pattern with MCI icon)
  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 28 },
  emptyTile: {
    width: 66, height: 66, borderRadius: 14,
    backgroundColor: P.yellowPale,
    borderWidth: 1.5, borderColor: P.yellow, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontFamily: fonts.displayBold, fontSize: 14, fontWeight: '800', color: P.ink, textAlign: 'center', marginBottom: 6 },
  emptySubtext:{ fontFamily: fonts.sansMedium, fontSize: 11.5, color: P.muted, textAlign: 'center', lineHeight: 17, maxWidth: 260 },
  retryBtn: {
    marginTop: 16,
    backgroundColor: P.ink,
    borderRadius: 12,
    paddingHorizontal: 22,
    paddingVertical: 11,
  },
  retryBtnText: { fontFamily: fonts.displayBold, fontSize: 12.5, fontWeight: '800', color: P.yellow, letterSpacing: 0.3 },

  // Campaign card
  campaignCard: {
    backgroundColor: P.white,
    marginHorizontal: 14, marginBottom: 8,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1, borderColor: P.border,
  },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 11,
  },
  brandName: { fontFamily: fonts.displayBold, fontSize: 14.5, fontWeight: '800', color: P.ink, lineHeight: 18 },
  campaignName: { fontFamily: fonts.monoBold, fontSize: 10.5, color: P.muted2, marginTop: 3 },

  cardStats: { flexDirection: 'row', gap: 14, marginBottom: 11 },
  statL: { fontFamily: fonts.monoBold, fontSize: 9, color: P.muted2, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: '700' },
  statV: { fontFamily: fonts.monoBold, fontSize: 13.5, fontWeight: '800', color: P.ink, marginTop: 2 },

  cardDates: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: P.borderSoft,
  },
  dateText: { fontFamily: fonts.monoBold, fontSize: 10.5, color: P.muted2 },
});
