import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { colors } from '../../theme/tokens';
import { brandApi } from '../../services/api';

const TYPE_ICONS = {
  account_approved: '✅', account_rejected: '❌',
  offer_accepted: '🎉', offer_declined: '❌',
  negotiation_turn: '💬', contract_signed: '📄',
  content_submitted: '🎬', content_approved: '✅', content_live: '🚀',
  tranche_released: '💰', commission_earned: '💸',
  low_wallet: '⚠️', withdrawal_processed: '💳',
};

export default function BrandNotificationsScreen() {
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
            <Text style={styles.markAllText}>{markingAll ? '…' : 'Mark all read'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {notifications.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={{ fontSize: 32, marginBottom: 8 }}>🔔</Text>
          <Text style={styles.emptyText}>No notifications yet</Text>
        </View>
      ) : (
        notifications.map(n => (
          <View key={n.id} style={[styles.notifCard, !n.is_read && styles.notifCardUnread]}>
            <Text style={styles.notifIcon}>{TYPE_ICONS[n.type] || '🔔'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.notifTitle}>{n.title}</Text>
              {n.body ? <Text style={styles.notifBody}>{n.body}</Text> : null}
              <Text style={styles.notifTime}>
                {n.created_at ? new Date(n.created_at).toLocaleString('en-IN') : ''}
              </Text>
            </View>
            {!n.is_read && <View style={styles.unreadDot} />}
          </View>
        ))
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
  emptyText: { fontSize: 14, fontWeight: '700', color: colors.t1 },
  notifCard: { marginHorizontal: 16, marginTop: 10, backgroundColor: colors.white, borderRadius: 14, padding: 14, flexDirection: 'row', gap: 12, borderWidth: 1, borderColor: colors.border },
  notifCardUnread: { borderColor: colors.navy + '40', backgroundColor: colors.navy + '06' },
  notifIcon: { fontSize: 22, marginTop: 2 },
  notifTitle: { fontSize: 13, fontWeight: '700', color: colors.t1, marginBottom: 3 },
  notifBody: { fontSize: 12, color: colors.t2, lineHeight: 18, marginBottom: 4 },
  notifTime: { fontSize: 10, color: colors.t3 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.navy, marginTop: 4, flexShrink: 0 },
});
