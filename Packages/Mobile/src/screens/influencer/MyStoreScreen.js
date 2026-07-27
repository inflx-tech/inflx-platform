/**
 * MyStoreScreen — B4, locked board b4-mystore.html frame 1 (revised for full
 * section→chip→concept parity with global home, progressively revealed).
 * Contract: features/concept-stageb-discover/.
 *
 * The creator arranges ONLY what their approved+visible posts qualify for
 * (GET /influencers/me/discover-options): sections (named groups) → optional
 * chips → concept banners (order ▲▼ · cover pick · show/hide). A brand-new
 * creator sees one auto-section holding everything — zero learning. Save
 * publishes instantly; a concept that goes dark hides itself on the
 * follower side (resolver truth).
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity, TextInput, Modal, Pressable,
  ActivityIndicator, Alert, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { influencerApi } from '../../services/api';

const keyOf = (b) => (b.concept_id ? `c:${b.concept_id}` : `l:${b.collection_id}`);

export default function MyStoreScreen({ navigation }) {
  const [options, setOptions] = useState(null);   // qualifying concepts + posts
  const [rows, setRows] = useState(null);         // sections
  const [activeChip, setActiveChip] = useState({});
  const [coverFor, setCoverFor] = useState(null); // { si, ci, bi }
  const [previewOpen, setPreviewOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const optByKey = useMemo(() => {
    const m = new Map();
    for (const o of options || []) m.set(keyOf(o), o);
    return m;
  }, [options]);

  useEffect(() => {
    (async () => {
      const [optRes, layRes] = await Promise.all([
        influencerApi.getDiscoverOptions?.().catch(() => null),
        influencerApi.getDiscoverLayout?.().catch(() => null),
      ]);
      const opts = optRes?.success ? (optRes.data?.options || []) : [];
      setOptions(opts);
      let rj = layRes?.success ? (layRes.data?.layout?.rows_json || []) : [];
      if (!rj.length && opts.length) {
        // First visit: one auto-section holding everything (the flat default).
        rj = [{ type: 'section', title: 'My picks', chips: [{ label: null, banners: opts.map((o) => ({ concept_id: o.concept_id, collection_id: o.collection_id })) }] }];
      }
      setRows(rj);
    })();
  }, []);

  function mutate(fn) { setRows((prev) => fn(JSON.parse(JSON.stringify(prev)))); setDirty(true); }

  // keys already placed anywhere → the rest form the "add to your store" pool
  const placedKeys = useMemo(() => {
    const s = new Set();
    for (const row of rows || []) for (const chip of row.chips || []) for (const b of chip.banners || []) s.add(keyOf(b));
    return s;
  }, [rows]);
  const pool = (options || []).filter((o) => !placedKeys.has(keyOf(o)));

  const moveRow = (si, d) => mutate((r) => { const j = si + d; if (j < 0 || j >= r.length) return r; [r[si], r[j]] = [r[j], r[si]]; return r; });
  const moveBanner = (si, ci, bi, d) => mutate((r) => {
    const arr = r[si].chips[ci].banners; const j = bi + d;
    if (j < 0 || j >= arr.length) return r; [arr[bi], arr[j]] = [arr[j], arr[bi]]; return r;
  });

  async function save() {
    setSaving(true);
    const res = await influencerApi.putDiscoverLayout?.(rows).catch(() => null);
    setSaving(false);
    if (res?.success) { setDirty(false); Alert.alert('Saved', 'Your store is live — followers see it instantly.'); }
    else Alert.alert('Could not save', res?.error?.message || 'Please try again.');
  }

  if (rows == null || options == null) {
    return <SafeAreaView style={st.safe}><View style={st.center}><ActivityIndicator color="#111" /></View></SafeAreaView>;
  }

  if (!options.length) {
    return (
      <SafeAreaView style={st.safe} edges={['top']}>
        <Header navigation={navigation} />
        <View style={st.center}>
          <Text style={st.emptyTitle}>No live posts yet</Text>
          <Text style={st.emptySub}>Publish posts and get them approved — the concepts they qualify for appear here, ready to arrange.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const coverBanner = coverFor ? rows[coverFor.si]?.chips[coverFor.ci]?.banners[coverFor.bi] : null;
  const coverOpt = coverBanner ? optByKey.get(keyOf(coverBanner)) : null;

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <Header navigation={navigation} onPreview={() => setPreviewOpen(true)} />
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={st.hint}>
          <Text style={st.hintTxt}>Same structure as the app's home: sections → chips → your concepts → your posts. Start simple; add sections or chips only if you want them. Sold-out concepts hide themselves.</Text>
        </View>

        {rows.map((row, si) => {
          const ci = Math.min(activeChip[si] || 0, (row.chips?.length || 1) - 1);
          const chip = row.chips[ci];
          const showChips = row.chips.length > 1 || row.chips.some((c) => c.label);
          return (
            <View key={si} style={st.section}>
              <View style={st.secHead}>
                <View style={{ flexDirection: 'column', gap: 2 }}>
                  <TouchableOpacity onPress={() => moveRow(si, -1)} hitSlop={6}><Text style={st.arrow}>▲</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => moveRow(si, +1)} hitSlop={6}><Text style={st.arrow}>▼</Text></TouchableOpacity>
                </View>
                <TextInput value={row.title || ''} placeholder="Section name"
                  onChangeText={(t) => mutate((r) => { r[si].title = t; return r; })}
                  style={st.secTitle} placeholderTextColor="#B5B5B5" />
                <TouchableOpacity hitSlop={6}
                  onPress={() => mutate((r) => { r[si].chips.push({ label: `Chip ${r[si].chips.length + 1}`, banners: [] }); return r; })}>
                  <Text style={st.miniBtn}>＋ chips</Text>
                </TouchableOpacity>
                {rows.length > 1 && (
                  <TouchableOpacity hitSlop={6} onPress={() => Alert.alert('Remove section', `Remove “${row.title}”? Its concepts go back to the add pool.`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Remove', style: 'destructive', onPress: () => mutate((r) => { r.splice(si, 1); return r; }) },
                  ])}>
                    <Text style={[st.miniBtn, { color: '#D64545' }]}>remove</Text>
                  </TouchableOpacity>
                )}
              </View>

              {showChips && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chips}>
                  {row.chips.map((c, i) => (
                    <TouchableOpacity key={i} style={[st.chip, i === ci && st.chipOn]}
                      onPress={() => setActiveChip((s) => ({ ...s, [si]: i }))}
                      onLongPress={() => {
                        Alert.alert('Chip', c.label || '(no label)', [
                          { text: 'Cancel', style: 'cancel' },
                          row.chips.length > 1 ? { text: 'Delete chip', style: 'destructive', onPress: () => mutate((r) => { r[si].chips.splice(i, 1); return r; }) } : null,
                        ].filter(Boolean));
                      }}>
                      <Text style={[st.chipTxt, i === ci && { color: '#FFF' }]}>{c.label || 'All'}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              {showChips && (
                <TextInput value={chip.label || ''} placeholder="chip label"
                  onChangeText={(t) => mutate((r) => { r[si].chips[ci].label = t || null; return r; })}
                  style={st.chipLabelInput} placeholderTextColor="#B5B5B5" />
              )}

              {chip.banners.map((b, bi) => {
                const opt = optByKey.get(keyOf(b));
                if (!opt) return null; // no longer qualifying — resolver hides it too
                const lead = b.lead_post_id ? opt.posts.find((p) => p.id === b.lead_post_id) : null;
                const cover = lead || opt.posts[0];
                return (
                  <View key={keyOf(b)} style={[st.crow, b.hidden && { opacity: 0.5 }]}>
                    <View style={{ flexDirection: 'column', gap: 2 }}>
                      <TouchableOpacity onPress={() => moveBanner(si, ci, bi, -1)} hitSlop={6}><Text style={st.arrow}>▲</Text></TouchableOpacity>
                      <TouchableOpacity onPress={() => moveBanner(si, ci, bi, +1)} hitSlop={6}><Text style={st.arrow}>▼</Text></TouchableOpacity>
                    </View>
                    <TouchableOpacity onPress={() => setCoverFor({ si, ci, bi })} activeOpacity={0.8}>
                      {cover?.cover_url
                        ? <Image source={{ uri: cover.cover_url }} style={st.thumb} resizeMode="cover" />
                        : <View style={[st.thumb, { backgroundColor: '#F5F2EC' }]} />}
                    </TouchableOpacity>
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => setCoverFor({ si, ci, bi })} activeOpacity={0.8}>
                      <Text style={st.cname}>{opt.name}</Text>
                      <Text style={st.csub}>{opt.visible} post{opt.visible === 1 ? '' : 's'} · cover: {lead ? lead.label : 'newest post'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity hitSlop={8}
                      onPress={() => mutate((r) => { r[si].chips[ci].banners[bi].hidden = !b.hidden; return r; })}>
                      <View style={[st.tog, b.hidden && st.togOff]}><View style={[st.knob, b.hidden && st.knobOff]} /></View>
                    </TouchableOpacity>
                  </View>
                );
              })}
              {chip.banners.length === 0 && (
                <Text style={st.emptyChip}>Nothing in this chip yet — add from the pool below.</Text>
              )}
            </View>
          );
        })}

        <TouchableOpacity style={st.addSection}
          onPress={() => mutate((r) => { r.push({ type: 'section', title: 'New section', chips: [{ label: null, banners: [] }] }); return r; })}>
          <Text style={st.addSectionTxt}>＋ New section</Text>
        </TouchableOpacity>

        {pool.length > 0 && (
          <View style={st.poolWrap}>
            <Text style={st.poolTitle}>Add to your store</Text>
            {pool.map((o) => (
              <TouchableOpacity key={keyOf(o)} style={st.poolRow}
                onPress={() => mutate((r) => {
                  const si = r.length - 1;
                  const ci = Math.min(activeChip[si] || 0, r[si].chips.length - 1);
                  r[si].chips[ci].banners.push({ concept_id: o.concept_id, collection_id: o.collection_id });
                  return r;
                })}>
                {o.posts[0]?.cover_url
                  ? <Image source={{ uri: o.posts[0].cover_url }} style={st.poolThumb} resizeMode="cover" />
                  : <View style={[st.poolThumb, { backgroundColor: '#F5F2EC' }]} />}
                <View style={{ flex: 1 }}>
                  <Text style={st.cname}>{o.name}</Text>
                  <Text style={st.csub}>{o.visible} post{o.visible === 1 ? '' : 's'}</Text>
                </View>
                <Text style={st.poolAdd}>＋ Add</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={st.foot}>
        <TouchableOpacity style={[st.saveBtn, (!dirty || saving) && { opacity: 0.4 }]} disabled={!dirty || saving} onPress={save}>
          {saving ? <ActivityIndicator color="#FFF" /> : <Text style={st.saveTxt}>Save — live instantly</Text>}
        </TouchableOpacity>
      </SafeAreaView>

      {/* cover picker */}
      <Modal visible={!!coverFor} transparent animationType="slide" onRequestClose={() => setCoverFor(null)}>
        <Pressable style={st.dim} onPress={() => setCoverFor(null)} />
        <View style={st.sheet}>
          <Text style={st.sheetTitle}>Cover for “{coverOpt?.name}”</Text>
          <Text style={st.sheetSub}>Pick the photo that fronts this banner</Text>
          <ScrollView contentContainerStyle={st.pickGrid}>
            {(coverOpt?.posts || []).map((p) => {
              const selected = coverBanner?.lead_post_id === p.id;
              return (
                <TouchableOpacity key={p.id} style={st.pickCard} activeOpacity={0.85}
                  onPress={() => { mutate((r) => { r[coverFor.si].chips[coverFor.ci].banners[coverFor.bi].lead_post_id = p.id; return r; }); setCoverFor(null); }}>
                  {p.cover_url
                    ? <Image source={{ uri: p.cover_url }} style={st.pickImg} resizeMode="cover" />
                    : <View style={[st.pickImg, { backgroundColor: '#F5F2EC' }]} />}
                  {selected && <View style={st.pickSel}><Text style={st.pickTick}>✓</Text></View>}
                  <Text style={st.pickName} numberOfLines={1}>{p.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      {/* preview as follower — the banner rail exactly as their page renders it */}
      <Modal visible={previewOpen} transparent animationType="slide" onRequestClose={() => setPreviewOpen(false)}>
        <Pressable style={st.dim} onPress={() => setPreviewOpen(false)} />
        <View style={st.sheet}>
          <Text style={st.sheetTitle}>Preview — your store's top</Text>
          <ScrollView>
            {rows.map((row, si) => {
              const visible = row.chips.flatMap((c) => c.banners).filter((b) => !b.hidden && optByKey.get(keyOf(b)));
              if (!visible.length) return null;
              return (
                <View key={si} style={{ marginBottom: 14 }}>
                  <Text style={st.pvSec}>{row.title}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 9, paddingTop: 7 }}>
                    {visible.map((b) => {
                      const opt = optByKey.get(keyOf(b));
                      const lead = b.lead_post_id ? opt.posts.find((p) => p.id === b.lead_post_id) : null;
                      const cover = (lead || opt.posts[0])?.cover_url;
                      return (
                        <View key={keyOf(b)} style={st.pvBanner}>
                          {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
                          <View style={st.pvShade}>
                            <Text style={st.pvTitle} numberOfLines={2}>{opt.name}</Text>
                            <Text style={st.pvCount}>{opt.visible} posts</Text>
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Header({ navigation, onPreview }) {
  return (
    <View style={st.hdr}>
      <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}><Text style={st.back}>‹</Text></TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={st.title}>My Store</Text>
        <Text style={st.sub}>Arrange what followers see first</Text>
      </View>
      {onPreview && <TouchableOpacity onPress={onPreview} hitSlop={8}><Text style={st.previewLink}>Preview</Text></TouchableOpacity>}
    </View>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  hdr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  back: { fontSize: 24, fontWeight: '700', color: '#111', marginTop: -2 },
  title: { fontSize: 17, fontWeight: '800', color: '#111' },
  sub: { fontSize: 11.5, color: '#8A8A8A', fontWeight: '600', marginTop: 1 },
  previewLink: { fontSize: 13, fontWeight: '800', color: '#111' },
  hint: { marginHorizontal: 16, marginBottom: 6, backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#EEE', borderRadius: 10, padding: 10 },
  hintTxt: { fontSize: 10.5, color: '#666', lineHeight: 16 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: '#111' },
  emptySub: { fontSize: 12, color: '#9A9A9A', textAlign: 'center', marginTop: 6, lineHeight: 18 },
  section: { marginTop: 10 },
  secHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  arrow: { fontSize: 9, color: '#999', fontWeight: '800' },
  secTitle: { flex: 1, fontSize: 13.5, fontWeight: '800', color: '#111', borderWidth: 1, borderColor: '#EEE', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 6 },
  miniBtn: { fontSize: 10.5, fontWeight: '800', color: '#555', borderWidth: 1, borderColor: '#E4E4E4', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, overflow: 'hidden' },
  chips: { gap: 6, paddingHorizontal: 16, paddingTop: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: '#E4E4E4' },
  chipOn: { backgroundColor: '#111', borderColor: '#111' },
  chipTxt: { fontSize: 10.5, fontWeight: '700', color: '#555' },
  chipLabelInput: { marginHorizontal: 16, marginTop: 6, fontSize: 11, fontWeight: '600', color: '#111', borderWidth: 1, borderColor: '#F0F0F0', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  crow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 8, borderWidth: 1, borderColor: '#EEE', borderRadius: 13, padding: 10 },
  thumb: { width: 44, height: 56, borderRadius: 9 },
  cname: { fontSize: 13, fontWeight: '800', color: '#111' },
  csub: { fontSize: 10.5, color: '#8A8A8A', marginTop: 2 },
  tog: { width: 38, height: 21, borderRadius: 11, backgroundColor: '#111', justifyContent: 'center' },
  togOff: { backgroundColor: '#DDD' },
  knob: { width: 17, height: 17, borderRadius: 9, backgroundColor: '#FFF', alignSelf: 'flex-end', marginRight: 2 },
  knobOff: { alignSelf: 'flex-start', marginLeft: 2 },
  emptyChip: { marginHorizontal: 16, marginTop: 8, fontSize: 11, color: '#9A9A9A', fontStyle: 'italic' },
  addSection: { marginHorizontal: 16, marginTop: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#CCC', borderRadius: 12, alignItems: 'center', paddingVertical: 11 },
  addSectionTxt: { fontSize: 12, fontWeight: '800', color: '#555' },
  poolWrap: { marginTop: 16, paddingTop: 10, borderTopWidth: 8, borderTopColor: '#FAFAFA' },
  poolTitle: { fontSize: 12.5, fontWeight: '800', color: '#111', paddingHorizontal: 16, marginBottom: 4 },
  poolRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 8, borderWidth: 1, borderColor: '#F0F0F0', borderRadius: 13, padding: 10 },
  poolThumb: { width: 38, height: 48, borderRadius: 8 },
  poolAdd: { fontSize: 12, fontWeight: '800', color: '#111' },
  foot: { borderTopWidth: 1, borderTopColor: '#EEE', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
  saveBtn: { backgroundColor: '#111', borderRadius: 999, alignItems: 'center', paddingVertical: 13 },
  saveTxt: { color: '#FFF', fontSize: 13.5, fontWeight: '800' },
  dim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '72%', backgroundColor: '#FFF', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, paddingBottom: 28 },
  sheetTitle: { fontSize: 15, fontWeight: '800', color: '#111' },
  sheetSub: { fontSize: 11.5, color: '#8A8A8A', marginTop: 2, marginBottom: 10 },
  pickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 10 },
  pickCard: { width: 104, position: 'relative' },
  pickImg: { width: 104, height: 130, borderRadius: 11 },
  pickSel: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  pickTick: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  pickName: { fontSize: 9.5, color: '#555', marginTop: 4 },
  pvSec: { fontSize: 13, fontWeight: '800', color: '#111' },
  pvBanner: { width: 150, height: 92, borderRadius: 12, overflow: 'hidden', backgroundColor: '#F5F2EC' },
  pvShade: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 9, paddingTop: 18, paddingBottom: 7, backgroundColor: 'rgba(0,0,0,0.32)' },
  pvTitle: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  pvCount: { color: 'rgba(255,255,255,0.9)', fontSize: 8.5, fontWeight: '700', marginTop: 1 },
});
