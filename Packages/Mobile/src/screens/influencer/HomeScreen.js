import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { brandPalette as P, fonts, fmtRupees } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import StatusPill from '../../components/brand/StatusPill';

// ─── Notification type → action-tile category mapping ──────────────────────
// Mirrors NotificationsScreen.js — client-side derivation, no new endpoint.
const ATTENTION_TYPES = ['offer_received', 'contract_ready', 'content_revision', 'negotiation_update'];

function timeAgoShort(dateStr) {
  if (!dateStr) return '';
  const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  const d = Math.floor(diffSec / 86400);
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatDateShort(dateStr) {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function greetingForHour() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// Notification card icon mapping (collapsed from 20 emoji types → 10 MCI categories
// with semantic color tones). Mirrors NotificationsScreen.js.
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

const TONE_BG = { neutral: P.bg2,         info: P.infoPale,   conv: P.convPale,   success: P.successPale, danger: P.dangerPale };
const TONE_FG = { neutral: P.muted,       info: P.info,       conv: P.conv,       success: P.successText, danger: P.dangerText };

function brandInitials(name) {
  if (!name) return '?';
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

// ─── Screen ────────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const [earnings, setEarnings] = useState(null);
  const [activeCampaigns, setActiveCampaigns] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    const [earningsRes, campaignsRes] = await Promise.all([
      influencerApi.getEarnings(),
      influencerApi.getMyCampaigns('active'),
    ]);
    setLoading(false);
    if (earningsRes.success) setEarnings(earningsRes.data);
    if (campaignsRes.success) setActiveCampaigns((campaignsRes.data?.campaigns || []).slice(0, 3));
  }

  async function loadNotifications() {
    const res = await influencerApi.getNotifications();
    if (res.success && Array.isArray(res.data)) setNotifications(res.data);
  }

  useEffect(() => { load(); loadNotifications(); }, []);

  // Refresh notifications when screen gains focus (e.g. returning from Notifications)
  useFocusEffect(useCallback(() => { loadNotifications(); }, []));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([load(), loadNotifications()]);
    setRefreshing(false);
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // Counts derived client-side from already-loaded notifications array.
  // Zero new backend endpoint.
  const unreadCount       = notifications.filter(n => !n.is_read).length;
  const pendingOffers     = notifications.filter(n => !n.is_read && n.type === 'offer_received').length;
  const contractsToSign   = notifications.filter(n => !n.is_read && n.type === 'contract_ready').length;
  const contentRevisions  = notifications.filter(n => !n.is_read && n.type === 'content_revision').length;
  const negotiationsLive  = notifications.filter(n => !n.is_read && n.type === 'negotiation_update').length;
  const attentionTotal    = pendingOffers + contractsToSign + contentRevisions + negotiationsLive;
  const recentUnread      = notifications.filter(n => !n.is_read).slice(0, 3);

  const walletBalance = earnings?.available_to_withdraw ?? earnings?.wallet_balance ?? 0;

  return (
    <ScrollView
      style={styles.outer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={P.ink} />}
    >
      {/* ─── Header ─── */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>[LOGO]</Text>
          </View>
          <TouchableOpacity style={styles.bellBtn} onPress={() => navigation.navigate('Notifications')}>
            <Icon name="bell-outline" size={20} color="rgba(255,255,255,0.9)" />
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        <View style={styles.headerRule} />
      </View>

      {/* ─── Greeting ─── */}
      <View style={styles.greet}>
        <Text style={styles.greetTitle}>{greetingForHour()}</Text>
        {attentionTotal > 0 ? (
          <Text style={styles.greetSub}>
            You have <Text style={styles.greetSubCount}>{attentionTotal}</Text> {attentionTotal === 1 ? 'thing that needs' : 'things that need'} your attention today.
          </Text>
        ) : (
          <Text style={styles.greetSub}>You're all caught up. Keep an eye out for new offers.</Text>
        )}
      </View>

      {/* ─── 3 attention tiles ─── */}
      <View style={styles.actionRow}>
        <ActionTile
          icon="tag-outline"
          count={pendingOffers}
          label="Pending offers"
          onPress={() => navigation.navigate('Collabs')}
        />
        <ActionTile
          icon="signature-text"
          count={contractsToSign}
          label="Contracts to sign"
          onPress={() => navigation.navigate('Profile', { screen: 'MyContracts' })}
        />
        <ActionTile
          icon="image-outline"
          count={contentRevisions}
          label="Content revisions"
          onPress={() => navigation.navigate('Collabs')}
        />
      </View>

      {/* ─── Create Post (Post/Concept P2 — the Post Composer) ─── */}
      <TouchableOpacity
        style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: '#1A1A1A', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center' }}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('PostComposer')}
      >
        <Text style={{ fontSize: 20, marginRight: 10 }}>📸</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>Create Post</Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>Pick a concept → photos → tag products</Text>
        </View>
        <Text style={{ color: '#F6B11E', fontSize: 18 }}>→</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={{ marginHorizontal: 16, marginTop: 8, borderWidth: 1.5, borderColor: '#EEE', borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center' }}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('MyPosts')}
      >
        <Text style={{ fontSize: 16, marginRight: 10 }}>🖼️</Text>
        <Text style={{ flex: 1, color: '#1A1A1A', fontWeight: '700', fontSize: 13 }}>My Posts</Text>
        <Text style={{ color: '#999', fontSize: 16 }}>›</Text>
      </TouchableOpacity>

      {/* ─── Active Campaigns ─── */}
      {activeCampaigns.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Active Campaigns</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Collabs')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          {activeCampaigns.map(c => (
            <TouchableOpacity
              key={c.campaign_influencer_id}
              style={styles.listRow}
              onPress={() => navigation.navigate('CampaignDetail', { campaignInfluencerId: c.campaign_influencer_id })}
            >
              <View style={styles.brandThumb}>
                <Text style={styles.brandThumbText}>{brandInitials(c.brand_name)}</Text>
              </View>
              <View style={styles.lrMid}>
                <Text style={styles.lrName} numberOfLines={1}>{c.campaign_name}</Text>
                <Text style={styles.lrSub} numberOfLines={1}>
                  {c.brand_name} · {formatDateShort(c.start_date)}–{formatDateShort(c.end_date)}
                </Text>
              </View>
              <StatusPill status={c.influencer_status} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ─── Recent Activity (top 3 unread notifications) ─── */}
      {recentUnread.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Notifications')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          {recentUnread.map(n => {
            const ic = getNotificationIcon(n.type);
            return (
              <View key={n.id} style={[styles.actCard, styles.actCardUnread]}>
                <View style={[styles.actIcoTile, { backgroundColor: TONE_BG[ic.tone] }]}>
                  <Icon name={ic.name} size={18} color={TONE_FG[ic.tone]} />
                </View>
                <View style={styles.actMid}>
                  <Text style={styles.actTitle} numberOfLines={1}>{n.title}</Text>
                  <Text style={styles.actMsg} numberOfLines={2}>{n.body}</Text>
                  <Text style={styles.actTime}>{timeAgoShort(n.created_at)}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* ─── Wallet glance (compact bottom strip) ─── */}
      <TouchableOpacity style={styles.walletGlance} onPress={() => navigation.navigate('Earnings')}>
        <View style={styles.walletGlanceIco}>
          <Icon name="wallet-outline" size={20} color={P.yellow} />
        </View>
        <View style={styles.walletGlanceMid}>
          <Text style={styles.walletGlanceLabel}>Available to withdraw</Text>
          <Text style={styles.walletGlanceVal}>{fmtRupees(walletBalance)}</Text>
        </View>
        <View style={styles.walletGlanceCTA}>
          <Text style={styles.walletGlanceCTAText}>WITHDRAW</Text>
          <Icon name="chevron-right" size={14} color="rgba(255,255,255,0.85)" />
        </View>
      </TouchableOpacity>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

// ─── ActionTile ─────────────────────────────────────────────────────────────
function ActionTile({ icon, count, label, onPress }) {
  const attention = count > 0;
  return (
    <TouchableOpacity
      style={[styles.actionTile, attention && styles.actionTileAttention]}
      onPress={onPress}
    >
      <View style={[styles.actionIcoTile, attention && styles.actionIcoTileAttention]}>
        <Icon name={icon} size={18} color={attention ? P.ink : P.muted} />
      </View>
      <Icon
        name="chevron-right"
        size={15}
        color={attention ? P.ink : P.muted3}
        style={styles.actionChev}
      />
      <Text style={styles.actionN}>{count}</Text>
      <Text style={styles.actionL} numberOfLines={2}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  outer:  { flex: 1, backgroundColor: P.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: P.bg },
  loadingText: { fontSize: 13, color: P.muted2, fontFamily: fonts.sansMedium },

  // Header
  header: { backgroundColor: P.ink, paddingHorizontal: 18, paddingTop: 50, paddingBottom: 18, position: 'relative' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logoBox: {
    backgroundColor: 'rgba(255,193,7,0.12)',
    borderWidth: 1.5,
    borderColor: P.yellow,
    borderStyle: 'dashed',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 6,
  },
  logoText: {
    color: P.yellow,
    fontFamily: fonts.monoBold,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  bellBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute', top: -2, right: -2,
    backgroundColor: P.yellow,
    minWidth: 18, height: 18, borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center',
  },
  bellBadgeText: { color: P.ink, fontFamily: fonts.monoBold, fontSize: 9, fontWeight: '800' },
  headerRule: { position: 'absolute', left: 18, bottom: 8, width: 30, height: 3, backgroundColor: P.yellow, borderRadius: 2 },

  // Greeting
  greet: { marginHorizontal: 18, marginTop: 14 },
  greetTitle: { fontFamily: fonts.displayBold, fontSize: 18, fontWeight: '800', color: P.ink, letterSpacing: -0.2 },
  greetSub: { fontFamily: fonts.sansMedium, fontSize: 12, color: P.muted, marginTop: 3, lineHeight: 17 },
  greetSubCount: {
    fontFamily: fonts.monoBold,
    fontWeight: '800',
    color: P.ink,
    backgroundColor: P.yellowPale,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },

  // Action tiles
  actionRow: { flexDirection: 'row', gap: 8, marginHorizontal: 14, marginTop: 12 },
  actionTile: {
    flex: 1,
    backgroundColor: P.white,
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 14,
    padding: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  actionTileAttention: {
    borderColor: P.yellow,
    backgroundColor: P.yellow50,
  },
  actionIcoTile: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: P.bg2,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  actionIcoTileAttention: { backgroundColor: P.yellow },
  actionChev: { position: 'absolute', top: 11, right: 11 },
  actionN: { fontFamily: fonts.monoBold, fontSize: 22, fontWeight: '900', color: P.ink, marginBottom: 3 },
  actionL: { fontFamily: fonts.sansMedium, fontSize: 10.5, color: P.muted, lineHeight: 14 },

  // Section
  section: { marginHorizontal: 14, marginTop: 20 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontFamily: fonts.displayBold, fontSize: 12.5, fontWeight: '800', color: P.ink, textTransform: 'uppercase', letterSpacing: 0.4 },
  viewAllText: { fontFamily: fonts.monoBold, fontSize: 10, fontWeight: '800', color: P.ink, borderBottomWidth: 1, borderBottomColor: P.ink, borderStyle: 'dashed' },

  // List row (campaigns)
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: P.white,
    borderWidth: 1, borderColor: P.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 7,
  },
  brandThumb: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: P.ink,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  brandThumbText: { color: P.yellow, fontFamily: fonts.monoBold, fontSize: 11, fontWeight: '800' },
  lrMid: { flex: 1, minWidth: 0 },
  lrName: { fontFamily: fonts.displayBold, fontSize: 13, fontWeight: '800', color: P.ink, marginBottom: 2 },
  lrSub: { fontFamily: fonts.monoMedium, fontSize: 10.5, color: P.muted2 },

  // Recent activity card
  actCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 11,
    backgroundColor: P.white,
    borderWidth: 1, borderColor: P.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 7,
  },
  actCardUnread: { backgroundColor: P.yellow50, borderColor: '#F0DA88' },
  actIcoTile: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  actMid: { flex: 1, minWidth: 0 },
  actTitle: { fontFamily: fonts.displayBold, fontSize: 12.5, fontWeight: '800', color: P.ink, marginBottom: 2 },
  actMsg: { fontFamily: fonts.sansMedium, fontSize: 11, color: P.muted, lineHeight: 16, marginBottom: 4 },
  actTime: { fontFamily: fonts.monoBold, fontSize: 9.5, color: P.muted2, fontWeight: '700' },

  // Wallet glance
  walletGlance: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 14, marginTop: 18,
    backgroundColor: P.ink,
    borderRadius: 14,
    padding: 14,
  },
  walletGlanceIco: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,193,7,0.16)',
    alignItems: 'center', justifyContent: 'center',
  },
  walletGlanceMid: { flex: 1 },
  walletGlanceLabel: {
    fontFamily: fonts.monoBold,
    fontSize: 9.5,
    color: 'rgba(255,255,255,0.55)',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontWeight: '700',
  },
  walletGlanceVal: {
    fontFamily: fonts.monoBold,
    fontSize: 18,
    fontWeight: '900',
    color: P.yellow,
    marginTop: 1,
  },
  walletGlanceCTA: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
  },
  walletGlanceCTAText: {
    fontFamily: fonts.monoBold,
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.5,
  },
});
