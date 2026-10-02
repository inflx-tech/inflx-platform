/**
 * DiscoverList — the reusable creator list: search, quick filters, count + sort, cards,
 * infinite scroll, loading / empty / error states, and a SELECT mode (G5 now, item 5's set
 * picker later). Contract: features/item3-discovery-profiles-groups · prompt §6.2, §6.9
 *
 * Props
 *   fetcher(params)     → { success, data:{ total, rows } }   (brandApi.discoverCreators or workedWith-adapter)
 *   countFetcher(params)→ { success, data:{ total } }
 *   lists               { niches, languages, states, nicheLabel, cityName }
 *   mode                'browse' | 'select'
 *   defaultOpenOnly     true on Discover, false inside a group picker
 *   selectedIds, disabledIds (Set), capacityLeft, onToggleSelect
 *   onOpen(creator), onAddToGroup(creator)
 *   onBlockedPress(creator, pickState)   select mode: a "Can't invite" row was tapped (board B, D2)
 *
 * ui-walk-fixes board B (locked 2 Oct 2026, founder decisions D1 + D2):
 *   · ONE control row — the search box with a single Filters button ("Filters · N"). The chip
 *     row is gone; "Open to invitations only" lives in the Filters sheet. "Clear all" joins the
 *     count line while a filter is on, and "Nearest first ▾" opens the sheet (U12) — no second
 *     menu in the pinned area.
 *   · select mode draws the compact three-line PickRow; browse mode keeps the full CreatorCard.
 * Everything new is styled from `p` below. The exported `s` is also the creator app's Find
 * brands list (BrandList imports it) and is not touched.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { Skeleton, LoadError } from '../settings/feedback';
import { EmptyState, TagRow, PrimaryButton } from '../settings/primitives';
import { Avatar } from '../../screens/brand/BrandBlockedCreatorsScreen';
import { StatTriple, StatusChip3 } from './bits';
import FiltersSheet, { CREATOR_DEFAULTS, changedCount } from './FiltersSheet';
import { aimLabel, modeLabel } from '../settings/copy';
import { C3, fmtCompact, fmtPct, distanceLabel, distanceOf, AIM_ORDER, MODE_ORDER } from './copy3';

/**
 * One creator, as the Creators tab draws her.
 *
 * `select` turns the same card into a pick: the ⊕ becomes a tick, the whole card toggles, and
 * a locked row (already invited, or her settings rule this set out) dims and says why.
 * Founder, 2026-09-16: picking creators for a set must show the SAME list as the Creators tab.
 * It used to fall back to a one-line MemberRow, so the followers, the engagement and the
 * Aim/mode tags — everything she picks ON — were missing exactly where she is choosing.
 *   select: { checked, disabled, onToggle, note, chip, tone }
 */
