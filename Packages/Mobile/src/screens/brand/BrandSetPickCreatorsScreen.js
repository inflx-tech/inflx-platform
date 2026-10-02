/**
 * BrandSetPickCreatorsScreen — I1: All creators (the item 3 Discover list in select mode, with
 * the set-level pick state per row), Worked with, Groups (→ I2) and Pool. "Next: terms for {n}
 * creators" starts the in-app draft and opens the terms screen for the first creator.
 *
 * ── One basket (2026-09-17) ──────────────────────────────────────────────────
 * Founder: "i can able to add pool creators, from group and from list of creators selected
 * manually ...but navigation to add creators is not actually supporting this."
 *
 * It did not. Three tabs ticked into this screen's own useState; the Groups tab LEFT the screen
 * for the group check, which called startDraft with the group's members only and so threw the
 * picks away. The footer was hidden here too, so nothing even hinted they were still held.
 *
 * The selection now lives in draft5's basket, which both screens reach, and the footer renders
 * on all four tabs. The group check adds to the basket and comes back.
 *
 * ── ui-walk-fixes board B (locked 2 Oct 2026) ────────────────────────────────
 * Founder, 1 Oct: "while selecting creators … most of the things covering, influencers showing
 * space … use the screen top to bottom judiciously … all filters into one button."
 *   · the campaign / set line is the title bar's second line, not a band of its own
 *   · the list is the compact three-line pick row behind one search + Filters row (DiscoverList)
 *   · the grey "can't be picked … the reason is never shown" sentence is gone (D2): a creator who
 *     can't be invited says why on her row (the server's short reason), and tapping her shows the
 *     server's sentence in this screen's toast — on All creators, Worked with and Pool alike
 *   · the footer steps away while the keypad is open (frame B5) and returns when it closes
 *
 * ── ui-walk-fixes board C ────────────────────────────────────────────────────
 * The footer is a strip in the column, under the list (BottomBar) — it no longer floats over the
 * last rows, so the lists lost the empty space that scrolled them clear of it. It still steps
 * away while the keypad is open (B5). The toast floats just above the strip (or just above the
 * keypad while the strip is away).
 *
 * Contract: features/item5-invitations · prompt §6.1 · features/one-basket-add-creators ·
 * features/ui-walk-fixes (board B, decisions D1, D2)
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { PrimaryButton, EmptyState } from '../../components/settings/primitives';
import { useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import { BottomBar } from '../../components/shell/BottomBar';
import { FormArea } from '../../components/shell/FormScroll';
import { Header, s as base } from './BrandPitchSettingsScreen';
import SegmentedControl from '../../components/shell/SegmentedControl';
import DiscoverList, { MemberRow, LoadErrorList } from '../../components/discovery/DiscoverList';
import { CheckboxRow, st as boxStyles } from '../../components/discovery/bits';
import useReferenceLists from '../../hooks/useReferenceLists';
import useRouteToast from '../../hooks/useRouteToast';
import { useKeyboardVisible } from '../../hooks/useKeyboardVisible';
import { C3 } from '../../components/discovery/copy3';
import { Chip5 } from '../../components/invitations/bits5';
import { C5 } from '../../components/invitations/copy5';
import { startDraft, getBasket, toggleInBasket, removeFromBasket } from '../../components/invitations/draft5';
import { Sheet } from '../../components/settings/sheets';
import { Avatar } from './BrandBlockedCreatorsScreen';
import { C6, aimLabel6 as aimLabel4 } from '../../components/negotiation/copy6';

// Item 6 (B13): the pool is a fourth source inside any set's picker (rules v1.18 §7B).
const P = { ...C5.pick, tabs: [...C5.pick.tabs, 'Pool'] };

/**
 * The pick state of a row, as the list needs it.
 *
 * ui-walk-fixes D2 — a creator who can't be invited carries the server's own words:
 * `pick.label` is the short reason for her row ("Not taking Pay for Content") and `pick.message`
 * the sentence shown when she is tapped ("Asha isn't taking Pay for Content collaborations.").
 * A server that sends no sentence gets its label said instead; one that sends neither gets the
 * old line. Nothing about WHY is decided or worded on the phone.
 */
export function pickStateOf(item) {
  const p = item.pick || { state: 'ok' };
  if (p.state === 'invited') return { state: 'invited', label: P.alreadyIn, chip: P.invited };
  if (p.state === 'ineligible') {
    const label = p.label || P.notOpen;
    return { state: 'ineligible', label, chip: P.cantInvite, message: p.message || label };
  }
  return { state: 'ok' };
}

