/**
 * Item 14 — her Going live screen (board v2: S1, S4, S5, S7–S10, S12, S14–S16, S19, S20, S24).
 * Contract: features/item14-sale-going-live · rules v1.30 §12.1
 *
 * TWO PATHS on one screen, in order:
 *   1 · Shoppable posts — checked by INFLX. Made in the Create tab (item 13); this screen shows
 *       them against the minimum and opens the create flow with this collaboration filled in.
 *   2 · Social media — checked by the brand. LOCKED until INFLX approves her first post; the
 *       server refuses it too. It is item 12's content step: she names each approved post and
 *       where she'll share it, uploads the version, sends it, posts and links it.
 * Which moment it is comes from the server's `stage` and `can`, never a guess on the phone.
 * Files go straight to storage exactly as item 12's screen sends them.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { launchImageLibrary } from 'react-native-image-picker';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { influencerApi, uploadContentFile } from '../../services/api';
import { PrimaryButton, SecondaryButton, TextButton, EmptyState, FieldError } from '../../components/settings/primitives';
import { Skeleton, useToast } from '../../components/settings/feedback';
import { ActionSheet } from '../../components/settings/sheets';
import { COPY } from '../../components/settings/copy';
import { LoadErrorList } from '../../components/discovery/DiscoverList';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import useRouteToast from '../../hooks/useRouteToast';
import { Card7 } from '../../components/agreement/bits7';
import { StepLine10, AmberBox10, GreenBox10, WaitBox10, DelayedChip10 } from '../../components/shoot/bits10';
import { FileTile12, AddTile12, NoteLine12, RoundPill12, QuoteBox12, Line12, CountChip12 } from '../../components/content/bits12';
import { SendSheet12 } from '../../components/content/sheets12';
import { MSG12, LIMITS12 } from '../../components/content/copy12';
import { DestinationSheet14 } from '../../components/sale/sheets14';
import { C14, day10, rupees } from '../../components/sale/copy14';

const mimeOf = (a) => {
  const t = String((a && a.type) || '').toLowerCase();
  if (t) return t === 'image/jpg' ? 'image/jpeg' : t;
  const n = String((a && a.fileName) || '').toLowerCase();
  return n.endsWith('.mp4') ? 'video/mp4' : n.endsWith('.png') ? 'image/png' : /\.jpe?g$/.test(n) ? 'image/jpeg' : '';
};
const STATE_TONE = { live: 'active', approved: 'waiting', in_review: 'waiting', sent_back: 'yourMove', removed: 'ended', draft: 'ended' };

/** A small status chip in the locked palette. */
function Chip({ tone, text, testID }) {
  const c = T.state[tone] || T.state.ended;
  return <View style={[s.chip, { backgroundColor: c.bg }]} testID={testID}><Text style={[s.chipText, { color: c.fg }]}>{text}</Text></View>;
}

/** "1 of 2 approved", the bar, and one line under it (S4–S7). */
export function Progress14({ p1, line, testID }) {
  if (!p1) return null;
  const pct = Math.min(100, (p1.approved / Math.max(1, p1.min)) * 100);
  return (
    <View style={s.progress} testID={testID || 'progress'}>
      <View style={s.progressTop}>
        <Text style={s.progressBig}>{C14.progress(p1.approved, p1.min)}</Text>
        <Text style={s.progressMin}>{C14.minimum(p1.min)}</Text>
      </View>
      <View style={s.bar2}><View style={[s.bar2Fill, { width: `${pct}%` }]} /></View>
      {line ? <Text style={s.small}>{line}</Text> : null}
    </View>
  );
}

