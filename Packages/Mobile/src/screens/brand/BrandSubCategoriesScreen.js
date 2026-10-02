/**
 * BrandSubCategoriesScreen — A3: what the brand sells, one or more of the eight fashion
 * sub-categories. Creators who pick categories in their invitation settings are matched
 * against these. Contract: features/item3-discovery-profiles-groups · prompt §6.1 A3
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi, referenceApi } from '../../services/api';
import { Chip, FieldError, Section } from '../../components/settings/primitives';
import { SaveBar, useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import { FormScroll, FormArea } from '../../components/shell/FormScroll';
import { COPY } from '../../components/settings/copy';
import useUnsavedGuard from '../../hooks/useUnsavedGuard';
import { Header, s as base } from './BrandPitchSettingsScreen';
import { C3, MSG3 } from '../../components/discovery/copy3';

const S = C3.brandProfile.subs;

export default function BrandSubCategoriesScreen({ navigation }) {
  const [status, setStatus] = useState('loading');
  const [options, setOptions] = useState([]);
  const [initial, setInitial] = useState([]);
  const [sel, setSel] = useState([]);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const { toast, show } = useToast({ inFlow: true });

  const load = useCallback(async () => {
    setStatus('loading');
    const [me, cats] = await Promise.all([brandApi.getMe(), referenceApi.brandCategories()]);
    if (!me.success) { setStatus('error'); return; }
    const subs = Array.isArray(me.data.brand?.sub_categories) ? me.data.brand.sub_categories : [];
    setInitial(subs); setSel(subs);
    setOptions(cats.success ? (cats.data.items || []) : []);
    setStatus('ready');
  }, []);
  useEffect(() => { load(); }, [load]);

  const dirty = JSON.stringify([...sel].sort()) !== JSON.stringify([...initial].sort());
  useUnsavedGuard(navigation, dirty && !done);
  const error = sel.length ? '' : MSG3.SUB_CATEGORIES;

  async function save() {
    setSaving(true);
    const r = await brandApi.updateMe({ sub_categories: sel });
    setSaving(false);
    if (!r.success) { show(r.error?.message || COPY.saveFailed); return; }
    setDone(true);
    navigation.navigate('BrandProfile', { toast: 'Saved.' });
  }

  if (status === 'loading') return <View style={base.screen}><Header title={S.title} onBack={() => navigation.goBack()} /><Skeleton /></View>;
  if (status === 'error') return <View style={base.screen}><Header title={S.title} onBack={() => navigation.goBack()} /><LoadError onRetry={load} /></View>;

  return (
    <View style={base.screen}>
      <Header title={S.title} onBack={() => navigation.goBack()} />
      {/* ui-walk-fixes board C: the page scrolls in the room above the Save strip; nothing floats over it.
          No text box here — FormScroll is used so every Save screen is built the same way. */}
      <FormArea>
      <FormScroll contentContainerStyle={base.body}>
        <Text style={base.hint}>{S.intro}</Text>
        <Section title={S.major}><Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: T.ink }}>Fashion</Text></Section>
        <Section title={S.label}>
          <View style={base.chips}>
            {options.map(o => (
              <Chip key={o.code} testID={`sub-${o.code}`} label={o.label} selected={sel.includes(o.code)}
                onPress={() => setSel(prev => prev.includes(o.code) ? prev.filter(c => c !== o.code) : [...prev, o.code])} />
            ))}
          </View>
          <FieldError text={dirty ? error : ''} />
        </Section>
      </FormScroll>
      {toast}
      </FormArea>
      <SaveBar dirty={dirty} errorCount={error ? 1 : 0} saving={saving} onSave={save} />
    </View>
  );
}
