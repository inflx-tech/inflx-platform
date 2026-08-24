import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Share, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Clipboard from '@react-native-clipboard/clipboard';
import { brandPalette as P, fonts, fmtRupees } from '../../theme/tokens';
import { influencerApi } from '../../services/api';

/**
 * ReferAndEarnScreen — Contract 4 (influencer Refer & Earn).
 * The influencer's referral code (copy + share), total earned, how-it-works,
 * and the referral earnings ledger. Read-only via GET /influencers/me/referral;
 * the engine already credits influencer-referrers' wallets inline.
 */

const SOURCE_LABEL = { subscription: 'Subscription', protection_fee: 'Protection fee', commission: 'Commission' };
const SOURCE_STYLE = {
  subscription:   { bg: '#E0F2FE', fg: '#075985' },
  protection_fee: { bg: '#DCFCE7', fg: '#166534' },
  commission:     { bg: P.warnPale, fg: P.warnText },
};

function fmtDate(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }); } catch { return ''; }
}

export default function ReferAndEarnScreen() {
  const navigation = useNavigation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    const res = await influencerApi.getReferralInfo();
    setLoading(false);
    if (res.success) setData(res.data);
  }
  useEffect(() => { load(); }, []);
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, []);

  function copyCode() {
    if (!data?.code) return;
    Clipboard.setString(data.code);
    Alert.alert('Copied', 'Your referral code is on the clipboard.');
  }
  async function shareCode() {
    if (!data?.code) return;
    try {
      await Share.share({
        message: `Join INFLX with my referral code ${data.code} — let's grow together. https://inflx.in`,
      });
    } catch (_) { /* user dismissed */ }
  }

  const ledger = data?.ledger || [];

  return (
    <View style={styles.root}>
      {/* App bar */}
      <View style={styles.appbar}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="chevron-left" size={28} color={P.ink} />
        </TouchableOpacity>
        <Text style={styles.appbarTitle}>Refer & Earn</Text>
        <View style={{ width: 28 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={P.ink} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 14, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[P.ink]} />}
        >
          {/* Hero */}
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>YOU'VE EARNED</Text>
            <Text style={styles.heroAmount}>{fmtRupees(data?.earned_total || 0)}</Text>
            <Text style={styles.heroSub}>
              Paid straight to your wallet
              {data?.referred_count ? ` · ${data.referred_count} active referral${data.referred_count === 1 ? '' : 's'}` : ''}
            </Text>
          </View>

          {/* Code card */}
          <View style={styles.codeCard}>
            <Text style={styles.cap}>YOUR REFERRAL CODE</Text>
            <View style={styles.codeChip}><Text style={styles.codeText}>{data?.code || '—'}</Text></View>
            <View style={styles.btnRow}>
              <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={copyCode} activeOpacity={0.8}>
                <Icon name="content-copy" size={16} color={P.ink} />
                <Text style={styles.btnGhostText}>Copy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={shareCode} activeOpacity={0.8}>
                <Icon name="share-variant" size={16} color={P.white} />
                <Text style={styles.btnPrimaryText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* How it works */}
          <Text style={styles.sectionTitle}>How it works</Text>
          <View style={styles.how}>
            <HowRow icon="office-building" text="Refer a brand → earn a share of their subscription + campaign protection fee." />
            <HowRow icon="star" text="Refer an influencer → earn a share of the commission on their sales." />
            <HowRow icon="calendar-month" text="You earn for 12 months from each referral — paid to your wallet as we earn. It never reduces their pay." last />
          </View>

          {/* Ledger */}
          <Text style={styles.sectionTitle}>Your referral earnings</Text>
          {ledger.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>💸</Text>
              <Text style={styles.emptyText}>No referral earnings yet</Text>
              <Text style={styles.emptySub}>Share your code — you'll earn here when someone you refer brings revenue.</Text>
            </View>
          ) : (
            ledger.map((r) => {
              const ss = SOURCE_STYLE[r.source] || { bg: P.bg2, fg: P.muted };
              return (
                <View key={r.id} style={styles.row}>
                  <View style={styles.rowAv}><Icon name={r.referred_type === 'brand' ? 'office-building' : 'star'} size={18} color={P.muted} /></View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.rowName} numberOfLines={1}>{r.referred_name}</Text>
                    <View style={styles.rowMetaRow}>
                      <View style={[styles.srcChip, { backgroundColor: ss.bg }]}><Text style={[styles.srcChipText, { color: ss.fg }]}>{SOURCE_LABEL[r.source] || r.source}</Text></View>
                      <Text style={styles.rowDate}>· {fmtDate(r.created_at)}</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.rowAmt}>{fmtRupees(r.amount)}</Text>
                    <View style={[styles.pill, r.payout_status === 'paid' ? styles.pillPaid : styles.pillPending]}>
                      <Text style={[styles.pillText, { color: r.payout_status === 'paid' ? '#fff' : P.warnText }]}>{r.payout_status}</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

function HowRow({ icon, text, last }) {
  return (
    <View style={[styles.howRow, last && { marginBottom: 0 }]}>
      <Icon name={icon} size={18} color={P.ink} style={{ width: 24 }} />
      <Text style={styles.howText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.bg },
  appbar: { height: 52, backgroundColor: P.white, borderBottomWidth: 1, borderBottomColor: P.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  appbarTitle: { fontFamily: fonts.displayBold, fontSize: 17, color: P.ink },

  hero: { backgroundColor: P.ink, borderRadius: 18, padding: 18 },
  heroLabel: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 0.5, color: P.white },
  heroAmount: { fontFamily: fonts.displayBlack, fontSize: 34, color: P.white, marginTop: 2 },
  heroSub: { fontFamily: fonts.sansRegular, fontSize: 12, color: P.muted3, marginTop: 2 },

  codeCard: { backgroundColor: P.white, borderWidth: 1, borderColor: P.border, borderRadius: 16, padding: 16, marginTop: 12 },
  cap: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 0.4, color: P.muted2 },
  codeChip: { backgroundColor: P.bg2, borderWidth: 1.5, borderColor: P.ink, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, marginTop: 8 },
  codeText: { fontFamily: fonts.monoBold, fontSize: 22, letterSpacing: 1, color: P.ink, textAlign: 'center' },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  btnPrimary: { backgroundColor: P.ink },
  btnPrimaryText: { fontFamily: fonts.displayBold, fontSize: 14, color: P.white},
  btnGhost: { backgroundColor: P.white, borderWidth: 1.5, borderColor: P.ink },
  btnGhostText: { fontFamily: fonts.displayBold, fontSize: 14, color: P.ink },

  sectionTitle: { fontFamily: fonts.displayBold, fontSize: 13, color: P.ink, marginTop: 18, marginBottom: 8, marginHorizontal: 4 },
  how: { backgroundColor: P.bg2, borderWidth: 1, borderColor: P.bg2, borderRadius: 14, padding: 14 },
  howRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  howText: { flex: 1, fontFamily: fonts.sansRegular, fontSize: 12.5, color: P.ink2, lineHeight: 18 },

  row: { backgroundColor: P.white, borderWidth: 1, borderColor: P.border, borderRadius: 13, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 11 },
  rowAv: { width: 34, height: 34, borderRadius: 10, backgroundColor: P.bg2, alignItems: 'center', justifyContent: 'center' },
  rowName: { fontFamily: fonts.displayBold, fontSize: 13.5, color: P.ink },
  rowMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  srcChip: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1 },
  srcChipText: { fontFamily: fonts.monoBold, fontSize: 9, textTransform: 'uppercase' },
  rowDate: { fontFamily: fonts.sansRegular, fontSize: 11, color: P.muted2 },
  rowAmt: { fontFamily: fonts.displayBlack, fontSize: 14, color: P.ink },
  pill: { borderRadius: 99, paddingHorizontal: 7, paddingVertical: 1, marginTop: 2 },
  pillPaid: { backgroundColor: P.tealDeep },
  pillPending: { backgroundColor: P.white, borderWidth: 1, borderColor: P.warn },
  pillText: { fontFamily: fonts.monoBold, fontSize: 9, textTransform: 'uppercase' },

  emptyCard: { backgroundColor: P.white, borderWidth: 1, borderColor: P.border, borderStyle: 'dashed', borderRadius: 14, padding: 24, alignItems: 'center' },
  emptyEmoji: { fontSize: 30 },
  emptyText: { fontFamily: fonts.displayBold, fontSize: 14, color: P.muted, marginTop: 6 },
  emptySub: { fontFamily: fonts.sansRegular, fontSize: 12, color: P.muted2, marginTop: 2, textAlign: 'center' },
});
