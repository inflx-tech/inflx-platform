import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { brandPalette as P, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';

const TYPE_ICONS = {
  account_approved: '[OK]', account_rejected: '[X]',
  offer_accepted: '[+]', offer_declined: '[X]',
  negotiation_turn: '[CHAT]', contract_signed: '[DOC]',
  content_submitted: '[UP]', content_approved: '[OK]', content_live: '[LIVE]',
  tranche_released: '[RS]', commission_earned: '[RS]',
  low_wallet: '[!]', withdrawal_processed: '[$]',
};

// Type → avatar tile palette. Mirrors Flow 15 brand-web notifications surface
// so a brand sees the same colour language across web + mobile.
const TYPE_AVATAR = {
  account_approved:     { bg: P.yellowPale,  fg: P.yellowText },
  account_rejected:     { bg: P.dangerPale,  fg: P.dangerText },
  offer_accepted:       { bg: P.successPale, fg: P.successText },
  offer_declined:       { bg: P.dangerPale,  fg: P.dangerText },
  negotiation_turn:     { bg: P.convPale,    fg: P.conv },
  contract_signed:      { bg: P.engPale,     fg: P.eng },
  content_submitted:    { bg: P.infoPale,    fg: P.info },
  content_approved:     { bg: P.successPale, fg: P.successText },
  content_live:         { bg: P.successPale, fg: P.successText },
  tranche_released:     { bg: P.yellowPale,  fg: P.yellowText },
  commission_earned:    { bg: P.yellowPale,  fg: P.yellowText },
  low_wallet:           { bg: P.dangerPale,  fg: P.dangerText },
  withdrawal_processed: { bg: P.yellowPale,  fg: P.yellowText },
};
const FALLBACK_AVATAR = { bg: P.bg2, fg: P.muted2 };

function fmtRelative(iso) {
  if (!iso) return '—';
  const sec = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60)      return `${sec}s ago`;
  if (sec < 3600)    return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86_400)  return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604_800) return `${Math.floor(sec / 86_400)}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

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
    return (
      <View style={styles.container}>
        <View style={styles.topbar}>
          <View style={styles.topbarL}>
            <Text style={styles.title}>Notifications</Text>
            <View style={styles.rule} />
          </View>
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={P.yellow} size="large" />
          <Text style={styles.loadingTxt}>Loading…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topbar}>
        <View style={styles.topbarL}>
          <Text style={styles.title}>Notifications</Text>
          <View style={styles.rule} />
          <View style={[styles.cntChip, unreadCount === 0 && styles.cntChipZero]}>
            <Text style={[styles.cntChipText, unreadCount === 0 && styles.cntChipTextZero]}>
              {unreadCount} UNREAD
            </Text>
          </View>
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity
            onPress={markAllRead}
            disabled={markingAll}
            style={[styles.markAllPill, markingAll && styles.markAllPillBusy]}
            activeOpacity={0.7}
          >
            <Text style={styles.markAllText}>{markingAll ? '…' : '✓ Mark all read'}</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={P.yellow}
            colors={[P.yellow]}
          />
        }
      >
        {notifications.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <Text style={styles.emptyIconText}>[BELL]</Text>
            </View>
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptySub}>
              You'll see updates here when influencers respond, contracts move, or money flows.
            </Text>
          </View>
        ) : (
          notifications.map(n => {
            const data = n.data_json || n.data || {};
            const hasLink = !!(data && data.screen);
            const av = TYPE_AVATAR[n.type] || FALLBACK_AVATAR;
            const icon = TYPE_ICONS[n.type] || '[*]';
            return (
              <TouchableOpacity
                key={n.id}
                style={[styles.notifCard, !n.is_read && styles.notifCardUnread]}
                activeOpacity={hasLink ? 0.7 : 1}
                onPress={() => handlePress(n)}
                disabled={!hasLink}
              >
                <View style={[styles.notifAvatar, { backgroundColor: av.bg }]}>
                  <Text style={[styles.notifAvatarText, { color: av.fg }]}>{icon}</Text>
                </View>
                <View style={styles.notifMid}>
                  <Text style={styles.notifTitle} numberOfLines={2}>{n.title}</Text>
                  {n.body ? (
                    <Text style={styles.notifBody} numberOfLines={3}>{n.body}</Text>
                  ) : null}
                  <View style={styles.notifFoot}>
                    <Text style={styles.notifTime}>{fmtRelative(n.created_at)}</Text>
                    {hasLink && (
                      <Text style={styles.notifLink}>
                        Tap to open <Text style={styles.notifLinkChevron}>›</Text>
                      </Text>
                    )}
                  </View>
                </View>
                {!n.is_read && <View style={styles.unreadDot} />}
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: P.bg,
  },

  // ── Topbar (ink, replaces navy) ──────────────────────────────
  topbar: {
    backgroundColor: P.ink,
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
  },
  topbarL: {
    flexDirection: 'column',
    gap: 6,
    flexShrink: 1,
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 22,
    fontWeight: '700',
    color: P.white,
    letterSpacing: -0.3,
  },
  rule: {
    width: 36,
    height: 3,
    backgroundColor: P.yellow,
    borderRadius: 2,
  },
  cntChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    backgroundColor: P.yellow,
    marginTop: 2,
  },
  cntChipZero: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  cntChipText: {
    fontFamily: fonts.monoBold,
    fontSize: 10.5,
    fontWeight: '800',
    color: P.ink,
    letterSpacing: 0.3,
  },
  cntChipTextZero: {
    color: P.white,
  },
  markAllPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: P.yellow,
    flexShrink: 0,
  },
  markAllPillBusy: {
    backgroundColor: P.yellow,
    opacity: 0.4,
  },
  markAllText: {
    fontFamily: fonts.sansBold,
    fontSize: 11.5,
    fontWeight: '700',
    color: P.ink,
  },

  // ── Scroll body ─────────────────────────────────────────────
  body: {
    flex: 1,
    backgroundColor: P.bg,
  },
  bodyContent: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 24,
  },

  // ── Notification card ───────────────────────────────────────
  notifCard: {
    backgroundColor: P.white,
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 14,
    padding: 13,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    position: 'relative',
  },
  notifCardUnread: {
    backgroundColor: P.yellow50,
    borderColor: P.yellowPale,
  },
  notifAvatar: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: P.yellowPale,
  },
  notifAvatarText: {
    fontFamily: fonts.monoBold,
    fontSize: 9.5,
    fontWeight: '800',
    color: P.yellowText,
    letterSpacing: 0.4,
  },
  notifMid: {
    flex: 1,
    minWidth: 0,
    paddingRight: 16,
    flexDirection: 'column',
    gap: 3,
  },
  notifTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 13.5,
    fontWeight: '700',
    color: P.ink,
    lineHeight: 18,
  },
  notifBody: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: P.muted,
    lineHeight: 17,
    fontWeight: '500',
  },
  notifFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  notifTime: {
    fontFamily: fonts.monoBold,
    fontSize: 10,
    fontWeight: '600',
    color: P.muted3,
  },
  notifLink: {
    fontFamily: fonts.sansBold,
    fontSize: 10.5,
    fontWeight: '700',
    color: P.yellowText,
  },
  notifLinkChevron: {
    fontFamily: fonts.monoBold,
    color: P.yellow,
    fontWeight: '800',
  },
  unreadDot: {
    position: 'absolute',
    top: 14,
    right: 13,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: P.yellow,
  },

  // ── Empty state ─────────────────────────────────────────────
  emptyCard: {
    marginTop: 24,
    marginHorizontal: 2,
    backgroundColor: P.white,
    borderWidth: 1.5,
    borderColor: P.yellowPale,
    borderStyle: 'dashed',
    borderRadius: 18,
    paddingVertical: 42,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 10,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: P.yellowPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconText: {
    fontFamily: fonts.monoBold,
    fontSize: 12,
    fontWeight: '800',
    color: P.yellowText,
    letterSpacing: 0.4,
  },
  emptyTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 14,
    fontWeight: '700',
    color: P.ink,
  },
  emptySub: {
    fontFamily: fonts.sansMedium,
    fontSize: 11.5,
    color: P.muted,
    lineHeight: 17,
    textAlign: 'center',
    maxWidth: 240,
  },

  // ── Loading state ──────────────────────────────────────────
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 80,
  },
  loadingTxt: {
    fontFamily: fonts.monoBold,
    fontSize: 11,
    color: P.muted2,
  },
});
