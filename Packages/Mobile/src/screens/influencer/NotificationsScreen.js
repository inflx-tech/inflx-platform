import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { colors, radius, spacing } from '../../theme/tokens';
import { influencerApi } from '../../services/api';

const NOTIFICATION_ICONS = {
  offer_received: '📩',
  offer_expired: '⏰',
  offer_accepted: '✅',
  offer_declined: '❌',
  negotiation_update: '🤝',
  contract_ready: '📝',
  contract_signed: '✍️',
  content_submitted: '📤',
  content_approved: '🎉',
  content_revision: '🔄',
  content_live: '📺',
  tranche_released: '💸',
  commission_earned: '💰',
  commission_confirmed: '✅',
  withdrawal_processed: '🏦',
  withdrawal_failed: '⚠️',
  campaign_update: '📢',
  account_approved: '🎊',
  account_rejected: '🚫',
  general: '🔔',
};

function getIcon(type) {
  return NOTIFICATION_ICONS[type] || NOTIFICATION_ICONS.general;
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek < 5) return `${diffWeek}w ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function getNavTarget(type, dataJson) {
  switch (type) {
    case 'offer_received':
    case 'offer_expired':
      return dataJson?.offer_id ? { screen: 'Offers', params: { screen: 'OfferDetail', params: { offerId: dataJson.offer_id } } } : null;
    case 'contract_ready':
    case 'contract_signed':
      return dataJson?.contract_id ? { screen: 'Offers', params: { screen: 'Contract', params: { contractId: dataJson.contract_id } } } : null;
    case 'content_approved':
    case 'content_submitted':
    case 'content_revision':
    case 'content_live':
      return dataJson?.deliverable_id ? { screen: 'Offers', params: { screen: 'Deliverable', params: { deliverableId: dataJson.deliverable_id } } } : null;
    case 'tranche_released':
    case 'commission_earned':
    case 'commission_confirmed':
    case 'withdrawal_processed':
    case 'withdrawal_failed':
      return { screen: 'Earnings' };
    case 'negotiation_update':
      return dataJson?.negotiation_id ? { screen: 'Offers', params: { screen: 'Negotiation', params: { negotiationId: dataJson.negotiation_id } } } : null;
    default:
      return null;
  }
}

function NotificationCard({ item, onPress }) {
  const isUnread = !item.is_read;
  return (
    <TouchableOpacity
      style={[styles.card, isUnread && styles.cardUnread]}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      {isUnread && <View style={styles.unreadDot} />}
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>{getIcon(item.type)}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, isUnread && styles.cardTitleUnread]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.cardMsg} numberOfLines={2}>{item.body}</Text>
        <Text style={styles.cardTime}>{timeAgo(item.created_at)}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function NotificationsScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [markingRead, setMarkingRead] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const res = await influencerApi.getNotifications();
    setLoading(false);
    if (res.success) {
      setNotifications(res.data || []);
    } else {
      setError(res.error?.message || 'Failed to load notifications');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleMarkAllRead = useCallback(async () => {
    setMarkingRead(true);
    const res = await influencerApi.markAllNotificationsRead();
    if (res.success) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    }
    setMarkingRead(false);
  }, []);

  const handlePress = useCallback((item) => {
    // Mark as read locally
    if (!item.is_read) {
      setNotifications(prev =>
        prev.map(n => n.id === item.id ? { ...n, is_read: true } : n)
      );
    }

    const target = getNavTarget(item.type, item.data_json);
    if (target) {
      navigation.navigate(target.screen, target.params);
    }
  }, [navigation]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const renderItem = useCallback(({ item }) => (
    <NotificationCard item={item} onPress={handlePress} />
  ), [handlePress]);

  const keyExtractor = useCallback((item) => String(item.id), []);

  if (loading) {
    return (
      <View style={styles.centerWrap}>
        <ActivityIndicator size="large" color={colors.navy} />
        <Text style={styles.loadingText}>Loading notifications...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backIcon}>{'<'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={{ width: 36 }} />
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity
            style={styles.markAllBtn}
            onPress={handleMarkAllRead}
            disabled={markingRead}
          >
            {markingRead ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.markAllText}>Mark all as read ({unreadCount})</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Error state */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* List or empty */}
      {notifications.length === 0 && !error ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyIcon}>🔔</Text>
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptyMsg}>
            When you receive offers, contract updates, or payment notifications they will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.navy} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  loadingText: { marginTop: 12, fontSize: 13, color: colors.t3, fontWeight: '500' },

  // Header
  header: { backgroundColor: colors.navyDeep, paddingTop: 52, paddingHorizontal: 16, paddingBottom: 14 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)' },
  backIcon: { fontSize: 18, color: colors.white, fontWeight: '700' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.white },
  markAllBtn: {
    marginTop: 10,
    backgroundColor: colors.orange,
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  markAllText: { fontSize: 12, fontWeight: '700', color: colors.white },

  // Error
  errorBanner: { backgroundColor: colors.redPale, borderRadius: radius.md, padding: 12, flexDirection: 'row', alignItems: 'center', margin: 16 },
  errorText: { flex: 1, fontSize: 13, color: colors.red },
  retryText: { fontSize: 12, fontWeight: '700', color: colors.red, marginLeft: 8 },

  // List
  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },

  // Card
  card: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
  },
  cardUnread: { backgroundColor: colors.navyPale, borderColor: colors.navyMid + '30' },
  unreadDot: {
    position: 'absolute',
    top: 14,
    left: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.orange,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  icon: { fontSize: 20 },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: colors.t1, marginBottom: 2 },
  cardTitleUnread: { fontWeight: '800' },
  cardMsg: { fontSize: 12, color: colors.t3, lineHeight: 17, marginBottom: 4 },
  cardTime: { fontSize: 10, color: colors.t3, fontWeight: '500' },

  // Empty
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.t1, marginBottom: 8 },
  emptyMsg: { fontSize: 13, color: colors.t3, textAlign: 'center', lineHeight: 19 },
});
