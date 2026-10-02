/**
 * NicheLanguagesScreen — C6: exactly one niche (or "Other" plus what kind of content she
 * makes — that is how the niche list grows, spec §3.3) and the languages she creates in,
 * all 30 from the reference list, southern ones first.
 * Contract: features/registration-and-profile · features/item3-discovery-profiles-groups
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { influencerApi, referenceApi } from '../../services/api';
import { Chip, FieldError, Section, st } from '../../components/settings/primitives';
import { SaveBar, useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import { FormScroll, FormArea } from '../../components/shell/FormScroll';
import { COPY } from '../../components/settings/copy';
import useUnsavedGuard from '../../hooks/useUnsavedGuard';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { C3, MSG3 } from '../../components/discovery/copy3';

const N = C3.creatorProfile.niche;
export const OTHER = 'other';
const OTHER_MAX = 80;

/** The dashed "Other" chip — visibly a door, not another bucket. */
function OtherChip({ selected, onPress, testID }) {
  return (
    <TouchableOpacity testID={testID} accessibilityRole="button" accessibilityState={{ selected: !!selected }} onPress={onPress} activeOpacity={0.8}
      style={[st.chip, s.dashed, selected && st.chipOn]}>
      <Text style={[st.chipText, selected && st.chipTextOn]}>{selected ? '✓ ' : ''}Other</Text>
    </TouchableOpacity>
  );
}

export default function NicheLanguagesScreen({ navigation }) {
  const [status, setStatus] = useState('loading');
  const [niches, setNiches] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [initial, setInitial] = useState({ niche: null, nicheOther: '', language: [] });
  const [niche, setNiche] = useState(null);
  const [nicheOther, setNicheOther] = useState('');
  const [language, setLanguage] = useState([]);
  const [serverErr, setServerErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const { toast, show } = useToast({ inFlow: true });

  const load = useCallback(async () => {
    setStatus('loading');
    const [me, n, l] = await Promise.all([influencerApi.getMe(), referenceApi.creatorNiches(), referenceApi.languages()]);
    if (!me.success) { setStatus('error'); return; }
    const inf = me.data.influencer || me.data;
    const code = Array.isArray(inf.niche) && inf.niche.length === 1 ? inf.niche[0] : null;
    const other = inf.niche_other || '';
    setInitial({ niche: code, nicheOther: other, language: inf.language || [] });
    setNiche(code); setNicheOther(other); setLanguage(inf.language || []);
    const items = n.success ? n.data.items || [] : [];
    // "Other" is always offered, last, even if an older list omits it.
    setNiches(items.some(o => o.code === OTHER) ? items : [...items, { code: OTHER, label: 'Other' }]);
    setLanguages(l.success ? l.data.items || [] : []);
    setStatus('ready');
  }, []);
  useEffect(() => { load(); }, [load]);

  const dirty = niche !== initial.niche || (niche === OTHER && nicheOther.trim() !== initial.nicheOther.trim())
    || JSON.stringify([...language].sort()) !== JSON.stringify([...initial.language].sort());
  useUnsavedGuard(navigation, dirty && !done);
  const nicheError = niche ? '' : MSG3.NICHE;
  const otherError = niche === OTHER ? (!nicheOther.trim() ? N.otherRequired : (nicheOther.trim().length > OTHER_MAX ? N.otherLong : '')) : '';
  const errorCount = (nicheError ? 1 : 0) + (otherError ? 1 : 0);

  async function save() {
    setServerErr('');
    setSaving(true);
    const body = { niche: [niche], language };
    if (niche === OTHER) body.niche_other = nicheOther.trim();
    const r = await influencerApi.updateMe(body);
    setSaving(false);
    if (!r.success) {
      if (r.error?.code === 'NICHE_OTHER_REQUIRED' || r.error?.field === 'niche_other') setServerErr(r.error.message);
      else show(r.error?.message || COPY.saveFailed);
      return;
    }
    setDone(true);
    navigation.navigate('ProfileMain', { toast: 'Saved.' });
  }

  if (status === 'loading') return <View style={base.screen}><Header title={N.title} onBack={() => navigation.goBack()} /><Skeleton /></View>;
  if (status === 'error') return <View style={base.screen}><Header title={N.title} onBack={() => navigation.goBack()} /><LoadError onRetry={load} /></View>;

  return (
    <View style={base.screen} testID="niche-languages">
      <Header title={N.title} onBack={() => navigation.goBack()} />
      {/* ui-walk-fixes board C: the form scrolls in the room above the Save strip; nothing floats over it. */}
      <FormArea>
      <FormScroll contentContainerStyle={base.body}>
        <Section title={N.yours} hint={N.hint}>
          <View style={base.chips}>
            {niches.map(o => o.code === OTHER
              ? <OtherChip key={o.code} testID={`niche-${o.code}`} selected={niche === o.code} onPress={() => setNiche(niche === o.code ? null : o.code)} />
              : <Chip key={o.code} testID={`niche-${o.code}`} label={o.label} selected={niche === o.code} onPress={() => setNiche(niche === o.code ? null : o.code)} />)}
          </View>
          <FieldError text={nicheError} />
        </Section>
        {niche === OTHER ? (
          <View style={{ marginTop: 14 }} testID="niche-other-block">
            <Text style={base.label}>{N.other}</Text>
            <TextInput style={s.input} value={nicheOther} onChangeText={(v) => { setNicheOther(v); setServerErr(''); }} placeholder="e.g. Pet & dog training" placeholderTextColor={T.ink3} maxLength={OTHER_MAX + 20} testID="niche-other-text" />
            <FieldError text={serverErr || (dirty ? otherError : '')} />
            <View style={s.blue} testID="niche-other-note"><Text style={s.blueText}>{N.otherNote}</Text></View>
          </View>
        ) : null}
        <Section title={N.languages}>
          <View style={base.chips}>
            {languages.map(o => <Chip key={o.code} testID={`lang-${o.code}`} label={o.label} selected={language.includes(o.code)}
              onPress={() => setLanguage(prev => prev.includes(o.code) ? prev.filter(c => c !== o.code) : [...prev, o.code])} />)}
          </View>
        </Section>
      </FormScroll>
      {toast}
      </FormArea>
      <SaveBar dirty={dirty} errorCount={errorCount} saving={saving} onSave={save} label="Save" />
    </View>
  );
}

const s = StyleSheet.create({
  dashed: { borderStyle: 'dashed', borderColor: T.ink2 },
  input: { fontFamily: fonts.sansMedium, fontSize: 15, color: T.ink, borderWidth: 1, borderColor: T.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: T.bg },
  blue: { backgroundColor: T.state.waiting.bg, borderRadius: 10, padding: 12, marginTop: 10 },
  blueText: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: T.state.waiting.fg, lineHeight: 18 },
});
