/**
 * StoreLinksScreen — L5 "Store and collection links": her store link with the five channel endings
 * and this month's visits on each, every collection's one link with its visits, and the
 * handle-change line.
 * Contract: features/post-links-codes · rules §4.14
 */
import React, { useCallback, useState } from 'react';
import { View, ScrollView, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { influencerApi } from '../../services/api';
import { Skeleton, LoadError } from '../../components/settings/feedback';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { CL } from '../../components/create/copyLinks';
import { s as b } from '../../components/create/bitsCreate';
import { LinkRow, k } from '../../components/create/bitsLinks';

export default function StoreLinksScreen({ navigation }) {
  const [d, setD] = useState(null);
  const [status, setStatus] = useState('loading');

  const load = useCallback(async () => {
    const r = await influencerApi.myLinks();
    if (!r.success) { setStatus('error'); return; }
    setD(r.data); setStatus('ready');
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={base.screen} testID="store-links">
      <Header title={CL.linksTitle} onBack={() => navigation.goBack()} />
      {status === 'loading' ? <Skeleton /> : status === 'error' ? <LoadError onRetry={load} /> : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {d.store ? (
            <>
              <Text style={b.label}>{CL.yourStore}</Text>
              <View style={k.capline}><Text style={k.caplineText}>{d.store.display}</Text></View>
              <Text style={b.hint}>{CL.storeHint}</Text>
              <Text style={b.label}>{CL.storeLinks}</Text>
              {d.store.links.map((l, i) => (
                <LinkRow key={l.channel} label={l.label} display={l.display} url={l.url} note={CL.visitsMonth(l.visits, i === 0)} testID={`store-${l.channel}`} />
              ))}
            </>
          ) : <Text style={b.hint}>{CL.noHandle}</Text>}
          <Text style={b.label}>{CL.collections}</Text>
          {d.collections.length ? d.collections.map(c => (
            <LinkRow key={c.id} label={c.name} display={c.display} url={c.url} note={CL.collectionLine(c)} testID={`collection-${c.id}`} />
          )) : <Text style={b.hint}>{CL.noCollections}</Text>}
          <Text style={b.hint}>{CL.collectionPay}</Text>
          <Text style={b.hint}>{CL.handleHint}</Text>
        </ScrollView>
      )}
    </View>
  );
}
