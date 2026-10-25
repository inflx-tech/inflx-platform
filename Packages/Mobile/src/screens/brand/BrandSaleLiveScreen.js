/**
 * Item 14 — the brand's side of a Pay for Sale collaboration going live
 * (board v2: S6, S7, S10–S13, S17, S18, S21–S23). Contract: features/item14-sale-going-live · rules v1.30 §12.1
 *
 * The brand WATCHES Path 1 (INFLX approves shop posts, never the brand) and ACTS on Path 2: it
 * reviews what she will share (item 12's rounds), opens her links, confirms it is live once for
 * the collaboration — no money moves on Pay for Sale — or tells INFLX what's wrong. Completed
 * shows the collaboration's sales, split as item 16 records them. `stage` and `can` come from the
 * server; the brand sees only what she has sent.
 *
 * ui-walk-fixes (board C, rule 1): the button strip is part of the column, under the page
 * (BottomBar) — it used to float over the page's last lines. The page lost the 190 of empty
 * space that only existed to scroll clear of it, and the toast sits just above the strip.
 *
 * shopper-walk-fixes (frames B1, B2): each post row shows its picture and each video to check the
 * picture taken from it (they were grey squares and black tiles); the count reads "4 approved ·
 * ✓ Minimum 1 met" once the minimum is met; the viewer's title is the post over the place.
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
import { FileTile12, RoundPill12, History12, LinkLine12, Line12, FeeCard12, hasCover12 } from '../../components/content/bits12';
import { ChangesSheet12 } from '../../components/content/sheets12';
import MediaViewer12 from '../../components/content/MediaViewer12';
import { ReportSheet14 } from '../../components/sale/sheets14';
import { C14, day10, rupees } from '../../components/sale/copy14';
// post-performance-v2 (board B2): the one line under each row's link; Update now after confirming. Contract: features/post-performance-v2
import { StatLine } from '../../components/content/StatLine12';
import { STATS } from '../../components/content/copyStats';
import { Progress14, PostLine14, postSub14 } from '../influencer/SaleLiveScreen';

const STATE_TONE = { live: 'active', approved: 'waiting', in_review: 'waiting', sent_back: 'yourMove', removed: 'ended', draft: 'ended' };
function Chip({ tone, text, testID }) {
  const c = T.state[tone] || T.state.ended;
  return <View style={[s.chip, { backgroundColor: c.bg }]} testID={testID}><Text style={[s.chipText, { color: c.fg }]}>{text}</Text></View>;
}

export default function BrandSaleLiveScreen({ navigation, route }) {
  const { campaignId, setId, ciId } = route.params || {};
  const [c, setC] = useState(null);
  const [status, setStatus] = useState('loading');
  const [sheet, setSheet] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sheetError, setSheetError] = useState(null);
  const [urls, setUrls] = useState({});
  const [viewer, setViewer] = useState(null);           // the open file: { title, place, files, index }
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

  // The tiles' small pictures: every photo and Story screenshot, and (W15) the picture taken from a
  // video that has one — asked for as the PICTURE (`cover`), never as the video itself.
  useEffect(() => {
    if (!c) return;
    const ids = [];                                     // [file id, the picture taken from a video?]
    for (const row of c.rows || []) {
      for (const f of row.files || []) if ((f.kind === 'photo' || hasCover12(f)) && !urls[f.id]) ids.push([f.id, hasCover12(f)]);
      for (const p of row.proofs || []) if (p.screenshotFileId && !urls[p.screenshotFileId]) ids.push([p.screenshotFileId, false]);
    }
    ids.slice(0, 24).forEach(async ([id, cover]) => {
      const r = await (cover ? brandApi.contentFileUrl(campaignId, setId, ciId, id, true) : brandApi.contentFileUrl(campaignId, setId, ciId, id));
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
  const approve = () => act(() => brandApi.contentApprove(campaignId, setId, ciId, c.round.current), C14.approved);
  const askChanges = (reason) => act(() => brandApi.contentChanges(campaignId, setId, ciId, { round: c.round.current, reason, notes: [] }), C14.changesSent);
  // Item 15: on Hybrid the tap is a payment — the amount the button names travels with it (item 12's G10).
  const confirmLive = () => act(() => brandApi.contentConfirmLive(campaignId, setId, ciId, c.hybrid && c.money ? c.money.t2.amount : undefined), C14.confirmedDone);
  const report = (kind, note) => act(() => brandApi.contentReport(campaignId, setId, ciId, { kind, note }), C14.reportedDone);

  const title = c ? c.creator.name : '';
  if (status === 'loading') return <View style={base.screen}><Header title={title} onBack={() => navigation.goBack()} /><Skeleton rows={6} /></View>;
  if (status === 'error') return <View style={base.screen}><Header title={title} onBack={() => navigation.goBack()} /><LoadErrorList what={C14.couldntLoad} onRetry={load} /></View>;

  const name = c.creator.name;
  const stage = c.stage;
  const p1 = c.path1;
  const last = c.rounds && c.rounds.length ? c.rounds[c.rounds.length - 1] : null;
  const pkg = (c.rows || []).filter((r) => !r.outside);
  const outsideRows = (c.rows || []).filter((r) => r.outside);
  const postTitle = (row) => (row.post ? `${row.post.title}${row.post.code ? ` · ${row.post.code}` : ''}` : '');
  const rowTitle = (row) => C14.rowLabel(postTitle(row), row.label);
  /** The viewer's two title lines for a row's files (frame B2): "This good offer · SHNCZW", then the place. */
  const named = (row) => ({ title: postTitle(row), place: row.label });
  const reportKinds = [
    ...(c.can.reportRoundsUsed ? ['rounds_used'] : []),
    ...(c.can.reportNotPosted ? ['not_posted'] : []),
    ...(c.can.reportPosted ? ['posted_wrong', 'missing'] : []),
  ];

  function Proofs({ row }) {
    const proof = (row.proofs || [])[0] || {};
    if (row.isStory) {
      return proof.screenshotFileId
        ? (
          <>
            <View style={s.tiles}><FileTile12 file={{ id: proof.screenshotFileId, kind: 'photo' }} url={urls[proof.screenshotFileId]} onPress={() => setViewer({ ...named(row), files: [{ id: proof.screenshotFileId, kind: 'photo' }], index: 0 })} /></View>
            <StatLine stats={{ state: 'story' }} side="brand" testID={`stat-${row.key}`} />
          </>
        )
        : null;
    }
    if (!proof.url) return null;
    return (
      <>
        <LinkLine12 url={proof.url} testID={`link-${row.key}`} />
        {/* post-performance-v2 (B2): its one line — the numbers, or why there are none. */}
        <StatLine stats={proof.stats} side="brand" testID={`stat-${row.key}`} />
      </>
    );
  }
  // post-performance-v2 (P7): every link read once; the server says "once a day" or "budget used up".
  const updateNow = () => act(() => brandApi.contentRefreshStats(campaignId, setId, ciId), null);

  return (
    <View style={base.screen} testID={`brand-sale-${stage}${c.frozen ? '-frozen' : ''}${c.delayed ? '-delayed' : ''}`}>
      <Header title={name} onBack={() => navigation.goBack()} />
      <FormArea>
      <ScrollView style={s.page} contentContainerStyle={{ padding: 18 }} testID="brand-sale-scroll">
        <View style={s.crumbRow}>
          <Text style={s.crumb}>{C14.crumbBrand(c.campaignName, c.setName)}</Text>
          {c.delayed ? <DelayedChip10 /> : null}
        </View>

        {stage === 'old_terms' ? <EmptyState title={C14.oldTermsBrand} body="" /> : null}
        {stage === 'shoot_not_done' ? <EmptyState title={C14.shootNotDone} body={C14.opensAfterShoot} /> : null}

        {/* S21/S22 — reported: nothing moves, her shop posts keep selling. */}
        {c.frozen && c.reported && c.reported.brand ? (
          <Card7 title={C14.toldInflxBrand(c.reported.brand.at)} testID="reported-card"><Text style={s.para}>{c.hybrid && c.money ? C14.lockedStays(c.money.stillLocked) : C14.toldInflxBrandBody}</Text></Card7>
        ) : null}
        {c.delayed && !c.frozen ? <AmberBox10 text={C14.delayed(c.postingDate, c.delayed.label)} testID="delayed-box" /> : null}
        {c.hybrid && c.reported && c.reported.creator && !c.frozen && stage === 'posted' ? <AmberBox10 text={C14.sheToldInflx(name, c.reported.creator.at)} testID="she-told-inflx" /> : null}

        {/* S20 — completed, and the collaboration's sales. */}
        {stage === 'complete' ? (
          <>
            <GreenBox10 text={c.liveConfirmedAuto ? C14.confirmedItself(c.liveConfirmedAt) : C14.completedBrand(c.completedAt)} testID="completed-box" />
            <View style={s.money} testID="sales">
              <View style={s.mline}><Text style={s.mlabel}>{C14.ordersSales}</Text><Text style={s.mval}>{`${c.sales.orders} · ${rupees(c.sales.sales)}`}</Text></View>
              <View style={s.mline}><Text style={s.mlabel}>{C14.commissionTo(name)}</Text><Text style={s.mval}>{rupees(c.sales.commission)}</Text></View>
              <View style={s.mline}><Text style={s.mlabel}>{C14.inflxFee}</Text><Text style={s.mval}>{rupees(c.sales.fee)}</Text></View>
              <View style={[s.mline, s.mtot]}><Text style={s.mtotLabel}>{C14.youReceive}</Text><Text style={s.mtotVal}>{rupees(c.sales.brandNet)}</Text></View>
            </View>
          </>
        ) : null}

        {/* ── Path 1 · Shoppable posts — INFLX checks; the brand watches (S6, S7) ── */}
        {p1 && !['old_terms', 'shoot_not_done'].includes(stage) ? (
          <View style={s.pathCard} testID="path1">
            <View style={s.pathHead}><Text style={s.pathTitle}>{stage === 'complete' ? C14.herPosts : C14.path1}</Text><Text style={s.pathWho}>{C14.path1WhoBrand}</Text></View>
            {stage !== 'complete' ? (
              <Progress14 p1={p1} line={c.delayed && p1.short ? C14.shortBy(p1.short) : p1.inReview ? C14.withInflx(p1.inReview) : null} />
            ) : null}
            {p1.posts.filter((p) => p.counts).map((p) => {
              const ns = (c.notShared || []).find((n) => n.postId === p.id);
              return (
                <PostLine14 key={p.id} post={p} {...postSub14(p, c.postingDate)}
                  right={ns ? <Chip tone="yourMove" text={C14.notSharedYet} /> : p.late ? <Chip tone="yourMove" text={C14.late} /> : <Chip tone={STATE_TONE[p.state]} text={C14.postState[p.state] || p.state} />} />
              );
            })}
          </View>
        ) : null}

        {/* ── Path 2 · Social media — the brand's part ─────────────────────── */}
        {['posts', 'draft'].includes(stage) ? (
          <View style={s.pathCard} testID="path2-waiting">
            <View style={s.pathHead}><Text style={s.pathTitle}>{C14.path2Brand}</Text><Text style={s.pathWho}>{C14.path2WhoBrand}</Text></View>
            <WaitBox10 text={C14.herMoveNotSent} testID="her-move" />
          </View>
        ) : null}

        {stage === 'changes' ? (
          <View style={s.pathCard}>
            <WaitBox10 text={C14.withHer(name)} testID="with-her" />
            <History12 rounds={c.rounds} />
          </View>
        ) : null}

        {/* S10 · S13 · rounds used — one verdict on what she will share. */}
        {stage === 'in_review' && !c.frozen ? (
          <View style={s.pathCard} testID="review">
            <MoveBox10 text={C14.yourMoveSent(name, last && last.submittedAt)} testID="your-move" />
            <RoundPill12 round={c.round} />
            {c.round.used ? <AmberBox10 text={C14.roundsUsed} testID="rounds-used" />
              : c.round.isLast ? <AmberBox10 text={C14.lastRound} testID="last-round" /> : null}
            {c.round.current > 1 ? <History12 rounds={c.rounds} /> : null}
            {pkg.map((row) => (
              <View key={row.key} style={s.row} testID={`review-row-${row.key}`}>
                <Text style={s.rowLabel}>{rowTitle(row)}</Text>
                <View style={s.tiles}>{row.files.map((f, i) => <FileTile12 key={f.id} file={f} url={urls[f.id]} onPress={() => setViewer({ ...named(row), files: row.files, index: i })} />)}</View>
                {row.caption ? <Text style={s.para}>{row.caption}</Text> : null}
              </View>
            ))}
            <Line12 text={C14.approvingLocks} />
          </View>
        ) : null}

        {stage === 'approved' ? <WaitBox10 text={C14.approvedPosting(name)} testID="approved-posting" /> : null}

        {/* S17 — every link opens; what confirming does is said before the tap. */}
        {stage === 'posted' && !c.frozen ? (
          <View style={s.pathCard} testID="confirm">
            <MoveBox10 text={C14.yourMovePosted(name, c.postedAt)} testID="posted-move" />
            {pkg.map((row) => (
              <View key={row.key} style={s.row} testID={`posted-row-${row.key}`}>
                <Text style={s.rowLabel}>{rowTitle(row)}</Text>
                <Proofs row={row} />
              </View>
            ))}
            <View style={[s.preview, { backgroundColor: T.state.active.bg }]} testID="confirm-preview">
              {c.hybrid && c.money && c.settledByInflx ? (
                <Text style={[s.previewSub, { color: T.state.active.fg }]} testID="settled-box">{c.money.returned > 0 ? C14.returnedToYou(c.money.returned) : C14.settledForBrand}</Text>
              ) : c.hybrid && c.money ? (
                <>
                  <Text style={[s.previewTitle, { color: T.state.active.fg }]}>{C14.confirmReleases(c.money.t2.amount)}</Text>
                  <Text style={[s.previewSub, { color: T.state.active.fg }]}>{C14.confirmReleasesSub(c.money.fee, c.money.t3.amount, c.money.waitDays)}</Text>
                </>
              ) : (
                <>
                  <Text style={[s.previewTitle, { color: T.state.active.fg }]}>{p1 && p1.met ? C14.confirmCompletes : C14.confirmWaits}</Text>
                  <Text style={[s.previewSub, { color: T.state.active.fg }]}>{p1 && p1.met ? C14.confirmCompletesSub(c.autoconfirmAt) : C14.confirmWaitsSub(p1 ? p1.short : 0, c.autoconfirmAt)}</Text>
                </>
              )}
            </View>
          </View>
        ) : null}

        {/* S18 — live, waiting on posts. */}
        {stage === 'live' ? (
          <View style={s.pathCard} testID="waiting-posts">
            <GreenBox10 text={c.liveConfirmedAuto ? C14.confirmedItself(c.liveConfirmedAt)
              : c.hybrid && c.money
                ? (c.liveConfirmedBy === 'inflx' ? C14.inflxConfirmedPaid(c.liveConfirmedAt, c.money.t2.amount, name) : C14.youConfirmedPaid(c.liveConfirmedAt, c.money.t2.amount, name))
                : C14.youConfirmed(c.liveConfirmedAt)} testID="you-confirmed" />
            {c.hybrid && c.money && c.money.returned > 0 ? <WaitBox10 text={C14.returnedToYou(c.money.returned)} testID="returned-box" /> : null}
            {p1 && p1.short ? <Text style={s.para}>{C14.completesWhen(p1.short)}</Text> : null}
          </View>
        ) : null}

        {/* post-performance-v2 (B2) — her links once confirmed, each with its numbers. */}
        {['live', 'complete'].includes(stage) && pkg.some((row) => ((row.proofs || [])[0] || {}).filled) ? (
          <View style={s.pathCard} testID="her-links">
            <Text style={s.pathTitle}>{STATS.herLinks}</Text>
            {pkg.filter((row) => ((row.proofs || [])[0] || {}).filled).map((row) => (
              <View key={row.key} style={s.row} testID={`link-row-${row.key}`}><Text style={s.rowLabel}>{rowTitle(row)}</Text><Proofs row={row} /></View>
            ))}
          </View>
        ) : null}

        {/* Item 15 (S2, S4, S8): Hybrid's fixed amount — what she has had and what is still locked. No campaign fee on Hybrid. */}
        {c.money && !['old_terms', 'shoot_not_done'].includes(stage) ? <FeeCard12 money={c.money} side="brand" testID="payments" /> : null}

        {/* Her links for posts outside the package (reporting; S16's other side). */}
        {outsideRows.length ? (
          <View style={s.pathCard} testID="outside">
            {outsideRows.map((row) => (
              <View key={row.key} style={s.row}><Text style={s.rowLabel}>{rowTitle(row)}</Text><Proofs row={row} /></View>
            ))}
          </View>
        ) : null}

        {c.steps && c.steps.length && !['old_terms', 'shoot_not_done', 'complete'].includes(stage) ? (
          <StepLine10 steps={c.steps.map((st) => ({ ...st, detail: st.key === 'posts' ? st.detail : st.at ? day10(st.at) : null }))} />
        ) : null}
      </ScrollView>
      {toast}
      </FormArea>

      {/* With nothing the stage offers, the strip is not drawn at all. */}
      <BottomBar testID="brand-sale-actions">
        {stage === 'in_review' && !c.frozen ? (
          <>
            <PrimaryButton label={C14.approve} icon="check" onPress={approve} busy={busy} busyLabel="Approving" testID="approve" />
            {c.can.askChanges ? <SecondaryButton label={c.round.isLast ? C14.askChangesLast : C14.askChanges} onPress={() => { if (!busy) { setSheetError(null); setSheet('changes'); } }} testID="ask-changes" /> : null}
          </>
        ) : null}
        {stage === 'posted' && !c.frozen && !c.settledByInflx ? (
          <PrimaryButton label={c.hybrid && c.money ? C14.confirmPays(c.money.t2.amount) : C14.confirmLive} icon="check" onPress={confirmLive} busy={busy} busyLabel="Confirming" testID="confirm-live" />
        ) : null}
        {reportKinds.length ? (
          <TextButton label={C14.somethingWrong} onPress={() => { if (!busy) { setSheetError(null); setSheet('report'); } }} testID="something-wrong" />
        ) : null}
        {/* post-performance-v2 (B2, M2): Update now appears only after confirming — once a day. */}
        {['live', 'complete'].includes(stage) && c.social && c.social.canUpdate ? (
          <>
            <SecondaryButton label={STATS.updateNow} onPress={() => { if (!busy) updateNow(); }} disabled={busy} testID="update-now" />
            <Text style={s.hint} testID="update-hint">{STATS.updateHintBrand}</Text>
          </>
        ) : null}
      </BottomBar>

      <ChangesSheet12 visible={sheet === 'changes'} round={c.round} noteCount={0} busy={busy} serverError={sheetError}
        onSend={askChanges} onClose={() => setSheet(null)} />
      <ReportSheet14 visible={sheet === 'report'} kinds={reportKinds} busy={busy} serverError={sheetError}
        onReport={report} onClose={() => setSheet(null)} />
      {/* H1–H5 — one tap on a tile opens the file here, and nothing else: this review has no
          notes on files (it sends `notes: []`), so the viewer is given no "Add a note". */}
      <MediaViewer12 open={viewer} fetchUrl={(id) => brandApi.contentFileUrl(campaignId, setId, ciId, id)} onClose={() => setViewer(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  crumbRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  crumb: { fontFamily: fonts.sansBold, fontSize: 10.5, color: T.ink3, letterSpacing: 0.6, flex: 1 },
  para: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink2, lineHeight: 20 },
  pathCard: { borderRadius: 14, borderWidth: 1, borderColor: T.border, padding: 14, marginBottom: 12, backgroundColor: '#FFFFFF', gap: 8 },
  pathHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pathTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: T.ink },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, lineHeight: 17, textAlign: 'center' },
  pathWho: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: T.ink2 },
  chip: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  chipText: { fontFamily: fonts.sansBold, fontSize: 11 },
  row: { borderRadius: 12, borderWidth: 1, borderColor: T.border, padding: 12, backgroundColor: '#FFFFFF', gap: 6 },
  rowLabel: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink },
  tiles: { flexDirection: 'row', flexWrap: 'wrap' },
  preview: { borderRadius: 12, padding: 12 },
  previewTitle: { fontFamily: fonts.sansBold, fontSize: 14.5 },
  previewSub: { fontFamily: fonts.sansRegular, fontSize: 12.5, marginTop: 3, lineHeight: 18 },
  money: { borderRadius: 14, borderWidth: 1, borderColor: T.border, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 12 },
  mline: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: T.border },
  mlabel: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2 },
  mval: { fontFamily: fonts.sansBold, fontSize: 12.5, color: T.ink },
  mtot: { borderBottomWidth: 0, borderTopWidth: 1.5, borderTopColor: T.ink },
  mtotLabel: { fontFamily: fonts.sansBold, fontSize: 13.5, color: T.ink },
  mtotVal: { fontFamily: fonts.sansBold, fontSize: 13.5, color: T.ink },
  page: { flex: 1 },
});
