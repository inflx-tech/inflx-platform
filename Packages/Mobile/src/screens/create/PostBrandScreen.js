/**
 * PostBrandScreen — P2 (step 1): which brand is this post for. Only brands where she has a signed
 * Pay for Sale or Hybrid collaboration; one waiting for its shoot shows "Opens after your shoot plan".
 * Contract: features/shoppable-posts-v2 · rules §4.1, §4.8
 */
import React, { useCallback, useState } from 'react';
import { View, ScrollView, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { influencerApi } from '../../services/api';
import { Skeleton, LoadError } from '../../components/settings/feedback';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { CP } from '../../components/create/copyCreate';
import { StepTop, ChoiceCard, Footer, initialsOf, s as b } from '../../components/create/bitsCreate';

export default function PostBrandScreen({ navigation }) {
  const [brands, setBrands] = useState(null);
  const [status, setStatus] = useState('loading');
  const [picked, setPicked] = useState(null);

  const load = useCallback(async () => {
    const r = await influencerApi.postBrands();
    if (!r.success) { setStatus('error'); return; }
    setBrands(r.data.brands); setStatus('ready');
    const open = r.data.brands.filter(x => x.open);
    if (open.length === 1) setPicked(open[0].id);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={base.screen} testID="post-brand">
      <Header title={CP.newTitle} onBack={() => navigation.goBack()} />
      {status === 'loading' ? <Skeleton /> : status === 'error' ? <LoadError onRetry={load} /> : (
        <>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <StepTop step={1} question={CP.brandQ} />
            {brands.length ? brands.map(x => (
              <ChoiceCard key={x.id} title={x.name} sub={x.line} logo={x.logo_url} initials={initialsOf(x.name)}
                selected={picked === x.id} disabled={!x.open} onPress={() => setPicked(x.id)} testID={`brand-${x.id}`} />
            )) : <Text style={b.hint}>{CP.noBrands}</Text>}
            <Text style={b.hint}>{CP.brandHint}</Text>
          </ScrollView>
          <Footer label={CP.next} disabled={!picked} onPress={() => navigation.navigate('PostCollab', { brandId: picked })} />
        </>
      )}
    </View>
  );
}
