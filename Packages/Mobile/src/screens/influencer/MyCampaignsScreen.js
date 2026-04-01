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
import { colors, fmtMoney, fmtRupees } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import StatusBadge from '../../components/StatusBadge';

function formatDate(dateStr) {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const TABS = [
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'all', label: 'All' },
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
          <Text style={styles.backText}>{'<-'} Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Campaigns</Text>
        <Text style={styles.headerSub}>Track your active and past campaigns</Text>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            onPress={() => { setLoading(true); setTab(t.key); }}
            style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.navy} />}
      >
        {loading ? (
          <View style={styles.centerLoader}>
            <ActivityIndicator size="small" color={colors.navy} />
            <Text style={styles.loadingText}>Loading campaigns...</Text>
          </View>
        ) : error ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>!</Text>
            <Text style={styles.emptyTitle}>Something went wrong</Text>
            <Text style={styles.emptySubtext}>{error}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => { setLoading(true); setError(null); load(tab); }}
            >
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : campaigns.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>{'[  ]'}</Text>
            <Text style={styles.emptyTitle}>
              No {tab === 'all' ? '' : tab} campaigns
            </Text>
            <Text style={styles.emptySubtext}>
              Accept offers to start working on campaigns
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
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.brandName}>{c.brand_name || 'Brand'}</Text>
                  <Text style={styles.campaignName}>{c.campaign_name}</Text>
                </View>
                <StatusBadge status={c.influencer_status} />
              </View>

              <View style={styles.cardStats}>
                <View style={styles.cardStat}>
                  <Text style={styles.cardStatLabel}>Fee</Text>
                  <Text style={styles.cardStatVal}>{fmtRupees(c.agreed_fee)}</Text>
                </View>
                <View style={styles.cardStat}>
                  <Text style={styles.cardStatLabel}>Goal</Text>
                  <Text style={styles.cardStatVal}>
                    {(c.goal || '--').replace(/_/g, ' ').replace(/^\w/, ch => ch.toUpperCase())}
                  </Text>
                </View>
                <View style={styles.cardStat}>
                  <Text style={styles.cardStatLabel}>Deliverables</Text>
                  <Text style={styles.cardStatVal}>
                    {c.approved_count}/{c.deliverable_count}
                  </Text>
                </View>
              </View>

              <View style={styles.cardDates}>
                <Text style={styles.dateText}>
                  {formatDate(c.start_date)} - {formatDate(c.end_date)}
                </Text>
                {c.set_name && (
                  <Text style={styles.setName}>Set: {c.set_name}</Text>
                )}
              </View>
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

  // Header
  header: { backgroundColor: colors.navyDeep, paddingTop: 52, paddingHorizontal: 20, paddingBottom: 16 },
  back: { marginBottom: 8 },
  backText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.white },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  tabBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surface2,
  },
  tabBtnActive: { backgroundColor: colors.navy },
  tabText: { fontSize: 12, fontWeight: '600', color: colors.t3 },
  tabTextActive: { color: colors.white },

  // Loading / Empty
  centerLoader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 8 },
  loadingText: { fontSize: 13, color: colors.t3 },
  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 36, marginBottom: 12, color: colors.t3 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.t1, marginBottom: 4 },
  emptySubtext: { fontSize: 13, color: colors.t3, textAlign: 'center' },
  retryBtn: {
    marginTop: 16,
    backgroundColor: colors.navy,
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retryBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },

  // Campaign card
  campaignCard: {
    backgroundColor: colors.white,
    margin: 16,
    marginBottom: 0,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  brandName: { fontSize: 15, fontWeight: '700', color: colors.t1 },
  campaignName: { fontSize: 12, color: colors.t3, marginTop: 2 },

  cardStats: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  cardStat: {},
  cardStatLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.t3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardStatVal: { fontSize: 14, fontWeight: '700', color: colors.t1, marginTop: 2 },

  cardDates: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  dateText: { fontSize: 11, color: colors.t3 },
  setName: { fontSize: 11, color: colors.t3, fontStyle: 'italic' },
});