export function CreatorCard({ c, onOpen, onAddToGroup, compact, select }) {
  // creator-distance-and-visit-preference (D1): "Fashion · Guntur · 32 km" — the distance rides
  // after the city; "Same city" for 0; nothing when either side has no city.
  const meta = [c.nicheLabel, c.cityName, distanceLabel(distanceOf(c)), (c.languages || []).join(', ')].filter(Boolean).join(' · ');
  const tags = [...AIM_ORDER.filter(a => (c.acceptedAims || []).includes(a)).map(aimLabel), ...MODE_ORDER.filter(m => (c.acceptedModes || []).includes(m)).map(m => m === 'visit' ? `📍 ${modeLabel(m)}` : modeLabel(m))];
  const picking = !!select;
  const checked = picking && !!select.checked;
  const locked = picking && !!select.disabled;
  const sub = picking && select.note ? select.note : meta;
  const a11y = picking ? { checked, disabled: locked } : undefined;
  return (
    <TouchableOpacity style={[s.card, checked && s.cardOn, locked && s.cardOff]}
      onPress={picking ? select.onToggle : (onOpen ? () => onOpen(c) : undefined)}
      disabled={locked} activeOpacity={0.85}
      accessibilityRole={picking ? 'checkbox' : 'button'} accessibilityState={a11y}
      testID={picking ? `select-${c.id}` : `creator-${c.id}`}>
      <View style={s.cardTop}>
        <Avatar name={c.name} url={c.avatarUrl} size={44} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.name} numberOfLines={1}>{c.name}</Text>
          {sub ? <Text style={s.meta} numberOfLines={1}>{sub}</Text> : null}
        </View>
        {picking ? (
          <View style={[s.tick, checked && s.tickOn]} testID={`tick-${c.id}`}>{checked ? <Text style={s.tickMark}>✓</Text> : null}</View>
        ) : onAddToGroup ? (
          <TouchableOpacity style={s.plus} onPress={() => onAddToGroup(c)} accessibilityLabel="Add to group" testID={`add-to-group-${c.id}`}>
            <Text style={s.plusText}>+</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <StatTriple instagram={c.instagram} youtube={c.youtube} engagement={c.engagement} compact={compact} />
      <View style={{ marginTop: 8 }}>
        {picking && select.chip ? (
          <View style={{ flexDirection: 'row' }}>
            <View style={[s.pickChip, { marginLeft: 0, backgroundColor: (select.tone || T.state.ended).bg }]}>
              <Text style={[s.pickChipText, { color: (select.tone || T.state.ended).fg }]}>{select.chip}</Text>
            </View>
          </View>
        ) : c.status === 'OK' ? <TagRow items={tags} /> : <StatusChip3 status={c.status} />}
        {c.blockedByYou ? <StatusChip3 status={null} blockedByYou /> : null}
      </View>
    </TouchableOpacity>
  );
}

/** "Fashion · Guntur · 32 km · Telugu, English" — the same facts, in the same order, as the full card's line. */
export function placeLine(c) {
  return [c.nicheLabel, c.cityName, distanceLabel(distanceOf(c)), (c.languages || []).join(', ')].filter(Boolean).join(' · ');
}

/**
 * PickRow — the row you TICK, on "Add creators" for a set and for a group.
 * ui-walk-fixes board B, frames B1–B6 · founder decisions D1 and D2 (2 Oct 2026).
 *
 * Three lines, so about six creators fit where one full card did:
 *   her name, with the round tick at the right
 *   niche · city · distance · languages        (one line, cut with … when long)
 *   48.2K IG · 12.1K YT · 4.2% eng
 * No Aim/mode tag line (D1 — "no need to mention this"). The Creators tab keeps the full card.
 *
 * A row that can't be ticked (`locked`) dims ONLY her face and her name. With a `note` — why she
 * is locked — that note takes the second line, stays readable grey and the numbers step aside;
 * a `chip` ("Can't invite", "Invited") sits beside her name.
 *
 * `onWhy` makes a locked row tappable: D2 — tapping a creator who can't be invited says why.
 * Such a row must NOT be marked disabled: React Native switches a touchable off as soon as
 * accessibilityState.disabled is true, so it is a button there, not a dead checkbox. A locked
 * row with nothing to say (already invited, already in the group, the group is full) is dead.
 */
export function PickRow({ c, checked, locked, note, chip, tone, onToggle, onWhy }) {
  const isLocked = !!locked;
  const isChecked = !!checked;
  const speaks = isLocked && typeof onWhy === 'function';
  const dead = isLocked && !speaks;
  const explained = isLocked && !!note;
  const second = explained ? note : placeLine(c);
  const chipTone = tone || T.state.ended;
  const hasStatus = !!c.status && c.status !== 'OK';
  return (
    <TouchableOpacity style={p.row} onPress={isLocked ? onWhy : onToggle} disabled={dead} activeOpacity={0.7}
      accessibilityRole={speaks ? 'button' : 'checkbox'} accessibilityState={{ checked: !!isChecked, disabled: !!dead }}
      testID={`select-${c.id}`}>
      <View style={p.hd}>
        <View style={isLocked ? p.dim : null}><Avatar name={c.name} url={c.avatarUrl} size={36} /></View>
        <View style={p.text}>
          <View style={p.nameRow}>
            <Text style={[p.name, isLocked && p.dim]} numberOfLines={1} testID={`pick-name-${c.id}`}>{c.name}</Text>
            {chip ? (
              <View style={[p.chip, { backgroundColor: chipTone.bg }]}><Text style={[p.chipText, { color: chipTone.fg }]}>{chip}</Text></View>
            ) : null}
          </View>
          {second ? <Text style={p.line} numberOfLines={1} ellipsizeMode="tail" testID={`pick-line-${c.id}`}>{second}</Text> : null}
          {explained ? null : (
            <Text style={[p.line, p.num]} numberOfLines={1} ellipsizeMode="tail" testID={`pick-numbers-${c.id}`}>
              {C3.discover.pickNumbers(fmtCompact(c.instagram), fmtCompact(c.youtube), fmtPct(c.engagement))}
            </Text>
          )}
        </View>
        <View style={[p.tick, isChecked && !isLocked && p.tickOn, isLocked && p.tickOff]} testID={`tick-${c.id}`}>
          {isChecked ? <Text style={[p.tickMark, isLocked && p.tickMarkOff]}>✓</Text> : null}
        </View>
      </View>
      {/* What the full card says under her numbers when she is not simply open: "Not taking
          invitations", "Not open to your brand", "Blocked by you". She can still join a group. */}
      {hasStatus || c.blockedByYou ? (
        <View style={p.under}><StatusChip3 status={hasStatus ? c.status : null} blockedByYou={!!c.blockedByYou} /></View>
      ) : null}
    </TouchableOpacity>
  );
}

/**
 * Compact row for group members / pickers: avatar · name · "Niche · City · 32 km · 48.2K IG" · status chip.
 * `dim` (optional, ui-walk-fixes board B): greys her face and her name only — for a creator who
 * can't be invited, whose `sub` line says why and must stay readable. Off, the row is as before.
 */
export function MemberRow({ c, right, onOpen, sub, dim }) {
  const meta = sub || [c.nicheLabel, c.cityName, distanceLabel(distanceOf(c)), c.instagram != null ? `${fmtCompact(c.instagram)} IG` : null].filter(Boolean).join(' · ');
  return (
    <TouchableOpacity style={s.member} onPress={onOpen ? () => onOpen(c) : undefined} activeOpacity={onOpen ? 0.7 : 1} testID={`member-${c.id}`}>
      {dim ? <View style={p.dim}><Avatar name={c.name} url={c.avatarUrl} size={40} /></View> : <Avatar name={c.name} url={c.avatarUrl} size={40} />}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={dim ? [s.name, p.dim] : s.name} numberOfLines={1}>{c.name}</Text>
        {meta ? <Text style={s.meta} numberOfLines={1}>{meta}</Text> : null}
        {c.status ? <View style={{ marginTop: 4 }}><StatusChip3 status={c.status} blockedByYou={c.blockedByYou} /></View> : null}
      </View>
      {right || null}
    </TouchableOpacity>
  );
}

export default function DiscoverList({
  fetcher, countFetcher, lists, mode = 'browse', defaultOpenOnly = true,
  selectedIds, disabledIds, disabledLabel, capacityLeft, onToggleSelect, onOpen, onAddToGroup, header, testID = 'discover-list',
  // Item 5 — a per-row pick state for the set picker: (item) → { state: 'ok' | 'invited' | 'ineligible', label, chip }.
  // 'invited' is ticked and locked; 'ineligible' is locked and unticked; both show the label under the name.
  // ui-walk-fixes D2: the state may also carry `message`, and a tapped 'ineligible' row is handed
  // to onBlockedPress(item, state) so the screen can say the sentence in its own toast.
  pickState, onBlockedPress,
}) {
  const [search, setSearch] = useState('');
  // creator-distance-and-visit-preference: `sort` (default 'distance' — nearest first) and `within`
  // (default 'any') ride inside the filters. ui-walk-fixes U12: the sheet is now the sort's only
  // home — the count line's "Nearest first ▾" opens it instead of a second menu.
  const [filters, setFilters] = useState({ ...CREATOR_DEFAULTS, openOnly: defaultOpenOnly });
  const sort = filters.sort || CREATOR_DEFAULTS.sort;
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('loading');   // loading | error | ready | more
  const [sheet, setSheet] = useState(false);
  const seq = useRef(0);
  const debounce = useRef(null);

  const params = useMemo(() => ({ ...filters, search: search.trim() || undefined, sort }), [filters, search, sort]);

  const load = useCallback(async (nextPage = 1) => {
    const my = ++seq.current;
    setStatus(nextPage === 1 ? 'loading' : 'more');
    const r = await fetcher({ ...params, page: nextPage });
    if (my !== seq.current) return;
    if (!r.success) { setStatus('error'); return; }
    setTotal(r.data.total || 0);
    setRows(prev => nextPage === 1 ? (r.data.rows || []) : [...prev, ...(r.data.rows || [])]);
    setPage(nextPage);
    setStatus('ready');
  }, [fetcher, params]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => load(1), search ? 350 : 0);
    return () => clearTimeout(debounce.current);
  }, [load]); // eslint-disable-line

  const defaults = { ...CREATOR_DEFAULTS, openOnly: defaultOpenOnly };
  const nChanged = changedCount(filters, defaults);
  const hasMore = rows.length < total;

  function clearAll() { setFilters({ ...defaults }); setSearch(''); }

  // Select mode draws the compact PickRow (board B, D1); browse mode keeps the full card.
  const renderItem = ({ item }) => {
    if (mode === 'select' && pickState) {
      const ps = pickState(item) || { state: 'ok' };
      const locked = ps.state !== 'ok';
      const checked = ps.state === 'invited' || !!(selectedIds && selectedIds.has(item.id));
      // D2: only a creator who can't be invited has something to say when tapped.
      const why = ps.state === 'ineligible' && onBlockedPress ? () => onBlockedPress(item, ps) : undefined;
      return (
        <PickRow c={locked ? { ...item, status: null } : item} checked={checked} locked={locked}
          note={locked ? ps.label : undefined} chip={ps.chip}
          tone={ps.state === 'invited' ? T.state.waiting : T.state.ended}
          onToggle={() => onToggleSelect && onToggleSelect(item)} onWhy={why} />
      );
    }
    if (mode === 'select') {
      const disabled = !!(disabledIds && disabledIds.has(item.id));
      const checked = disabled || !!(selectedIds && selectedIds.has(item.id));
      const full = !checked && capacityLeft != null && capacityLeft <= 0;
      return (
        <PickRow c={disabled ? { ...item, status: null } : item} checked={checked} locked={disabled || full}
          note={disabled ? (disabledLabel || C3.groups.alreadyIn) : undefined}
          onToggle={() => onToggleSelect && onToggleSelect(item)} />
      );
    }
    return <CreatorCard c={item} onOpen={onOpen} onAddToGroup={onAddToGroup} />;
  };

  return (
    <View style={{ flex: 1 }} testID={testID}>
      {/*
        Founder, 2026-09-17: "all the screen is covered with header things … if we
        come to creator visibility screen, it is almost nothing."

        It was four stacked bands pinned above the list — the caller's hint, the
        search box, the filter chips and the count/sort row — so on a 6" phone
        exactly ONE creator card fitted, and opening the keyboard to search left
        none at all.

        Only the two you actually touch stay pinned now. The hint and the count
        ride at the top of the list and scroll away once you are looking at
        people, which is the moment you stop needing them.

        Founder, 2026-10-01 (ui-walk-fixes board B): "all filters into one button."
        The chip row under the search box is gone — it wrapped to a second line as
        soon as a filter was on. What is pinned now is ONE row: the search box and
        a Filters button that counts what is set. "Open to invitations only" is the
        first switch inside that sheet, and the sort menu that used to open here,
        pushing the list down, is the sheet's Sort group.
      */}
      <View style={p.ctlWrap}>
        <View style={p.ctlRow} testID="discover-controls">
          <TextInput style={[s.search, p.ctlSearch]} value={search} onChangeText={setSearch} placeholder={C3.discover.search} placeholderTextColor={T.ink3} autoCorrect={false} autoCapitalize="none" testID="discover-search" />
          <TouchableOpacity style={[p.fbtn, nChanged > 0 && p.fbtnOn]} onPress={() => setSheet(true)} activeOpacity={0.7} accessibilityRole="button" testID="open-filters">
            <Text style={p.fbtnText} numberOfLines={1}>{nChanged > 0 ? C3.discover.filtersN(nChanged) : C3.discover.filters}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {status === 'loading' ? <Skeleton rows={5} /> : status === 'error' ? (
        <LoadErrorList what="creators" onRetry={() => load(1)} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={r => r.id}
          renderItem={renderItem}
          // ui-walk-fixes board C: in select mode (the two "Add creators" pickers) the footer is now
          // a strip under this list, not a bar floating over it, so the 120 that scrolled the last
          // row clear of that bar is not needed there. Browse mode (the Creators tab) is unchanged.
          contentContainerStyle={{ padding: 18, paddingTop: 0, paddingBottom: mode === 'select' ? 24 : 120 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListHeaderComponent={
            <View>
              {header || null}
              {status !== 'error' ? (
                <View style={s.countRow}>
                  <View style={p.countLeft}>
                    <Text style={s.count}>{C3.discover.count(total)}</Text>
                    {/* "Clear all" takes the place of the summary chip ("Fashion +1 ✕") and does
                        what it did, so it keeps that chip's testID. Shown only while a filter is on. */}
                    {nChanged > 0 ? (
                      <TouchableOpacity onPress={clearAll} hitSlop={CLEAR_SLOP} accessibilityRole="button" testID="quick-chip">
                        <Text style={p.clear}>{C3.discover.clearAll}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  {/* U12: the sort lives in the Filters sheet; this opens it. */}
                  <TouchableOpacity onPress={() => setSheet(true)} accessibilityRole="button" testID="sort-toggle">
                    <Text style={s.sort}>{C3.discover.sorts[sort]} ▾</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          }
          onEndReachedThreshold={0.4}
          onEndReached={() => { if (hasMore && status === 'ready') load(page + 1); }}
          ListFooterComponent={status === 'more' ? <ActivityIndicator color={T.ink3} style={{ marginVertical: 12 }} /> : null}
          ListEmptyComponent={
            <View style={{ paddingTop: 20 }}>
              <EmptyState title={C3.states.noCreatorsTitle} body={C3.states.noCreatorsBody} />
              <View style={{ width: 160, alignSelf: 'center' }}><PrimaryButton label={C3.states.clearFilters} onPress={clearAll} testID="clear-filters" /></View>
            </View>
          }
        />
      )}

      <FiltersSheet visible={sheet} kind="creators" value={filters} lists={lists} defaults={defaults}
        fetchCount={async (f) => { const r = await countFetcher({ ...f, search: search.trim() || undefined, countOnly: 1 }); return r.success ? r.data.total : 0; }}
        onApply={(f) => { setFilters(f); setSheet(false); }} onClose={() => setSheet(false)} />
    </View>
  );
}

export function LoadErrorList({ what, onRetry }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }} testID="load-error">
      <Text style={{ fontFamily: fonts.sansBold, fontSize: 17, color: T.ink }}>{C3.states.couldntLoad(what)}</Text>
      <Text style={{ fontFamily: fonts.sansRegular, fontSize: 13.5, color: T.ink3, marginTop: 6 }}>{C3.states.couldntLoadBody}</Text>
      <View style={{ marginTop: 16, width: 160 }}><PrimaryButton label={C3.states.tryAgain} onPress={onRetry} testID="try-again" /></View>
    </View>
  );
}

export const s = StyleSheet.create({
  controls: { paddingHorizontal: 18, paddingTop: 8 },
  search: { fontFamily: fonts.sansRegular, borderWidth: 1, borderColor: T.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: T.ink, backgroundColor: T.surface },
  quick: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  qchip: { borderWidth: 1, borderColor: T.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8, marginBottom: 6, backgroundColor: T.bg },
  qchipOn: { backgroundColor: T.ink, borderColor: T.ink },
  qchipText: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: T.ink },
  qchipTextOn: { color: '#FFFFFF' },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  count: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: T.ink2 },
  sort: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: T.ink },
  sortMenu: { borderWidth: 1, borderColor: T.border, borderRadius: 10, backgroundColor: T.bg, marginBottom: 8 },
  sortItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.border },
  sortItemText: { fontFamily: fonts.sansMedium, fontSize: 14, color: T.ink2 },
  capHint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, marginBottom: 6 },
  card: { borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 14, marginBottom: 12, backgroundColor: T.bg },
  cardOn: { borderColor: T.ink, borderWidth: 1.5, backgroundColor: T.surface },
  cardOff: { opacity: 0.5 },
  tick: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: T.border, alignItems: 'center', justifyContent: 'center', backgroundColor: T.bg },
  tickOn: { backgroundColor: T.ink, borderColor: T.ink },
  tickMark: { fontFamily: fonts.sansBold, fontSize: 14, color: T.bg, marginTop: -1 },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  name: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: T.ink },
  meta: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, marginTop: 2 },
  plus: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  plusText: { fontFamily: fonts.sansBold, fontSize: 20, color: T.ink, marginTop: -2 },
  member: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  pickChip: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, marginLeft: 8 },
  pickChipText: { fontFamily: fonts.sansBold, fontSize: 11 },
});

