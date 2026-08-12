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
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { brandPalette as P, fonts } from '../../theme/tokens';
import { influencerApi } from '../../services/api';

// ─── Notification icon map (10 MCI categories with semantic color tones) ──
// Collapsed from the wave-1 20-emoji map. Same mapping is duplicated in
// HomeScreen.js for the Recent Activity preview — keep in sync.
function getNotificationIcon(type) {
  const map = {
    offer_received:        { name: 'tag-outline',            tone: 'neutral' },
    offer_accepted:        { name: 'tag-outline',            tone: 'neutral' },
    offer_declined:        { name: 'tag-outline',            tone: 'neutral' },
    offer_expired:         { name: 'tag-outline',            tone: 'danger' },
    negotiation_update:    { name: 'handshake-outline',      tone: 'conv' },
    contract_ready:        { name: 'file-document-outline',  tone: 'neutral' },
    contract_signed:       { name: 'file-document-outline',  tone: 'neutral' },
    content_submitted:     { name: 'image-outline',          tone: 'info' },
    content_approved:      { name: 'image-outline',          tone: 'info' },
    content_revision:      { name: 'image-outline',          tone: 'info' },
    content_live:          { name: 'image-outline',          tone: 'info' },
    tranche_released:      { name: 'currency-inr',           tone: 'success' },
    commission_earned:     { name: 'currency-inr',           tone: 'success' },
    commission_confirmed:  { name: 'currency-inr',           tone: 'success' },
    withdrawal_processed:  { name: 'bank-outline',           tone: 'success' },
    withdrawal_failed:     { name: 'bank-outline',           tone: 'danger' },
    campaign_update:       { name: 'bullhorn-outline',       tone: 'neutral' },
    account_approved:      { name: 'account-check-outline',  tone: 'neutral' },
    account_rejected:      { name: 'account-check-outline',  tone: 'danger' },
    general:               { name: 'bell-outline',           tone: 'neutral' },
  };
  return map[type] || map.general;
}

const TONE_BG = { neutral: P.bg2,   info: P.infoPale, conv: P.convPale, success: P.successPale, danger: P.dangerPale };
const TONE_FG = { neutral: P.muted, info: P.info,     conv: P.conv,     success: P.successText, danger: P.dangerText };

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

// Cross-tab nested deep-link routing — all 18 type branches preserved verbatim.
function getNavTarget(type, dataJson) {
  switch (type) {
    // Collabs tab (features/collabs-list) absorbs the old Offers/Campaigns tabs.
    case 'offer_received':
    case 'offer_expired':
      // Unified hub (features/collab-detail); offer_id === campaign_influencer_id.
      return dataJson?.offer_id ? { screen: 'Collabs', params: { screen: 'CollabDetail', params: { campaignInfluencerId: dataJson.offer_id } } } : null;
    case 'contract_ready':
    case 'contract_signed':
      return dataJson?.contract_id ? { screen: 'Collabs', params: { screen: 'Contract', params: { contractId: dataJson.contract_id } } } : null;
    case 'content_approved':
    case 'content_submitted':
    case 'content_revision':
    case 'content_live':
      return dataJson?.deliverable_id ? { screen: 'Collabs', params: { screen: 'Deliverable', params: { deliverableId: dataJson.deliverable_id } } } : null;
    case 'tranche_released':
    case 'commission_earned':
    case 'commission_confirmed':
    case 'withdrawal_processed':
    case 'withdrawal_failed':
      return { screen: 'Earnings' };
    case 'negotiation_update':
      return dataJson?.negotiation_id ? { screen: 'Collabs', params: { screen: 'Negotiation', params: { negotiationId: dataJson.negotiation_id } } } : null;
    // collab-part2 — the pre-campaign handshake. A brand asked for you, countered you,
    // or agreed your terms. All live in the Profile stack next to your pitches.
    case 'collab_request.received':
    case 'collab_request.countered':
      return dataJson?.request_id
        ? { screen: 'Profile', params: { screen: 'CollabRequestDetail', params: { requestId: dataJson.request_id } } }
        : { screen: 'Profile', params: { screen: 'ProposalsHub' } };
    // collab-part5 — a brand closed a collaboration. Their products came off the shopping
    // app, so send them to Collabs where the campaign now reads Completed.
    case 'campaign.ended':
      return { screen: 'Collabs' };
    case 'collab_request.agreed':
    case 'proposal.accepted':
      // Terms agreed — the campaign details arrive next; until then the hub shows it.
      return { screen: 'Profile', params: { screen: 'ProposalsHub' } };
    default:
      return null;
  }
}

