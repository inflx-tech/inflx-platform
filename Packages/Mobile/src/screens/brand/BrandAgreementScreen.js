/**
 * Item 7 — the brand's agreement screen (P2, P3, P9, P10, P11, P12, P14).
 * Contract: features/item7-agreement · rules v1.20 §9, §10
 *
 * One screen carries the whole of the brand's side, because it is one thing at
 * different moments: the preview before it is sent, the wait while she reads
 * it, the money in view when she has signed, and what moved once the brand
 * signs. Which of those it is comes from the server's `can`, never from a
 * guess on the phone.
 *
 * The brand signs LAST, because the brand pays. Everything it is about to
 * commit is on one screen before it taps anything.
 *
 * ui-walk-fixes (board C): every strip at the foot of this screen is the one shared strip
 * (BottomBar) — Send, Sign, Withdraw and the after-both-signed pair used to be two kinds. The
 * toast sits just above whichever strip is showing. The screen draws its own title bar, which now
 * starts at the phone's top inset like every other pushed screen (D4).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { PrimaryButton, SecondaryButton, DangerButton, EmptyState, AnswerBar } from '../../components/settings/primitives';
import { BottomBar } from '../../components/shell/BottomBar';
import { FormArea } from '../../components/shell/FormScroll';
import { Skeleton, LoadError, useToast } from '../../components/settings/feedback';
import useRouteToast from '../../hooks/useRouteToast';
import useTopInset, { TOP_GAP } from '../../hooks/useTopInset';
import { rupees5 } from '../../components/invitations/copy5';
import { C7, MSG7, AIM_LABEL7, longDate7, shortDate7, dayOf7, offerDates7 } from '../../components/agreement/copy7';
import {
  Reference7, Card7, MoneyRow7, TermRow7, TotalRow7, SignatureBlock7,
  StandardTermsRow7, StateBox7, ShortfallCard7, MoneyMoved7,
} from '../../components/agreement/bits7';
import { SendAgreementSheet7, BrandSignSheet7, WithdrawAgreementSheet7 } from '../../components/agreement/sheets7';
// Item 10 (V1) — the gate as ticks, the four-step line, the posting countdown, "Plan the visit".
import { GateCard10, StepLine10 } from '../../components/shoot/bits10';
import { C10 } from '../../components/shoot/copy10';

export default function BrandAgreementScreen({ navigation, route }) {
  const { campaignId, setId, ciId, preview } = route.params || {};
  const [ag, setAg] = useState(null);
  const [cost, setCost] = useState(null);
  const [shoot, setShoot] = useState(null);
  const [status, setStatus] = useState('loading');
  const [sheet, setSheet] = useState(null);
  const [busy, setBusy] = useState(false);
  // The reason the server refused a signature, shown INSIDE the sign sheet. A toast cannot be
  // seen from behind a modal, so a refusal announced that way is a refusal nobody reads.
  const [signError, setSignError] = useState(null);
  // ui-walk-fixes (board F, frame F5): the same for a refused Send or Withdraw. Their reason was a
  // toast behind the sheet too — "Signatures for this set closed on 17 Oct." said to nobody.
  const [sheetError, setSheetError] = useState(null);
  const { toast, show } = useToast({ inFlow: true });
  // F4: "Agreement sent." arrives with the route, so it is read on the agreement that is now out
  // rather than lost with the preview that closed.
  useRouteToast(navigation, route, show);

  const load = useCallback(async () => {
    setStatus('loading');
    // Before it is sent there is no agreement to read, only one to preview.
    const r = preview
      ? await brandApi.agreementPreview(campaignId, setId, ciId)
      : await brandApi.getAgreement(campaignId, setId, ciId);
    if (!r || !r.success) { setStatus('error'); return; }
    setAg(r.data.agreement);
    setStatus('ready');
    if (!preview && r.data.agreement.can && r.data.agreement.can.sign) {
      const c = await brandApi.agreementCost(campaignId, setId, ciId);
      if (c && c.success) setCost(c.data.cost);
    }
    // Item 10: once both have signed, V1's gate card and step line come from the shoot itself,
    // so the ticks and amounts are the money that actually moved, not a recalculation.
    const sg = r.data.agreement.signatures || {};
    if (!preview && sg.creator && sg.brand) {
      const sh = await brandApi.getShoot(campaignId, setId, ciId);
      setShoot(sh && sh.success ? sh.data.shoot : null);
    }
  }, [campaignId, setId, ciId, preview]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // F3: "Withdraw agreement" in the set's ⋯ menu opens this screen with the withdraw sheet already
  // up (`ask: 'withdraw'`). Once only, and only if the server still allows it.
  const asked = useRef(false);
  const ask = route && route.params ? route.params.ask : undefined;
  useEffect(() => {
    if (asked.current || ask !== 'withdraw' || status !== 'ready' || !ag) return;
    asked.current = true;
    if (navigation && typeof navigation.setParams === 'function') navigation.setParams({ ask: undefined });
    if (ag.can && ag.can.withdraw) setSheet('withdraw');
  }, [ask, status, ag]); // eslint-disable-line

  const openSheet = (which) => { setSheetError(null); setSheet(which); };
  // A refusal means the screen behind the sheet is out of date (she signed meanwhile, the set
  // closed), so closing a sheet that showed one reads the agreement again.
  function closeSheet() {
    const refused = !!sheetError;
    setSheetError(null);
    setSheet(null);
    if (refused) load();
  }

  /**
   * ui-walk-fixes (board F, frame F4). The brand used to be sent back to the set the instant it
   * tapped Send, with "Agreement sent." raised on the screen that was closing. Now it STAYS on the
   * agreement, in its sent state: the route is replaced with `preview: false` (so a later refocus
   * reads the agreement that is out, never the draft again) and the message rides along.
   */
  async function send() {
    setBusy(true);
    setSheetError(null);
    const r = await brandApi.sendAgreement(campaignId, setId, ciId);
    setBusy(false);
    if (!r || !r.success) { setSheetError((r && r.error && r.error.message) || C7.brand.sendFailed); return; }
    setSheet(null);
    navigation.replace('BrandAgreement', { campaignId, setId, ciId, preview: false, toast: C7.brand.sent });
  }

  async function sign(body) {
    setBusy(true);
    setSignError(null);
    const r = await brandApi.signAgreement(campaignId, setId, ciId, body);
    setBusy(false);
    if (!r || !r.success) {
      // Whatever the reason — a short balance names the shortfall, a set that cannot be
      // countersigned says why — it belongs in the sheet she is looking at, not in a toast
      // behind it. The sheet stays open so she can act on it.
      setSignError((r && r.error && r.error.message) || MSG7.ALREADY_SIGNED);
      load();
      return;
    }
    setSignError(null);
    setSheet(null);
    setAg(r.data.agreement);
  }

  /** F6: back on the set, which says "Agreement withdrawn." and lists her under "Your move" again. */
  async function withdraw() {
    setBusy(true);
    setSheetError(null);
    const r = await brandApi.withdrawAgreement(campaignId, setId, ciId);
    setBusy(false);
    if (!r || !r.success) { setSheetError((r && r.error && r.error.message) || C7.brand.withdrawFailed); return; }
    setSheet(null);
    navigation.navigate('BrandSetDetail', { campaignId, setId, toast: C7.brand.withdrawn });
  }

  async function download() {
    const r = await brandApi.agreementDocument(ciId);
    if (!r || !r.success) { show((r && r.error && r.error.message) || MSG7.NOT_COMPLETE); return; }
    const url = r.data && r.data.document && r.data.document.url;
    if (!url) { show(MSG7.NOT_COMPLETE); return; }
    Linking.openURL(url).catch(() => show('Could not open the document'));
  }

  // The toast is drawn in every state: "Agreement sent." arrives while the sent agreement is still
  // being read, and must not wait for it.
  if (status === 'loading') return <Frame nav={navigation}><Skeleton rows={6} />{toast}</Frame>;
  if (status === 'error') return <Frame nav={navigation}><LoadError onRetry={load} />{toast}</Frame>;
  if (!ag) return <Frame nav={navigation}><EmptyState title="No agreement yet" body="" />{toast}</Frame>;

  const t = ag.terms || {};
  const money = t.money || {};
  const work = t.work || {};
  const brandName = (t.parties && t.parties.brand && t.parties.brand.name) || '';
  const creator = (t.parties && t.parties.creator) || {};
  const creatorName = creator.name || '';
  const firstName = creatorName.split(' ')[0] || creatorName;
  const remote = !t.branchName;
  const can = ag.can || {};
  const sigs = ag.signatures || {};
  const bothSigned = !!(sigs.creator && sigs.brand);
  const shortfall = cost && cost.shortfall > 0 ? cost : null;
  // ui-walk-fixes (board F, frame F4) — sent, and she has not signed. This state had no sentence
  // at all: the terms, and a red Withdraw. Which state it is comes from the server (`can.withdraw`,
  // the status), never from the phone having just pressed Send.
  const sentWaiting = !preview && !ag.ending && !sigs.creator && !sigs.brand && (!!can.withdraw || ag.status === 'pending_influencer');
  const signBy = t.cutoff || ag.cutoff;

  return (
    <Frame nav={navigation} title={C7.brand.title(firstName)}>
      <FormArea>
      <ScrollView style={s.page} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} testID="brand-agreement-body">
        {/* The preview prints a single "DRAFT": the reference number is stamped only when it is
            sent, and Reference7 already says DRAFT in its place (it used to read "DRAFT · DRAFT"). */}
        <Reference7 reference={ag.reference} suffix={ag.reference ? AIM_LABEL7[t.aim] : null} />

        {ag.ending ? <StateBox7 tone="ended" text={ag.ending.text} testID="agreement-ending" /> : null}
        {/* The blue box names the day it was sent, so it is drawn only when there is one. An
            agreement put out through the website's "Approve & Send" is out for her signature with
            no sent date; the sentence would read "Sent to Sneha on . Waiting…" — a hole where the
            date belongs (final review, finding F-4). The two "Not signed yet" boxes and "You sign
            after her…" below still say whose turn it is. */}
        {sentWaiting && ag.sentAt ? (
          <StateBox7 tone="wait" icon="clock-outline" testID="waiting-for-her"
            text={C7.brand.waitingForHer(firstName, shortDate7(dayOf7(ag.sentAt)), shortDate7(signBy))} />
        ) : null}
        {bothSigned ? <StateBox7 tone="done" text={C7.brand.bothSigned(sigs.brand.at)} testID="agreement-done" /> : null}
        {!bothSigned && sigs.creator && !ag.ending ? (
          <StateBox7 tone="move" text={C7.brand.sheSignedYouComplete(firstName, sigs.creator.at)} testID="she-signed" />
        ) : null}

        {/* P2 — the two of you, and what was agreed. */}
        <Card7 title={C7.brand.twoOfYou} testID="two-of-you">
          <TermRow7 label="Brand" value={[brandName, t.parties.brand.city].filter(Boolean).join(', ')} />
          <TermRow7 label="Creator" value={[creatorName, creator.city].filter(Boolean).join(', ')} />
        </Card7>

        <Card7 title={C7.brand.whatAgreed} testID="what-agreed">
          <TermRow7 label="Aim" value={AIM_LABEL7[t.aim] || t.aim} testID="aim-row" />
          <TermRow7 label="Campaign · Set" value={`${t.campaignName} · ${t.setName}`} />
          <TermRow7 label="Posts on" value={longDate7(t.postingDate)} />
          <TermRow7 label="Mode"
            value={remote ? 'Remote · products shipped' : `Store Visit · ${t.branchName}${t.branchCity ? ', ' + t.branchCity : ''}`} />
          {money.fee ? <TermRow7 label="Fee" value={rupees5(money.fee)} testID="fee-row" /> : null}
          {money.commissionPct != null
            ? <TermRow7 label="Commission" value={`${money.commissionPct}% on what she sells`} testID="commission-row" />
            : null}
          {t.sell ? <TermRow7 label="She can sell" value={t.sell.words} testID="sell-row" /> : null}
          {/* creator-terms-v2 (C4): the brand's copy lists the same offers, as of signing (rules 2.7). */}
          {t.sell && Array.isArray(t.sell.offers)
            ? t.sell.offers.map((o, i) => <TermRow7 key={`${o.name}-${i}`} label={o.name} value={offerDates7(o)} testID={`sell-offer-${i}`} />)
            : null}
          {work.minShoppablePosts != null
            ? <TermRow7 label="Shoppable posts" value={C7.creator.atLeast(work.minShoppablePosts)} testID="shoppable-row" />
            : null}
          {work.deliverablesWords ? <TermRow7 label="She posts" value={work.deliverablesWords} testID="deliverables-row" /> : null}
          {work.usageRights ? <TermRow7 label="You may reuse" value={work.usageRights.words} testID="usage-row" /> : null}
          {money.commissionAfterDays != null
            ? <TermRow7 label="Commission paid" value={money.commissionPaidWords || C7.creator.commissionPaid(money.commissionAfterDays)} />
            : null}
        </Card7>

        {t.note ? (
          <Card7 title={C7.brand.noteFromYou} tone="tint" testID="brand-note">
            <Text style={s.quote}>&ldquo;{t.note}&rdquo;</Text>
          </Card7>
        ) : null}

        <StandardTermsRow7 version={ag.standardTerms.version} sub={C7.brand.standardTermsSub(ag.standardTerms.version)} />

        {/* P9 / P10 — the money, in view before anything is committed. */}
        {can.sign && cost && cost.gate ? (
          <>
            <Card7 title={C7.brand.whatItCosts} testID="what-it-costs">
              <MoneyRow7 label={C7.brand.theirFee(firstName)} value={rupees5(cost.fee)} testID="cost-fee" />
              {cost.campaignFee > 0
                ? <MoneyRow7 label={C7.brand.campaignFee(cost.campaignFeePct)} value={rupees5(cost.campaignFee)} testID="cost-campaign-fee" />
                : null}
              <TotalRow7 label={C7.brand.lockedWhenYouSign} value={rupees5(cost.totalToLock)} testID="cost-total" />
            </Card7>

            {cost.payouts ? (
              <Card7 title={C7.brand.paidOutAs} testID="paid-out-as">
                <MoneyRow7 label={C7.brand.toHerWhenYouSign(firstName)} value={rupees5(cost.payouts.t1)} testID="payout-t1" />
                <MoneyRow7 label={C7.brand.whenLive} value={rupees5(cost.payouts.t2)} testID="payout-t2" />
                <MoneyRow7 label={C7.brand.afterItStaysLive} value={rupees5(cost.payouts.t3)} testID="payout-t3" />
              </Card7>
            ) : null}

            {shortfall ? (
              <ShortfallCard7 shortfall={cost.shortfall} available={cost.availableBalance} needed={cost.totalToLock}>
                <PrimaryButton label={C7.brand.addToWallet(rupees5(cost.shortfall))}
                  onPress={() => navigation.navigate('BrandAddMoney', {
                    need: cost.shortfall,
                    forWhom: firstName,
                    fee: cost.fee,
                    campaignFee: cost.campaignFee,
                    // This screen refetches on focus, so coming back shows the green box and a live
                    // Sign button without anything being handed back.
                    returnTo: { screen: 'BrandAgreement', params: route?.params || {} },
                  })}
                  testID="add-to-wallet" />
                <Text style={s.hint}>{C7.brand.bringYouBack}</Text>
              </ShortfallCard7>
            ) : (
              <>
                <StateBox7 tone="done" text={C7.brand.enough(rupees5(cost.availableBalance))} testID="balance-enough" />
                <Text style={s.hint}>{C7.brand.locksHint(rupees5(cost.totalToLock))}</Text>
              </>
            )}
            {sigs.creator ? (
              <Text style={s.hint} testID="waiting-hint">{C7.brand.waitingIfNobody(firstName, sigs.creator.at, ag.cutoff)}</Text>
            ) : null}
          </>
        ) : null}

        {/* Both signature boxes. F4: once it is sent they are both there, reading "Not signed yet",
            with the line that says who signs first. The preview still shows neither. */}
        {(sigs.creator || sigs.brand || sentWaiting) ? (
          <>
            <Text style={s.sigHd}>{C7.brand.signatures}</Text>
            <SignatureBlock7 who="Creator" name={sigs.creator ? sigs.creator.name : creatorName}
              at={sigs.creator && sigs.creator.at} device={sigs.creator && sigs.creator.device} ip={sigs.creator && sigs.creator.ip} />
            <SignatureBlock7 who="Brand" name={sigs.brand ? sigs.brand.name : brandName}
              forBrand={sigs.brand ? brandName : null}
              at={sigs.brand && sigs.brand.at} device={sigs.brand && sigs.brand.device} ip={sigs.brand && sigs.brand.ip} />
            {sentWaiting ? <Text style={s.hint} testID="you-sign-after">{C7.brand.youSignAfter}</Text> : null}
          </>
        ) : null}

        {/* P12 — what happened just now, and the one thing to do next. */}
        {bothSigned ? (
          <>
            <MoneyMoved7 locked={ag.money.locked} released={ag.money.released}
              stillLocked={ag.money.stillLocked} creatorName={firstName} />
            {/* Item 10 (V1): the gate §10 always described, as ticks; the step line; the countdown. */}
            {shoot ? (
              <>
                <GateCard10 gate={{ ...shoot.gate, creatorName }} />
                <StepLine10 steps={shoot.steps} />
                {shoot.postingDate ? <Text style={s.countdown} testID="posting-countdown">{C10.countdown(shoot.postingDate, shoot.daysToPosting)}</Text> : null}
              </>
            ) : (
              <Card7 title={C7.brand.next} tone="tint" testID="next-step">
                <Text style={s.para}>{remote ? C7.brand.nextShip(firstName) : C7.brand.nextVisit(firstName)}</Text>
              </Card7>
            )}
          </>
        ) : null}

        {preview ? <Text style={s.hint} testID="not-editable">{C7.brand.notEditable}</Text> : null}
      </ScrollView>
      {/* Above whichever strip is showing — never on top of it, never behind a sheet's scrim. */}
      {toast}
      </FormArea>

      {/* One main button at a time, and only the one that is actually available. Each is the
          shared strip (BottomBar), the same one the after-both-signed pair below sits in. */}
      {preview ? (
        <BottomBar testID="preview-actions">
          <PrimaryButton label={C7.brand.sendForSignature} onPress={() => openSheet('send')} testID="send-for-signature" />
        </BottomBar>
      ) : can.sign ? (
        <BottomBar testID="sign-actions">
          <PrimaryButton
            label={cost && cost.gate ? C7.brand.signAndLock(rupees5(cost.totalToLock)) : C7.brand.signAndComplete}
            onPress={() => setSheet('sign')} disabled={!!shortfall} testID="brand-sign" />
        </BottomBar>
      ) : can.withdraw ? (
        /* F4: nothing is owed by the brand while it waits, so there is no yellow button — only a
           quiet red-outline Withdraw (it was a solid red block). */
        <BottomBar testID="withdraw-actions">
          <DangerButton outline label={C7.brand.withdraw} onPress={() => openSheet('withdraw')} testID="brand-withdraw" />
        </BottomBar>
      ) : null}

      {/* ui-walk-fixes (board E, frames E11 / E12) — after both have signed. The button that says
          what the shoot needs takes the full width, with Download as a full-width outline button
          under it, both in the bar at the foot of the screen. They used to sit side by side at the
          end of the scrolling page, Download 10 lower, and the long labels wrapped inside half a
          button. */}
      {bothSigned ? (
        <BottomBar testID="signed-actions">
          <AnswerBar
            main={(
              /* Walk fix (20 Sep): this button is the only door to the shoot, so it says what the
                 shoot actually needs — "Confirm the shoot is done" once she has marked attended,
                 not "Plan the visit" forever. Spec U14: on Remote it opens the Remote shoot (it
                 used to show a message written before item 11 shipped). */
              <PrimaryButton
                label={remote ? C7.brand.shootPlan : C10.openLabel(shoot && shoot.stage, shoot && shoot.passed)}
                icon={!remote && shoot && shoot.stage === 'attended' ? 'check' : undefined}
                onPress={() => navigation.navigate(remote ? 'BrandRemote' : 'BrandShoot', { campaignId, setId, ciId })}
                testID="shoot-plan" />
            )}
          >
            <SecondaryButton strong icon="download" label={C7.brand.download} onPress={download} testID="download" />
          </AnswerBar>
        </BottomBar>
      ) : null}

      <SendAgreementSheet7 visible={sheet === 'send'} creatorName={firstName} cutoff={signBy}
        busy={busy} serverError={sheet === 'send' ? sheetError : null} onSend={send} onClose={closeSheet} />
      <BrandSignSheet7 visible={sheet === 'sign'} defaultName="" brandName={brandName} creatorName={firstName}
        cost={cost} busy={busy} serverError={signError} onSign={sign}
        onClose={() => { setSignError(null); setSheet(null); }} />
      <WithdrawAgreementSheet7 visible={sheet === 'withdraw'} creatorName={firstName}
        busy={busy} serverError={sheet === 'withdraw' ? sheetError : null} onWithdraw={withdraw} onClose={closeSheet} />
    </Frame>
  );
}

