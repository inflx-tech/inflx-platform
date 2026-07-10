import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Image, StyleSheet, SafeAreaView } from 'react-native';
import { influencerApi } from '../../services/api';

/**
 * ExperienceStudioScreen — Creator Experience Studio (Creator Experience Engine
 * Phase 6b). Contract: features/creator-experiences/.
 *
 * Creator instantiates a placed Template into a live Experience: pick a
 * template (look + words already done) → select products → choose a featured
 * image → Publish. Backed by the 6a creator API. On publish the experience
 * fills the experience_template rule and renders on the follower home.
 */
const INK = '#1A1A1A', MUTED = '#6B6B6B', LINE = '#E7E6E2', BG = '#F7F4EC', CARD = '#FFFFFF', GOLD = '#F6B11E', GREEN = '#1D9E75';

export default function ExperienceStudioScreen({ navigation }) {
  const [templates, setTemplates] = useState([]);
  const [products, setProducts] = useState([]);
  const [picked, setPicked] = useState(null);          // selected template
  const [selectedIds, setSelectedIds] = useState([]);
  const [featured, setFeatured] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [t, p] = await Promise.all([influencerApi.listExperienceTemplates('fashion'), influencerApi.experienceStockable('fashion')]);
    if (t.success) setTemplates(t.data?.templates || []);
    if (p.success) setProducts(p.data?.products || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = (id) => setSelectedIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const publish = async () => {
    setBusy(true); setMsg(null);
    const created = await influencerApi.createExperience({ template_id: picked.id, product_ids: selectedIds, featured_image_url: featured || null });
    if (!created.success) { setBusy(false); setMsg({ kind: 'err', text: created.error?.message || 'Could not create' }); return; }
    const pub = await influencerApi.publishExperience(created.data.experience.id);
    setBusy(false);
    if (pub.success) setMsg({ kind: 'ok', text: `Published! "${picked.name}" is live on the home.` });
    else setMsg({ kind: 'err', text: pub.error?.message || 'Publish failed' });
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => (picked ? setPicked(null) : navigation.goBack())} accessibilityLabel="Back"><Text style={s.back}>‹ Back</Text></TouchableOpacity>
        <Text style={s.h1}>Create Experience</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.body}>
        {msg ? <View style={[s.msg, msg.kind === 'ok' ? s.msgOk : s.msgErr]}><Text style={msg.kind === 'ok' ? s.msgOkTxt : s.msgErrTxt}>{msg.text}</Text></View> : null}

        {!picked ? (
          <>
            <Text style={s.lbl}>AVAILABLE TEMPLATES</Text>
            {loading ? <Text style={s.dim}>Loading…</Text> : templates.length === 0 ? (
              <Text style={s.dim}>No templates available yet — an admin needs to place one.</Text>
            ) : templates.map((t) => (
              <TouchableOpacity key={t.id} style={s.tpl} activeOpacity={0.9} onPress={() => { setPicked(t); setMsg(null); }}>
                <Text style={s.tplName}>{t.name}</Text>
                <Text style={s.tplSub}>{t.theme?.title} · {t.section_style}</Text>
              </TouchableOpacity>
            ))}
          </>
        ) : (
          <>
            <Text style={s.picked}>{picked.theme?.title || picked.name}</Text>
            {picked.theme?.subtitle ? <Text style={s.pickedSub}>“{picked.theme.subtitle}”</Text> : null}
            {picked.theme?.min_products ? <Text style={s.rule}>Needs {picked.theme.min_products}+ products{picked.theme?.media_rules?.featured === 'required' ? ' + a featured image' : ''}.</Text> : null}

            <Text style={s.lbl}>SELECT PRODUCTS · {selectedIds.length} picked</Text>
            <View style={s.grid}>
              {products.map((p) => {
                const on = selectedIds.includes(p.id);
                return (
                  <TouchableOpacity key={p.id} style={[s.p, on && s.pOn]} activeOpacity={0.85}
                    onPress={() => toggle(p.id)} onLongPress={() => p.image_url && setFeatured(p.image_url)}>
                    <View style={s.pImg}>{p.image_url ? <Image source={{ uri: p.image_url }} style={s.pImgFill} /> : <Text style={s.pEmoji}>🛍️</Text>}</View>
                    <Text style={s.pName} numberOfLines={1}>{p.name}</Text>
                    <Text style={s.pPrice}>₹{p.price}</Text>
                  </TouchableOpacity>
                );
              })}
              {products.length === 0 ? <Text style={s.dim}>No stockable products — contract with a brand first.</Text> : null}
            </View>

            <Text style={s.lbl}>FEATURED IMAGE</Text>
            <Text style={s.hint}>Paste an image URL, or long-press a product to use its image.</Text>
            <TextInput value={featured} onChangeText={setFeatured} placeholder="https://…/photo.jpg" style={s.input} autoCapitalize="none" />
            {featured ? <Text style={s.featOk}>✓ featured set</Text> : null}

            <TouchableOpacity style={[s.pub, busy && { opacity: 0.5 }]} disabled={busy} onPress={publish} accessibilityLabel="Publish">
              <Text style={s.pubTxt}>Publish ✓</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, backgroundColor: CARD, borderBottomWidth: 1, borderBottomColor: LINE },
  back: { color: INK, fontSize: 15, fontWeight: '700' },
  h1: { color: INK, fontSize: 16, fontWeight: '800' },
  body: { padding: 16 },
  lbl: { color: MUTED, fontSize: 11, fontWeight: '800', letterSpacing: 0.4, marginTop: 14, marginBottom: 8 },
  dim: { color: MUTED, fontSize: 13 },
  tpl: { backgroundColor: CARD, borderWidth: 1, borderColor: LINE, borderRadius: 12, padding: 12, marginBottom: 8 },
  tplName: { fontWeight: '800', fontSize: 14, color: INK },
  tplSub: { fontSize: 11, color: MUTED, marginTop: 2 },
  picked: { fontSize: 18, fontWeight: '800', color: INK },
  pickedSub: { fontSize: 12, color: MUTED, marginTop: 2 },
  rule: { fontSize: 11, color: MUTED, marginTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  p: { width: '31%', backgroundColor: CARD, borderWidth: 1, borderColor: LINE, borderRadius: 10, overflow: 'hidden' },
  pOn: { borderWidth: 2, borderColor: GREEN },
  pImg: { height: 58, backgroundColor: '#eee7d8', alignItems: 'center', justifyContent: 'center' },
  pImgFill: { width: '100%', height: '100%' },
  pEmoji: { fontSize: 22 },
  pName: { fontSize: 10, fontWeight: '700', padding: 5, color: INK },
  pPrice: { fontSize: 10, color: MUTED, paddingHorizontal: 5, paddingBottom: 5 },
  hint: { fontSize: 11, color: MUTED, marginBottom: 6 },
  input: { backgroundColor: CARD, borderWidth: 1, borderColor: LINE, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, fontSize: 13, color: INK },
  featOk: { fontSize: 11, color: GREEN, marginTop: 4, fontWeight: '700' },
  pub: { marginTop: 18, backgroundColor: INK, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  pubTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  msg: { borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1 },
  msgOk: { backgroundColor: '#e6f6ec', borderColor: '#bfe6d6' },
  msgErr: { backgroundColor: '#fdeee9', borderColor: '#f5c4b3' },
  msgOkTxt: { color: '#0f6e56', fontSize: 13, fontWeight: '700' },
  msgErrTxt: { color: '#993c1d', fontSize: 13, fontWeight: '700' },
});
