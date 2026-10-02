/**
 * CollectionScreen — P20 one collection: see and edit. Rename, add or remove items, or delete, at any
 * time. A collection of posts stays posts-only and one of products stays products-only. A post that
 * leaves the shop stays here greyed; deleting a collection never touches the posts in it.
 * Contract: features/shoppable-posts-v2 · rules §4.11 · founder Q5
 *
 * ui-walk-fixes (board C): the page is a FormScroll, so with the keypad open for the new name the
 * first tap on "Save" saves (a plain scroller spent that tap closing the keypad). Nothing floats
 * here and nothing else changes.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { influencerApi } from '../../services/api';
import { Skeleton, LoadError, useToast } from '../../components/settings/feedback';
import { FormScroll } from '../../components/shell/FormScroll';
import { SecondaryButton, DangerButton, ButtonRow } from '../../components/settings/primitives';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { CP, rupeesP } from '../../components/create/copyCreate';
import { s as b } from '../../components/create/bitsCreate';
import { VisChip } from './CollectionsScreen';

export default function CollectionScreen({ navigation, route }) {
  const { collectionId } = route.params || {};
  const [c, setC] = useState(null);
  const [status, setStatus] = useState('loading');
  const [renaming, setRenaming] = useState(null);
  const { toast, show } = useToast();

  const load = useCallback(async () => {
    const r = await influencerApi.getCollection(collectionId);
    if (!r.success) { setStatus('error'); return; }
    setC(r.data.collection); setStatus('ready');
  }, [collectionId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function patch(body) {
    const r = await influencerApi.updateCollection(collectionId, body);
    if (r.success) { setC(r.data.collection); setRenaming(null); } else show(r.error?.message || '');
  }
  function del() {
    Alert.alert(CP.deleteCollectionQ, CP.deleteCollectionBody, [
      { text: CP.keepIt, style: 'cancel' },
      { text: CP.deleteIt, style: 'destructive', onPress: async () => {
        const r = await influencerApi.deleteCollection(collectionId);
        if (r.success) navigation.goBack(); else show(r.error?.message || '');
      } },
    ]);
  }

  if (status !== 'ready') return <View style={base.screen}><Header title="" onBack={() => navigation.goBack()} />{status === 'error' ? <LoadError onRetry={load} /> : <Skeleton />}</View>;
  return (
    <View style={base.screen} testID="collection">
      <Header title={c.name} onBack={() => navigation.goBack()} right={<VisChip hidden={c.hidden} />} />
      <FormScroll contentContainerStyle={{ padding: 16, paddingBottom: 40 }} testID="collection-scroll">
        <Text style={b.hint}>{c.line}{c.hidden ? ` · ${c.hidden_line}` : ''}</Text>
        {renaming != null ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <TextInput value={renaming} onChangeText={setRenaming} maxLength={60} style={k.input} testID="rename-input" autoFocus />
            <TouchableOpacity onPress={() => patch({ name: renaming })} testID="rename-save"><Text style={k.link}>{CP.save}</Text></TouchableOpacity>
          </View>
        ) : null}
        {c.items.map(it => (
          <View key={it.id} style={[b.row, !it.in_shop && { opacity: 0.5 }]} testID={`item-${it.id}`}>
            <View style={{ flex: 1 }}>
              <Text style={b.rowName}>{it.title}</Text>
              <Text style={b.rowMeta}>{[it.brand_name, it.line || (it.price != null ? rupeesP(it.price) : null)].filter(Boolean).join(' · ')}</Text>
            </View>
            <TouchableOpacity onPress={() => patch({ remove: [it.id] })} testID={`remove-${it.id}`}><Text style={k.link}>{CP.remove}</Text></TouchableOpacity>
          </View>
        ))}
        <View style={{ height: 12 }} />
        <SecondaryButton label={c.kind === 'posts' ? CP.addPosts : CP.addProducts} onPress={() => navigation.navigate('NewCollection', { collectionId, kind: c.kind })} testID="add-items" />
        {/* ui-walk-fixes (board E): the shared level pair — Rename used to sit 10 lower than Delete.
            Two equal halves, level; Rename the dark outline and Delete the red outline, as P20 draws. */}
        <ButtonRow style={{ marginTop: 10 }}>
          <SecondaryButton strong label={CP.rename} onPress={() => setRenaming(c.name)} testID="rename" />
          <DangerButton outline label={CP.deleteIt} onPress={del} testID="delete" />
        </ButtonRow>
        <Text style={[b.hint, { marginTop: 12 }]}>{CP.collectionHint}</Text>
      </FormScroll>
      {toast}
    </View>
  );
}

const k = StyleSheet.create({
  input: { flex: 1, borderWidth: 1, borderColor: T.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontFamily: fonts.sansRegular, fontSize: 14, color: T.ink, marginRight: 10 },
  link: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: T.ink, textDecorationLine: 'underline', marginLeft: 8 },
});
