import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ig } from '../../theme/ig';
import { brandApi } from '../../services/api';
import { termsLine, settledLine, byExpiry } from '../../utils/agreementSummary';
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

const SUB_TABS = [
  { key: 'talking', label: 'Talking' },
  { key: 'agreed',  label: 'Agreed' },
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
  const [tab, setTab] = useState('talking');
  const [requests, setRequests] = useState([]);
  const [pitches, setPitches] = useState([]);
  const [agreements, setAgreements] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Pitch settings, surfaced here rather than three taps away under Profile.
  const [pitchSettings, setPitchSettings] = useState(null);
  const [pitchOpen, setPitchOpen] = useState(false);
  // Sent or Received. A request you sent needs chasing; an approach you did not ask for
  // needs a decision. Merging them — which is what I built first — hid that difference.
  // Contract: features/creators-tab-shape (item 1)
  const [side, setSide] = useState('sent');

  const load = useCallback(async () => {
    const [rq, pi, ag, gr, ps] = await Promise.all([
      brandApi.listSentCollabRequests(),
      brandApi.listProposals(),
      brandApi.listAgreements(),
      brandApi.listGroups(),
      brandApi.getProposalSettings(),
    ]);
    if (ps.success) setPitchSettings(ps.data?.brand || ps.data);
    // One source failing must not blank the tab — three of four conversations beats none.
    if (rq.success) setRequests(rq.data?.requests || []);
    if (pi.success) setPitches(pi.data?.proposals || []);
    if (ag.success) setAgreements(ag.data?.agreements || []);
    if (gr.success) setGroups(gr.data?.groups || []);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await load(); setRefreshing(false);
  }, [load]);

  /** Both directions, one list, ordered by who owes a move. */
  const talking = useMemo(() => {
    const rows = [
      ...requests.map(r => ({
        kind: 'request',
        id: r.id,
        name: r.influencer_name || r.instagram_handle || 'Creator',
        handle: r.instagram_handle,
        status: r.status,
        counter_by: r.counter_by,
        terms: termsLine(r.counter_terms_json || r.terms_json),
        at: r.updated_at || r.created_at,
      })),
      ...pitches.map(p => ({
        kind: 'proposal',
        id: p.id,
        name: p.influencer_name || p.instagram_handle || 'Creator',
        handle: p.instagram_handle,
        status: p.status,
        counter_by: p.counter_by,
        terms: termsLine(p.counter_terms) || termsLine({
          money: { fee: p.proposed_fee, commission_pct: p.proposed_commission_pct },
        }),
        at: p.updated_at || p.created_at,
      })),
    ].map(r => ({ ...r, turn: turnOf(r) }));

    // Yours first — the whole reason to open this screen — then waiting, then closed.
    const rank = { you: 0, them: 1, none: 2 };
    return rows.sort((a, b) => (rank[a.turn] - rank[b.turn]) || (new Date(b.at) - new Date(a.at)));
  }, [requests, pitches]);

  // Every row already carries its direction, so this is a partition of a list that
  // exists — not a new query. A conversation belongs to exactly one side.
  const sent     = talking.filter(r => r.kind === 'request');
  const received = talking.filter(r => r.kind === 'proposal');
  const sideRows = side === 'sent' ? sent : received;

  const yourTurn = talking.filter(r => r.turn === 'you');
  const waiting  = talking.filter(r => r.turn === 'them');
  const closed   = talking.filter(r => r.turn === 'none');

  function openConversation(row) {
    if (row.kind === 'request') navigation.navigate('BrandCollabRequests', { focusId: row.id });
    else navigation.navigate('ProposalInbox', { focusId: row.id });
  }

  const header = (
    <>
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Creators</Text>
          <Text style={s.sub}>
            {loading ? 'Loading…'
              : `${talking.length} conversation${talking.length === 1 ? '' : 's'} · ${agreements.length} agreed`}
          </Text>
        </View>
        {yourTurn.length > 0 && (
          <View style={s.pill}><Text style={s.pillT}>{yourTurn.length} need you</Text></View>
        )}
      </View>
      <View style={s.subtabs}>
        {SUB_TABS.map(t => {
          const n = t.key === 'agreed' ? agreements.length : t.key === 'groups' ? groups.length : 0;
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
  if (tab === 'find') {
    return (
      <View style={s.container}>
        {header}
        <BrandFindCreatorsScreen navigation={navigation} route={{ params: {} }} embedded />
      </View>
    );
  }

  if (tab === 'groups') {
    return (
      <View style={s.container}>
        {header}
        <BrandGroupsList navigation={navigation} groups={groups} onChanged={load} />
      </View>
    );
  }

  // Soonest-expiring first. An agreement 90 days unbriefed is lost, and a list ordered
  // by when it was agreed buries exactly the row that needs acting on. Anything with no
  // clock sits at the end rather than jumping the queue.
  const sortedAgreements = byExpiry(agreements);

  if (tab === 'agreed') {
    return (
      <View style={s.container}>
        {header}
        <FlatList
          data={sortedAgreements}
          keyExtractor={(a) => String(a.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ig.text} />}
          renderItem={({ item }) => {
            // 90 days unbriefed and the whole negotiation is lost. This is the screen
            // where an expiring agreement is most likely to be noticed, so the clock
            // goes on the row rather than one tap in.
            const days = item.expires_at
              ? Math.ceil((new Date(item.expires_at) - Date.now()) / 86400000) : null;
            const soon = days != null && days <= 14;
            return (
              <View style={s.row}>
                <CreatorAvatar name={item.influencer_name || item.instagram_handle} avatarUrl={item.profile_image_url} size={38} square />
                <View style={{ flex: 1 }}>
                  <Text style={s.rowName}>{item.influencer_name || item.instagram_handle || 'Creator'}</Text>
                  <Text style={s.rowTerms}>{settledLine(item.terms_json)}</Text>
                  <Text style={[s.rowStatus, { color: soon ? ig.red : ig.mut }]}>
                    {days != null
                      ? (days <= 0 ? 'EXPIRED' : soon ? `EXPIRES IN ${days} DAYS` : `EXPIRES ${fmtD(item.expires_at)}`)
                      : 'READY TO BRIEF'}
                  </Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Icon name="handshake-outline" size={30} color={ig.mut2} />
              <Text style={s.emptyT}>Nobody has agreed terms yet</Text>
              <Text style={s.emptyS}>When a creator accepts, they wait here until you build a campaign.</Text>
            </View>
          }
          contentContainerStyle={sortedAgreements.length === 0 ? { flexGrow: 1 } : { paddingBottom: 28 }}
        />
      </View>
    );
  }

  // ── Talking ────────────────────────────────────────────────────────────────
  const sections = [
    { title: `Your turn · ${sideRows.filter(r => r.turn === 'you').length}`,
      rows: sideRows.filter(r => r.turn === 'you') },
    { title: `Waiting on ${side === 'sent' ? 'them' : 'you'} · ${sideRows.filter(r => r.turn === 'them').length}`,
      rows: sideRows.filter(r => r.turn === 'them') },
    { title: 'Closed', rows: sideRows.filter(r => r.turn === 'none') },
  ].filter(sec => sec.rows.length > 0);

  return (
    <View style={s.container}>
      {header}
      <FlatList
        data={sections}
        keyExtractor={(sec) => sec.title}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ig.text} />}
        /* Who may approach you, stated and changeable where the approaches arrive.
           It used to live under Profile -> Influencer Proposals behind a control
           labelled "Filters" — which reads as "show me fewer of these", not "decide
           who is allowed to reach me". Two very different things that looked the same.
           Contract: features/stage-1-find-each-other-and-agree */
        ListHeaderComponent={
          <>
            {/* Sent or Received — two jobs, not one list.
                Contract: features/creators-tab-shape (item 1) */}
            <View style={s.seg}>
              <TouchableOpacity style={[s.segBtn, side === 'sent' && s.segOn]}
                activeOpacity={0.7} onPress={() => setSide('sent')}>
                <Text style={[s.segT, side === 'sent' && s.segTOn]}>Sent {sent.length}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.segBtn, side === 'received' && s.segOn]}
                activeOpacity={0.7} onPress={() => setSide('received')}>
                <Text style={[s.segT, side === 'received' && s.segTOn]}>Received {received.length}</Text>
              </TouchableOpacity>
            </View>

            {/* Who may approach you belongs where approaches arrive — not over the
                list of people you approached. Contract: features/creators-tab-shape (item 2) */}
            {side === 'received' && pitchSettings ? (
            <TouchableOpacity style={s.pitchBar} activeOpacity={0.7} onPress={() => setPitchOpen(true)}>
              <View style={[s.pitchDot, { backgroundColor: pitchSettings.accepts_proposals ? ig.green : ig.mut2 }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.pitchT}>Who can pitch you</Text>
                <Text style={s.pitchS}>
                  {pitchSettings.accepts_proposals
                    ? (Object.keys(pitchSettings.proposal_filters || {}).length
                        ? 'Open to pitches, with conditions'
                        : 'Open to pitches from anyone')
                    : 'Closed — no creator can approach you'}
                </Text>
              </View>
              <Icon name="chevron-right" size={18} color={ig.mut2} />
            </TouchableOpacity>
            ) : null}
          </>
        }
        ListEmptyComponent={
          side === 'received' ? (
            <View style={s.empty}>
              <Icon name="email-outline" size={30} color={ig.mut2} />
              {pitchSettings && pitchSettings.accepts_proposals === false ? (
                <>
                  <Text style={s.emptyT}>You are closed to pitches</Text>
                  <Text style={s.emptyS}>No creator can approach you right now. Open it and they can — you set the conditions.</Text>
                </>
              ) : (
                <>
                  <Text style={s.emptyT}>Nobody has pitched yet</Text>
                  <Text style={s.emptyS}>You are open to pitches, so creators can approach you. When one does, she lands here and this tab counts her.</Text>
                </>
              )}
            </View>
          ) : (
            <View style={s.empty}>
              <Icon name="account-search-outline" size={30} color={ig.mut2} />
              <Text style={s.emptyT}>You have not asked anyone yet</Text>
              <Text style={s.emptyS}>Find creators, then ask one, a group, or everyone who matches your filters.</Text>
            </View>
          )
        }
        contentContainerStyle={sections.length === 0 ? { flexGrow: 1 } : undefined}
        renderItem={({ item: sec }) => (
          <View>
            <Text style={s.sectionH}>{sec.title}</Text>
            {sec.rows.map(row => {
              const tone = TONE[row.turn];
              return (
                <TouchableOpacity key={`${row.kind}:${row.id}`} style={s.row} activeOpacity={0.7} onPress={() => openConversation(row)}>
                  <CreatorAvatar name={row.name} avatarUrl={row.profile_image_url} size={38} square />
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowName}>{row.name}</Text>
                    <Text style={s.rowTerms}>
                      {row.kind === 'proposal' ? 'She pitched · ' : ''}{row.terms || '—'}
                    </Text>
                    <View style={s.statusRow}>
                      <View style={[s.dot, { backgroundColor: tone.d }]} />
                      <Text style={[s.rowStatus, { color: tone.c }]}>{statusLine(row, row.turn)}</Text>
                    </View>
                  </View>
                  <Icon name="chevron-right" size={18} color={ig.mut2} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        ListEmptyComponent={
          <View style={s.empty}>
            <Icon name="message-outline" size={30} color={ig.mut2} />
            <Text style={s.emptyT}>No conversations yet</Text>
            <Text style={s.emptyS}>Find a creator and ask them to work with you — it starts here.</Text>
          </View>
        }
        contentContainerStyle={sections.length === 0 ? { flexGrow: 1 } : { paddingBottom: 28 }}
      />
      <ProposalFiltersSheet
        visible={pitchOpen}
        settings={pitchSettings}
        onClose={() => setPitchOpen(false)}
        onSaved={() => { setPitchOpen(false); load(); }}
      />
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
