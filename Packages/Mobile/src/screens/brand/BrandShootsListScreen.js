import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ig } from '../../theme/ig';
import { brandApi } from '../../services/api';
import CreatorAvatar from '../../components/CreatorAvatar';
import { MODE_LABEL, STATUS_LABEL, turnOf, shortDate, shortDateTime } from '../../utils/shoot';

/**
 * BrandShootsListScreen — every shoot, across every campaign, needs-you first.
 * Contract: features/stage-4-the-shoot (slice 6) · M-2 · board panel ②
 *
 * WHY A LIST AT ALL, WHEN A CAMPAIGN ROSTER ALREADY EXISTED
 * `/campaigns/:id/production` has existed for a while and answers a question nobody asks. The
 * question a brand asks in the morning is *"what is waiting on me today"* — and the shoots
 * waiting on them are spread across whatever campaigns happen to be running. A per-campaign
 * roster makes them open four screens to answer one.
 *
 * THE ORDER IS THE SERVER'S, NOT THIS SCREEN'S
 * Needs-you-first is computed in SQL, for the same reason Stage 3's step number is computed on
 * the server: her app renders the same shoot, and two clients each working out "whose turn"
 * separately is precisely how they come to disagree about one fact.
 *
 * ON A PRACTICE WORLD THIS WILL LOOK THIN
 * Production holds four shoots today. On a real brand with twenty this is the most useful
 * screen in the stage; on the practice shelf it is four rows, and that is the honest picture.
 */

function needsYou(row) {
  // Mirrors the CASE in listBrandShoots. Kept as one small function so the badge and the
  // server's ordering cannot drift into two different opinions on the same row.
  if (row.production_status === 'proposed' && !row.visit_scheduled_at) return true;
  if (row.production_status === 'proposed' && row.slot_proposed_by === 'influencer') return true;
  if (row.production_status === 'confirmed' && row.mode === 'shipment' && !row.shipment_dispatched_at) return true;
  return Number(row.shortfall_count || 0) > 0;
}

/** The one line under the name that says where this shoot actually is. */
function whenLine(row) {
  if (row.mode === 'visit') {
    return row.visit_scheduled_at
      ? shortDate(row.visit_scheduled_at)
      : 'No day settled yet';
  }
  if (row.mode === 'shipment') {
    if (row.shipment_received_confirmed_at) return `Arrived ${shortDateTime(row.shipment_received_confirmed_at)}`;
    if (row.shipment_dispatched_at) {
      return row.shipment_expected_at
        ? `In transit · due ${shortDate(row.shipment_expected_at)}`
        : 'In transit';
    }
    return Number(row.item_count) ? `${row.item_count} item${Number(row.item_count) === 1 ? '' : 's'} packed, not sent` : 'Nothing in the box yet';
  }
  return STATUS_LABEL[row.production_status] || '';
}

