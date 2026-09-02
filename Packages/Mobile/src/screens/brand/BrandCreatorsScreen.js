import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ig } from '../../theme/ig';
import { brandApi } from '../../services/api';
import CreatorAvatar from '../../components/CreatorAvatar';
// Rendered INSIDE this tab rather than pushed as their own pages.
import BrandFindCreatorsScreen from './BrandFindCreatorsScreen';
import BrandGroupsList from './BrandGroupsList';
// Who may approach you is a pre-campaign decision, so it belongs in this tab — not
// under Profile, where nobody looks for it.
// Contract: features/stage-1-find-each-other-and-agree
import ProposalFiltersSheet from '../../components/brand/ProposalFiltersSheet';

/**
 * BrandCreatorsScreen — everything that happens before a campaign exists.
 * Contract: features/stage-1-find-each-other-and-agree
 *
 * Four sub-tabs: Talking · Agreed · Find · Groups.
 *
 * TALKING holds BOTH directions in one list — the brand's requests out and creators'
 * pitches in — sorted by whose turn it is, never split by who spoke first. Both are
 * "a conversation with a creator about terms"; splitting them by direction makes a
 * brand check two places for the same job. (The creator's side deliberately DOES split
 * them, because for her the direction is the thing she is choosing between.)
 *
 * The tab has a hard boundary: a conversation lives here from the first approach until
 * a campaign is drafted from it, then moves to Campaigns and never comes back. Nothing
 * is ever in both.
 */

// Docs/THE_CUT.md pass 1 — 'Talking' and 'Agreed' removed with the pre-agreement
// pathway. Reaching a creator now happens inside a set, so this tab is only the two
// mechanisms that feed it: search, and the saved lists.
const SUB_TABS = [
  { key: 'find',    label: 'Find' },
  { key: 'groups',  label: 'Groups' },
];

const fmtD = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '');

/**
 * termsLine and settledLine MOVED to utils/agreementSummary in Stage 2.
 * Contract: features/creators-tab-shape (item 9) · features/stage-2-build-a-campaign-from-the-phone
 *
 * The campaign wizard needs the same two lines in three more places — the agreement
 * pick-list, the agreement detail it opens, and the read-back at step 4. Leaving a copy
 * here would be the fault this programme has already had to fix four times: two things
 * doing one job, and only one of them getting the change. The rules they encode are
 * unchanged, and they are now checkable without a handset.
 */

/**
 * Whose turn — the single thing that orders this list.
 *
 * 'countered' cannot answer it on its own: the same word covers the brand waiting and
 * the creator waiting. Who moved LAST is what separates them.
 */
function turnOf(row) {
  const s = String(row.status || '').toLowerCase();
  if (row.kind === 'request') {
    if (s === 'countered') return row.counter_by === 'creator' ? 'you' : 'them';
    if (s === 'sent' || s === 'viewed') return 'them';
    return 'none';
  }
  // A pitch arriving is the brand's to answer until they have moved.
  if (s === 'sent' || s === 'viewed') return 'you';
  if (s === 'countered') return row.counter_by === 'creator' ? 'you' : 'them';
  return 'none';
}

function statusLine(row, turn) {
  const s = String(row.status || '').toLowerCase();
  if (row.kind === 'proposal') {
    if (s === 'sent' || s === 'viewed') return 'HER PITCH — UNANSWERED';
    if (s === 'countered') return turn === 'you' ? 'SHE COUNTERED' : 'YOU COUNTERED';
    if (s === 'accepted') return 'AGREED';
    return s.toUpperCase();
  }
  if (s === 'sent') return 'NOT OPENED YET';
  if (s === 'viewed') return 'OPENED, NOT ANSWERED';
  if (s === 'countered') return turn === 'you' ? 'SHE COUNTERED' : 'YOU COUNTERED';
  if (s === 'agreed') return 'TERMS AGREED';
  if (s === 'declined') return 'SHE SAID NO';
  return s.toUpperCase();
}

const TONE = {
  you:  { c: ig.yInk, d: ig.y },
  them: { c: ig.blue, d: ig.blue },
  none: { c: ig.mut,  d: ig.mut2 },
};