/** One shoppable post in Path 1's list. */
export function PostLine14({ post, right, sub, testID }) {
  return (
    <View style={s.postLine} testID={testID || `post-${post.id}`}>
      <View style={s.thumb} />
      <View style={{ flex: 1 }}>
        <Text style={s.postTitle} numberOfLines={1}>{post.title}</Text>
        <Text style={s.code}>{post.code || (post.kind === 'price' ? 'Price post' : post.offerName || 'Offer post')}</Text>
        {sub ? <Text style={s.small}>{sub}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export default function SaleLiveScreen({ navigation, route }) {
  const { ciId } = route.params || {};
  const [c, setC] = useState(null);
  const [status, setStatus] = useState('loading');
  const [sheet, setSheet] = useState(null);             // 'send' | { dest: post, outside }
  const [busy, setBusy] = useState(false);
  const [sheetError, setSheetError] = useState(null);
  const [uploads, setUploads] = useState({});
  const [rowError, setRowError] = useState({});
  const [captions, setCaptions] = useState({});
  const [links, setLinks] = useState({});
  const [menu, setMenu] = useState(null);
  const [urls, setUrls] = useState({});
  const mounted = useRef(true);
  const { toast, show } = useToast();
  useRouteToast(navigation, route, show);
  useEffect(() => () => { mounted.current = false; }, []);

  const load = useCallback(async () => {
    setStatus((st) => (st === 'ready' ? 'ready' : 'loading'));
    const r = await influencerApi.myContent(ciId);
    if (!mounted.current) return;
    if (!r || !r.success) { setStatus('error'); return; }
    setC(r.data.content);
    setStatus('ready');
  }, [ciId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!c) return;
    const ids = [];
    for (const row of c.rows || []) {
      for (const f of row.files || []) if (f.kind === 'photo' && !urls[f.id]) ids.push(f.id);
      for (const p of row.proofs || []) if (p.screenshotFileId && !urls[p.screenshotFileId]) ids.push(p.screenshotFileId);
    }
    ids.slice(0, 20).forEach(async (id) => {
      const r = await influencerApi.contentFileUrl(ciId, id);
      if (mounted.current && r && r.success) setUrls((u) => ({ ...u, [id]: r.data.view.url }));
    });
  }, [c]); // eslint-disable-line react-hooks/exhaustive-deps

  const refuse = (r) => (r && r.error && r.error.message) || COPY.saveFailed;

  async function createPost() {
    setBusy(true);
    const r = await influencerApi.createPost(ciId);
    setBusy(false);
    if (!r || !r.success) { show(refuse(r)); return; }
    // P1: item 13's flow, opened at the post type with the brand and this collaboration filled in.
    navigation.navigate('CreateTab', { screen: 'PostType', params: { postId: r.data.post.id } });
  }

  async function addFiles(row, purpose = 'content') {
    setRowError((e) => ({ ...e, [row.key]: null }));
    const room = purpose === 'story_proof' ? 1 : Math.max(1, 10 - (row.files || []).length);
    const pick = await launchImageLibrary({ mediaType: purpose === 'story_proof' ? 'photo' : 'mixed', selectionLimit: room });
    if (!pick || pick.didCancel || !pick.assets) return;
    for (const a of pick.assets) {
      const mime = mimeOf(a);
      const size = Number(a.fileSize || 0);
      const kind = mime === 'video/mp4' ? 'video' : 'photo';
      if (!LIMITS12[mime] || (purpose === 'story_proof' && kind !== 'photo')) { setRowError((e) => ({ ...e, [row.key]: MSG12.FILE_WRONG_TYPE })); continue; }
      if (size > LIMITS12[mime]) { setRowError((e) => ({ ...e, [row.key]: kind === 'video' ? MSG12.FILE_TOO_LARGE_VIDEO : MSG12.FILE_TOO_LARGE_PHOTO })); continue; }
      const tempId = `${Date.now()}-${Math.random()}`;
      setUploads((u) => ({ ...u, [tempId]: { rowKey: row.key, progress: 0 } }));
      try {
        // eslint-disable-next-line no-await-in-loop
        const u = await influencerApi.contentUploadUrl(ciId, { rowKey: row.key, kind, mime, sizeBytes: size, durationS: a.duration != null ? a.duration : null, purpose });
        if (!u || !u.success) throw new Error(refuse(u));
        // eslint-disable-next-line no-await-in-loop
        await uploadContentFile(u.data.upload, a.uri, { onProgress: (p) => mounted.current && setUploads((x) => ({ ...x, [tempId]: { rowKey: row.key, progress: p } })) })
          .catch(() => { throw new Error(MSG12.UPLOAD_MISSING); });
        // eslint-disable-next-line no-await-in-loop
        const done = await influencerApi.contentConfirmFile(ciId, u.data.upload.fileId);
        if (!done || !done.success) throw new Error(refuse(done));
        if (purpose === 'story_proof') {
          // eslint-disable-next-line no-await-in-loop
          const p = await influencerApi.contentSetProof(ciId, row.key, 1, { screenshotFileId: done.data.file.id });
          if (!p || !p.success) throw new Error(refuse(p));
        }
      } catch (e) {
        if (mounted.current) setRowError((x) => ({ ...x, [row.key]: e.message }));
      } finally {
        if (mounted.current) setUploads((x) => { const n = { ...x }; delete n[tempId]; return n; });
      }
    }
    load();
  }

  async function removeFile(file) {
    setMenu(null);
    const r = await influencerApi.contentRemoveFile(ciId, file.id);
    if (!r || !r.success) show(refuse(r));
    load();
  }
  async function viewFile(file) {
    setMenu(null);
    const r = await influencerApi.contentFileUrl(ciId, file.id);
    if (!r || !r.success) { show(refuse(r)); return; }
    Linking.openURL(r.data.view.url).catch(() => {});
  }
  async function saveCaption(row) {
    const text = captions[row.key];
    if (text == null) return;
    const r = await influencerApi.contentCaption(ciId, row.key, text);
    if (!r || !r.success) { setRowError((e) => ({ ...e, [row.key]: refuse(r) })); return; }
    setCaptions((x) => { const n = { ...x }; delete n[row.key]; return n; });
    setC(r.data.content);
  }
  async function saveLink(row) {
    const url = links[row.key];
    if (url == null) return;
    const r = url.trim()
      ? await influencerApi.contentSetProof(ciId, row.key, 1, { url: url.trim() })
      : await influencerApi.contentClearProof(ciId, row.key, 1);
    if (!r || !r.success) { setRowError((e) => ({ ...e, [row.key]: refuse(r) })); return; }
    setRowError((e) => ({ ...e, [row.key]: null }));
    setLinks((x) => { const n = { ...x }; delete n[row.key]; return n; });
    setC(r.data.content);
  }
  async function act(call, done) {
    setBusy(true); setSheetError(null);
    const r = await call();
    setBusy(false);
    if (!r || !r.success) { if (sheet) setSheetError(refuse(r)); else show(refuse(r)); load(); return false; }
    setSheet(null);
    setC(r.data.content);
    if (done) show(done);
    return true;
  }
  async function addPlaces(types) {
    const post = sheet && sheet.dest;
    if (!post) return;
    if (!sheet.outside) { await act(() => influencerApi.saleAddRows(ciId, post.id, types)); return; }
    setBusy(true); setSheetError(null);
    for (const type of types) {
      // eslint-disable-next-line no-await-in-loop
      const r = await influencerApi.saleAddOutside(ciId, post.id, type);
      if (!r || !r.success) { setBusy(false); setSheetError(refuse(r)); load(); return; }
      setC(r.data.content);
    }
    setBusy(false); setSheet(null);
  }
  const removeRow = (row) => act(() => influencerApi.saleRemoveRow(ciId, row.key));
  const submit = () => act(() => influencerApi.contentSubmit(ciId, c.round.current), C14.sent);
  const posted = () => act(() => influencerApi.contentPosted(ciId), C14.postedDone);

  if (status === 'loading') return <View style={base.screen}><Header title={C14.titleHers} onBack={() => navigation.goBack()} /><Skeleton rows={6} /></View>;
  if (status === 'error') return <View style={base.screen}><Header title={C14.titleHers} onBack={() => navigation.goBack()} /><LoadErrorList what={C14.couldntLoad} onRetry={load} /></View>;

  const brand = c.brand.name;
  const stage = c.stage;
  const p1 = c.path1;
  const editing = ['draft', 'changes'].includes(stage) && !c.frozen;
  const pkg = (c.rows || []).filter((r) => !r.outside);
  const outsideRows = (c.rows || []).filter((r) => r.outside);
  const last = c.rounds && c.rounds.length ? c.rounds[c.rounds.length - 1] : null;
  const pendingOf = (key) => Object.entries(uploads).filter(([, u]) => u.rowKey === key);
  const sharable = p1 ? p1.posts.filter((p) => p.sharable) : [];
  const takenFor = (postId) => (c.rows || []).filter((r) => r.postId === postId).map((r) => r.type);
  const rowTitle = (row) => C14.rowLabel(row.post ? row.post.title : '', row.label);
  const left = c.proofsLeft || [];
  const notShared = (c.notShared || []).filter((n) => !n.inPackage);
  const steps = (c.steps || []).map((st) => ({
    ...st,
    detail: st.key === 'shoot' && st.at ? day10(st.at) : st.key === 'posts' ? st.detail
      : st.key === 'complete' ? (st.at ? day10(st.at) : C14.steps.salesKeep) : st.at ? day10(st.at) : null,
  }));

  return (
    <View style={base.screen} testID={`sale-live-${stage}${c.frozen ? '-frozen' : ''}${c.delayed ? '-delayed' : ''}`}>
      <Header title={C14.titleHers} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 190 }} keyboardShouldPersistTaps="handled">
        <View style={s.crumbRow}>
          <Text style={s.crumb}>{C14.crumb(brand, c.setName)}</Text>
          {c.delayed ? <DelayedChip10 /> : null}
        </View>

        {/* S24 — every other state. */}
        {stage === 'old_terms' ? <EmptyState title={C14.oldTerms} body="" /> : null}
        {stage === 'shoot_not_done' ? <EmptyState title={C14.shootNotDone} body={C14.opensAfterShoot} /> : null}
        {c.frozen && c.reported && c.reported.brand ? (
          <Card7 title={C14.toldInflxHers(brand, c.reported.brand.at)} testID="told-inflx"><Text style={s.para}>{C14.toldInflxHersBody}</Text></Card7>
        ) : null}
        {c.delayed && !c.frozen ? <AmberBox10 text={C14.delayedHers(c.postingDate)} testID="delayed-box" /> : null}

        {stage === 'complete' ? (
          <>
            <GreenBox10 text={c.liveConfirmedAuto ? C14.confirmedItself(c.liveConfirmedAt) : C14.completedHers(c.completedAt)} testID="completed-box" />
            <View style={s.stats} testID="sales">
              <View style={s.stat}><Text style={s.statBig}>{c.sales.orders}</Text><Text style={s.statSub}>{C14.orders}</Text></View>
              <View style={s.stat}><Text style={s.statBig}>{rupees(c.sales.sales)}</Text><Text style={s.statSub}>{C14.sales}</Text></View>
              <View style={s.stat}><Text style={s.statBig}>{rupees(c.sales.commission)}</Text><Text style={s.statSub}>{C14.youEarn}</Text></View>
            </View>
            <View style={s.tint}>
              <View style={s.moneyRow}><Text style={s.para}>{C14.waitingReturn}</Text><Text style={s.moneyVal}>{rupees(c.sales.pending)}</Text></View>
              <View style={s.moneyRow}><Text style={s.para}>{C14.inWallet}</Text><Text style={s.moneyVal}>{rupees(c.sales.inWallet)}</Text></View>
            </View>
          </>
        ) : null}

        {/* ── Path 1 · Shoppable posts (S4, S5) ───────────────────────────── */}
        {p1 && !['old_terms', 'shoot_not_done'].includes(stage) ? (
          <View style={s.pathCard} testID="path1">
            <View style={s.pathHead}><Text style={s.pathTitle}>{stage === 'complete' ? C14.yourPosts : C14.path1}</Text><Text style={s.pathWho}>{C14.path1Who}</Text></View>
            {stage !== 'complete' ? (
              <Progress14 p1={p1} line={p1.inReview ? C14.withInflx(p1.inReview) : p1.short ? C14.moreToMin(p1.short) : null} />
            ) : null}
            {p1.posts.map((p) => (
              <PostLine14 key={p.id} post={p}
                sub={p.late ? C14.approvedLate(p.approvedAt) : null}
                right={p.late ? <Chip tone="yourMove" text={C14.late} /> : <Chip tone={STATE_TONE[p.state]} text={C14.postState[p.state] || p.state} testID={`post-state-${p.id}`} />} />
            ))}
            {stage !== 'complete' ? (
              p1.approved === 0
                ? <PrimaryButton label={`+ ${C14.createPost}`} onPress={createPost} busy={busy} testID="create-post" />
                : <SecondaryButton label={`+ ${C14.createAnother}`} onPress={() => { if (!busy) createPost(); }} testID="create-another" />
            ) : null}
          </View>
        ) : null}

        {/* ── Path 2 · Social media ────────────────────────────────────────── */}
        {stage === 'posts' ? (
          <View style={[s.pathCard, { opacity: 0.8 }]} testID="path2-locked">
            <View style={s.pathHead}><Text style={s.pathTitle}>{C14.path2}</Text><Chip tone="ended" text={C14.locked} /></View>
            <Text style={s.small}>{C14.lockedWhy(brand)}</Text>
          </View>
        ) : null}

        {editing ? (
          <View style={s.pathCard} testID="path2">
            <View style={s.pathHead}><Text style={s.pathTitle}>{C14.path2}</Text><Chip tone="yourMove" text={C14.open} /></View>
            {stage === 'changes' && last ? (
              <>
                <AmberBox10 text={C14.theyAsked(brand, last.verdictAt)} testID="they-asked" />
                <RoundPill12 round={{ ...c.round, current: last.no, isLast: last.no === c.round.allowed, used: false }} />
                <QuoteBox12 text={last.reason} />
              </>
            ) : <Text style={s.small}>{C14.openWhy(brand)}</Text>}
            {pkg.map((row) => (
              <View key={row.key} style={s.row} testID={`row-${row.key}`}>
                <View style={s.rowHead}><Text style={s.rowLabel}>{rowTitle(row)}</Text><CountChip12 have={row.files.length} need={1} /></View>
                <View style={s.tiles}>
                  {row.files.map((f) => <FileTile12 key={f.id} file={f} url={urls[f.id]} note={f.pinnedNote} onPress={() => setMenu(f)} />)}
                  {pendingOf(row.key).map(([id, u]) => <FileTile12 key={id} progress={u.progress} />)}
                  {row.files.length + pendingOf(row.key).length < 10 ? <AddTile12 onPress={() => addFiles(row)} testID={`add-${row.key}`} /> : null}
                </View>
                {row.files.filter((f) => f.pinnedNote).map((f) => <NoteLine12 key={f.id} text={f.pinnedNote} />)}
                <TextInput style={s.caption} value={captions[row.key] != null ? captions[row.key] : row.caption} placeholder={C14.captionPlaceholder}
                  placeholderTextColor={T.ink3} multiline maxLength={500} onChangeText={(v) => setCaptions((x) => ({ ...x, [row.key]: v }))}
                  onEndEditing={() => saveCaption(row)} testID={`caption-${row.key}`} />
                <FieldError text={rowError[row.key]} />
                {c.can.removeRow ? <TextButton label={C14.removeRow} onPress={() => removeRow(row)} testID={`remove-${row.key}`} /> : null}
              </View>
            ))}
            {c.can.addRows ? sharable.map((p) => (
              <PostLine14 key={p.id} post={p} testID={`sharable-${p.id}`}
                right={<TouchableOpacity style={s.plus} onPress={() => { setSheetError(null); setSheet({ dest: p, outside: false }); }} accessibilityLabel={C14.addPostOrPlace} testID={`add-place-${p.id}`}><Text style={s.plusText}>+</Text></TouchableOpacity>} />
            )) : null}
            {!pkg.length ? <Line12 text={C14.approvedOnly} /> : null}
          </View>
        ) : null}

        {stage === 'in_review' && !c.frozen ? (
          <View style={s.pathCard} testID="path2-in-review">
            <WaitBox10 text={C14.withThem(brand, last && last.submittedAt)} testID="with-them" />
            <RoundPill12 round={c.round} />
            {pkg.map((row) => (
              <View key={row.key} style={s.row}>
                <View style={s.rowHead}><Text style={s.rowLabel}>{rowTitle(row)}</Text><CountChip12 have={row.files.length} need={1} /></View>
                <View style={s.tiles}>{row.files.map((f) => <FileTile12 key={f.id} file={f} url={urls[f.id]} onPress={() => viewFile(f)} />)}</View>
              </View>
            ))}
            <Text style={s.small}>{C14.lockedWhile}</Text>
          </View>
        ) : null}

        {/* S14 — approved: post, then a link each (a screenshot for a Story). */}
        {stage === 'approved' && !c.frozen ? (
          <View style={s.pathCard} testID="path2-approved">
            <GreenBox10 text={C14.approvedPostNow(brand, c.approvedAt)} testID="approved-box" />
            <Text style={s.h}>{C14.addLinkEach}</Text>
            {pkg.map((row) => {
              const proof = (row.proofs || [])[0] || {};
              return (
                <View key={row.key} style={s.row} testID={`proof-row-${row.key}`}>
                  <View style={s.rowHead}><Text style={s.rowLabel}>{rowTitle(row)}</Text><CountChip12 have={proof.filled ? 1 : 0} need={1} /></View>
                  {row.isStory ? (
                    <View style={s.tiles}>
                      {proof.screenshotFileId ? <FileTile12 file={{ id: proof.screenshotFileId, kind: 'photo' }} url={urls[proof.screenshotFileId]} /> : <AddTile12 onPress={() => addFiles(row, 'story_proof')} testID={`add-shot-${row.key}`} />}
                      <Text style={[s.small, { marginLeft: 8, flex: 1 }]}>{C14.storiesGo}</Text>
                    </View>
                  ) : (
                    <TextInput style={s.link} value={links[row.key] != null ? links[row.key] : (proof.url || '')} placeholder={C14.pasteLink}
                      placeholderTextColor={T.ink3} autoCapitalize="none" autoCorrect={false} keyboardType="url"
                      onChangeText={(v) => setLinks((x) => ({ ...x, [row.key]: v }))} onEndEditing={() => saveLink(row)} testID={`link-${row.key}`} />
                  )}
                  <FieldError text={rowError[row.key]} />
                </View>
              );
            })}
          </View>
        ) : null}

        {/* S15 — posted: the day it confirms itself, shown from the start. */}
        {stage === 'posted' && !c.frozen ? (
          <View style={s.pathCard} testID="path2-posted">
            <WaitBox10 text={C14.postedWaiting(c.postedAt, brand)} testID="posted-waiting" />
            {c.autoconfirmAt ? (
              <View style={s.when} testID="autoconfirm-date"><Text style={s.whenSub}>{C14.confirmsItselfOn}</Text><Text style={s.whenDay}>{day10(c.autoconfirmAt)}</Text></View>
            ) : null}
          </View>
        ) : null}

        {stage === 'live' ? (
          <View style={s.pathCard} testID="path2-live">
            <GreenBox10 text={C14.theyConfirmed(brand, c.liveConfirmedAt)} testID="live-box" />
            <Text style={s.small}>{C14.completesWhen(p1 ? p1.short : 0)}</Text>
          </View>
        ) : null}

        {/* S16 — posts outside the package: a link only, no approval. */}
        {c.can.addOutside && (notShared.length || outsideRows.length) ? (
          <View style={s.pathCard} testID="outside">
            <Text style={s.pathTitle}>{C14.whereShared}</Text>
            {outsideRows.map((row) => {
              const proof = (row.proofs || [])[0] || {};
              return (
                <View key={row.key} style={s.row} testID={`outside-${row.key}`}>
                  <View style={s.rowHead}><Text style={s.rowLabel}>{rowTitle(row)}</Text><CountChip12 have={proof.filled ? 1 : 0} need={1} /></View>
                  {row.isStory ? (
                    proof.screenshotFileId ? <FileTile12 file={{ id: proof.screenshotFileId, kind: 'photo' }} url={urls[proof.screenshotFileId]} />
                      : <AddTile12 onPress={() => addFiles(row, 'story_proof')} testID={`add-shot-${row.key}`} />
                  ) : (
                    <TextInput style={s.link} value={links[row.key] != null ? links[row.key] : (proof.url || '')} placeholder={C14.pasteLink}
                      placeholderTextColor={T.ink3} autoCapitalize="none" autoCorrect={false} keyboardType="url"
                      onChangeText={(v) => setLinks((x) => ({ ...x, [row.key]: v }))} onEndEditing={() => saveLink(row)} testID={`link-${row.key}`} />
                  )}
                  <FieldError text={rowError[row.key]} />
                </View>
              );
            })}
            {notShared.map((n) => {
              const p = sharable.find((x) => x.id === n.postId);
              if (!p) return null;
              return (
                <View key={n.postId}>
                  <PostLine14 post={p} right={<Chip tone="yourMove" text={C14.notSharedYet} />} />
                  {n.dueBy ? <Text style={s.small}>{C14.addBy(n.dueBy, brand)}</Text> : null}
                  <TextButton label={C14.addWhere} onPress={() => { setSheetError(null); setSheet({ dest: p, outside: true }); }} testID={`add-where-${n.postId}`} />
                </View>
              );
            })}
          </View>
        ) : null}

        {c.steps && c.steps.length && !['complete', 'old_terms', 'shoot_not_done'].includes(stage) ? <StepLine10 steps={steps} /> : null}
      </ScrollView>

      <View style={s.barBottom} testID="sale-actions">
        {editing ? (
          <>
            <PrimaryButton label={stage === 'changes' ? C14.sendChanges : C14.sendTo(brand)} disabled={!c.can.submit || Object.keys(uploads).length > 0}
              onPress={() => { setSheetError(null); setSheet('send'); }} testID="send" />
            <Text style={s.hint}>{!pkg.length ? C14.noRowsBody : stage === 'changes' && c.round ? C14.lastRoundHint(c.round.allowed) : ''}</Text>
          </>
        ) : null}
        {stage === 'approved' && !c.frozen ? (
          <>
            <PrimaryButton label={C14.postedEverything} disabled={!c.can.markPosted} onPress={posted} busy={busy} busyLabel="Sending" testID="posted" />
            {left.length ? <Text style={s.hint} testID="to-go">{C14.toGo(left.filter((x) => !x.isStory).length, left.filter((x) => x.isStory).length)}</Text> : null}
          </>
        ) : null}
      </View>

      <SendSheet12 visible={sheet === 'send'} brandName={brand} rows={pkg.map((r) => ({ ...r, label: rowTitle(r) }))} busy={busy} serverError={sheetError}
        resend={stage === 'changes'} onSend={submit} onClose={() => setSheet(null)} />
      <DestinationSheet14 visible={!!(sheet && sheet.dest)} post={sheet && sheet.dest} destinations={c.destinations}
        taken={sheet && sheet.dest ? takenFor(sheet.dest.id) : []} busy={busy} serverError={sheetError}
        onAdd={addPlaces} onClose={() => setSheet(null)} />
      <ActionSheet visible={!!menu} onClose={() => setMenu(null)} actions={menu ? [
        { label: 'View', onPress: () => viewFile(menu) },
        ...(editing ? [{ label: 'Remove', destructive: true, onPress: () => removeFile(menu) }] : []),
      ] : []} />
      {toast}
    </View>
  );
}

