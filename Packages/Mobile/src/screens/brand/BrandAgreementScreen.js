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
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { PrimaryButton, SecondaryButton, DangerButton, EmptyState } from '../../components/settings/primitives';
import { Skeleton, LoadError, useToast } from '../../components/settings/feedback';
import { rupees5 } from '../../components/invitations/copy5';
import { C7, MSG7, AIM_LABEL7, longDate7, shortDate7 } from '../../components/agreement/copy7';
import {
  Reference7, Card7, MoneyRow7, TermRow7, TotalRow7, SignatureBlock7,
  StandardTermsRow7, StateBox7, ShortfallCard7, MoneyMoved7,
} from '../../components/agreement/bits7';
import { SendAgreementSheet7, BrandSignSheet7, WithdrawAgreementSheet7 } from '../../components/agreement/sheets7';

export default function BrandAgreementScreen({ navigation, route }) {
  const { campaignId, setId, ciId, preview } = route.params || {};
  const [ag, setAg] = useState(null);
  const [cost, setCost] = useState(null);
  const [status, setStatus] = useState('loading');
  const [sheet, setSheet] = useState(null);
  const [busy, setBusy] = useState(false);
  // The reason the server refused a signature, shown INSIDE the sign sheet. A toast cannot be
  // seen from behind a modal, so a refusal announced that way is a refusal nobody reads.
  const [signError, setSignError] = useState(null);
  const { toast, show } = useToast();

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
  }, [campaignId, setId, ciId, preview]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function send() {
    setBusy(true);
    const r = await brandApi.sendAgreement(campaignId, setId, ciId);
    setBusy(false);
    if (!r || !r.success) { show((r && r.error && r.error.message) || 'Could not send'); return; }
    setSheet(null);
    show(C7.brand.sent);
    navigation.goBack();
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

  async function withdraw() {
    setBusy(true);
    const r = await brandApi.withdrawAgreement(campaignId, setId, ciId);
    setBusy(false);
    if (!r || !r.success) { show((r && r.error && r.error.message) || 'Could not withdraw'); return; }
    setSheet(null);
    show(C7.brand.withdrawn);
    navigation.goBack();
  }

  async function download() {
    const r = await brandApi.agreementDocument(ciId);
    if (!r || !r.success) { show((r && r.error && r.error.message) || MSG7.NOT_COMPLETE); return; }
    const url = r.data && r.data.document && r.data.document.url;
    if (!url) { show(MSG7.NOT_COMPLETE); return; }
    Linking.openURL(url).catch(() => show('Could not open the document'));
  }

  if (status === 'loading') return <Frame nav={navigation}><Skeleton rows={6} /></Frame>;
  if (status === 'error') return <Frame nav={navigation}><LoadError onRetry={load} /></Frame>;
  if (!ag) return <Frame nav={navigation}><EmptyState title="No agreement yet" body="" /></Frame>;

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

  return (
    <Frame nav={navigation} title={C7.brand.title(firstName)}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} testID="brand-agreement-body">
        <Reference7 reference={ag.reference} suffix={ag.reference ? AIM_LABEL7[t.aim] : C7.brand.draft} />

        {ag.ending ? <StateBox7 tone="ended" text={ag.ending.text} testID="agreement-ending" /> : null}
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
          {work.minShoppablePosts != null
            ? <TermRow7 label="Shoppable posts" value={C7.creator.atLeast(work.minShoppablePosts)} testID="shoppable-row" />
            : null}
          {work.deliverablesWords ? <TermRow7 label="She posts" value={work.deliverablesWords} testID="deliverables-row" /> : null}
          {work.usageRights ? <TermRow7 label="You may reuse" value={work.usageRights.words} testID="usage-row" /> : null}
          {money.commissionAfterDays != null
            ? <TermRow7 label="Commission paid" value={C7.creator.commissionPaid(money.commissionAfterDays)} />
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

        {/* Both signature boxes. */}
        {(sigs.creator || sigs.brand) ? (
          <>
            <Text style={s.sigHd}>{C7.brand.signatures}</Text>
            <SignatureBlock7 who="Creator" name={sigs.creator ? sigs.creator.name : creatorName}
              at={sigs.creator && sigs.creator.at} device={sigs.creator && sigs.creator.device} ip={sigs.creator && sigs.creator.ip} />
            <SignatureBlock7 who="Brand" name={sigs.brand ? sigs.brand.name : brandName}
              forBrand={sigs.brand ? brandName : null}
              at={sigs.brand && sigs.brand.at} device={sigs.brand && sigs.brand.device} ip={sigs.brand && sigs.brand.ip} />
          </>
        ) : null}

        {/* P12 — what happened just now, and the one thing to do next. */}
        {bothSigned ? (
          <>
            <MoneyMoved7 locked={ag.money.locked} released={ag.money.released}
              stillLocked={ag.money.stillLocked} creatorName={firstName} />
            <Card7 title={C7.brand.next} tone="tint" testID="next-step">
              <Text style={s.para}>{remote ? C7.brand.nextShip(firstName) : C7.brand.nextVisit(firstName)}</Text>
            </Card7>
            <View style={s.row}>
              <View style={{ flex: 1 }}><SecondaryButton label={C7.brand.download} onPress={download} testID="download" /></View>
              <View style={{ flex: 1 }}><PrimaryButton label={C7.brand.shootPlan} onPress={() => show('Shoot plan opens in item 10.')} testID="shoot-plan" /></View>
            </View>
          </>
        ) : null}

        {preview ? <Text style={s.hint} testID="not-editable">{C7.brand.notEditable}</Text> : null}
      </ScrollView>

      {/* One main button at a time, and only the one that is actually available. */}
      {preview ? (
        <View style={s.footer} testID="preview-actions">
          <PrimaryButton label={C7.brand.sendForSignature} onPress={() => setSheet('send')} testID="send-for-signature" />
        </View>
      ) : can.sign ? (
        <View style={s.footer} testID="sign-actions">
          <PrimaryButton
            label={cost && cost.gate ? C7.brand.signAndLock(rupees5(cost.totalToLock)) : C7.brand.signAndComplete}
            onPress={() => setSheet('sign')} disabled={!!shortfall} testID="brand-sign" />
        </View>
      ) : can.withdraw ? (
        <View style={s.footer} testID="withdraw-actions">
          <DangerButton label={C7.brand.withdraw} onPress={() => setSheet('withdraw')} testID="brand-withdraw" />
        </View>
      ) : null}

      <SendAgreementSheet7 visible={sheet === 'send'} creatorName={firstName} cutoff={t.cutoff || ag.cutoff}
        busy={busy} onSend={send} onClose={() => setSheet(null)} />
      <BrandSignSheet7 visible={sheet === 'sign'} defaultName="" brandName={brandName} creatorName={firstName}
        cost={cost} busy={busy} serverError={signError} onSign={sign}
        onClose={() => { setSignError(null); setSheet(null); }} />
      <WithdrawAgreementSheet7 visible={sheet === 'withdraw'} creatorName={firstName}
        busy={busy} onWithdraw={withdraw} onClose={() => setSheet(null)} />
      {toast}
    </Frame>
  );
}

function Frame({ nav, title, children }) {
  return (
    <View style={s.screen}>
      <View style={s.bar}>
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
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.border },
  back: { width: 40, alignItems: 'center' },
  backText: { fontFamily: fonts.sansRegular, fontSize: 26, color: T.ink },
  barTitle: { flex: 1, fontFamily: fonts.sansBold, fontSize: 16, color: T.ink, textAlign: 'center' },
  para: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink2, lineHeight: 20 },
  quote: { fontFamily: fonts.sansRegular, fontSize: 13.5, color: T.ink, lineHeight: 20, fontStyle: 'italic' },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, lineHeight: 18, marginBottom: 12 },
  sigHd: { fontFamily: fonts.monoMedium, fontSize: 10, letterSpacing: 1, color: T.ink3, marginTop: 6, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 10, marginTop: 4 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: T.border, backgroundColor: '#FFFFFF' },
});