// "Clear all" is a word, not a button-sized target: give the finger room around it.
const CLEAR_SLOP = { top: 10, bottom: 10, left: 8, right: 8 };

/**
 * ui-walk-fixes board B — everything the one control row and the PickRow need. Kept apart from
 * the exported `s` on purpose: BrandList (the creator app's Find brands) draws itself from `s`,
 * and that list does not change in this round (spec U9).
 */
const p = StyleSheet.create({
  // the one control row: search + Filters
  ctlWrap: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 4 },
  ctlRow: { flexDirection: 'row', alignItems: 'stretch' },
  ctlSearch: { flex: 1, minWidth: 0 },
  fbtn: { marginLeft: 8, minHeight: 40, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1.5, borderColor: T.border, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center' },
  fbtnOn: { borderColor: T.ink },
  fbtnText: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink },
  // the count line
  countLeft: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  clear: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink, textDecorationLine: 'underline', marginLeft: 8 },
  // the compact pick row
  row: { paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: T.border },
  hd: { flexDirection: 'row', alignItems: 'flex-start' },
  text: { flex: 1, minWidth: 0, marginLeft: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { flexShrink: 1, fontFamily: fonts.sansSemiBold, fontSize: 15, lineHeight: 20, color: T.ink },
  line: { fontFamily: fonts.sansRegular, fontSize: 12.5, lineHeight: 17, color: T.ink2, marginTop: 1 },
  num: { fontFamily: fonts.sansSemiBold, color: T.ink, fontVariant: ['tabular-nums'] },
  // a row that can't be ticked: only her face and her name are dimmed — the line that says why is not
  dim: { opacity: 0.5 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginLeft: 8 },
  chipText: { fontFamily: fonts.sansBold, fontSize: 11 },
  tick: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: T.border, alignItems: 'center', justifyContent: 'center', backgroundColor: T.bg, marginLeft: 10, marginTop: 1 },
  tickOn: { backgroundColor: T.ink, borderColor: T.ink },
  tickOff: { backgroundColor: T.surface, borderColor: T.surface },
  tickMark: { fontFamily: fonts.sansBold, fontSize: 13, color: T.bg, marginTop: -1 },
  tickMarkOff: { color: T.ink3 },
  under: { marginTop: 6, marginLeft: 46 },
});
