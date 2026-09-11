/**
 * NicheLanguagesScreen — A9: exactly one niche (required; brands filter by it) and the
 * languages she creates in. Contract: features/item3-discovery-profiles-groups · prompt §6.1 A9
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { influencerApi, referenceApi } from '../../services/api';
import { Chip, FieldError, Section } from '../../components/settings/primitives';
import { SaveBar, useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import { COPY } from '../../components/settings/copy';
import useUnsavedGuard from '../../hooks/useUnsavedGuard';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { C3, MSG3 } from '../../components/discovery/copy3';

const N = C3.creatorProfile.niche;

export default function NicheLanguagesScreen({ navigation }) {
  const [status, setStatus] = useState('loading');
  const [niches, setNiches] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [initial, setInitial] = useState({ niche: null, language: [] });
  const [niche, setNiche] = useState(null);
  const [language, setLanguage] = useState([]);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const { toast, show } = useToast();

  const load = useCallback(async () => {
    setStatus('loading');
    const [me, n, l] = await Promise.all([influencerApi.getMe(), referenceApi.creatorNiches(), referenceApi.languages()]);
    if (!me.success) { setStatus('error'); return; }
    const inf = me.data.influencer || me.data;
    const code = Array.isArray(inf.niche) && inf.niche.length === 1 ? inf.niche[0] : null;
    setInitial({ niche: code, language: inf.language || [] });
    setNiche(code); setLanguage(inf.language || []);
    setNiches(n.success ? n.data.items || [] : []);
    setLanguages(l.success ? l.data.items || [] : []);
    setStatus('ready');
  }, []);
  useEffect(() => { load(); }, [load]);

  const dirty = niche !== initial.niche || JSON.stringify([...language].sort()) !== JSON.stringify([...initial.language].sort());
  useUnsavedGuard(navigation, dirty && !done);
  const error = niche ? '' : MSG3.NICHE;

  async function save() {
    setSaving(true);
    const r = await influencerApi.updateMe({ niche: [niche], language });
    setSaving(false);
    if (!r.success) { show(r.error?.message || COPY.saveFailed); return; }
    setDone(true);
    navigation.navigate('ProfileMain', { toast: 'Saved.' });
  }

  if (status === 'loading') return <View style={base.screen}><Header title={N.title} onBack={() => navigation.goBack()} /><Skeleton /></View>;
  if (status === 'error') return <View style={base.screen}><Header title={N.title} onBack={() => navigation.goBack()} /><LoadError onRetry={load} /></View>;

  return (
    <View style={base.screen} testID="niche-languages">
      <Header title={N.title} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[base.body, { paddingBottom: 140 }]}>
        <Section title={N.yours} hint={N.hint}>
          <View style={base.chips}>
            {niches.map(o => <Chip key={o.code} testID={`niche-${o.code}`} label={o.label} selected={niche === o.code} onPress={() => setNiche(niche === o.code ? null : o.code)} />)}
          </View>
          <FieldError text={error} />
        </Section>
        <Section title={N.languages}>
          <View style={base.chips}>
            {languages.map(o => <Chip key={o.code} testID={`lang-${o.code}`} label={o.label} selected={language.includes(o.code)}
              onPress={() => setLanguage(prev => prev.includes(o.code) ? prev.filter(c => c !== o.code) : [...prev, o.code])} />)}
          </View>
        </Section>
      </ScrollView>
      <SaveBar dirty={dirty} errorCount={error ? 1 : 0} saving={saving} onSave={save} />
      {toast}
    </View>
  );
}
