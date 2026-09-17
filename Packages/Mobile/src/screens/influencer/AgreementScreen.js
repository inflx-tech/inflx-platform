/**
 * Item 7 — the creator reads and signs (P4, P5, P6, P7, P8).
 * Contract: features/item7-agreement · rules v1.20 §9
 *
 * What you get first, then what you do. The money is broken into the three
 * real payments, not one number she has to divide herself. Nothing is binding
 * until both names are on it, and the screen says so in those words.
 *
 * Everything on this screen comes from the agreement's own snapshot, so what
 * she reads is exactly what she signs and exactly what the document will say.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import { PrimaryButton, DangerButton, EmptyState } from '../../components/settings/primitives';
import { Skeleton, LoadError, useToast } from '../../components/settings/feedback';
import { rupees5 } from '../../components/invitations/copy5';
import { C7, MSG7, AIM_LABEL7, longDate7, shortDate7 } from '../../components/agreement/copy7';
import {
  Reference7, Card7, MoneyRow7, TermRow7, TotalRow7, SignatureBlock7,
  StandardTermsRow7, StateBox7,
} from '../../components/agreement/bits7';
import { CreatorSignSheet7, DeclineAgreementSheet7 } from '../../components/agreement/sheets7';

export default function AgreementScreen({ navigation, route }) {
  const { ciId } = route.params || {};
  const [ag, setAg] = useState(null);
  const [status, setStatus] = useState('loading');
  const [sheet, setSheet] = useState(null);
  const [busy, setBusy] = useState(false);
  // Why a signature was refused, shown in the sheet she is looking at.
  const [signError, setSignError] = useState(null);
  const { toast, show } = useToast();

  const load = useCallback(async () => {
    setStatus('loading');
    const r = await influencerApi.myAgreement(ciId);
    if (!r || !r.success) { setStatus('error'); return; }
    setAg(r.data.agreement);
    setStatus('ready');
  }, [ciId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function sign(body) {
    setBusy(true);
    setSignError(null);
    const r = await influencerApi.signMyAgreement(ciId, body);
    setBusy(false);
    if (!r || !r.success) {
      // Inside the sheet, not in a toast behind it. See BrandAgreementScreen for the whole story:
      // a refusal announced from behind a modal is a refusal nobody reads.
      setSignError((r && r.error && r.error.message) || MSG7.ALREADY_SIGNED);
      return;
    }
    setSignError(null);
    setSheet(null);
    setAg(r.data.agreement);
    show(C7.creator.signed);
  }

  async function decline(body) {
    setBusy(true);
    const r = await influencerApi.declineMyAgreement(ciId, body);
    setBusy(false);
    if (!r || !r.success) { show((r && r.error && r.error.message) || 'Could not decline'); return; }
    setSheet(null);
    setAg(r.data.agreement);
    show(C7.creator.declined);
  }

  async function download() {
    const r = await influencerApi.myAgreementDocument(ciId);
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
  const creatorName = (t.parties && t.parties.creator && t.parties.creator.name) || '';
  const remote = !t.branchName;
  const ended = ag.ending;
  const bothSigned = !!(ag.signatures.creator && ag.signatures.brand);

  return (
    <Frame nav={navigation} title={C7.creator.title}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} testID="agreement-body">
        <Reference7 reference={ag.reference} suffix={brandName} />

        {/* The state, in one sentence: her move, waiting, or over. */}
        {ended ? (
          <StateBox7 tone="ended" text={ended.text} testID="agreement-ending" />
        ) : bothSigned ? (
          <StateBox7 tone="done" text={C7.brand.bothSigned(ag.signatures.brand.at)} testID="agreement-done" />
        ) : ag.signatures.creator ? (
          <StateBox7 tone="wait" text={C7.creator.waitingFor(brandName, ag.cutoff)} testID="agreement-waiting" />
        ) : (
          <StateBox7 tone="move" text={C7.creator.signBy(ag.cutoff, ag.daysLeft)} testID="agreement-tosign" />
        )}

        {/* What you get — the fee split into the three real payments. */}
        <Card7 title={C7.creator.whatYouGet} testID="what-you-get">
          {money.fee ? <MoneyRow7 label={C7.creator.fee} value={rupees5(money.fee)} strong testID="fee-row" /> : null}
          {money.split ? (
            <>
              <MoneyRow7 label={C7.creator.whenBothSign} value={rupees5(money.split.t1)} testID="split-t1" />
              <MoneyRow7 label={C7.creator.whenLive} value={rupees5(money.split.t2)} testID="split-t2" />
              <MoneyRow7 label={C7.creator.afterItStaysLive} value={rupees5(money.split.t3)} testID="split-t3" />
            </>
          ) : null}
          {money.commissionPct != null ? (
            <>
              <MoneyRow7 label={C7.creator.commission} value={C7.creator.commissionOn(money.commissionPct)} strong testID="commission-row" />
              {money.commissionAfterDays != null
                ? <MoneyRow7 label="Commission paid" value={C7.creator.commissionPaid(money.commissionAfterDays)} testID="commission-when" />
                : null}
            </>
          ) : null}
        </Card7>

        {/* What you do. */}
        <Card7 title={C7.creator.whatYouDo} testID="what-you-do">
          {work.deliverablesWords ? <TermRow7 label={C7.creator.youPost} value={work.deliverablesWords} testID="deliverables-row" /> : null}
          <TermRow7 label={C7.creator.postsOn} value={longDate7(t.postingDate)} testID="posting-row" />
          <TermRow7 label={C7.creator.mode}
            value={remote ? 'Remote · they ship to you' : `Store Visit · ${t.branchName}${t.branchCity ? ', ' + t.branchCity : ''}`}
            testID="mode-row" />
          {work.usageRights ? <TermRow7 label={C7.creator.brandCanReuse} value={work.usageRights.words} testID="usage-row" /> : null}
          {t.sell ? <TermRow7 label={C7.creator.youCanSell} value={t.sell.words} testID="sell-row" /> : null}
          {work.minShoppablePosts != null
            ? <TermRow7 label={C7.creator.shoppablePosts} value={C7.creator.atLeast(work.minShoppablePosts)} testID="shoppable-row" />
            : null}
        </Card7>

        {/* Remote: returning the products. */}
        {t.returnTerms ? (
          <Card7 title={C7.creator.returningTitle} tone="tint" testID="return-terms">
            <Text style={s.para}>{C7.creator.returning(t.returnTerms.days, brandName)}</Text>
          </Card7>
        ) : null}

        {/* The brand's note, when there is one. */}
        {t.note ? (
          <Card7 title={C7.creator.noteFrom(brandName)} tone="tint" testID="brand-note">
            <Text style={s.quote}>&ldquo;{t.note}&rdquo;</Text>
          </Card7>
        ) : null}

        <StandardTermsRow7 version={ag.standardTerms.version} testID="standard-terms" />

        {/* Both signature boxes, once either exists. */}
        {(ag.signatures.creator || ag.signatures.brand) ? (
          <>
            <Text style={s.sigHd}>{C7.brand.signatures}</Text>
            <SignatureBlock7 who="Creator" name={ag.signatures.creator ? ag.signatures.creator.name : creatorName}
              at={ag.signatures.creator && ag.signatures.creator.at}
              device={ag.signatures.creator && ag.signatures.creator.device}
              ip={ag.signatures.creator && ag.signatures.creator.ip} />
            <SignatureBlock7 who="Brand" name={ag.signatures.brand ? ag.signatures.brand.name : brandName}
              forBrand={ag.signatures.brand ? brandName : null}
              at={ag.signatures.brand && ag.signatures.brand.at}
              device={ag.signatures.brand && ag.signatures.brand.device}
              ip={ag.signatures.brand && ag.signatures.brand.ip} />
          </>
        ) : null}

        {/* Signed and waiting: what happens if they never sign. */}
        {ag.signatures.creator && !ag.signatures.brand && !ended ? (
          <Text style={s.para} testID="nothing-binding">{C7.creator.nothingBinding(ag.cutoff)}</Text>
        ) : null}

        {bothSigned ? (
          <View style={{ marginTop: 10 }}>
            <PrimaryButton label={C7.brand.download} onPress={download} testID="download" />
          </View>
        ) : null}
      </ScrollView>

      {/* Sign or decline — only while it is hers to answer. */}
      {ag.can.sign ? (
        <View style={s.footer} testID="agreement-actions">
          <PrimaryButton label={C7.creator.sign} onPress={() => setSheet('sign')} testID="agreement-sign" />
          <View style={{ height: 8 }} />
          <DangerButton label={C7.creator.decline} onPress={() => setSheet('decline')} testID="agreement-decline" />
        </View>
      ) : null}

      <CreatorSignSheet7 visible={sheet === 'sign'} defaultName={creatorName} brandName={brandName}
        busy={busy} serverError={signError} onSign={sign}
        onClose={() => { setSignError(null); setSheet(null); }} />
      <DeclineAgreementSheet7 visible={sheet === 'decline'} brandName={brandName}
        busy={busy} onDecline={decline} onClose={() => setSheet(null)} />
      {toast}
    </Frame>
  );
}

function Frame({ nav, title, children }) {
  return (
    <View style={s.screen}>
      <View style={s.bar}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.back} testID="back"><Text style={s.backText}>‹</Text></TouchableOpacity>
        <Text style={s.barTitle}>{title || C7.creator.title}</Text>
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
  sigHd: { fontFamily: fonts.monoMedium, fontSize: 10, letterSpacing: 1, color: T.ink3, marginTop: 6, marginBottom: 8 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: T.border, backgroundColor: '#FFFFFF' },
});