/**
 * The screen and its own title row. ui-walk-fixes D4: the row starts at the phone's real top inset
 * plus the same small gap as every other pushed screen's title row (useTopInset) — on a phone that
 * draws edge to edge it used to start under the status bar. That gap is the one kept above a
 * 40-high back control, so the back control here is 40 high too (as on the creator's agreement):
 * the title then sits on the same line as every other pushed screen's.
 */
function Frame({ nav, title, children }) {
  const top = useTopInset();
  return (
    <View style={s.screen}>
      <View style={[s.bar, { paddingTop: top }]} testID="agreement-bar">
        <TouchableOpacity onPress={() => nav.goBack()} style={s.back} testID="back"><Text style={s.backText}>‹</Text></TouchableOpacity>
        <Text style={s.barTitle} numberOfLines={1}>{title || 'Agreement'}</Text>
        <View style={s.back} />
      </View>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  // paddingTop here is only the gap; Frame adds the phone's top inset to it (useTopInset).
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingTop: TOP_GAP, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: T.border },
  page: { flex: 1 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backText: { fontFamily: fonts.sansRegular, fontSize: 26, color: T.ink },
  barTitle: { flex: 1, fontFamily: fonts.sansBold, fontSize: 16, color: T.ink, textAlign: 'center' },
  para: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink2, lineHeight: 20 },
  quote: { fontFamily: fonts.sansRegular, fontSize: 13.5, color: T.ink, lineHeight: 20, fontStyle: 'italic' },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, lineHeight: 18, marginBottom: 12 },
  countdown: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: T.ink, marginBottom: 12 },
  sigHd: { fontFamily: fonts.monoMedium, fontSize: 10, letterSpacing: 1, color: T.ink3, marginTop: 6, marginBottom: 8 },
});