export default function BrandCreatorsScreen({ navigation }) {
  const [tab, setTab] = useState('find');
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Pitch settings, surfaced here rather than three taps away under Profile.
  const [pitchSettings, setPitchSettings] = useState(null);
  const [pitchOpen, setPitchOpen] = useState(false);

  const load = useCallback(async () => {
    const [gr, ps] = await Promise.all([
      brandApi.listGroups(),
      brandApi.getProposalSettings(),
    ]);
    if (ps.success) setPitchSettings(ps.data?.brand || ps.data);
    if (gr.success) setGroups(gr.data?.groups || []);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await load(); setRefreshing(false);
  }, [load]);

  // Docs/THE_CUT.md pass 1 — the conversation list, its sent/received split, the
  // whose-turn ranking and openConversation() are all gone with the pre-agreement
  // pathway. Nothing on this tab opens a conversation any more; it is search and
  // saved lists only, and reaching a creator happens inside a set.

  const header = (
    <>
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Creators</Text>
          <Text style={s.sub}>
            {loading ? 'Loading…'
              : `${groups.length} saved list${groups.length === 1 ? '' : 's'}`}
          </Text>
        </View>
      </View>
      <View style={s.subtabs}>
        {SUB_TABS.map(t => {
          const n = t.key === 'groups' ? groups.length : 0;
          const on = tab === t.key;
          return (
            <TouchableOpacity key={t.key} onPress={() => setTab(t.key)} activeOpacity={0.7} style={s.subtabWrap}>
              <Text style={[s.subtab, on && s.subtabOn]}>
                {t.label}{n > 0 ? ` ${n}` : ''}
              </Text>
              {on && <View style={s.subtabBar} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );

  if (loading) {
    return <View style={s.container}>{header}<View style={s.center}><ActivityIndicator color={ig.text} /></View></View>;
  }

  // Stage 1 correction (founder, 2026-08-22): "search of brands and groups it is asking
  // to open into new page instead directly showing them."
  //
  // These two were a placeholder with an "Open search" button — you tapped Find, and were
  // asked to tap again. There was no reason for it. Both now render in the tab.
  if (tab === 'groups') {
    return (
      <View style={s.container}>
        {header}
        <BrandGroupsList navigation={navigation} groups={groups} onChanged={load} />
      </View>
    );
  }

  // Docs/THE_CUT.md pass 1 — the Talking and Agreed tabs are gone with the
  // pre-agreement pathway, so Find is both the default and the fallthrough.
  return (
    <View style={s.container}>
      {header}
      <BrandFindCreatorsScreen navigation={navigation} route={{ params: {} }} embedded />
    </View>
  );
}

const s = StyleSheet.create({
  pitchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: ig.lineSoft, backgroundColor: ig.bg,
  },
  pitchDot: { width: 7, height: 7, borderRadius: 4 },
  seg: { flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8 },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8, backgroundColor: ig.bgSoft },
  segOn: { backgroundColor: ig.text },
  segT: { fontSize: 11.5, fontWeight: '800', color: ig.mut },
  segTOn: { color: ig.bg },
  pitchT: { fontSize: 12.5, fontWeight: '800', color: ig.text },
  pitchS: { fontSize: 11, color: ig.mut, marginTop: 2 },
  container: { flex: 1, backgroundColor: ig.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  head: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: '800', color: ig.text, letterSpacing: -0.3 },
  sub: { fontSize: 12, color: ig.mut, marginTop: 2 },
  pill: { backgroundColor: ig.yBg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  pillT: { fontSize: 11, fontWeight: '800', color: ig.yInk },

  subtabs: { flexDirection: 'row', gap: 18, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  subtabWrap: { paddingBottom: 9 },
  subtab: { fontSize: 12.5, fontWeight: '700', color: ig.mut },
  subtabOn: { color: ig.text, fontWeight: '800' },
  subtabBar: { height: 2, backgroundColor: ig.text, borderRadius: 2, marginTop: 7, marginBottom: -9 },

  sectionH: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, color: ig.mut, textTransform: 'uppercase', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },

  row: { flexDirection: 'row', gap: 11, alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  avatar: { width: 38, height: 38, borderRadius: 11, backgroundColor: ig.text, alignItems: 'center', justifyContent: 'center' },
  avatarT: { color: ig.bg, fontSize: 12, fontWeight: '800' },
  rowName: { fontSize: 13.5, fontWeight: '800', color: ig.text },
  rowTerms: { fontSize: 11.5, color: ig.text2, fontWeight: '600', marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  rowStatus: { fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyT: { fontSize: 15, fontWeight: '700', color: ig.text, marginTop: 12 },
  emptyS: { fontSize: 12.5, color: ig.mut, marginTop: 5, textAlign: 'center', lineHeight: 18 },

  doorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 36 },
  doorT: { fontSize: 16, fontWeight: '800', color: ig.text, marginTop: 12 },
  doorS: { fontSize: 12.5, color: ig.mut, marginTop: 6, textAlign: 'center', lineHeight: 19 },
  doorBtn: { backgroundColor: ig.text, borderRadius: 10, paddingVertical: 13, paddingHorizontal: 26, marginTop: 18 },
  doorBtnT: { color: ig.bg, fontSize: 13, fontWeight: '800' },
});
