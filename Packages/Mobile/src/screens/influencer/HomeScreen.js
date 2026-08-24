import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ig, IG_TONE } from '../../theme/ig';
import { fmtRupees } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import { mergeCollabs } from '../../utils/collabStages';
import { badgeFor } from '../../components/collabs/CollabRow';

/* ════════════════════════════════════════════════════════════════════════
   HomeScreen — features/home-restyle. IG-clean entry screen: white header +
   one "Your turn (N)" tile → Collabs, active glance, recent activity, wallet.
   ══════════════════════════════════════════════════════════════════════ */

function greetingForHour() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function timeAgoShort(dateStr) {
  if (!dateStr) return '';
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = Math.floor(s / 86400);
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const NOTIF_ICON = {
  offer_received: 'tag-outline', offer_expired: 'tag-outline',
  negotiation_update: 'handshake-outline',
  contract_ready: 'file-document-outline', contract_signed: 'file-document-outline',
  content_submitted: 'image-outline', content_approved: 'check-circle-outline',
  content_revision: 'image-outline', content_live: 'image-outline',
  tranche_released: 'currency-inr', commission_earned: 'currency-inr', commission_confirmed: 'currency-inr',
  withdrawal_processed: 'bank-outline', withdrawal_failed: 'bank-outline',
  general: 'bell-outline',
};

function brandInitials(name) {
  if (!name) return '?';
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

export default function HomeScreen({ navigation }) {
  const [earnings, setEarnings] = useState(null);
  const [collabs, setCollabs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [er, or, cr, nr] = await Promise.all([
      influencerApi.getEarnings(),
      influencerApi.getOffers(null),
      influencerApi.getMyCampaigns('all'),
      influencerApi.getNotifications(),
    ]);
    setLoading(false);
    if (er.success) setEarnings(er.data);
    const offers = or.success ? (or.data?.offers || or.data || []) : [];
    const camps = cr.success ? (cr.data?.campaigns || []) : [];
    setCollabs(mergeCollabs(offers, camps));
    if (nr.success && Array.isArray(nr.data)) setNotifications(nr.data);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={ig.text} /></View>;
  }

  const youCount = collabs.filter(c => c.turn === 'you').length;
  const active = collabs.filter(c => c.stage === 'active' || c.stage === 'tracking').slice(0, 3);
  const recentUnread = notifications.filter(n => !n.is_read).slice(0, 3);
  const unreadCount = notifications.filter(n => !n.is_read).length;
  const walletBalance = earnings?.available_to_withdraw ?? earnings?.wallet_balance ?? 0;

  const openActive = (c) => navigation.navigate('Collabs', { screen: 'CollabDetail', params: { campaignInfluencerId: c.ciId } });

  return (
    <ScrollView
      style={styles.outer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ig.text} />}
    >
      {/* header */}
      <View style={styles.header}>
        <Text style={styles.greet}>{greetingForHour()}</Text>
        <TouchableOpacity style={styles.bell} onPress={() => navigation.navigate('Notifications')} activeOpacity={0.6}>
          <Icon name="bell-outline" size={22} color={ig.text} />
          {unreadCount > 0 && <View style={styles.bellDot} />}
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        {/* the single Your-turn tile */}
        <TouchableOpacity
          style={[styles.turn, youCount === 0 && styles.turnCalm]}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Collabs')}
        >
          <View style={[styles.turnN, youCount === 0 && styles.turnNCalm]}>
            <Text style={[styles.turnNTxt, youCount === 0 && styles.turnNTxtCalm]}>{youCount}</Text>
          </View>
          <View style={styles.turnMid}>
            <Text style={styles.turnT}>{youCount === 0 ? "You're all caught up" : `${youCount} thing${youCount === 1 ? '' : 's'} need${youCount === 1 ? 's' : ''} you`}</Text>
            <Text style={[styles.turnS, youCount === 0 && styles.turnSCalm]}>
              {youCount === 0 ? 'New offers will show up in Collabs' : 'Offers, contracts, revisions — all in Collabs'}
            </Text>
          </View>
          <Icon name="chevron-right" size={22} color={youCount === 0 ? ig.mut2 : ig.text} />
        </TouchableOpacity>

        {/* active collabs glance */}
        {active.length > 0 && (
          <>
            <View style={styles.lab}>
              <Text style={styles.labTxt}>Active collabs</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Collabs')}><Text style={styles.labLink}>View all</Text></TouchableOpacity>
            </View>
            {active.map(c => {
              const badge = badgeFor(c);
              const tone = IG_TONE[badge.tone] || IG_TONE.neutral;
              return (
                <TouchableOpacity key={c.ciId} style={styles.arow} onPress={() => openActive(c)} activeOpacity={0.7}>
                  <View style={styles.athumb}><Text style={styles.athumbTxt}>{brandInitials(c.brand_name)}</Text></View>
                  <View style={styles.amid}>
                    <Text style={styles.aname} numberOfLines={1}>{c.brand_name}</Text>
                    <Text style={styles.asub} numberOfLines={1}>{c.campaign_name}</Text>
                  </View>
                  <View style={styles.apill}><View style={[styles.dot, { backgroundColor: tone.dot }]} /><Text style={[styles.apillTxt, { color: tone.fg }]}>{badge.label}</Text></View>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {/* recent activity */}
        {recentUnread.length > 0 && (
          <>
            <View style={styles.lab}>
              <Text style={styles.labTxt}>Recent activity</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Notifications')}><Text style={styles.labLink}>View all</Text></TouchableOpacity>
            </View>
            {recentUnread.map(n => (
              <View key={n.id} style={styles.act}>
                <View style={styles.actIco}><Icon name={NOTIF_ICON[n.type] || NOTIF_ICON.general} size={17} color={ig.yInk} /></View>
                <View style={styles.actMid}>
                  <Text style={styles.actT} numberOfLines={1}>{n.title}</Text>
                  <Text style={styles.actM} numberOfLines={2}>{n.body}</Text>
                  <Text style={styles.actTime}>{timeAgoShort(n.created_at)}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* wallet strip */}
        <TouchableOpacity style={styles.wallet} onPress={() => navigation.navigate('Earnings')} activeOpacity={0.85}>
          <View style={styles.wIco}><Icon name="wallet-outline" size={20} color={ig.yInk} /></View>
          <View style={styles.wMid}>
            <Text style={styles.wLabel}>Available to withdraw</Text>
            <Text style={styles.wVal}>{fmtRupees(walletBalance)}</Text>
          </View>
          <View style={styles.wCta}><Text style={styles.wCtaTxt}>WITHDRAW</Text></View>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: ig.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: ig.bg },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: ig.line },
  greet: { fontSize: 24, fontWeight: '800', color: ig.text, letterSpacing: -0.3 },
  bell: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  bellDot: { position: 'absolute', top: 5, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: ig.red, borderWidth: 1.5, borderColor: ig.bg },

  body: { padding: 16 },

  turn: { flexDirection: 'row', alignItems: 'center', gap: 13, borderWidth: 1, borderColor: ig.y, backgroundColor: ig.yBg, borderRadius: 14, padding: 15 },
  turnCalm: { borderColor: ig.line, backgroundColor: ig.bg },
  turnN: { width: 44, height: 44, borderRadius: 12, backgroundColor: ig.y, alignItems: 'center', justifyContent: 'center' },
  turnNCalm: { backgroundColor: ig.bgSoft },
  turnNTxt: { fontSize: 22, fontWeight: '900', color: ig.bg },
  turnNTxtCalm: { color: ig.mut },
  turnMid: { flex: 1 },
  turnT: { fontSize: 15, fontWeight: '800', color: ig.text },
  turnS: { fontSize: 11.5, color: ig.yInk, marginTop: 2 },
  turnSCalm: { color: ig.mut },

  lab: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, marginBottom: 4 },
  labTxt: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: ig.mut },
  labLink: { fontSize: 12, fontWeight: '700', color: ig.text },

  arow: { flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1, borderBottomColor: ig.lineSoft, paddingVertical: 12 },
  athumb: { width: 36, height: 36, borderRadius: 9, backgroundColor: ig.text, alignItems: 'center', justifyContent: 'center' },
  athumbTxt: { color: ig.bg, fontSize: 11, fontWeight: '800' },
  amid: { flex: 1, minWidth: 0 },
  aname: { fontSize: 13.5, fontWeight: '700', color: ig.text },
  asub: { fontSize: 11, color: ig.mut, marginTop: 1 },
  apill: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  apillTxt: { fontSize: 10.5, fontWeight: '700' },

  act: { flexDirection: 'row', gap: 11, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  actIco: { width: 34, height: 34, borderRadius: 9, backgroundColor: ig.yBg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  actMid: { flex: 1, minWidth: 0 },
  actT: { fontSize: 12.5, fontWeight: '700', color: ig.text },
  actM: { fontSize: 11, color: ig.mut, marginTop: 2, lineHeight: 15 },
  actTime: { fontSize: 9.5, color: ig.mut2, marginTop: 3, fontWeight: '600' },

  wallet: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20, borderWidth: 1, borderColor: ig.line, borderRadius: 14, padding: 14 },
  wIco: { width: 36, height: 36, borderRadius: 10, backgroundColor: ig.yBg, alignItems: 'center', justifyContent: 'center' },
  wMid: { flex: 1 },
  wLabel: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase', color: ig.mut },
  wVal: { fontSize: 18, fontWeight: '900', color: ig.text, marginTop: 1 },
  wCta: { backgroundColor: ig.text, borderRadius: 9, paddingHorizontal: 13, paddingVertical: 9 },
  wCtaTxt: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
});