function NotificationCard({ item, onPress }) {
  const isUnread = !item.is_read;
  const ic = getNotificationIcon(item.type);
  const tileBg = isUnread ? P.yellowPale : TONE_BG[ic.tone];
  const tileFg = isUnread ? P.yellowText : TONE_FG[ic.tone];
  return (
    <TouchableOpacity
      style={[styles.card, isUnread && styles.cardUnread]}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      {isUnread && <View style={styles.unreadDot} />}
      <View style={[styles.iconWrap, { backgroundColor: tileBg }]}>
        <Icon name={ic.name} size={20} color={tileFg} />
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
    // Mark as read locally (mirrors original behaviour)
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
        <ActivityIndicator size="large" color={P.ink} />
        <Text style={styles.loadingText}>Loading notifications...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ─── Header ─── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backRow}>
          <Icon name="chevron-left" size={16} color="rgba(255,255,255,0.65)" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity
            style={styles.markAllBtn}
            onPress={handleMarkAllRead}
            disabled={markingRead}
          >
            {markingRead ? (
              <ActivityIndicator size="small" color={P.ink} />
            ) : (
              <>
                <Icon name="check-all" size={14} color={P.ink} />
                <Text style={styles.markAllText}>MARK ALL AS READ ({unreadCount})</Text>
              </>
            )}
          </TouchableOpacity>
        )}
        <View style={styles.headerRule} />
      </View>

      {/* ─── Error ─── */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ─── Empty OR list ─── */}
      {notifications.length === 0 && !error ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyTile}>
            <Icon name="bell-outline" size={32} color={P.yellowText} />
          </View>
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptyMsg}>
            When you receive offers, contract updates, or payment notifications they'll appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={P.ink} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.bg },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: P.bg },
  loadingText: { marginTop: 12, fontFamily: fonts.sansMedium, fontSize: 13, color: P.muted2 },

  // Header (ink topbar with yellow rule)
  header: { backgroundColor: P.ink, paddingTop: 50, paddingHorizontal: 18, paddingBottom: 16, position: 'relative' },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  backText: { fontFamily: fonts.monoBold, fontSize: 10.5, fontWeight: '700', color: 'rgba(255,255,255,0.65)' },
  headerTitle: { fontFamily: fonts.displayBold, fontSize: 20, fontWeight: '800', color: P.white, marginBottom: 10 },
  markAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: P.yellow,
    borderRadius: 8,
    paddingHorizontal: 13,
    paddingVertical: 7,
    alignSelf: 'flex-start',
  },
  markAllText: { fontFamily: fonts.monoBold, fontSize: 10, fontWeight: '800', color: P.ink, letterSpacing: 0.3 },
  headerRule: { position: 'absolute', left: 18, bottom: 6, width: 30, height: 3, backgroundColor: P.yellow, borderRadius: 2 },

  // Error
  errorBanner: {
    backgroundColor: P.dangerPale,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row', alignItems: 'center',
    margin: 14,
  },
  errorText: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 12, color: P.dangerText },
  retryText: { fontFamily: fonts.monoBold, fontSize: 11, fontWeight: '800', color: P.dangerText, marginLeft: 8 },

  // List
  listContent: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 24 },

  // Card
  card: {
    flexDirection: 'row',
    backgroundColor: P.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 7,
    borderWidth: 1,
    borderColor: P.border,
    position: 'relative',
  },
  cardUnread: { backgroundColor: P.yellow50, borderColor: '#F0DA88' },
  unreadDot: {
    position: 'absolute',
    top: 14, left: 6,
    width: 6, height: 6,
    borderRadius: 3,
    backgroundColor: P.yellow,
  },
  iconWrap: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 11,
    flexShrink: 0,
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardTitle: { fontFamily: fonts.displayBold, fontSize: 12.5, fontWeight: '700', color: P.ink, marginBottom: 2 },
  cardTitleUnread: { fontWeight: '800' },
  cardMsg: { fontFamily: fonts.sansMedium, fontSize: 11, color: P.muted, lineHeight: 16, marginBottom: 4 },
  cardTime: { fontFamily: fonts.monoBold, fontSize: 9.5, color: P.muted2, fontWeight: '700' },

  // Empty
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyTile: {
    width: 66, height: 66,
    borderRadius: 14,
    backgroundColor: P.yellowPale,
    borderWidth: 1.5,
    borderColor: P.yellow,
    borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontFamily: fonts.displayBold, fontSize: 14, fontWeight: '800', color: P.ink, marginBottom: 6 },
  emptyMsg: { fontFamily: fonts.sansMedium, fontSize: 11.5, color: P.muted, textAlign: 'center', lineHeight: 17 },
});