export default function BrandSetPickCreatorsScreen({ navigation, route }) {
  const { campaignId, setId } = route?.params || {};
  // Founder, 2026-09-16: "loading of creators info is too slow". It was two round trips end to
  // end — the set summary first, and only when THAT came back did the creator list start
  // loading. Both now start together, so the cards arrive in one wait instead of two, and the
  // caller hands over the names it already has so the subline needs no wait at all.
  const names = { campaign: route?.params?.campaignName || null, set: route?.params?.setName || null };
  const [status, setStatus] = useState('loading');
  const [data, setData] = useState(null);
  const [tab, setTab] = useState(P.tabs[0]);
  // The selection lives in draft5 so the group check can add to it. This is a mirror that
  // re-reads on focus, which is how the picks are still here after a trip to the group check.
  const [sel, setSel] = useState(() => new Map(getBasket(setId).map(c => [c.id, c])));
  const [reviewing, setReviewing] = useState(false);
  const syncBasket = useCallback(() => setSel(new Map(getBasket(setId).map(c => [c.id, c]))), [setId]);
  useFocusEffect(useCallback(() => { syncBasket(); }, [syncBasket]));
  const lists = useReferenceLists();
  const { toast, show } = useToast({ inFlow: true });
  useRouteToast(navigation, route, show);
  // Frame B5: while the keypad is open the footer steps out of the way, so the creators found
  // run down to the keypad instead of hiding behind a button that has ridden up over them.
  const typing = useKeyboardVisible();
  // D2: tapping a creator who can't be invited says why, in the server's sentence.
  const sayWhy = useCallback((item, ps) => { if (ps && ps.message) show(ps.message); }, [show]);

  // The set summary no longer gates the screen; it only fills the subline and arms "Next".
  const load = useCallback(async () => {
    setStatus('loading');
    const r = await brandApi.setSummary(campaignId, setId);
    if (!r.success) { setStatus('error'); return; }
    setData(r.data); setStatus('ready');
  }, [campaignId, setId]);
  useEffect(() => { load(); }, [load]);

  const toggle = (c) => { toggleInBasket(setId, c); syncBasket(); };
  const drop = (id) => { removeFromBasket(setId, id); syncBasket(); };
  const fetcher = useCallback((params) => brandApi.pickable(campaignId, setId, { ...params, tab: 'all' }), [campaignId, setId]);

  function next() {
    if (!data) return;
    // Item 6: a creator picked from the pool carries her entry and the terms she agreed, so the
    // terms screen opens filled in and the entry is marked used when the invitation is sent.
    // sourceGroupId rides on the CREATOR now, not the draft — one send can mix sources, so one
    // label for the whole batch would be a lie.
    const creators = [...sel.values()].map(c => ({
      id: c.id, name: c.name, avatarUrl: c.avatarUrl || null,
      sourceGroupId: c.sourceGroupId || null, sourceGroupName: c.sourceGroupName || null,
      poolEntryId: c.pool ? c.pool.entryId : undefined,
      poolTerms: c.pool && c.pool.sameAim ? c.pool.terms : undefined,
      poolAgreedAt: c.pool ? c.pool.agreedAt : undefined,
    }));
    startDraft(setId, { set: data.set, campaignName: data.campaign.name, creators, sourceGroupId: null });
    navigation.navigate('BrandCreatorTerms', { campaignId, setId, index: 0 });
  }

  // Only a set summary that FAILED stops the screen; a slow one does not.
  if (status === 'error') return <View style={base.screen}><Header title={P.title} onBack={() => navigation.goBack()} /><LoadError onRetry={load} /></View>;

  const campaignName = (data && data.campaign.name) || names.campaign;
  const setName = (data && data.set.name) || names.set;

  return (
    <View style={base.screen} testID="set-pick-creators">
      {/* Board B: the campaign / set line is the title bar's second line (one Text, cut with …). */}
      <Header title={P.title} subtitle={campaignName || setName ? P.sub(campaignName || '', setName || '') : undefined}
        subtitleTestID="pick-subline" onBack={() => navigation.goBack()} />
      {/* ui-walk-fixes board C: the tabs and the list fill the room above the strip; nothing floats over them. */}
      <FormArea>
      <View style={{ paddingHorizontal: 18, paddingTop: 8 }}>
        <SegmentedControl segments={P.tabs} value={tab} onChange={setTab} testID="pick-tabs" />
      </View>
      {tab === P.tabs[0] ? (
        <DiscoverList key="all" mode="select" defaultOpenOnly fetcher={fetcher} countFetcher={fetcher} lists={lists}
          selectedIds={new Set(sel.keys())} pickState={pickStateOf} onToggleSelect={toggle} onBlockedPress={sayWhy} />
      ) : tab === P.tabs[1] ? (
        <WorkedPickList campaignId={campaignId} setId={setId} selectedIds={new Set(sel.keys())} onToggle={toggle} onWhy={sayWhy} />
      ) : tab === P.tabs[2] ? (
        <GroupsPickList selectedIds={new Set(sel.keys())}
          onOpen={(g) => navigation.navigate('BrandGroupInviteCheck', { campaignId, setId, groupId: g.id, groupName: g.name })} />
      ) : (
        <PoolPickList campaignId={campaignId} setId={setId} selectedIds={new Set(sel.keys())} onToggle={toggle} onWhy={sayWhy} />
      )}
      {toast}
      </FormArea>
      {/* On every tab, including Groups. A basket you cannot see is a basket you do not trust.
          Not while typing (B5): the basket is untouched, the strip is back when the keypad closes. */}
      {typing ? null : (
        <BottomBar testID="pick-footer">
          {sel.size ? (
            <TouchableOpacity style={s.basket} onPress={() => setReviewing(true)} activeOpacity={0.7} testID="pick-basket">
              <View style={s.faces}>
                {[...sel.values()].slice(0, 3).map(c => (
                  <View key={c.id} style={{ marginRight: 6 }}><Avatar name={c.name} url={c.avatarUrl} size={24} /></View>
                ))}
              </View>
              <Text style={s.count} testID="pick-count">{P.selected(sel.size)}</Text>
              <Text style={s.reviewLink}>{P.review}</Text>
            </TouchableOpacity>
          ) : null}
          <PrimaryButton label={P.next(sel.size)} onPress={next} disabled={!sel.size || !data} testID="pick-next" />
        </BottomBar>
      )}
      <BasketSheet visible={reviewing} rows={[...sel.values()]} onRemove={drop} onClose={() => setReviewing(false)} />
    </View>
  );
}

