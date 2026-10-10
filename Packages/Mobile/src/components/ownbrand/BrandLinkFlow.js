/**
 * BrandLinkFlow — the steps that link a creator to the brand he runs (item 20, board L1–L4).
 *   same    the number he is signed in with also has a brand account → one tap
 *   ask     "Do you run a brand on INFLX?" (sign-up only)
 *   number  the brand's own number → a code is sent to it
 *   code    the code from the brand's phone
 * Used as the third step of creator sign-up (`ask`) and by Profile › My brand. A brand is never
 * picked from a list: it is proved by its own number.
 * Contract: features/item20-own-brand · rules v1.33 §2D
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import { PrimaryButton, SecondaryButton, TextButton, StatusChip } from '../settings/primitives';
import { ChoiceCard, initialsOf } from '../create/bitsCreate';
import { OtpBoxes, ResendLine, Note, RESEND_SECONDS } from '../../screens/shared/ChangeNumberScreen';
import { O20 } from './copy20';

const EMPTY = ['', '', '', '', '', ''];

/** The brand as a card: logo or initials, name, "Fashion · Hyderabad", its own approval. (L1, L6) */
export function BrandCard20({ brand, testID }) {
  return (
    <View style={s.card} testID={testID || 'brand-card'}>
      {brand.logo_url ? <Image source={{ uri: brand.logo_url }} style={s.logo} /> : <View style={s.logo}><Text style={s.initials}>{initialsOf(brand.name)}</Text></View>}
      <View style={{ flex: 1, marginRight: 8 }}>
        <Text style={s.brandName} numberOfLines={1}>{brand.name}</Text>
        {O20.brandLine(brand) ? <Text style={s.brandLine} numberOfLines={1}>{O20.brandLine(brand)}</Text> : null}
      </View>
      <StatusChip on={brand.status === 'approved'} label={brand.status_chip} />
    </View>
  );
}

