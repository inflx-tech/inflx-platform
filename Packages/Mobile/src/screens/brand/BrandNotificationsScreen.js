import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { colors } from '../../theme/tokens';
import { brandApi } from '../../services/api';

const TYPE_ICONS = {
  account_approved: '[OK]', account_rejected: '[X]',
  offer_accepted: '[+]', offer_declined: '[X]',
  negotiation_turn: '[CHAT]', contract_signed: '[DOC]',
  content_submitted: '[UP]', content_approved: '[OK]', content_live: '[LIVE]',
  tranche_released: '[RS]', commission_earned: '[RS]',
  low_wallet: '[!]', withdrawal_processed: '[$]',
};

// Map backend data.screen → brand mobile navigation action. Tapping any
// notification routes the brand to the exact place that needs attention.
// The backend has been attaching `data.screen` + relevant IDs since Phase 1;
// we just consume it here.
function routeNotification(navigation, data) {
  if (!data || typeof data !== 'object') return false;
  const s = data.screen;
  switch (s) {
    case 'campaign_detail':
    case 'offer_inbox':
      if (data.campaign_id) {
        navigation.navigate('Campaigns', {
          screen: 'CampaignDetail',
          params: { campaignId: data.campaign_id },
        });
        return true;
      }
      return false;

    case 'contract_review':
    case 'contract_detail':
      if (data.campaign_influencer_id) {
        navigation.navigate('Campaigns', {
          screen: 'BrandContract',
          params: { campaignInfluencerId: data.campaign_influencer_id },
        });
        return true;
      }
      return false;

    case 'negotiation':
      if (data.negotiation_id) {
        navigation.navigate('Campaigns', {
          screen: 'BrandNegotiation',
          params: { negotiationId: data.negotiation_id },
        });
        return true;
      }
      if (data.campaign_influencer_id) {
        navigation.navigate('Campaigns', {
          screen: 'BrandNegotiation',
          params: { campaignInfluencerId: data.campaign_influencer_id },
        });
        return true;
      }
      return false;

    case 'wallet':
      navigation.navigate('Wallet');
      return true;

    case 'brand_dashboard':
      navigation.navigate('Home');
      return true;

    default:
      return false;
  }
}

export default function BrandNotificationsScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [markingAll, setMarkingAll]       = useState(false);

  async function load() {
    const res = await brandApi.getNotifications?.();
    setLoading(false);
    if (res?.success) setNotifications(res.data?.notifications || []);
  }

  useEffect(() => { load(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, []);

  async function markAllRead() {
    setMarkingAll(true);
    await brandApi.markAllNotificationsRead?.();
    setMarkingAll(false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  }

  function handlePress(n) {
    // Optimistic mark-as-read for this row; backend doesn't have a
    // per-notification endpoint yet so this stays local until next refresh.
    if (!n.is_read) {
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
    }
    const data = n.data_json || n.data || {};
    routeNotification(navigation, data);
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.navy} /></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.navy} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead} disabled={markingAll} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>{markingAll ? '...' : 'Mark all read'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {notifications.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>[BELL]</Text>
          <Text style={styles.emptyText}>No notifications yet</Text>
        </View>
      ) : (
        notifications.map(n => {
          const data = n.data_json || n.data || {};
          const hasLink = !!(data && data.screen);
          return (
            <TouchableOpacity
              key={n.id}
              style={[styles.notifCard, !n.is_read && styles.notifCardUnread]}
              activeOpacity={hasLink ? 0.7 : 1}
              onPress={() => handlePress(n)}
              disabled={!hasLink}
            >
              <Text style={styles.notifIcon}>{TYPE_ICONS[n.type] || '[*]'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.notifTitle}>{n.title}</Text>
                {n.body ? <Text style={styles.notifBody}>{n.body}</Text> : null}
                <View style={styles.notifFooter}>
                  <Text style={styles.notifTime}>
                    {n.created_at ? new Date(n.created_at).toLocaleString('en-IN') : ''}
                  </Text>
                  {hasLink && <Text style={styles.notifLinkHint}>Tap to open  ›</Text>}
                </View>
              </View>
              {!n.is_read && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          );
        })
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: colors.navyDeep, padding: 20, paddingTop: 52, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: colors.white },
  markAllBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20 },
  markAllText: { fontSize: 11, color: colors.white, fontWeight: '600' },
  emptyCard: { margin: 16, backgroundColor: colors.white, borderRadius: 16, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  emptyIcon: { fontSize: 14, fontWeight: '800', color: colors.t3, marginBottom: 8, letterSpacing: 2 },
  emptyText: { fontSize: 14, fontWeight: '700', color: colors.t1 },
  notifCard: { marginHorizontal: 16, marginTop: 10, backgroundColor: colors.white, borderRadius: 14, padding: 14, flexDirection: 'row', gap: 12, borderWidth: 1, borderColor: colors.border },
  notifCardUnread: { borderColor: colors.navy + '40', backgroundColor: colors.navy + '06' },
  notifIcon: { fontSize: 11, fontWeight: '800', color: colors.navy, marginTop: 2, letterSpacing: 0.5, minWidth: 38 },
  notifTitle: { fontSize: 13, fontWeight: '700', color: colors.t1, marginBottom: 3 },
  notifBody: { fontSize: 12, color: colors.t2, lineHeight: 18, marginBottom: 4 },
  notifFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  notifTime: { fontSize: 10, color: colors.t3 },
  notifLinkHint: { fontSize: 10, color: colors.orange, fontWeight: '700' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.navy, marginTop: 4, flexShrink: 0 },
});