/**
 * A creator who can't be invited, on the Worked with and Pool tabs (ui-walk-fixes D2).
 *
 * The same square-box row as its neighbours, so the list does not change shape — but only her
 * face, her name and the box are greyed: the line under her name is the server's short reason and
 * has to stay readable. The whole row takes a tap and says the sentence. It is deliberately NOT a
 * disabled CheckboxRow: React Native switches a touchable off once accessibilityState.disabled
 * is true, and a dead row cannot say why.
 */
function CantInviteRow({ item, ps, onWhy }) {
  const why = () => { if (onWhy) onWhy(item, ps); };
  return (
    <TouchableOpacity style={boxStyles.checkRow} onPress={why} activeOpacity={0.7}
      accessibilityRole="button" accessibilityState={{ checked: false, disabled: false }} testID={`select-${item.id}`}>
      <View style={[boxStyles.box, s.boxOff]} />
      <View style={{ flex: 1 }}>
        <MemberRow c={{ ...item, status: null }} sub={ps.label} dim onOpen={why} right={<Chip5 label={ps.chip} tone="ended" />} />
      </View>
    </TouchableOpacity>
  );
}

function WorkedPickList({ campaignId, setId, selectedIds, onToggle, onWhy }) {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('loading');
  const seq = useRef(0);
  const load = useCallback(async (next = 1) => {
    const my = ++seq.current;
    setStatus(next === 1 ? 'loading' : 'more');
    const r = await brandApi.pickable(campaignId, setId, { tab: 'worked', search: search.trim() || undefined, page: next });
    if (my !== seq.current) return;
    if (!r.success) { setStatus('error'); return; }
    setTotal(r.data.total || 0);
    setRows(prev => next === 1 ? (r.data.rows || []) : [...prev, ...(r.data.rows || [])]);
    setPage(next); setStatus('ready');
  }, [campaignId, setId, search]);
  useEffect(() => { const t = setTimeout(() => load(1), search ? 350 : 0); return () => clearTimeout(t); }, [load]); // eslint-disable-line
  return (
    <View style={{ flex: 1 }} testID="worked-pick">
      <View style={{ paddingHorizontal: 18, paddingTop: 8 }}>
        <TextInput style={s.search} value={search} onChangeText={setSearch} placeholder={C3.discover.search} placeholderTextColor={T.ink3} autoCapitalize="none" autoCorrect={false} testID="worked-search" />
      </View>
      {status === 'loading' ? <Skeleton rows={4} /> : status === 'error' ? <LoadErrorList what={P.loadWhat} onRetry={() => load(1)} /> : (
        <FlatList data={rows} keyExtractor={r => r.id} contentContainerStyle={{ padding: 18, paddingTop: 4, paddingBottom: 24 }}
          onEndReachedThreshold={0.4} onEndReached={() => { if (rows.length < total && status === 'ready') load(page + 1); }}
          ListFooterComponent={status === 'more' ? <ActivityIndicator color={T.ink3} style={{ marginVertical: 12 }} /> : null}
          ListEmptyComponent={<EmptyState title={C3.worked.emptyTitle} body={C3.worked.emptyBody} />}
          renderItem={({ item }) => {
            const ps = pickStateOf(item);
            if (ps.state === 'ineligible') return <CantInviteRow item={item} ps={ps} onWhy={onWhy} />;
            const disabled = ps.state !== 'ok';
            const checked = ps.state === 'invited' || selectedIds.has(item.id);
            return (
              <CheckboxRow checked={checked} disabled={disabled} onPress={() => onToggle(item)} testID={`select-${item.id}`}>
                <MemberRow c={{ ...item, status: null }} sub={ps.label || C3.worked.row(item.collaborations, '').replace(/ · (last )?signed $/, '')} right={ps.chip ? <Chip5 label={ps.chip} tone={ps.state === 'invited' ? 'waiting' : 'ended'} /> : null} />
              </CheckboxRow>
            );
          }} />
      )}
    </View>
  );
}

