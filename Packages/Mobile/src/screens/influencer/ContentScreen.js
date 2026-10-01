/**
 * Item 12 — her content step (C1, C3, C4, C5, C8, C10, C12, C15).
 * Contract: features/item12-content · rules v1.29 §12.2
 *
 * One screen, because it is one thing at different moments: what she owes, filling it, the
 * package with the brand, their changes, posting and proving, and the money. Which moment it is
 * comes from the server's `stage` and `can`, never from a guess on the phone.
 *
 * Files go STRAIGHT to storage: ask for a signed URL, stream the file from disk
 * (uploadContentFile — no Blob in memory, proved with 195 MB on a real phone), then confirm, which
 * is when the server believes it. Nothing is ever read into the app's memory.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, Linking } from 'react-native';
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
import { StepLine10, Row10, AmberBox10, GreenBox10, WaitBox10, DelayedChip10 } from '../../components/shoot/bits10';
import { FeeCard12, FileTile12, AddTile12, RowHead12, NoteLine12, RoundPill12, QuoteBox12, Line12 } from '../../components/content/bits12';
import { SendSheet12, ReportSheet12 } from '../../components/content/sheets12';
import { C12, MSG12, LIMITS12, day10 } from '../../components/content/copy12';

const mimeOf = (a) => {
  const t = String((a && a.type) || '').toLowerCase();
  if (t) return t === 'image/jpg' ? 'image/jpeg' : t;
  const n = String((a && a.fileName) || '').toLowerCase();
  return n.endsWith('.mp4') ? 'video/mp4' : n.endsWith('.png') ? 'image/png' : /\.jpe?g$/.test(n) ? 'image/jpeg' : '';
};

export default function ContentScreen({ navigation, route }) {
  const { ciId } = route.params || {};
  const [c, setC] = useState(null);
  const [status, setStatus] = useState('loading');
  const [started, setStarted] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sheetError, setSheetError] = useState(null);
  const [uploads, setUploads] = useState({});           // tempId → { rowKey, progress }
  const [rowError, setRowError] = useState({});         // rowKey → message
  const [captions, setCaptions] = useState({});         // rowKey → text being edited
  const [links, setLinks] = useState({});               // `${rowKey}:${slot}` → text being edited
  const [menu, setMenu] = useState(null);               // a file's ⋯
  const [urls, setUrls] = useState({});                 // fileId → signed URL (photos)
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

  // Photo thumbnails: a 300-second signed URL each, fetched as the photos appear.
  useEffect(() => {
    if (!c) return;
    const photos = [];
    for (const row of c.rows || []) for (const f of row.files || []) if (f.kind === 'photo' && !urls[f.id]) photos.push(f.id);
    for (const row of c.rows || []) for (const pr of row.proofs || []) if (pr.screenshotFileId && !urls[pr.screenshotFileId]) photos.push(pr.screenshotFileId);
    photos.slice(0, 20).forEach(async (id) => {
      const r = await influencerApi.contentFileUrl(ciId, id);
      if (mounted.current && r && r.success) setUrls((u) => ({ ...u, [id]: r.data.view.url }));
    });
  }, [c]); // eslint-disable-line react-hooks/exhaustive-deps

  const refuse = (r) => (r && r.error && r.error.message) || COPY.saveFailed;

  /** Pick, check, sign, stream, confirm — one file at a time, each with its own progress. */
  async function addFiles(row, purpose = 'content', slot = null) {
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
        if (purpose === 'story_proof' && slot) {
          // eslint-disable-next-line no-await-in-loop
          const p = await influencerApi.contentSetProof(ciId, row.key, slot, { screenshotFileId: done.data.file.id });
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
    if (!r || !r.success) { show(refuse(r)); load(); return; }
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
  async function saveLink(row, slot) {
    const key = `${row.key}:${slot}`;
    const url = links[key];
    if (url == null) return;
    const r = url.trim()
      ? await influencerApi.contentSetProof(ciId, row.key, slot, { url: url.trim() })
      : await influencerApi.contentClearProof(ciId, row.key, slot);
    if (!r || !r.success) { setRowError((e) => ({ ...e, [key]: refuse(r) })); return; }
    setRowError((e) => ({ ...e, [key]: null }));
    setLinks((x) => { const n = { ...x }; delete n[key]; return n; });
    setC(r.data.content);
  }
  async function act(call, done, closeSheet = true) {
    setBusy(true); setSheetError(null);
    const r = await call();
    setBusy(false);
    if (!r || !r.success) { if (sheet) setSheetError(refuse(r)); else show(refuse(r)); load(); return; }
    if (closeSheet) setSheet(null);
    setC(r.data.content);
    if (done) show(done);
  }
  const submit = () => act(() => influencerApi.contentSubmit(ciId, c.round.current), C12.sent);
  const posted = () => act(() => influencerApi.contentPosted(ciId), C12.postedDone);
  const report = (note) => act(() => influencerApi.contentReport(ciId, { kind: 'brand_silent', note }), C12.reportedDone);

  if (status === 'loading') return <View style={base.screen}><Header title={C12.titleHers} onBack={() => navigation.goBack()} /><Skeleton rows={6} /></View>;
  if (status === 'error') return <View style={base.screen}><Header title={C12.titleHers} onBack={() => navigation.goBack()} /><LoadErrorList what={C12.couldntLoad} onRetry={load} /></View>;

  const brand = c.brand.name;
  const stage = c.stage;
  const editing = ['draft', 'changes'].includes(stage) && !c.frozen;
  const anyFiles = (c.rows || []).some((r) => (r.files || []).length > 0) || c.rounds.length > 0;
  const showIntro = stage === 'draft' && !anyFiles && !started;
  const last = c.rounds[c.rounds.length - 1] || null;
  const pendingOf = (rowKey) => Object.entries(uploads).filter(([, u]) => u.rowKey === rowKey);
  const stepsHers = (c.steps || []).map((st) => (
    st.key === 'shoot' ? { ...st, detail: st.at ? C12.steps.done(day10(st.at)) : st.detail }
      : st.key === 'content' ? { ...st, detail: stage === 'draft' ? C12.steps.uploadWhat : st.detail }
        : st.key === 'live' ? { ...st, detail: c.postingDate ? C12.steps.posts(day10(c.postingDate)) : null }
          : { ...st, detail: st.at ? day10(st.at) : null }));
  const paidSteps = [
    { key: 'signed', label: C12.steps.signed, state: 'done', detail: day10(c.steps[0] && c.steps[0].at) },
    { key: 'shoot', label: C12.steps.shoot, state: 'done', detail: day10(c.shootDoneAt) },
    { key: 'live', label: C12.steps.contentLive, state: 'done', detail: day10(c.liveConfirmedAt) },
    { key: 'final', label: C12.steps.finalPayment, state: stage === 'complete' ? 'done' : 'now', detail: day10(c.finalDueAt) },
  ];
  const slotsLeft = c.proofsLeft || [];
  const linksLeft = slotsLeft.filter((x) => !x.isStory).length;
  const shotsLeft = slotsLeft.filter((x) => x.isStory).length;

  return (
    <View style={base.screen} testID={`content-${stage}${c.frozen ? '-frozen' : ''}${c.delayed ? '-delayed' : ''}`}>
      <Header title={C12.titleHers} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 190 }} keyboardShouldPersistTaps="handled">
        <View style={s.crumbRow}>
          <Text style={s.crumb}>{C12.crumb(brand, c.setName)}</Text>
          {c.delayed ? <DelayedChip10 /> : null}
        </View>

        {/* C15 — a brand's report holds everything; the sentence says nothing is lost. */}
        {c.frozen && stage !== 'complete' ? (
          <Card7 title={C12.toldInflxTitle} testID="told-inflx"><Text style={s.para}>{C12.toldInflxBody(brand, c.money.t1.amount)}</Text></Card7>
        ) : null}
        {c.delayed && !c.frozen ? <AmberBox10 text={C12.delayedHers(c.postingDate)} testID="delayed-box" /> : null}

        {/* C15 — the shoot first. */}
        {stage === 'shoot_not_done' ? (
          <>
            <EmptyState title={C12.shootNotDoneTitle} body="" />
            <Card7 title={C12.afterTheShoot} testID="after-shoot"><Text style={s.para}>{c.mode === 'visit' ? C12.opensOnceVisit : C12.opensOnceRemote}</Text></Card7>
          </>
        ) : null}

        {/* C1 — what she owes, before a single file. */}
        {showIntro ? (
          <>
            <GreenBox10 text={C12.shootDone(c.shootDoneAt)} testID="shoot-done-box" />
            <StepLine10 steps={stepsHers} />
            <Card7 title={C12.whatYouAgreed} testID="what-you-agreed">
              {c.rows.map((r) => <Row10 key={r.key} label={r.label} value={String(r.count)} testID={`owe-${r.key}`} />)}
              <Row10 label={C12.usageRights} value={(c.usageRights && c.usageRights.words) || C12.noUsageRights} />
            </Card7>
            {c.postingDate && c.daysToPosting >= 0 ? <Text style={s.countdown} testID="countdown">{C12.countdownHers(c.postingDate, c.daysToPosting)}</Text> : null}
            <Line12 text={C12.uploadFirst(brand)} testID="upload-first" />
          </>
        ) : null}

        {/* C8 — their changes: their words, the round, the package open again. */}
        {stage === 'changes' && last ? (
          <>
            <AmberBox10 text={C12.theyAskedChanges(brand, last.verdictAt)} testID="they-asked" />
            <RoundPill12 round={{ ...c.round, current: last.no, isLast: last.no === c.round.allowed, used: false }} />
            <QuoteBox12 text={last.reason} />
          </>
        ) : null}

        {/* C3 / C4 / C8 — the rows, open to change. */}
        {editing && !showIntro ? (
          <>
            {!anyFiles ? <EmptyState title={C12.nothingYet} body={C12.nothingYetBody(c.rows)} /> : null}
            {c.rows.map((row) => (
              <View key={row.key} style={s.row} testID={`edit-row-${row.key}`}>
                <RowHead12 row={row} have={row.files.length} />
                <View style={s.tiles}>
                  {row.files.map((f) => <FileTile12 key={f.id} file={f} url={urls[f.id]} note={f.pinnedNote} onPress={() => setMenu(f)} />)}
                  {pendingOf(row.key).map(([id, u]) => <FileTile12 key={id} progress={u.progress} />)}
                  {row.files.length + pendingOf(row.key).length < 10 ? <AddTile12 onPress={() => addFiles(row)} testID={`add-${row.key}`} /> : null}
                </View>
                {row.files.filter((f) => f.pinnedNote).map((f) => <NoteLine12 key={f.id} text={f.pinnedNote} />)}
                <TextInput style={s.caption} value={captions[row.key] != null ? captions[row.key] : row.caption} placeholder={C12.captionPlaceholder}
                  placeholderTextColor={T.ink3} multiline maxLength={500} onChangeText={(v) => setCaptions((x) => ({ ...x, [row.key]: v }))}
                  onEndEditing={() => saveCaption(row)} testID={`caption-${row.key}`} />
                <Text style={s.counter}>{`${(captions[row.key] != null ? captions[row.key] : row.caption || '').length} / 500`}</Text>
                <FieldError text={rowError[row.key]} />
              </View>
            ))}
            {anyFiles ? <Line12 text={C12.captionsHint(brand)} testID="captions-hint" /> : null}
          </>
        ) : null}

        {/* In review — locked; nothing to do but wait. */}
        {stage === 'in_review' && !c.frozen ? (
          <>
            <WaitBox10 text={MSG12.PACKAGE_LOCKED(brand)} testID="with-them" />
            {c.rows.map((row) => (
              <View key={row.key} style={s.row}>
                <RowHead12 row={row} have={row.files.length} />
                <View style={s.tiles}>{row.files.map((f) => <FileTile12 key={f.id} file={f} url={urls[f.id]} onPress={() => viewFile(f)} />)}</View>
                {row.caption ? <Text style={s.para}>{row.caption}</Text> : null}
              </View>
            ))}
          </>
        ) : null}

        {/* C10 — approved: post it, then prove it, one slot per deliverable. */}
        {stage === 'approved' && !c.frozen ? (
          <>
            <GreenBox10 text={C12.approvedPostNow(c.approvedAt)} testID="approved-box" />
            <Text style={s.h}>{C12.addLinkEach}</Text>
            {c.rows.map((row) => (
              <View key={row.key} style={s.row} testID={`proof-row-${row.key}`}>
                <RowHead12 row={row} have={row.proofs.filter((p) => p.filled).length} />
                {row.isStory ? (
                  <>
                    <View style={s.tiles}>
                      {row.proofs.filter((p) => p.screenshotFileId).map((p) => (
                        <FileTile12 key={p.slot} file={{ id: p.screenshotFileId, kind: 'photo' }} url={urls[p.screenshotFileId]} />
                      ))}
                      {row.proofs.filter((p) => !p.filled).slice(0, 1).map((p) => (
                        <AddTile12 key={p.slot} onPress={() => addFiles(row, 'story_proof', p.slot)} testID={`add-shot-${row.key}`} />
                      ))}
                    </View>
                    <Line12 text={C12.storyProof} />
                  </>
                ) : row.proofs.map((p) => {
                  const key = `${row.key}:${p.slot}`;
                  return (
                    <View key={key}>
                      <TextInput style={s.link} value={links[key] != null ? links[key] : (p.url || '')} placeholder={C12.pasteLink}
                        placeholderTextColor={T.ink3} autoCapitalize="none" autoCorrect={false} keyboardType="url"
                        onChangeText={(v) => setLinks((x) => ({ ...x, [key]: v }))} onEndEditing={() => saveLink(row, p.slot)} testID={`link-${key}`} />
                      <FieldError text={rowError[key]} />
                    </View>
                  );
                })}
                <FieldError text={rowError[row.key]} />
              </View>
            ))}
          </>
        ) : null}

        {/* C15 — posted, waiting; after the stamped days she may ask INFLX to look. */}
        {/* Item 17: INFLX settled a payment by hand — nothing is waiting on the brand's confirmation. */}
        {stage === 'posted' && !c.frozen && c.settledByInflx ? (
          <WaitBox10 text={c.money.returned > 0 ? C12.returnedToBrand(c.money.returned) : C12.settledForCreator} testID="settled-box" />
        ) : null}
        {stage === 'posted' && !c.frozen && !c.settledByInflx ? (
          <Card7 title={C12.waitingTitle} testID="waiting-confirm">
            <Text style={s.para}>{C12.waitingBody(c.postedAt, brand, c.reportFrom)}</Text>
            {c.reported.creator ? <Text style={s.para} testID="you-told-inflx">{C12.youToldInflx(c.reported.creator.at)}</Text> : null}
          </Card7>
        ) : null}

        {/* C12 — the second payment in, the last on a date. */}
        {['live', 'complete'].includes(stage) ? (
          <>
            <GreenBox10 text={!c.liveConfirmedAt ? C12.inflxSettled : c.liveConfirmedBy === 'inflx' ? C12.inflxConfirmed(c.liveConfirmedAt) : C12.theyConfirmed(brand, c.liveConfirmedAt)} testID="confirmed-box" />
            <FeeCard12 money={c.money} side="creator" />
            {stage === 'live' && c.money.returned > 0 ? <WaitBox10 text={C12.returnedToBrand(c.money.returned)} testID="returned-box" /> : null}
            {stage === 'live' && !(c.money.returned > 0) ? <WaitBox10 text={C12.inWallet(c.money.t2.amount, c.money.t3.amount, c.finalDueAt)} testID="in-wallet" /> : null}
            <StepLine10 steps={paidSteps} />
          </>
        ) : null}
      </ScrollView>

      <View style={s.bar} testID="content-actions">
        {showIntro ? <PrimaryButton label={C12.startUploading} onPress={() => setStarted(true)} testID="start-uploading" /> : null}
        {editing && !showIntro ? (
          <>
            <PrimaryButton label={stage === 'changes' ? C12.sendChanges : C12.sendTo(brand)} disabled={!c.can.submit || Object.keys(uploads).length > 0}
              onPress={() => { setSheetError(null); setSheet('send'); }} testID="send" />
            <Text style={s.hint} testID="send-hint">{stage === 'changes' ? C12.replaceHint : c.missing.length ? (anyFiles ? C12.moreToAdd(c.missing) : C12.everyRow) : ''}</Text>
          </>
        ) : null}
        {stage === 'approved' && !c.frozen ? (
          <>
            <PrimaryButton label={C12.postedEverything} disabled={!c.can.markPosted} onPress={posted} busy={busy} busyLabel="Sending" testID="posted" />
            {slotsLeft.length ? <Text style={s.hint} testID="to-go">{C12.toGo(linksLeft, shotsLeft)}</Text> : null}
          </>
        ) : null}
        {stage === 'posted' && c.can.report ? (
          <SecondaryButton label={C12.askInflx} onPress={() => { setSheetError(null); setSheet('report'); }} testID="ask-inflx" />
        ) : null}
      </View>

      <SendSheet12 visible={sheet === 'send'} brandName={brand} rows={c.rows} busy={busy} serverError={sheetError}
        resend={stage === 'changes'} onSend={submit} onClose={() => setSheet(null)} />
      <ReportSheet12 visible={sheet === 'report'} kind="brand_silent" brandName={brand} busy={busy} serverError={sheetError}
        onReport={report} onClose={() => setSheet(null)} />
      <ActionSheet visible={!!menu} onClose={() => setMenu(null)} actions={menu ? [
        { label: C12.view, onPress: () => viewFile(menu) },
        ...(editing ? [{ label: C12.remove, destructive: true, onPress: () => removeFile(menu) }] : []),
      ] : []} />
      {toast}
    </View>
  );
}

const s = StyleSheet.create({
  crumbRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  crumb: { fontFamily: fonts.sansBold, fontSize: 10.5, color: T.ink3, letterSpacing: 0.6 },
  para: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink2, lineHeight: 20, marginBottom: 6 },
  h: { fontFamily: fonts.sansBold, fontSize: 14, color: T.ink, marginBottom: 10 },
  countdown: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: T.ink, marginBottom: 12 },
  row: { borderRadius: 14, borderWidth: 1, borderColor: T.border, padding: 14, marginBottom: 12, backgroundColor: '#FFFFFF' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap' },
  caption: { fontFamily: fonts.sansRegular, fontSize: 13.5, color: T.ink, borderWidth: 1, borderColor: T.border, borderRadius: 10, padding: 10, minHeight: 60, textAlignVertical: 'top', marginTop: 4 },
  counter: { fontFamily: fonts.sansRegular, fontSize: 11, color: T.ink3, textAlign: 'right', marginTop: 4 },
  link: { fontFamily: fonts.sansRegular, fontSize: 13.5, color: T.ink, borderWidth: 1, borderColor: T.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, marginBottom: 6 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, lineHeight: 17, textAlign: 'center' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, paddingBottom: 22, backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.border, gap: 8 },
});
