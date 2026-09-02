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
  // The server names types with dots (contract.ready); this map is keyed with
  // underscores (contract_ready), so NOTHING matched and every notification showed the
  // generic bell. Same root cause as the routing bug below — normalise and try again.
  const t = String(type || '');
  return map[t] || map[t.replace(/\./g, '_')] || map.general;
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

// ── Where a notification opens ──────────────────────────────────────────────
//
// THIS USED TO MATCH ON THE TYPE NAME, AND ALMOST NOTHING MATCHED.
// The server names its notifications with dots (contract.ready, negotiation.turn,
// deliverable.approved, tranche.released). This screen was matching underscores
// (contract_ready, negotiation_update, content_approved, tranche_released). Of the
// 19 types it handled, exactly ONE — campaign.ended — was a name the server actually
// sends. Every other notification tap in the creator app did nothing at all.
//
// So it no longer routes on the type. Every notification the server sends already
// carries data.screen — an explicit statement of where it belongs, written by the
// same code that sent it. Routing on that is correct by construction, and cannot
// drift the way two hand-kept lists of names did.
//
// The type is still used as a fallback for older rows already sitting in someone's
// list, written before this was fixed.
const SCREEN_ROUTES = {
  // She has been invited, or the offer lapsed.
  offer_inbox:        (d) => ci(d) && { screen: 'Collabs', params: { screen: 'CollabDetail', params: { campaignInfluencerId: ci(d) } } },
  open_offers:        () => ({ screen: 'Collabs' }),
  offers:             () => ({ screen: 'Collabs' }),
  collabs:            () => ({ screen: 'Collabs' }),
  // A contract to read or sign. ContractScreen opens by COLLABORATION id, which is
  // exactly what the server puts in this notification.
  contract_detail:    (d) => ci(d) && { screen: 'Collabs', params: { screen: 'Contract', params: { campaignInfluencerId: ci(d) } } },
  contract_review:    (d) => ci(d) && { screen: 'Collabs', params: { screen: 'Contract', params: { campaignInfluencerId: ci(d) } } },
  // The brand replied to her terms. NegotiationScreen reads negotiation_id.
  negotiation:        (d) => d?.negotiation_id && { screen: 'Collabs', params: { screen: 'Negotiation', params: { negotiation_id: d.negotiation_id } } },
  // Content she submitted.
  deliverable_detail: (d) => d?.deliverable_id && { screen: 'Collabs', params: { screen: 'Deliverable', params: { deliverableId: d.deliverable_id } } },
  // Money.
  earnings:           () => ({ screen: 'Earnings' }),
  withdrawals:        () => ({ screen: 'Earnings' }),
  wallet:             () => ({ screen: 'Earnings' }),
  // Her own pitches.
  my_proposals:       () => ({ screen: 'Profile', params: { screen: 'ProposalsHub' } }),
  // Whole-campaign news with no single screen of its own.
  campaign_detail:    () => ({ screen: 'Collabs' }),
  influencer_home:    () => ({ screen: 'Home' }),
  home:               () => ({ screen: 'Home' }),
};

/** The collaboration id, under any of the names the server has used for it. */
function ci(d) {
  return d?.campaign_influencer_id || d?.offer_id || null;
}

function getNavTarget(type, dataJson) {
  const d = dataJson || {};

  // 1 · what the server said, which is the answer for everything it sends today.
  const byScreen = SCREEN_ROUTES[d.screen];
  if (byScreen) {
    const target = byScreen(d);
    if (target) return target;
  }

  // 2 · older rows already in someone's list, from before the server carried a screen.
  //     Both naming conventions are accepted so nothing sitting there goes dead.
  const t = String(type || '').replace(/\./g, '_');
  if (t === 'offer_received' || t === 'offer_invited' || t === 'offer_expired' || t === 'offer_declined') {
    return ci(d) ? { screen: 'Collabs', params: { screen: 'CollabDetail', params: { campaignInfluencerId: ci(d) } } } : { screen: 'Collabs' };
  }
  if (t.startsWith('contract_')) {
    return ci(d) ? { screen: 'Collabs', params: { screen: 'Contract', params: { campaignInfluencerId: ci(d) } } } : { screen: 'Collabs' };
  }
  if (t.startsWith('negotiation_')) {
    return d.negotiation_id ? { screen: 'Collabs', params: { screen: 'Negotiation', params: { negotiation_id: d.negotiation_id } } } : { screen: 'Collabs' };
  }
  if (t.startsWith('deliverable_') || t.startsWith('content_')) {
    return d.deliverable_id ? { screen: 'Collabs', params: { screen: 'Deliverable', params: { deliverableId: d.deliverable_id } } } : { screen: 'Collabs' };
  }
  if (t.startsWith('tranche_') || t.startsWith('commission_') || t.startsWith('withdrawal_') || t.startsWith('sale_commission_')) {
    return { screen: 'Earnings' };
  }
  if (t.startsWith('campaign_')) return { screen: 'Collabs' };
  if (t.startsWith('proposal_')) return { screen: 'Profile', params: { screen: 'ProposalsHub' } };

  return null;
}

function NotificationCard({ item, onPress }) {
  const isUnread = !item.is_read;
  const ic = getNotificationIcon(item.type);
  const tileBg = isUnread ? P.bg2 : TONE_BG[ic.tone];
  const tileFg = isUnread ? P.ink : TONE_FG[ic.tone];
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
          <Icon name="chevron-left" size={16} color={P.muted2} />
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
              <ActivityIndicator size="small" color={P.white} />
            ) : (
              <>
                <Icon name="check-all" size={14} color={P.white} />
                <Text style={styles.markAllText}>MARK ALL AS READ ({unreadCount})</Text>
              </>
            )}
          </TouchableOpacity>
        )}
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
            <Icon name="bell-outline" size={32} color={P.ink} />
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

  // Header (white topbar, ink text, hairline rule)
  header: { backgroundColor: P.white, paddingTop: 50, paddingHorizontal: 18, paddingBottom: 16, position: 'relative', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.border },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  backText: { fontFamily: fonts.monoBold, fontSize: 10.5, fontWeight: '700', color: P.muted2 },
  headerTitle: { fontFamily: fonts.displayBold, fontSize: 20, fontWeight: '800', color: P.ink, marginBottom: 10 },
  markAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: P.ink,
    borderRadius: 8,
    paddingHorizontal: 13,
    paddingVertical: 7,
    alignSelf: 'flex-start',
  },
  markAllText: { fontFamily: fonts.monoBold, fontSize: 10, fontWeight: '800', color: P.white, letterSpacing: 0.3 },

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
  cardUnread: { backgroundColor: P.bg2, borderColor: P.border },
  unreadDot: {
    position: 'absolute',
    top: 14, left: 6,
    width: 6, height: 6,
    borderRadius: 3,
    backgroundColor: P.warn,
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
    backgroundColor: P.bg2,
    borderWidth: 1.5,
    borderColor: P.ink,
    borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontFamily: fonts.displayBold, fontSize: 14, fontWeight: '800', color: P.ink, marginBottom: 6 },
  emptyMsg: { fontFamily: fonts.sansMedium, fontSize: 11.5, color: P.muted, textAlign: 'center', lineHeight: 17 },
});