const s = StyleSheet.create({
  crumbRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  crumb: { fontFamily: fonts.sansBold, fontSize: 10.5, color: T.ink3, letterSpacing: 0.6, flex: 1 },
  para: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink2, lineHeight: 20 },
  small: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, lineHeight: 17, marginTop: 4 },
  h: { fontFamily: fonts.sansBold, fontSize: 14, color: T.ink, marginVertical: 8 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, lineHeight: 17, textAlign: 'center' },
  pathCard: { borderRadius: 14, borderWidth: 1, borderColor: T.border, padding: 14, marginBottom: 12, backgroundColor: '#FFFFFF', gap: 8 },
  pathHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pathTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: T.ink },
  pathWho: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: T.ink2 },
  progress: { backgroundColor: T.surface, borderRadius: 12, padding: 12, gap: 6 },
  progressTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressBig: { fontFamily: fonts.sansBold, fontSize: 14.5, color: T.ink },
  progressMin: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: T.ink2 },
  bar2: { height: 6, borderRadius: 99, backgroundColor: '#E5E4DE', overflow: 'hidden' },
  bar2Fill: { height: 6, backgroundColor: T.state.active.fg },
  postLine: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: T.border },
  thumb: { width: 40, height: 48, borderRadius: 9, backgroundColor: T.surface },
  postTitle: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink },
  code: { fontFamily: fonts.sansRegular, fontSize: 11, color: T.ink2, letterSpacing: 0.4 },
  chip: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  chipText: { fontFamily: fonts.sansBold, fontSize: 11 },
  row: { borderRadius: 12, borderWidth: 1, borderColor: T.border, padding: 12, backgroundColor: '#FFFFFF' },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8 },
  rowLabel: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink, flex: 1 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  caption: { fontFamily: fonts.sansRegular, fontSize: 13.5, color: T.ink, borderWidth: 1, borderColor: T.border, borderRadius: 10, padding: 10, minHeight: 56, textAlignVertical: 'top', marginTop: 4 },
  link: { fontFamily: fonts.sansRegular, fontSize: 13.5, color: T.ink, borderWidth: 1, borderColor: T.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9 },
  plus: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  plusText: { fontFamily: fonts.sansBold, fontSize: 18, color: T.ink },
  when: { borderRadius: 14, padding: 12, backgroundColor: T.surface },
  whenSub: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink2 },
  whenDay: { fontFamily: fonts.sansBold, fontSize: 19, color: T.ink, marginTop: 2 },
  stats: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  stat: { flex: 1, backgroundColor: T.surface, borderRadius: 10, padding: 10 },
  statBig: { fontFamily: fonts.sansBold, fontSize: 16, color: T.ink },
  statSub: { fontFamily: fonts.sansRegular, fontSize: 10.5, color: T.ink2 },
  tint: { backgroundColor: T.surface, borderRadius: 14, padding: 12, marginBottom: 12, gap: 4 },
  moneyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  moneyVal: { fontFamily: fonts.sansBold, fontSize: 13.5, color: T.ink },
  barBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, paddingBottom: 22, backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.border, gap: 8 },
});