/** Item 6 (B13) — pool creators inside this set's picker; terms travel only when the Aim matches. */
function PoolPickList({ campaignId, setId, selectedIds, onToggle, onWhy }) {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('loading');
  const load = useCallback(async () => {
    setStatus('loading');
    const r = await brandApi.pickable(campaignId, setId, { tab: 'pool' });
    if (!r.success) { setStatus('error'); return; }
    setRows(r.data.rows || []); setStatus('ready');
  }, [campaignId, setId]);
  useEffect(() => { load(); }, [load]);
  if (status === 'loading') return <Skeleton rows={4} />;
  if (status === 'error') return <LoadErrorList what={C6.pool.loadWhat} onRetry={load} />;
  return (
    <FlatList data={rows} keyExtractor={r => r.id} contentContainerStyle={{ padding: 18, paddingTop: 4, paddingBottom: 24 }} testID="pool-pick"
      ListEmptyComponent={<EmptyState title={C6.pool.emptyTitle} body={C6.pool.emptyBody} />}
      renderItem={({ item }) => {
        const ps = pickStateOf(item);
        if (ps.state === 'ineligible') return <CantInviteRow item={item} ps={ps} onWhy={onWhy} />;
        const disabled = ps.state !== 'ok';
        const checked = ps.state === 'invited' || selectedIds.has(item.id);
        const p = item.pool || {};
        const sub = [aimLabel4(p.goal), p.sameAim ? p.termsLine : 'different Aim — no terms carried', `${p.daysLeft} days left`].filter(Boolean).join(' · ');
        return (
          <CheckboxRow checked={checked} disabled={disabled} onPress={() => onToggle(item)} testID={`select-${item.id}`}>
            <MemberRow c={{ ...item, status: null }} sub={disabled ? ps.label : sub} right={ps.chip ? <Chip5 label={ps.chip} tone={ps.state === 'invited' ? 'waiting' : 'ended'} /> : (p.closingSoon ? <Chip5 label={C6.pool.closingSoon(p.daysLeft)} tone="yourMove" /> : null)} />
          </CheckboxRow>
        );
      }} />
  );
}

