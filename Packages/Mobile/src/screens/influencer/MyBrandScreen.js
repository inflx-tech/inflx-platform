/**
 * MyBrandScreen — Profile › My brand (item 20, board L5–L6). The brand a creator runs and posts for
 * himself: linked (its card, when, what he can do, Remove link) or not yet (the link steps).
 * One brand per creator. Removing asks first; his live posts stay live.
 * Contract: features/item20-own-brand · rules v1.33 §2D
 */
import React, { useCallback, useState } from 'react';
import { View, ScrollView, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import { Skeleton, LoadError, useToast } from '../../components/settings/feedback';
import { SecondaryButton, DangerButton, InfoBox } from '../../components/settings/primitives';
import { ConfirmSheet } from '../../components/settings/sheets';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import BrandLinkFlow, { BrandCard20 } from '../../components/ownbrand/BrandLinkFlow';
import { O20, dayYear20 } from '../../components/ownbrand/copy20';

export default function MyBrandScreen({ navigation }) {
  const [d, setD] = useState(null);
  const [status, setStatus] = useState('loading');
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const { toast, show } = useToast();

  const load = useCallback(async () => {
    const r = await influencerApi.brandLink();
    if (!r.success) { setStatus('error'); return; }
    setD(r.data); setStatus('ready');
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function remove() {
    setAsking(false); setBusy(true);
    const r = await influencerApi.removeBrandLink();
    setBusy(false);
    if (!r.success) { show(r.error?.message || O20.generic); return; }
    show(O20.removed);
    load();
  }

  const link = d && d.link;
  return (
    <View style={base.screen} testID="my-brand">
      <Header title={O20.title} onBack={() => navigation.goBack()} />
      {status === 'loading' ? <Skeleton rows={4} /> : status === 'error' ? <LoadError onRetry={load} /> : (
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {link ? (
            <View testID="my-brand-linked">
              <BrandCard20 brand={link.brand} />
              <View style={st.lines}>
                <View style={st.line}><Text style={st.k}>{O20.linkedOn}</Text><Text style={st.v}>{dayYear20(link.linked_on)}</Text></View>
                <View style={[st.line, st.last]}><Text style={st.k}>{O20.postsFor}</Text><Text style={st.v} testID="my-brand-posts">{O20.postsLine(link.posts)}</Text></View>
              </View>
              {link.brand.note
                ? <View style={st.wait} testID="my-brand-note"><Text style={st.waitText}>{link.brand.note}</Text></View>
                : <View style={st.grey}><Text style={st.greyText}>{O20.can}</Text></View>}
              <View style={{ height: 14 }} />
              {link.can_create ? <SecondaryButton label={O20.createPost} onPress={() => navigation.navigate('CreateTab')} testID="my-brand-create" /> : null}
              <DangerButton outline label={O20.remove} busy={busy} onPress={() => setAsking(true)} testID="my-brand-remove" />
              <Text style={[base.hint, { marginTop: 12 }]}>{O20.oneBrand}</Text>
            </View>
          ) : (
            <View testID="my-brand-unlinked">
              <InfoBox text={O20.intro} />
              <View style={{ height: 16 }} />
              <BrandLinkFlow status={d} onLinked={(l) => { show(O20.linkedToast(l.brand.name)); load(); }} />
            </View>
          )}
        </ScrollView>
      )}
      <ConfirmSheet visible={asking} danger title={link ? O20.removeQ(link.brand.name) : ''} body={O20.removeBody}
        confirmLabel={O20.remove} cancelLabel={O20.keep} onConfirm={remove} onCancel={() => setAsking(false)} />
      {toast}
    </View>
  );
}

const st = StyleSheet.create({
  lines: { borderWidth: 1, borderColor: T.border, borderRadius: 14, paddingHorizontal: 12, marginTop: 12 },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: T.border },
  last: { borderBottomWidth: 0 },
  k: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink2 },
  v: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink },
  grey: { backgroundColor: T.surface, borderRadius: 12, padding: 11, marginTop: 12 },
  greyText: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2, lineHeight: 18 },
  wait: { backgroundColor: T.state.waiting.bg, borderRadius: 12, padding: 11, marginTop: 12 },
  waitText: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: T.state.waiting.fg, lineHeight: 18 },
});