export default function BrandLinkFlow({ status, ask = false, onLinked, onSkip }) {
  const same = status && status.same_number;
  const [stage, setStage] = useState(same ? 'same' : ask ? 'ask' : 'number');
  const [choice, setChoice] = useState(null);
  const [digits, setDigits] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [otp, setOtp] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [fieldErr, setFieldErr] = useState('');
  const [fatal, setFatal] = useState('');            // the try has ended (too many wrong codes, time up, too many sends)
  const [seconds, setSeconds] = useState(0);
  const [resendKey, setResendKey] = useState(0);
  const inFlight = useRef(false);
  const first = same ? 'same' : ask ? 'ask' : null;   // where "Back" from the number step leads

  // The resend countdown — restarts on entering the code step and on every resend.
  useEffect(() => {
    if (stage !== 'code') return undefined;
    setSeconds(RESEND_SECONDS);
    const t = setInterval(() => setSeconds((x) => (x <= 1 ? 0 : x - 1)), 1000);
    return () => clearInterval(t);
  }, [stage, resendKey]);

  const done = (r) => { if (onLinked) onLinked(r.data.link); };
  const ended = (code) => code === 'TOO_MANY_ATTEMPTS' || code === 'LINK_EXPIRED' || code === 'RATE_LIMITED';

  async function act(fn) {
    if (inFlight.current) return null;
    inFlight.current = true; setBusy(true); setFieldErr(''); setFatal('');
    const r = await fn();
    inFlight.current = false; setBusy(false);
    return r;
  }

  async function linkSame() {
    const r = await act(() => influencerApi.linkSameNumberBrand());
    if (!r) return;
    if (r.success) done(r); else setFatal(r.error?.message || O20.generic);
  }

  async function send() {
    if (!/^[6-9]\d{9}$/.test(digits)) { setFieldErr(O20.numberBad); return; }
    const r = await act(() => influencerApi.sendBrandLinkCode(`+91${digits}`));
    if (!r) return;
    if (!r.success) {
      if (ended(r.error?.code)) setFatal(r.error?.message || O20.generic); else setFieldErr(r.error?.message || O20.generic);
      return;
    }
    if (r.data.linked) { done(r); return; }            // it was his own number: no code is needed
    setSentTo(r.data.sent_to); setOtp(EMPTY); setStage('code'); setResendKey((k) => k + 1);
  }

  async function confirm() {
    const code = otp.join('');
    if (code.length !== 6) return;
    const r = await act(() => influencerApi.confirmBrandLinkCode(code));
    if (!r) return;
    if (r.success) { done(r); return; }
    if (ended(r.error?.code)) setFatal(r.error?.message || O20.generic); else { setFieldErr(r.error?.message || O20.generic); setOtp(EMPTY); }
  }

  function startAgain() { setFatal(''); setFieldErr(''); setOtp(EMPTY); setStage('number'); }

  if (stage === 'same') {
    return (
      <View testID="link-same">
        <Text style={s.title}>{O20.askTitle}</Text>
        <Text style={s.lede}>{O20.sameLede}</Text>
        <BrandCard20 brand={same} />
        <View style={s.grey}><Text style={s.greyText}>{O20.sameBody}</Text></View>
        {fatal ? <Note tone="no" body={fatal} testID="link-error" /> : null}
        <View style={{ height: 14 }} />
        <PrimaryButton label={O20.linkMine} onPress={linkSame} busy={busy} disabled={busy} testID="link-same-yes" />
        {onSkip ? <TextButton label={O20.notNow} onPress={onSkip} testID="link-not-now" /> : (
          <TextButton label={O20.otherBrand} onPress={() => { setFatal(''); setStage('number'); }} testID="link-other" />
        )}
      </View>
    );
  }

  if (stage === 'ask') {
    return (
      <View testID="link-ask">
        <Text style={s.title}>{O20.askTitle}</Text>
        <Text style={s.lede}>{O20.askLede}</Text>
        <ChoiceCard title={O20.no} sub={O20.noSub} selected={choice === 'no'} onPress={() => setChoice('no')} testID="link-choice-no" />
        <ChoiceCard title={O20.yes} sub={O20.yesSub} selected={choice === 'yes'} onPress={() => setChoice('yes')} testID="link-choice-yes" />
        <View style={{ height: 6 }} />
        <PrimaryButton label={O20.cont} disabled={!choice} onPress={() => (choice === 'yes' ? setStage('number') : onSkip && onSkip())} testID="link-continue" />
      </View>
    );
  }

  if (stage === 'number') {
    return (
      <View testID="link-number">
        {first ? <TouchableOpacity onPress={() => { setFieldErr(''); setFatal(''); setStage(first); }} testID="link-back"><Text style={s.back}>{O20.back}</Text></TouchableOpacity> : null}
        <Text style={s.title}>{O20.numberTitle}</Text>
        <Text style={s.lede}>{O20.numberLede}</Text>
        <Text style={s.label}>{O20.numberLabel}</Text>
        <View style={[s.field, fieldErr ? s.fieldBad : null]}>
          <Text style={s.prefix}>+91</Text>
          <TextInput style={s.input} value={digits} onChangeText={(t) => { setDigits(t.replace(/\D/g, '').slice(0, 10)); setFieldErr(''); }}
            keyboardType="number-pad" maxLength={10} placeholder={O20.numberPlaceholder} placeholderTextColor={T.ink3} testID="link-phone" />
        </View>
        {fieldErr ? <Text style={s.err} testID="link-field-error">{fieldErr}</Text> : null}
        <Text style={s.hint}>{O20.noBrandYet}</Text>
        {fatal ? <Note tone="no" body={fatal} testID="link-error" /> : null}
        <View style={{ height: 14 }} />
        <PrimaryButton label={O20.sendCode} onPress={send} busy={busy} disabled={busy || digits.length !== 10} testID="link-send" />
      </View>
    );
  }

  return (
    <View testID="link-code">
      <TouchableOpacity onPress={startAgain} testID="link-back"><Text style={s.back}>{O20.back}</Text></TouchableOpacity>
      <Text style={s.title}>{O20.codeTitle}</Text>
      <Text style={s.lede}>{O20.sentTo(sentTo)}</Text>
      <OtpBoxes value={otp} onChange={(v) => { setOtp(v); setFieldErr(''); }} prefix="link-otp" />
      {fieldErr ? <Text style={s.err} testID="link-field-error">{fieldErr}</Text> : null}
      {fatal ? null : <ResendLine seconds={seconds} onResend={send} busy={busy} testID="link-resend" />}
      {fatal ? <Note tone="no" body={fatal} testID="link-error" /> : <Note body={O20.codeNote} testID="link-code-note" />}
      <View style={{ height: 14 }} />
      {fatal
        ? <SecondaryButton label={O20.startAgain} onPress={startAgain} testID="link-start-again" />
        : <PrimaryButton label={O20.link} onPress={confirm} busy={busy} disabled={busy || otp.join('').length !== 6} testID="link-confirm" />}
    </View>
  );
}

const s = StyleSheet.create({
  title: { fontFamily: fonts.sansBold, fontSize: 21, color: T.ink, marginBottom: 6 },
  lede: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink2, lineHeight: 19, marginBottom: 16 },
  back: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: T.ink2, marginBottom: 10 },
  label: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: T.ink, marginBottom: 8 },
  field: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: T.border, borderRadius: 12, paddingHorizontal: 12, backgroundColor: T.bg },
  fieldBad: { borderColor: T.danger },
  prefix: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: T.ink3, marginRight: 8 },
  input: { flex: 1, paddingVertical: 12, fontFamily: fonts.sansRegular, fontSize: 15, color: T.ink },
  err: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: T.danger, marginTop: 6 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, lineHeight: 17, marginTop: 10 },
  card: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: T.border, borderRadius: 14, padding: 12, backgroundColor: T.bg },
  logo: { width: 44, height: 44, borderRadius: 12, backgroundColor: T.surface, marginRight: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initials: { fontFamily: fonts.sansBold, fontSize: 14, color: T.ink2 },
  brandName: { fontFamily: fonts.sansBold, fontSize: 14.5, color: T.ink },
  brandLine: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, marginTop: 2 },
  grey: { backgroundColor: T.surface, borderRadius: 12, padding: 11, marginTop: 12 },
  greyText: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2, lineHeight: 18 },
});