function GroupsPickList({ onOpen, selectedIds }) {
  const [groups, setGroups] = useState(null);
  const [status, setStatus] = useState('loading');
  const load = useCallback(async () => {
    setStatus('loading');
    const r = await brandApi.listGroups();
    if (!r.success) { setStatus('error'); return; }
    setGroups(r.data.groups || []); setStatus('ready');
  }, []);
  useEffect(() => { load(); }, [load]);
  if (status === 'loading') return <Skeleton rows={4} />;
  if (status === 'error') return <LoadErrorList what="groups" onRetry={load} />;
  return (
    <FlatList data={groups} keyExtractor={g => g.id} contentContainerStyle={{ padding: 18, paddingBottom: 40 }} testID="groups-pick"
      ListEmptyComponent={<EmptyState title={P.groupsEmptyTitle} body={P.groupsEmptyBody} />}
      renderItem={({ item }) => (
        <TouchableOpacity style={s.groupRow} onPress={() => onOpen(item)} testID={`group-${item.id}`}>
          <View style={{ flex: 1 }}>
            <Text style={s.groupName}>{item.name}</Text>
            {/* How many of this group are already in the basket. Free — the basket is local.
                How many this SET can take is deliberately not shown: that answer costs the full
                eligibility query per group, and paying it for every row would undo the load-time
                fix of 2026-09-16. It lives inside the group check, where it is paid for once. */}
            <Text style={s.groupSub}>{(() => {
              const k = (item.members || []).filter(m => selectedIds.has(m.id)).length;
              return k ? P.groupRowPicked(item.memberCount || 0, k) : P.groupRow(item.memberCount || 0);
            })()}</Text>
          </View>
          <Text style={s.chev}>›</Text>
        </TouchableOpacity>
      )} />
  );
}

/**
 * What is in the basket, grouped by where each creator came from, with a way to take her out.
 * With a dozen creators from three sources, a number alone is not something you can check.
 */
function BasketSheet({ visible, rows, onRemove, onClose }) {
  const groups = [];
  const push = (title, list) => { if (list.length) groups.push({ title, list }); };
  push(P.byHand, rows.filter(c => !c.sourceGroupId && !c.pool));
  push(P.fromPool, rows.filter(c => !c.sourceGroupId && c.pool));
  const byGroup = new Map();
  for (const c of rows.filter(x => x.sourceGroupId)) {
    if (!byGroup.has(c.sourceGroupId)) byGroup.set(c.sourceGroupId, []);
    byGroup.get(c.sourceGroupId).push(c);
  }
  for (const [, list] of byGroup) push(P.fromGroup(list[0].sourceGroupName || 'a group'), list);

  return (
    <Sheet visible={visible} onClose={onClose} testID="basket-sheet">
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <Text style={s.sheetTitle}>{P.reviewTitle(rows.length)}</Text>
        <Text style={s.sheetHint}>{P.reviewRemoveHint}</Text>
      </View>
      <ScrollView style={{ maxHeight: 380 }}>
        {rows.length ? groups.map(g => (
          <View key={g.title}>
            <Text style={s.sheetSec}>{`${g.title} · ${g.list.length}`}</Text>
            {g.list.map(c => (
              <TouchableOpacity key={c.id} style={s.basketRow} onPress={() => onRemove(c.id)} activeOpacity={0.7} testID={`basket-remove-${c.id}`}>
                <Avatar name={c.name} url={c.avatarUrl} size={32} />
                <Text style={s.basketName} numberOfLines={1}>{c.name}</Text>
                <Text style={s.basketX}>×</Text>
              </TouchableOpacity>
            ))}
          </View>
        )) : <Text style={s.groupSub}>{P.emptyBasket}</Text>}
      </ScrollView>
      <View style={{ marginTop: 10 }}><PrimaryButton label={P.reviewDone} onPress={onClose} testID="basket-done" /></View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  // the square box of a row that can't be ticked: filled grey, like the round tick on All creators
  boxOff: { backgroundColor: T.surface, borderColor: T.surface },
  // 2 + the strip's own 8 between its children = the 10 this row always had above the button
  basket: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  faces: { flexDirection: 'row', alignItems: 'center' },
  count: { fontFamily: fonts.sansBold, fontSize: 13.5, color: T.ink, marginLeft: 2 },
  reviewLink: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: T.ink, marginLeft: 'auto', textDecorationLine: 'underline' },
  sheetTitle: { fontFamily: fonts.sansBold, fontSize: 16, color: T.ink, flex: 1 },
  sheetHint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3 },
  sheetSec: { fontFamily: fonts.sansBold, fontSize: 11, color: T.ink3, letterSpacing: 0.5, marginTop: 12, marginBottom: 4, textTransform: 'uppercase' },
  basketRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: T.border },
  basketName: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: T.ink, flex: 1, marginLeft: 10 },
  basketX: { fontFamily: fonts.sansRegular, fontSize: 20, color: T.ink3, paddingHorizontal: 6 },
  search: { fontFamily: fonts.sansRegular, borderWidth: 1, borderColor: T.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: T.ink, backgroundColor: T.surface },
  groupRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 14, marginBottom: 10 },
  groupName: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: T.ink },
  groupSub: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, marginTop: 2 },
  chev: { fontFamily: fonts.sansRegular, fontSize: 22, color: T.ink3 },
});
