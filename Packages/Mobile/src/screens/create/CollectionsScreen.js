/**
 * CollectionsScreen — P17 her collections: posts or products, which brands, what it earned, and
 * whether shoppers can see it (hidden when nothing in it is still in the shop).
 * Contract: features/shoppable-posts-v2 · rules §4.11 · founder Q5
 */
import React, { useCallback, useState } from 'react';
import { View, ScrollView, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { influencerApi } from '../../services/api';
import { Skeleton, LoadError } from '../../components/settings/feedback';
import { PrimaryButton } from '../../components/settings/primitives';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { CP } from '../../components/create/copyCreate';
import { s as b } from '../../components/create/bitsCreate';

export function VisChip({ hidden }) {
  const tone = hidden ? T.state.ended : T.state.active;
  return <Text style={[c.chip, { color: tone.fg, backgroundColor: tone.bg }]}>{hidden ? CP.hidden : CP.live}</Text>;
}

export default function CollectionsScreen({ navigation }) {
  const [list, setList] = useState(null);
  const [status, setStatus] = useState('loading');

  const load = useCallback(async () => {
    const r = await influencerApi.myCollections();
    if (!r.success) { setStatus('error'); return; }
    setList(r.data.collections); setStatus('ready');
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={base.screen} testID="collections">
      <Header title={CP.collectionsTitle} onBack={() => navigation.goBack()} />
      {status === 'loading' ? <Skeleton /> : status === 'error' ? <LoadError onRetry={load} /> : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text style={b.hint}>{CP.collectionsHint}</Text>
          {list.map(x => (
            <TouchableOpacity key={x.id} style={c.row} onPress={() => navigation.navigate('Collection', { collectionId: x.id })} testID={`collection-${x.id}`}>
              <View style={{ flex: 1 }}>
                <Text style={c.name}>{x.name}</Text>
                <Text style={c.line}>{x.hidden ? x.hidden_line : x.line}</Text>
                <Text style={c.line}>{x.hidden ? CP.hiddenLine : x.sales_words}</Text>
              </View>
              <VisChip hidden={x.hidden} />
            </TouchableOpacity>
          ))}
          <Text style={b.hint}>{CP.hiddenHint}</Text>
          <PrimaryButton label={CP.newCollection} onPress={() => navigation.navigate('NewCollection')} testID="new-collection" />
        </ScrollView>
      )}
    </View>
  );
}

const c = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: T.border, borderRadius: 14, padding: 12, marginBottom: 10 },
  name: { fontFamily: fonts.sansBold, fontSize: 14, color: T.ink },
  line: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, marginTop: 2 },
  chip: { fontFamily: fonts.sansSemiBold, fontSize: 11, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
});
