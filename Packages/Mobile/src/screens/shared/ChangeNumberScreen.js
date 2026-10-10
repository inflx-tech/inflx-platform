/**
 * ChangeNumberScreen — moving an account to a new login number. One screen, four steps,
 * shared by the brand app and the creator app (mockups N1–N4, the refusals of N6).
 *
 *   1  masked current number · "you'll need both phones" · Send code      → /auth/change-phone/start
 *   2  six-box code for the OLD number · resend after 30 s · Verify       → /auth/change-phone/verify-old
 *   3  +91 + ten digits · "this role only" · Send code                    → /auth/change-phone/send-new
 *   4  six-box code for the NEW number · "signed out everywhere" · Confirm → /auth/change-phone/confirm
 *
 * A step advances only on the server's success. The three refusals keep the server's words:
 * the same number and a malformed number land under the field (422), a number that already
 * holds an account of this role is the red note (409 PHONE_TAKEN), and fifteen minutes gone
 * (401 CHANGE_EXPIRED) or five wrong codes (429 TOO_MANY_ATTEMPTS) end the attempt with a red
 * note and "Start again". On confirm the fresh token pair is stored exactly as OTPScreen does
 * after sign-in, the stored user's phone is patched, and the detail screen gets the green line.
 *
 * Params: role ('brand' | 'influencer'), returnTo (the detail screen's route name), phone
 * (the current login number, E.164; falls back to the stored user).
 * Contract: features/change-login-number
 *
 * ui-walk-fixes (board C, rule 2): the form is a FormScroll — the number or code box being typed
 * in, with the "Resend" line, the red line or the red note under it, stays in view above the
 * button strip. The strip was already part of the column here (it never floated), so nothing
 * else changes.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, KeyboardAvoidingView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { authApi } from '../../services/api';
import { PrimaryButton, FieldError } from '../../components/settings/primitives';
import { FormScroll } from '../../components/shell/FormScroll';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';

const MONO = Platform.OS === 'android' ? 'monospace' : 'Menlo';
const RESEND_SECONDS = 30;
const EMPTY_OTP = ['', '', '', '', '', ''];
const GENERIC = 'Something went wrong. Please try again.';

export const CN = {
  title: 'Change number',
  step1Title: "First, confirm it's you",
  step1Hint: "We'll text a code to your current number.",
  current: 'Current number',
  bothPhones: "You'll need both phones: the old one to receive this code, the new one for the next.",
  sendCode: 'Send code',
  codeTitle: 'Enter the code',
  sentTo: (p) => `Sent to ${p}`,
  didntGet: "Didn't get it? ",
  resendIn: (s) => `Resend in 0:${String(s).padStart(2, '0')}`,
  resend: 'Resend',
  verify: 'Verify',
  step3Title: 'Your new number',
  step3Hint: 'This becomes your login number from now on.',
  newLabel: 'New mobile number',
  roleOnly: (role) => {
    const me = role === 'brand' ? 'brand' : 'creator';
    const other = role === 'brand' ? 'creator' : 'brand';
    return { before: 'This changes the number for your ', bold: me, after: ` account only. If you also have a ${other} account on the old number, change it from the ${other} app.` };
  },
  signedOut: 'When you confirm, the old number is signed out everywhere. This phone stays signed in.',
  confirm: 'Confirm new number',
  startAgain: 'Start again',
  done: (p) => `Your login number is now ${p}.`,
};

/** '+919876543210' → '+91 98765 43210' */
export function fmtIndian(phone) {
  const d = String(phone || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  if (d.length !== 10) return String(phone || '');
  return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
}
/** '+919876543210' → '+91 98••• ••210' (mockups N0 · N1 · N5) */
export function maskIndian(phone) {
  const d = String(phone || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  if (d.length !== 10) return String(phone || '');
  return `+91 ${d.slice(0, 2)}••• ••${d.slice(7)}`;
}

/** The server's one-sentence refusal, drawn as a bold first sentence + the rest (mockup N6). */
function splitSentence(msg) {
  const m = String(msg || '').match(/^(.*?[.!?])\s+(.*)$/);
  return m ? [m[1], m[2]] : [String(msg || ''), ''];
}

function StepBar({ step }) {
  return (
    <View style={s.steps} testID="change-number-steps" accessibilityLabel={`Step ${step} of 4`}>
      {[1, 2, 3, 4].map(n => <View key={n} style={[s.sbar, n <= step && s.sbarOn]} testID={`step-${n}-${n <= step ? 'on' : 'off'}`} />)}
    </View>
  );
}

function Note({ tone, title, body, testID }) {
  const c = tone === 'no' ? { fg: T.danger, bg: T.dangerSoft } : tone === 'warn' ? T.state.yourMove : T.state.waiting;
  return (
    <View style={[s.note, { backgroundColor: c.bg }]} testID={testID}>
      <Text style={[s.noteText, { color: c.fg }]}>
        {title ? <Text style={s.noteBold}>{title}</Text> : null}
        {title && body ? ' ' : null}
        {body}
      </Text>
    </View>
  );
}

/** The six-box code entry from OTPScreen — a paste of six digits fills every box. */
function OtpBoxes({ value, onChange, prefix }) {
  const refs = useRef([]);
  function change(i, v) {
    const cleaned = v.replace(/\D/g, '');
    if (cleaned.length === 6) { onChange(cleaned.split('')); refs.current[5]?.focus?.(); return; }
    const char = cleaned.slice(-1);
    const next = [...value]; next[i] = char;
    onChange(next);
    if (char && i < 5) refs.current[i + 1]?.focus?.();
  }
  function key(i, e) {
    if (e.nativeEvent.key === 'Backspace' && !value[i] && i > 0) refs.current[i - 1]?.focus?.();
  }
  return (
    <View style={s.otpRow}>
      {value.map((digit, i) => (
        <TextInput
          key={i}
          ref={el => { refs.current[i] = el; }}
          style={[s.otpBox, digit ? s.otpBoxOn : null]}
          value={digit}
          onChangeText={v => change(i, v)}
          onKeyPress={e => key(i, e)}
          keyboardType="number-pad"
          maxLength={1}
          selectTextOnFocus
          testID={`${prefix}-${i}`}
        />
      ))}
    </View>
  );
}

function ResendLine({ seconds, onResend, busy, testID }) {
  return (
    <View style={s.resendRow}>
      <Text style={base.hint}>{CN.didntGet}</Text>
      {seconds > 0 ? (
        <Text style={s.resendWait} testID={`${testID}-wait`}>{CN.resendIn(seconds)}</Text>
      ) : (
        <TouchableOpacity onPress={onResend} disabled={busy} accessibilityRole="button" testID={testID}>
          <Text style={s.resendLink}>{busy ? 'Sending…' : CN.resend}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// Item 20 reuses the code entry for linking a brand (components/ownbrand/BrandLinkFlow).
export { OtpBoxes, ResendLine, Note, RESEND_SECONDS };

export default function ChangeNumberScreen({ navigation, route }) {
  const role = route?.params?.role === 'brand' ? 'brand' : 'influencer';
  const returnTo = route?.params?.returnTo || (role === 'brand' ? 'BrandBusinessDetails' : 'ProfileInfo');
  const [phone, setPhone] = useState(route?.params?.phone || '');
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');          // the plain red line for this step
  const [fatal, setFatal] = useState('');          // CHANGE_EXPIRED · TOO_MANY_ATTEMPTS · a dead attempt
  const [oldOtp, setOldOtp] = useState(EMPTY_OTP);
  const [newOtp, setNewOtp] = useState(EMPTY_OTP);
  const [digits, setDigits] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [taken, setTaken] = useState('');
  const [changeToken, setChangeToken] = useState(null);
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const [resendKey, setResendKey] = useState(0);
  const inFlight = useRef(false);

  useEffect(() => {
    if (phone) return;
    AsyncStorage.getItem('inflx_user').then((str) => {
      try { const u = str ? JSON.parse(str) : null; if (u && u.phone) setPhone(u.phone); } catch (_) { /* no stored user */ }
    }).catch(() => {});
  }, [phone]);

  // The 30-second resend countdown — restarts on entering a code step and on every resend.
  useEffect(() => {
    if (step !== 2 && step !== 4) return undefined;
    setSeconds(RESEND_SECONDS);
    const t = setInterval(() => setSeconds(x => (x <= 1 ? 0 : x - 1)), 1000);
    return () => clearInterval(t);
  }, [step, resendKey]);

  const newPhone = `+91${digits}`;

  const reset = useCallback(() => {
    setStep(1); setBusy(false); setError(''); setFatal(''); setOldOtp(EMPTY_OTP); setNewOtp(EMPTY_OTP);
    setDigits(''); setFieldError(''); setTaken(''); setChangeToken(null); inFlight.current = false;
  }, []);

  /** Every refusal goes through here so the two attempt-ending codes are handled once. */
  function refuse(err, { field } = {}) {
    const code = err?.code;
    const message = err?.message || GENERIC;
    if (code === 'CHANGE_EXPIRED' || code === 'TOO_MANY_ATTEMPTS') { setFatal(message); return; }
    if (code === 'PHONE_TAKEN') { setTaken(message); return; }
    if (field && (err?.field === 'new_phone' || code === 'VALIDATION_ERROR')) { setFieldError(message); return; }
    setError(message);
  }

  async function call(fn) {
    if (inFlight.current) return null;
    inFlight.current = true;
    setBusy(true); setError('');
    const r = await fn();
    setBusy(false); inFlight.current = false;
    return r;
  }

  async function sendOld() {
    const r = await call(() => authApi.changePhoneStart());
    if (!r) return;
    if (!r.success) { refuse(r.error); return; }
    setOldOtp(EMPTY_OTP);
    if (step === 2) setResendKey(k => k + 1); else setStep(2);
  }

  async function verifyOld() {
    const otp = oldOtp.join('');
    if (otp.length < 6) return;
    const r = await call(() => authApi.changePhoneVerifyOld(otp));
    if (!r) return;
    if (!r.success) { refuse(r.error); return; }
    setChangeToken(r.data.change_token);
    setStep(3);
  }

  async function sendNew() {
    if (digits.length < 10) return;
    setFieldError(''); setTaken('');
    const r = await call(() => authApi.changePhoneSendNew(changeToken, newPhone));
    if (!r) return;
    if (!r.success) { refuse(r.error, { field: true }); return; }
    if (r.data && r.data.change_token) setChangeToken(r.data.change_token);
    setNewOtp(EMPTY_OTP);
    if (step === 4) setResendKey(k => k + 1); else setStep(4);
  }

  async function confirm() {
    const otp = newOtp.join('');
    if (otp.length < 6) return;
    const r = await call(() => authApi.changePhoneConfirm(changeToken, otp));
    if (!r) return;
    if (!r.success) {
      // A 409 here means the number was taken while the code was in flight; the server ended the attempt.
      if (r.error?.code === 'PHONE_TAKEN') { setFatal(r.error.message); return; }
      refuse(r.error); return;
    }
    const { access_token, refresh_token, phone: confirmed } = r.data;
    const finalPhone = confirmed || newPhone;
    if (access_token) await AsyncStorage.setItem('inflx_token', access_token);
    if (refresh_token) await AsyncStorage.setItem('inflx_refresh_token', refresh_token);
    try {
      const str = await AsyncStorage.getItem('inflx_user');
      if (str) await AsyncStorage.setItem('inflx_user', JSON.stringify({ ...JSON.parse(str), phone: finalPhone }));
    } catch (_) { /* the next /me read refreshes it */ }
    navigation.navigate(returnTo, { toast: CN.done(fmtIndian(finalPhone)) });
  }

  const roleNote = CN.roleOnly(role);
  const [fatalTitle, fatalBody] = splitSentence(fatal);
  const [takenTitle, takenBody] = splitSentence(taken);

  let body = null;
  let cta = null;
  if (step === 1) {
    body = (
      <>
        <Text style={s.h}>{CN.step1Title}</Text>
        <Text style={base.hint}>{CN.step1Hint}</Text>
        <View style={s.card}>
          <Text style={base.hint}>{CN.current}</Text>
          <Text style={s.mono} testID="current-number">{maskIndian(phone)}</Text>
        </View>
        <Note tone="wait" body={CN.bothPhones} testID="note-both-phones" />
      </>
    );
    cta = <PrimaryButton label={CN.sendCode} onPress={sendOld} busy={busy} busyLabel="Sending" disabled={!phone} testID="send-old" />;
  } else if (step === 2) {
    body = (
      <>
        <Text style={s.h}>{CN.codeTitle}</Text>
        <Text style={base.hint} testID="sent-to-old">{CN.sentTo(fmtIndian(phone))}</Text>
        <View style={{ height: 8 }} />
        <OtpBoxes value={oldOtp} onChange={(v) => { setOldOtp(v); setError(''); }} prefix="old-otp" />
        <ResendLine seconds={seconds} onResend={sendOld} busy={busy} testID="resend-old" />
      </>
    );
    cta = <PrimaryButton label={CN.verify} onPress={verifyOld} busy={busy} busyLabel="Verifying" disabled={oldOtp.join('').length < 6} testID="verify-old" />;
  } else if (step === 3) {
    body = (
      <>
        <Text style={s.h}>{CN.step3Title}</Text>
        <Text style={base.hint}>{CN.step3Hint}</Text>
        <View style={{ height: 8 }} />
        <Text style={base.label}>{CN.newLabel}</Text>
        <View style={[s.phoneWrap, (fieldError || taken) && s.phoneWrapErr]}>
          <Text style={s.prefix}>+91</Text>
          <TextInput
            style={s.phoneInput}
            value={digits}
            onChangeText={(v) => { setDigits(v.replace(/\D/g, '').slice(0, 10)); setFieldError(''); setTaken(''); }}
            keyboardType="number-pad"
            maxLength={10}
            placeholder="10-digit mobile number"
            placeholderTextColor={T.ink3}
            testID="new-phone"
          />
        </View>
        <FieldError text={fieldError} />
        {taken ? <Note tone="no" title={takenTitle} body={takenBody} testID="note-taken" /> : null}
        <Note tone="warn" body={<>{roleNote.before}<Text style={s.noteBold}>{roleNote.bold}</Text>{roleNote.after}</>} testID="note-role-only" />
      </>
    );
    cta = <PrimaryButton label={CN.sendCode} onPress={sendNew} busy={busy} busyLabel="Sending" disabled={digits.length < 10} testID="send-new" />;
  } else {
    body = (
      <>
        <Text style={s.h}>{CN.codeTitle}</Text>
        <Text style={base.hint} testID="sent-to-new">{CN.sentTo(fmtIndian(newPhone))}</Text>
        <View style={{ height: 8 }} />
        <OtpBoxes value={newOtp} onChange={(v) => { setNewOtp(v); setError(''); }} prefix="new-otp" />
        <ResendLine seconds={seconds} onResend={sendNew} busy={busy} testID="resend-new" />
        <Note tone="wait" body={CN.signedOut} testID="note-signed-out" />
      </>
    );
    cta = <PrimaryButton label={CN.confirm} onPress={confirm} busy={busy} busyLabel="Confirming" disabled={newOtp.join('').length < 6} testID="confirm-new" />;
  }

  return (
    <KeyboardAvoidingView style={base.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} testID="change-number">
      <Header title={CN.title} onBack={() => navigation.goBack()} />
      {/* 88 under the box: the red "this number already has an account" note is a two-line box, taller than a plain error line. */}
      <FormScroll revealBelow={88} contentContainerStyle={base.body} testID="change-number-scroll">
        <StepBar step={step} />
        <View style={{ height: 14 }} />
        {body}
        <FieldError text={error} />
        {fatal ? <Note tone="no" title={fatalTitle} body={fatalBody} testID="note-fatal" /> : null}
      </FormScroll>
      <View style={s.footer} testID="change-number-actions">
        {fatal ? <PrimaryButton label={CN.startAgain} onPress={reset} testID="start-again" /> : cta}
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  steps: { flexDirection: 'row' },
  sbar: { flex: 1, height: 3, borderRadius: 9, backgroundColor: T.border, marginRight: 5 },
  sbarOn: { backgroundColor: T.ink },
  h: { fontFamily: fonts.sansBold, fontSize: 20, color: T.ink, marginBottom: 6 },
  card: { borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 12, marginTop: 12, marginBottom: 12, backgroundColor: T.bg },
  mono: { fontFamily: MONO, fontSize: 17, fontWeight: '600', color: T.ink, marginTop: 2 },
  note: { borderRadius: 11, padding: 11, marginTop: 12 },
  noteText: { fontFamily: fonts.sansRegular, fontSize: 12.5, lineHeight: 18 },
  noteBold: { fontFamily: fonts.sansBold, fontWeight: '700' },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  otpBox: { flex: 1, height: 52, borderRadius: 10, borderWidth: 1, borderColor: T.border, backgroundColor: T.bg, color: T.ink, fontSize: 20, fontWeight: '600', textAlign: 'center', fontFamily: MONO, marginRight: 6 },
  otpBoxOn: { borderColor: T.ink },
  resendRow: { flexDirection: 'row', alignItems: 'center' },
  resendWait: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: T.state.waiting.fg, marginBottom: 4 },
  resendLink: { fontFamily: fonts.sansBold, fontSize: 12.5, color: T.state.waiting.fg, marginBottom: 4 },
  phoneWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: T.border, borderRadius: 10, backgroundColor: T.bg, paddingHorizontal: 12 },
  phoneWrapErr: { borderColor: T.danger },
  prefix: { fontFamily: fonts.sansMedium, fontSize: 15, color: T.ink2, marginRight: 8 },
  phoneInput: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 15, color: T.ink, paddingVertical: 11 },
  footer: { padding: 14, paddingBottom: 22, backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.border },
});