export default function BrandShootsListScreen({ navigation }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await brandApi.listShoots();
      setRows(res.data?.shoots || []);
    } catch (e) {
      // Never render an empty list on failure. "No shoots" and "we could not ask" are
      // different facts, and only one of them means there is nothing to do.
      setErr(e?.message || 'Could not load your shoots.');
      setRows(null);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const waiting = (rows || []).filter(needsYou).length;

  const renderItem = ({ item }) => {
    const turn = turnOf(
      { ...item, status: item.production_status },
      item.mode,
      { creatorName: item.influencer_name }
    );
    const you = needsYou(item);

    return (
      <TouchableOpacity
        style={[s.row, you && s.rowYou]}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('BrandShoot', {
          contractId: item.contract_id,
          creatorName: item.influencer_name,
          campaignName: item.campaign_name,
        })}
      >
        <CreatorAvatar name={item.influencer_name} avatarUrl={item.profile_image_url} size={38} />
        <View style={{ flex: 1 }}>
          <View style={s.head}>
            <Text style={s.name} numberOfLines={1}>{item.influencer_name}</Text>
            <Text style={s.mode}>{MODE_LABEL[item.mode] || item.mode}</Text>
          </View>
          <Text style={s.campaign} numberOfLines={1}>{item.campaign_name}</Text>
          <Text style={s.when}>{whenLine(item)}</Text>
          <Text style={[s.turn, you && s.turnYou]}>{you ? 'YOUR MOVE' : 'WAITING ON HER'} · {turn.line}</Text>
          {Number(item.shortfall_count) > 0 && (
            <Text style={s.short}>
              {item.shortfall_count} item{Number(item.shortfall_count) === 1 ? '' : 's'} did not arrive —
              resend or drop
            </Text>
          )}
        </View>
        <Icon name="chevron-right" size={18} color={ig.mut} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.container}>
      <View style={s.nav}>
        <TouchableOpacity style={s.back} onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="chevron-left" size={22} color={ig.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Shoots</Text>
          <Text style={s.sub}>
            {rows === null ? 'ACROSS EVERY CAMPAIGN'
              : waiting ? `NEEDS YOU · ${waiting}`
              : 'ACROSS EVERY CAMPAIGN'}
          </Text>
        </View>
      </View>

      {rows === null && !err && (
        <View style={s.center}><ActivityIndicator color={ig.text} /></View>
      )}

      {!!err && (
        <View style={s.center}>
          <View style={s.errBox}>
            <Text style={s.errT}>{err}</Text>
            <TouchableOpacity onPress={load}><Text style={s.retry}>Try again</Text></TouchableOpacity>
          </View>
        </View>
      )}

      {Array.isArray(rows) && (
        <FlatList
          data={rows}
          keyExtractor={r => String(r.production_event_id)}
          renderItem={renderItem}
          contentContainerStyle={rows.length ? s.list : s.listEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={ig.text}
            />
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Icon name="camera-outline" size={26} color={ig.mut} />
              <Text style={s.emptyT}>No shoots yet</Text>
              <Text style={s.emptyS}>
                A shoot appears here the moment a contract is signed. Nothing to arrange until then.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: ig.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 10, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  back: { padding: 4 },
  title: { fontSize: 16, fontWeight: '800', color: ig.text },
  sub: { fontSize: 10.5, fontWeight: '700', color: ig.mut, marginTop: 1, letterSpacing: 0.4 },

  list: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 32 },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },

  row: { flexDirection: 'row', gap: 11, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 11, borderRadius: 12, borderWidth: 1, borderColor: ig.lineSoft, marginBottom: 8 },
  rowYou: { borderColor: ig.y, backgroundColor: ig.yBg },
  head: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  name: { fontSize: 13.5, fontWeight: '800', color: ig.text, flexShrink: 1 },
  mode: { fontSize: 9, fontWeight: '800', color: ig.mut, letterSpacing: 0.4, textTransform: 'uppercase' },
  campaign: { fontSize: 10.5, fontWeight: '700', color: ig.mut, marginTop: 2, letterSpacing: 0.3 },
  when: { fontSize: 11.5, fontWeight: '700', color: ig.text, marginTop: 4 },
  turn: { fontSize: 9.5, fontWeight: '800', color: ig.mut, marginTop: 4, letterSpacing: 0.3 },
  turnYou: { color: ig.yInk },
  short: { fontSize: 10.5, fontWeight: '700', color: ig.red, marginTop: 4, lineHeight: 15 },

  errBox: { alignItems: 'center', gap: 8, paddingHorizontal: 30 },
  errT: { fontSize: 12.5, fontWeight: '700', color: ig.mut, textAlign: 'center', lineHeight: 18 },
  retry: { fontSize: 12.5, fontWeight: '800', color: ig.text },

  empty: { alignItems: 'center', paddingHorizontal: 40, gap: 6 },
  emptyT: { fontSize: 13.5, fontWeight: '800', color: ig.text, marginTop: 4 },
  emptyS: { fontSize: 11.5, color: ig.mut, textAlign: 'center', lineHeight: 17 },
});
