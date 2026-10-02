/**
 * Item 12 — the brand's content step (C2, C6, C7, C9, C11, C13, C14, C16).
 * Contract: features/item12-content · rules v1.29 §12.2
 *
 * One screen for the brand's whole side of the content: waiting for her, reviewing a round (the
 * last one warned before it is decided, not after), what she posted with every link opening,
 * the confirmation that pays her — the money named on the screen before the tap — and the record.
 * Which of those it is comes from the server's `stage` and `can`.
 *
 * The brand sees only what she has SENT. One tap on a tile opens the file INSIDE the app
 * (MediaViewer12 — ui-walk-fixes board H): a fresh 300-second signed URL each time, photos on
 * every app build, videos on builds from 30 Sep 2026. "Add a note" lives in the viewer, and only
 * while this review can still ask for changes.
 *
 * ui-walk-fixes (board C, rule 1): the button strip is part of the column, under the page
 * (BottomBar) — it used to float over the page's last lines. The page lost the 190 of empty
 * space that only existed to scroll clear of it, and the toast sits just above the strip.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { PrimaryButton, SecondaryButton, TextButton, EmptyState } from '../../components/settings/primitives';
import { Skeleton, useToast } from '../../components/settings/feedback';
import { COPY } from '../../components/settings/copy';
import { LoadErrorList } from '../../components/discovery/DiscoverList';
import { Header, s as base } from './BrandPitchSettingsScreen';
import { BottomBar } from '../../components/shell/BottomBar';
import { FormArea } from '../../components/shell/FormScroll';
import useRouteToast from '../../hooks/useRouteToast';
import { Card7 } from '../../components/agreement/bits7';
import { StepLine10, AmberBox10, GreenBox10, WaitBox10, MoveBox10, DelayedChip10 } from '../../components/shoot/bits10';
import { FeeCard12, FileTile12, RowHead12, NoteLine12, RoundPill12, History12, LinkLine12, Record12, Line12 } from '../../components/content/bits12';
import { ChangesSheet12, NoteSheet12, ReportSheet12 } from '../../components/content/sheets12';
import MediaViewer12 from '../../components/content/MediaViewer12';
import { C12, day10 } from '../../components/content/copy12';

export default function BrandContentScreen({ navigation, route }) {
  const { campaignId, setId, ciId } = route.params || {};
  const [c, setC] = useState(null);
  const [status, setStatus] = useState('loading');
  const [sheet, setSheet] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sheetError, setSheetError] = useState(null);
  const [viewer, setViewer] = useState(null);          // the open file: { label, files, index, review }
  const [noteFor, setNoteFor] = useState(null);
  const [notes, setNotes] = useState({});              // fileId → the note she will see (C8)
  const [urls, setUrls] = useState({});
  const mounted = useRef(true);
  const { toast, show } = useToast({ inFlow: true });
  useRouteToast(navigation, route, show);
  useEffect(() => () => { mounted.current = false; }, []);

  const load = useCallback(async () => {
    setStatus((st) => (st === 'ready' ? 'ready' : 'loading'));
    const r = await brandApi.content(campaignId, setId, ciId);
    if (!mounted.current) return;
    if (!r || !r.success) { setStatus('error'); return; }
    setC(r.data.content);
    setStatus('ready');
  }, [campaignId, setId, ciId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!c) return;
    const ids = [];
    for (const row of c.rows || []) {
      for (const f of row.files || []) if (f.kind === 'photo' && !urls[f.id]) ids.push(f.id);
      for (const p of row.proofs || []) if (p.screenshotFileId && !urls[p.screenshotFileId]) ids.push(p.screenshotFileId);
    }
    ids.slice(0, 24).forEach(async (id) => {
      const r = await brandApi.contentFileUrl(campaignId, setId, ciId, id);
      if (mounted.current && r && r.success) setUrls((u) => ({ ...u, [id]: r.data.view.url }));
    });
  }, [c]); // eslint-disable-line react-hooks/exhaustive-deps

  const refuse = (r) => (r && r.error && r.error.message) || COPY.saveFailed;
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
  const approve = () => act(() => brandApi.contentApprove(campaignId, setId, ciId, c.round.current), C12.approved);
  const askChanges = (reason) => act(() => brandApi.contentChanges(campaignId, setId, ciId, {
    round: c.round.current, reason, notes: Object.entries(notes).filter(([, n]) => n).map(([fileId, note]) => ({ fileId, note })),
  }), C12.changesSent).then((ok) => { if (ok) setNotes({}); });
  const confirmLive = () => act(() => brandApi.contentConfirmLive(campaignId, setId, ciId, c.money.t2.amount), C12.confirmedDone);
  const report = (kind) => (note) => act(() => brandApi.contentReport(campaignId, setId, ciId, { kind, note }), C12.reportedDone);

  const title = c ? c.creator.name : '';
  if (status === 'loading') return <View style={base.screen}><Header title={title} onBack={() => navigation.goBack()} /><Skeleton rows={6} /></View>;
  if (status === 'error') return <View style={base.screen}><Header title={title} onBack={() => navigation.goBack()} /><LoadErrorList what={C12.couldntLoad} onRetry={load} /></View>;

  const name = c.creator.name;
  const stage = c.stage;
  const last = c.rounds[c.rounds.length - 1] || null;
  const noteCount = Object.values(notes).filter(Boolean).length;
  const steps = (c.steps || []).map((st) => (
    st.key === 'shoot' ? { ...st, label: c.mode === 'visit' ? C12.steps.shootPlan : C12.steps.shoot, detail: st.at ? (c.mode === 'visit' ? C12.steps.visited(day10(st.at)) : C12.steps.done(day10(st.at))) : null }
      : st.key === 'content' ? { ...st, detail: ['draft', 'changes'].includes(stage) ? C12.steps.withHer(name) : null }
        : st.key === 'live' ? { ...st, detail: c.postingDate ? C12.steps.posts(day10(c.postingDate)) : null }
          : { ...st, detail: st.at ? day10(st.at) : null }));
  const shootAgeDays = c.shootDoneAt ? (Date.now() - new Date(c.shootDoneAt).getTime()) / 86400000 : 0;

  return (
    <View style={base.screen} testID={`brand-content-${stage}${c.frozen ? '-frozen' : ''}${c.delayed ? '-delayed' : ''}`}>
      <Header title={name} onBack={() => navigation.goBack()} />
      <FormArea>
      <ScrollView style={s.page} contentContainerStyle={{ padding: 18 }} testID="brand-content-scroll">
        <Text style={s.crumb}>{C12.crumb(c.campaignName, c.setName)}</Text>
        <View style={s.aimRow}>
          <Text style={s.aimLine}>{C12.aimLine(c.mode)}</Text>
          {c.delayed ? <DelayedChip10 /> : <View style={[s.chip, { backgroundColor: T.state.active.bg }]}><Text style={[s.chipText, { color: T.state.active.fg }]}>{C12.active}</Text></View>}
        </View>

        {/* C16 — reported, and the money that stays where it is. */}
        {c.reported.brand ? (
          <Card7 title={C12.reportedTitle} testID="reported-card"><Text style={s.para}>{C12.reportedBrand(c.reported.brand.at, c.money.stillLocked)}</Text></Card7>
        ) : null}
        {c.delayed && !c.frozen ? <AmberBox10 text={C12.delayedBrand(c.postingDate, c.delayed.stage)} testID="delayed-box" /> : null}

        {stage === 'shoot_not_done' ? (
          <EmptyState title={C12.shootNotDoneTitle} body={c.mode === 'visit' ? C12.brandOpensVisit : C12.brandOpensRemote} />
        ) : null}

        {/* C2 — waiting for her, and the money ahead. */}
        {stage === 'draft' ? (
          <>
            <StepLine10 steps={steps} />
            <WaitBox10 text={C12.workingOnIt(name)} testID="working-on-it" />
            {shootAgeDays >= 2 ? (
              <Card7 title={C12.nothingReceivedTitle} testID="nothing-received"><Text style={s.para}>{C12.nothingReceived(name)}</Text></Card7>
            ) : null}
            <FeeCard12 money={c.money} side="brand" />
            {c.postingDate && c.daysToPosting >= 0 ? <Text style={s.countdown} testID="countdown">{C12.countdownBrand(c.postingDate, c.daysToPosting)}</Text> : null}
          </>
        ) : null}

        {stage === 'changes' && last ? (
          <>
            <WaitBox10 text={C12.withHerForChanges(name)} testID="with-her" />
            <History12 rounds={c.rounds} />
            <FeeCard12 money={c.money} side="brand" />
          </>
        ) : null}

        {/* C6 · C9 · C14 — one verdict on the whole package. */}
        {stage === 'in_review' && !c.frozen ? (
          <>
            <MoveBox10 text={c.round.current > 1 ? C12.yourMoveChanges(name, last && last.submittedAt) : C12.yourMoveSent(name, last && last.submittedAt)} testID="your-move" />
            <RoundPill12 round={c.round} />
            {c.round.used ? <AmberBox10 text={C12.roundsUsed(c.round.allowed)} testID="rounds-used" />
              : c.round.isLast ? <AmberBox10 text={C12.lastRound} testID="last-round" /> : null}
            {c.round.current > 1 ? <History12 rounds={c.rounds} /> : null}
            {c.rows.map((row) => (
              <View key={row.key} style={s.row} testID={`review-row-${row.key}`}>
                <RowHead12 row={row} have={row.files.length} />
                <View style={s.tiles}>
                  {row.files.map((f, i) => (
                    <FileTile12 key={f.id} file={f} url={urls[f.id]} note={notes[f.id]}
                      onPress={() => setViewer({ label: row.label, files: row.files, index: i, review: true })} />
                  ))}
                </View>
                {row.files.filter((f) => notes[f.id]).map((f) => <NoteLine12 key={f.id} text={notes[f.id]} />)}
                {row.caption ? <Text style={s.para}>{row.caption}</Text> : null}
              </View>
            ))}
            <Line12 text={C12.approvingLocks} testID="approving-locks" />
          </>
        ) : null}

        {stage === 'approved' ? <WaitBox10 text={C12.approvedPosting(name)} testID="approved-posting" /> : null}

        {/* C11 — every link opens; the money that moves is named before the tap. */}
        {stage === 'posted' && !c.frozen ? (
          <>
            <MoveBox10 text={C12.yourMovePosted(name, c.postedAt)} testID="posted-move" />
            {c.reported.creator ? <AmberBox10 text={C12.sheToldInflx(name, c.reported.creator.at)} testID="she-told-inflx" /> : null}
            {c.rows.map((row) => (
              <View key={row.key} style={s.row} testID={`posted-row-${row.key}`}>
                <RowHead12 row={row} have={row.proofs.filter((p) => p.filled).length} />
                {row.isStory ? (
                  <View style={s.tiles}>
                    {row.proofs.filter((p) => p.screenshotFileId).map((p, i, shots) => (
                      <FileTile12 key={p.slot} file={{ id: p.screenshotFileId, kind: 'photo' }} url={urls[p.screenshotFileId]}
                        onPress={() => setViewer({ label: row.label, files: shots.map((x) => ({ id: x.screenshotFileId, kind: 'photo' })), index: i })} />
                    ))}
                  </View>
                ) : row.proofs.map((p) => <LinkLine12 key={p.slot} url={p.url} testID={`link-${row.key}-${p.slot}`} />)}
              </View>
            ))}
            {c.settledByInflx ? (
              <WaitBox10 text={c.money.returned > 0 ? C12.returnedToYou(c.money.returned) : C12.settledForBrand} testID="settled-box" />
            ) : (
              <View style={[s.preview, { backgroundColor: T.state.active.bg }]} testID="confirm-preview">
                <Text style={[s.previewTitle, { color: T.state.active.fg }]}>{C12.confirmReleases(c.money.t2.amount)}</Text>
                <Text style={[s.previewSub, { color: T.state.active.fg }]}>{C12.confirmReleasesSub(c.money.fee, c.money.t3.amount, c.money.waitDays)}</Text>
              </View>
            )}
          </>
        ) : null}

        {stage === 'live' ? (
          <>
            <GreenBox10 text={c.liveConfirmedBy === 'inflx' ? C12.inflxConfirmedForBrand(c.liveConfirmedAt) : C12.youConfirmed(c.liveConfirmedAt)} testID="you-confirmed" />
            <FeeCard12 money={c.money} side="brand" />
            {c.money.returned > 0
              ? <WaitBox10 text={C12.returnedToYou(c.money.returned)} testID="returned-box" />
              : <WaitBox10 text={C12.lastFollows(c.money.t3.amount, c.finalDueAt)} testID="last-follows" />}
          </>
        ) : null}

        {/* C13 — completed: every payment, the record, what the usage rights allow. */}
        {stage === 'complete' ? (
          <>
            <GreenBox10 text={C12.completedOn(c.completedAt)} testID="completed-box" />
            <FeeCard12 money={c.money} side="brand" />
            <Record12 c={c} />
            {c.usageRights && c.usageRights.words ? <Line12 text={C12.usageAfter(c.usageRights.words)} testID="usage-after" /> : null}
          </>
        ) : null}
      </ScrollView>
      {toast}
      </FormArea>

      {/* With nothing the stage offers, the strip is not drawn at all. */}
      <BottomBar testID="brand-content-actions">
        {stage === 'in_review' && !c.frozen ? (
          <>
            <PrimaryButton label={C12.approve} icon="check" onPress={approve} busy={busy} busyLabel="Approving" testID="approve" />
            {c.can.askChanges ? <SecondaryButton label={C12.askChanges} onPress={() => { if (!busy) { setSheetError(null); setSheet('changes'); } }} testID="ask-changes" /> : null}
            {c.can.reportRoundsUsed ? <SecondaryButton label={C12.reportToInflx} onPress={() => { if (!busy) { setSheetError(null); setSheet('report_rounds'); } }} testID="report-rounds" /> : null}
          </>
        ) : null}
        {stage === 'posted' && !c.frozen && !c.settledByInflx ? (
          <>
            <PrimaryButton label={C12.confirmLive} icon="check" onPress={confirmLive} busy={busy} busyLabel="Confirming" testID="confirm-live" />
            {c.can.reportPostedWrong ? <TextButton label={C12.somethingWrong} onPress={() => { if (!busy) { setSheetError(null); setSheet('report_posted'); } }} testID="something-wrong" /> : null}
          </>
        ) : null}
      </BottomBar>

      <ChangesSheet12 visible={sheet === 'changes'} round={c.round} noteCount={noteCount} busy={busy} serverError={sheetError}
        onSend={askChanges} onClose={() => setSheet(null)} />
      <ReportSheet12 visible={sheet === 'report_rounds' || sheet === 'report_posted'} kind={sheet === 'report_rounds' ? 'rounds_used' : 'posted_wrong'}
        busy={busy} serverError={sheetError} onReport={report(sheet === 'report_rounds' ? 'rounds_used' : 'posted_wrong')} onClose={() => setSheet(null)} />
      <NoteSheet12 visible={!!noteFor} initial={noteFor ? notes[noteFor] : ''} onClose={() => setNoteFor(null)}
        onSave={(n) => { setNotes((x) => ({ ...x, [noteFor]: n })); setNoteFor(null); }} />
      {/* H1–H6 — one tap on a tile opens the file here. "Add a note" only on a file under review,
          and only while this review can still ask for changes; the note box opens over the viewer. */}
      <MediaViewer12 open={viewer} fetchUrl={(id) => brandApi.contentFileUrl(campaignId, setId, ciId, id)} onClose={() => setViewer(null)}
        noteOf={viewer && viewer.review ? (f) => notes[f.id] : undefined}
        onAddNote={viewer && viewer.review && stage === 'in_review' && !c.frozen && c.can.askChanges ? (f) => setNoteFor(f.id) : undefined}
        held={!!noteFor} />
    </View>
  );
}

const s = StyleSheet.create({
  crumb: { fontFamily: fonts.sansBold, fontSize: 10.5, color: T.ink3, letterSpacing: 0.6, marginBottom: 4 },
  aimRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  aimLine: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontFamily: fonts.sansBold, fontSize: 11 },
  para: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink2, lineHeight: 20, marginBottom: 6 },
  countdown: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: T.ink, marginBottom: 12 },
  row: { borderRadius: 14, borderWidth: 1, borderColor: T.border, padding: 14, marginBottom: 12, backgroundColor: '#FFFFFF' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap' },
  preview: { borderRadius: 12, padding: 12, marginBottom: 12 },
  previewTitle: { fontFamily: fonts.sansBold, fontSize: 14.5 },
  previewSub: { fontFamily: fonts.sansRegular, fontSize: 12.5, marginTop: 3, lineHeight: 18 },
  page: { flex: 1 },
});
