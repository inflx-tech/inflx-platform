/**
 * BrandPayoutDetailScreen — B8: one screen, two kinds. GST number (it appears on the brand's
 * agreements) · bank account (account number + IFSC together, ONE form). No format checking:
 * the team verifies these by hand (spec §5). Neither is needed for approval.
 * PATCH /brands/me with { gstin } | { bank_account_no, bank_ifsc }.
 * Contract: features/registration-and-profile
 */
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { FieldError, PrimaryButton } from '../../components/settings/primitives';
import { useToast } from '../../components/settings/feedback';
import { FormScroll } from '../../components/shell/FormScroll';
import { COPY } from '../../components/settings/copy';
import { Header, s as base } from './BrandPitchSettingsScreen';
import { HAND_CHECK } from '../../components/wallet/DetailSection';

export const KINDS = {
  gst:  { title: 'GST number', fields: [{ key: 'gstin', label: 'GST number', placeholder: 'e.g. 36ABCDE1234F1Z5', autoCapitalize: 'characters' }] },
  bank: { title: 'Bank account', fields: [
    { key: 'bank_account_no', label: 'Account number', placeholder: 'Account number', keyboardType: 'number-pad' },
    { key: 'bank_ifsc', label: 'IFSC', placeholder: 'e.g. SBIN0001234', autoCapitalize: 'characters' },
  ] },
};
export const MSG_PAYOUT = {
  BANK_PAIR: 'Enter both the account number and the IFSC.',
  REQUIRED: 'Enter this to save.',
};

export default function BrandPayoutDetailScreen({ navigation, route }) {
  const kind = route?.params?.kind || 'gst';
  const spec = KINDS[kind] || KINDS.gst;
  const [f, setF] = useState(() => Object.fromEntries(spec.fields.map(x => [x.key, route?.params?.initial?.[x.key] || ''])));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const { toast, show } = useToast();

  const set = (k) => (v) => { setF(p => ({ ...p, [k]: v })); setErrors(e => ({ ...e, [k]: '', form: '' })); };

  async function save() {
    const errs = {};
    if (kind === 'bank') {
      if (!f.bank_account_no.trim() || !f.bank_ifsc.trim()) errs.form = MSG_PAYOUT.BANK_PAIR;
    } else {
      for (const x of spec.fields) if (!f[x.key].trim()) errs[x.key] = MSG_PAYOUT.REQUIRED;
    }
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const payload = Object.fromEntries(spec.fields.map(x => [x.key, f[x.key].trim()]));
    setSaving(true);
    const r = await brandApi.updateMe(payload);
    setSaving(false);
    if (!r.success) {
      if (r.error?.code === 'BANK_PAIR') setErrors({ form: r.error.message || MSG_PAYOUT.BANK_PAIR });
      else if (r.error?.field && f[r.error.field] !== undefined) setErrors({ [r.error.field]: r.error.message });
      else show(r.error?.message || COPY.saveFailed);
      return;
    }
    // Item 17: back to wherever she came from (the details list, or Withdraw), with the toast.
    if (route?.params?.returnTo) navigation.navigate({ name: route.params.returnTo, params: { toast: 'Saved.' }, merge: true });
    else navigation.navigate('BrandWallet', { toast: 'Saved.' });
  }

  return (
    <View style={base.screen} testID={`brand-payout-${kind}`}>
      <Header title={spec.title} onBack={() => navigation.goBack()} />
      {/* ui-walk-fixes board C: a FormScroll, so the red line under the box being typed in stays in
          view. Nothing floats here — Save was always part of the page. */}
      <FormScroll contentContainerStyle={[base.body, { paddingBottom: 40 }]}>
        {spec.fields.map((x, i) => (
          <View key={x.key} style={{ marginTop: i ? 14 : 0 }}>
            <Text style={base.label}>{x.label}</Text>
            <TextInput style={s.input} value={f[x.key]} onChangeText={set(x.key)} placeholder={x.placeholder} placeholderTextColor={T.ink3}
              autoCapitalize={x.autoCapitalize || 'sentences'} autoCorrect={false} keyboardType={x.keyboardType} testID={`payout-${x.key}`} />
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
});
