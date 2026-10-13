/**
 * PayoutDetailScreen — one screen, three kinds (C7): UPI id · bank account · PAN.
 * No format checking: the team verifies these by hand, offline (spec §5). Nothing on file is
 * ever shown back — the server never returns the numbers.
 * PATCH /influencers/me with { upi_id } | the bank entry | { pan_number }.
 * Contract: features/registration-and-profile
 *
 * creator-address-bank-save (board W1): the bank account is ONE entry of five parts, saved
 * whole — the account holder's name, the account number, the IFSC, the bank and the branch.
 * The number is typed twice (the first box hides it, so the second is really typed again) and
 * the two must agree: INFLX pays withdrawals by hand, and one wrong digit is money sent to a
 * stranger. Each empty box gets its own red line.
 *
 * ui-walk-fixes (board C, rule 2): the form is a FormScroll — the box being typed in, with the
 * red line under it, stays in view above the keypad. Nothing floats here (Save is the last thing
 * IN the form), so nothing else changes.
 */
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import { FieldError, PrimaryButton } from '../../components/settings/primitives';
import { useToast } from '../../components/settings/feedback';
import { FormScroll } from '../../components/shell/FormScroll';
import { COPY } from '../../components/settings/copy';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { HAND_CHECK } from '../../components/wallet/DetailSection';
import { BANK } from '../../components/profile/addressBankCopy';

export const KINDS = {
  upi:  { title: 'UPI', fields: [{ key: 'upi_id', label: 'UPI ID', placeholder: 'yourname@upi', autoCapitalize: 'none', keyboardType: 'email-address' }] },
  bank: { title: 'Bank account', lead: BANK.lead, fields: BANK.fields },
  pan:  { title: 'PAN', fields: [{ key: 'pan_number', label: 'PAN number', placeholder: 'e.g. ABCDE1234F', autoCapitalize: 'characters' }] },
};
export const MSG_PAYOUT = {
  REQUIRED: 'Enter this to save.',
  BANK_REQUIRED: BANK.required,
  BANK_MISMATCH: BANK.mismatch,
};
const digits = (v) => String(v || '').replace(/\s+/g, '');

export default function PayoutDetailScreen({ navigation, route }) {
  const kind = route?.params?.kind || 'upi';
  const spec = KINDS[kind] || KINDS.upi;
  const [f, setF] = useState(() => Object.fromEntries(spec.fields.map(x => [x.key, ''])));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const { toast, show } = useToast();

  const set = (k) => (v) => { setF(p => ({ ...p, [k]: v })); setErrors(e => ({ ...e, [k]: '', form: '' })); };

  async function save() {
    const errs = {};
    if (kind === 'bank') {
      for (const x of spec.fields) if (!f[x.key].trim()) errs[x.key] = MSG_PAYOUT.BANK_REQUIRED[x.key];
      if (!errs.bank_account_no && !errs.bank_account_no_confirm && digits(f.bank_account_no) !== digits(f.bank_account_no_confirm)) {
        errs.bank_account_no_confirm = MSG_PAYOUT.BANK_MISMATCH;
      }
    } else {
      for (const x of spec.fields) if (!f[x.key].trim()) errs[x.key] = MSG_PAYOUT.REQUIRED;
    }
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const payload = Object.fromEntries(spec.fields.map(x => [x.key, f[x.key].trim()]));
    setSaving(true);
    const r = await influencerApi.updateMe(payload);
    setSaving(false);
    if (!r.success) {
      if (r.error?.field && f[r.error.field] !== undefined) setErrors({ [r.error.field]: r.error.message });
      else if (r.error?.code === 'BANK_PAIR') setErrors({ form: r.error.message });
      else show(r.error?.message || COPY.saveFailed);
      return;
    }
    // Item 17: back to wherever she came from (the details list, or Withdraw), with the toast.
    if (route?.params?.returnTo) navigation.navigate({ name: route.params.returnTo, params: { toast: 'Saved.' }, merge: true });
    else navigation.navigate('CreatorWallet', { toast: 'Saved.' });
  }

  return (
    <View style={base.screen} testID={`payout-${kind}`}>
      <Header title={spec.title} onBack={() => navigation.goBack()} />
      <FormScroll contentContainerStyle={[base.body, { paddingBottom: 40 }]} testID="payout-scroll">
        {spec.lead ? <Text style={s.lead} testID="payout-lead">{spec.lead}</Text> : null}
        {spec.fields.map((x, i) => (
          <View key={x.key} style={{ marginTop: i ? 14 : 0 }}>
            <Text style={base.label}>{x.label}</Text>
            <TextInput style={s.input} value={f[x.key]} onChangeText={set(x.key)} placeholder={x.placeholder} placeholderTextColor={T.ink3}
              autoCapitalize={x.autoCapitalize || 'sentences'} autoCorrect={false} keyboardType={x.keyboardType}
              secureTextEntry={!!x.hidden} contextMenuHidden={!!x.noPaste} maxLength={x.maxLength} testID={`payout-${x.key}`} />
            <FieldError text={errors[x.key]} />
          </View>
        ))}
        <FieldError text={errors.form} />
        <View style={{ height: 20 }} />
        <PrimaryButton label="Save" onPress={save} busy={saving} testID="payout-save" />
        <Text style={s.footer}>{HAND_CHECK}</Text>
      </FormScroll>
      {toast}
    </View>
  );
}

const s = StyleSheet.create({
  input: { fontFamily: fonts.sansMedium, fontSize: 15, color: T.ink, borderWidth: 1, borderColor: T.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: T.bg },
  footer: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, textAlign: 'center', marginTop: 14, lineHeight: 17 },
  lead: { fontFamily: fonts.sansRegular, fontSize: 13.5, color: T.ink2, lineHeight: 19, marginBottom: 18 },
});
