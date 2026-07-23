/**
 * PostComposerScreen — the creator Post Composer (Post/Concept P2).
 * Contract: features/concept-p2-posts/. Architecture: POST_CONCEPT_MODEL.md §5.
 *
 * The founder's sequence (locked 2026-07-23):
 *   1 SCOPE      single / multi / all collaborations → the product universe
 *   2 CONCEPT    one admin template (× leaf) OR one collection → LIVE filtered
 *                products (server = the same evaluator as follower shelves)
 *   3 POST TYPE  static / carousel decide the upload; video + video-carousel
 *                are visible but locked until the video phase → upload
 *   4 PRODUCTS   select the post's products FROM THE FILTERED LIST — this
 *                alone completes the post; "Shop the post" always shows them
 *   5 PRICE TAGS (OPTIONAL) tap the photo → pick from the ALREADY-SELECTED
 *                products → name + price pin appears at the tap point.
 *                Creator can submit without placing a single pin.
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Image, Alert,
  ActivityIndicator, Modal, FlatList, StyleSheet, Dimensions, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchImageLibrary } from 'react-native-image-picker';
import { influencerApi, uploadFile } from '../../services/api';

const WIN = Dimensions.get('window');
const SLIDE_W = WIN.width - 32;
const TOTAL_STEPS = 5;
const TAG_STYLES = [
  { key: 'soft_editorial', label: 'Soft Editorial' },
  { key: 'minimal', label: 'Minimal' },
  { key: 'hidden', label: 'Hidden until Shop' },
];
const POST_TYPES = [
  { key: 'static', label: 'Static post', sub: 'One photo', locked: false },
  { key: 'carousel', label: 'Carousel', sub: 'Up to 10 photos', locked: false },
  { key: 'video', label: 'Video', sub: 'Coming soon', locked: true },
  { key: 'video_carousel', label: 'Video carousel', sub: 'Coming soon', locked: true },
];

export default function PostComposerScreen({ navigation }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);

  // vocab
  const [brands, setBrands] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [collections, setCollections] = useState([]);
  const [leaves, setLeaves] = useState([]);

  // step 1 — scope
  const [scope, setScope] = useState('single');
  const [brandIds, setBrandIds] = useState([]);

  // step 2 — concept
  const [mode, setMode] = useState('concept');            // 'concept' | 'collection'
  const [templateId, setTemplateId] = useState(null);
  const [leafId, setLeafId] = useState(null);
  const [collectionId, setCollectionId] = useState(null);
  const [leafModal, setLeafModal] = useState(false);
  const [pickerBusy, setPickerBusy] = useState(false);
  const [universe, setUniverse] = useState(null);         // the FILTERED products

  // step 3 — post type + media
  const [postFormat, setPostFormat] = useState(null);     // 'static' | 'carousel'
  const [slides, setSlides] = useState([]);               // {uri, r2_key, width, height}
  const [uploadPct, setUploadPct] = useState(null);

  // step 4 — selected products (the attachment / shop list)
  const [selectedIds, setSelectedIds] = useState([]);

  // step 5 — optional price tags + finish
  const [pins, setPins] = useState([]);                   // {media_index, product_id, x_pct, y_pct, name, price}
  const [tagStyle, setTagStyle] = useState('soft_editorial');
  const [caption, setCaption] = useState('');
  const [activeSlide, setActiveSlide] = useState(0);
  const [pinSheet, setPinSheet] = useState(null);         // pending tap {media_index, x_pct, y_pct}
  const [submitting, setSubmitting] = useState(false);
  const slideSize = useRef({});

  useEffect(() => {
    (async () => {
      const res = await influencerApi.getPostScope();
      if (res.success) {
        setBrands(res.data.brands || []);
        setTemplates(res.data.templates || []);
        setCollections(res.data.collections || []);
      }
      try {
        const tree = await fetch(`${require('../../config/api').getBaseUrl()}/listing/tree?vertical=fashion`).then(r => r.json());
        const out = [];
        const walk = (nodes, prefix) => (nodes || []).forEach(n => {
          if (n.is_leaf) out.push({ id: String(n.id), label: [...prefix, n.name].join(' › '), name: n.name });
          if (n.children) walk(n.children, [...prefix, n.name]);
        });
        walk(tree?.data?.tree || tree?.tree || [], []);
        setLeaves(out);
      } catch { /* leaf picker shows empty state */ }
      setLoading(false);
    })();
  }, []);

  const selectedTemplate = templates.find(t => t.id === templateId) || null;
  const needsLeaf = selectedTemplate?.kind === 'category';
  const selectedProducts = (universe || []).filter(p => selectedIds.includes(p.id));

  const toggleBrand = (id) => {
    if (scope === 'single') { setBrandIds([id]); return; }
    setBrandIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  };
  const scopeReady = scope === 'all' ? brands.length > 0
    : scope === 'single' ? brandIds.length === 1 : brandIds.length >= 2;

  const runPicker = useCallback(async () => {
    setPickerBusy(true); setUniverse(null); setSelectedIds([]); setPins([]);
    const res = await influencerApi.postPicker({
      scope, brand_ids: brandIds,
      template_id: mode === 'concept' ? templateId : null,
      category_node_id: mode === 'concept' ? leafId : null,
      collection_id: mode === 'collection' ? collectionId : null,
    });
    setPickerBusy(false);
    if (res.success) setUniverse(res.data.products || []);
    else Alert.alert('Cannot load products', res.error?.message || 'Try again.');
  }, [scope, brandIds, mode, templateId, leafId, collectionId]);

  const conceptReady = mode === 'collection'
    ? !!collectionId
    : !!templateId && (!needsLeaf || !!leafId);

  const maxSlides = postFormat === 'static' ? 1 : 10;

  async function pickImages() {
    launchImageLibrary({ mediaType: 'photo', selectionLimit: maxSlides - slides.length }, async (resp) => {
      if (resp.didCancel || !resp.assets?.length) return;
      for (const a of resp.assets) {
        setUploadPct(0);
        const urlRes = await influencerApi.getPostUploadUrl({
          filename: a.fileName || 'photo.jpg', content_type: a.type || 'image/jpeg',
        });
        if (!urlRes.success) { Alert.alert('Upload failed', urlRes.error?.message || ''); break; }
        const { url, key, method } = urlRes.data;
        try {
          await uploadFile(url, method, a.uri, a.fileName || 'photo.jpg', a.type || 'image/jpeg', key,
            (p) => setUploadPct(p));
          setSlides(s => [...s, { uri: a.uri, r2_key: key, width: a.width, height: a.height }]);
        } catch (e) { Alert.alert('Upload failed', e.message); break; }
      }
      setUploadPct(null);
    });
  }

  function onImageTap(mediaIndex, evt) {
    const size = slideSize.current[mediaIndex];
    if (!size) return;
    if (!selectedProducts.length) {
      Alert.alert('No products selected', 'Price tags come from the products you selected in the previous step.');
      return;
    }
    const { locationX, locationY } = evt.nativeEvent;
    const x = Math.round((locationX / size.w) * 1000) / 10;
    const y = Math.round((locationY / size.h) * 1000) / 10;
    setPinSheet({ media_index: mediaIndex, x_pct: Math.min(100, Math.max(0, x)), y_pct: Math.min(100, Math.max(0, y)) });
  }

  function placePin(prod) {
    setPins(t => [...t, {
      media_index: pinSheet.media_index, product_id: prod.id,
      x_pct: pinSheet.x_pct, y_pct: pinSheet.y_pct,
      name: prod.name, price: prod.offer_price ?? prod.price,
    }]);
    setPinSheet(null);
  }

  async function submit() {
    setSubmitting(true);
    // attachment = every selected product; entries with coordinates are the
    // optional price-tag pins (a pinned product is attached by construction).
    const pinnedIds = new Set(pins.map(t => t.product_id));
    const products = [
      ...pins.map(t => ({ media_index: t.media_index, product_id: t.product_id, x_pct: t.x_pct, y_pct: t.y_pct })),
      ...selectedIds.filter(id => !pinnedIds.has(id)).map(id => ({ product_id: id })),
    ];
    const res = await influencerApi.createPost({
      scope, brand_ids: brandIds,
      template_id: mode === 'concept' ? templateId : null,
      category_node_id: mode === 'concept' ? leafId : null,
      collection_id: mode === 'collection' ? collectionId : null,
      post_type: 'lifestyle',
      tag_style: tagStyle,
      caption: caption.trim() || null,
      media: slides.map(s => ({ r2_key: s.r2_key, width: s.width, height: s.height })),
      products,
    });
    setSubmitting(false);
    if (res.success) {
      Alert.alert('Submitted 🎉', 'Your post is with the INFLX team for review. You will be notified.',
        [{ text: 'My Posts', onPress: () => navigation.replace('MyPosts') }]);
    } else {
      Alert.alert('Could not submit', res.error?.message || 'Try again.');
    }
  }

  if (loading) {
    return <SafeAreaView style={st.safe}><ActivityIndicator style={{ marginTop: 60 }} color="#F6B11E" /></SafeAreaView>;
  }

  const Header = ({ title }) => (
    <View style={st.header}>
      <TouchableOpacity onPress={() => step > 1 ? setStep(step - 1) : navigation.goBack()}>
        <Text style={st.back}>‹</Text>
      </TouchableOpacity>
      <View>
        <Text style={st.hTitle}>{title}</Text>
        <Text style={st.hStep}>Step {step} of {TOTAL_STEPS}</Text>
      </View>
      <View style={{ width: 24 }} />
    </View>
  );

  // ── Step 1: scope ──────────────────────────────────────────────────────────
  if (step === 1) return (
    <SafeAreaView style={st.safe}>
      <Header title="Where do products come from?" />
      {brands.length === 0 ? (
        <View style={st.emptyWrap}>
          <Text style={st.emptyTitle}>No collaborations yet</Text>
          <Text style={st.emptySub}>Posts pull products from brands you have a signed campaign with. Accept an offer first.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {[['single', 'Single brand'], ['multi', 'Multiple brands'], ['all', `Entire collaborations (${brands.length})`]].map(([k, label]) => (
            <TouchableOpacity key={k} style={[st.radioRow, scope === k && st.radioRowOn]}
              onPress={() => { setScope(k); setBrandIds([]); }}>
              <Text style={[st.radioTxt, scope === k && st.radioTxtOn]}>{label}</Text>
              <Text style={st.radioDot}>{scope === k ? '●' : '○'}</Text>
            </TouchableOpacity>
          ))}
          {scope !== 'all' && (
            <View style={{ marginTop: 14 }}>
              <Text style={st.lbl}>{scope === 'single' ? 'Pick your brand' : 'Pick at least two brands'}</Text>
              <View style={st.chipWrap}>
                {brands.map(b => (
                  <TouchableOpacity key={b.id} style={[st.chip, brandIds.includes(b.id) && st.chipOn]}
                    onPress={() => toggleBrand(b.id)}>
                    <Text style={[st.chipTxt, brandIds.includes(b.id) && st.chipTxtOn]}>{b.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
          <TouchableOpacity style={[st.cta, !scopeReady && st.ctaOff]} disabled={!scopeReady}
            onPress={() => setStep(2)}>
            <Text style={st.ctaTxt}>Choose concept →</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );

  // ── Step 2: concept / collection ───────────────────────────────────────────
  if (step === 2) return (
    <SafeAreaView style={st.safe}>
      <Header title="Pick one concept" />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={st.segWrap}>
          {[['concept', 'Concept'], ['collection', 'Collection']].map(([k, label]) => (
            <TouchableOpacity key={k} style={[st.seg, mode === k && st.segOn]}
              onPress={() => { setMode(k); setUniverse(null); }}>
              <Text style={[st.segTxt, mode === k && st.segTxtOn]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {mode === 'concept' ? (
          <>
            {['category', 'price', 'offer'].map(kind => {
              const of = templates.filter(t => t.kind === kind);
              if (!of.length) return null;
              return (
                <View key={kind} style={{ marginTop: 12 }}>
                  <Text style={st.lbl}>{kind === 'category' ? 'Category themes' : kind === 'price' ? 'Price' : 'Offers'}</Text>
                  <View style={st.chipWrap}>
                    {of.map(t => (
                      <TouchableOpacity key={t.id} style={[st.chip, templateId === t.id && st.chipOn]}
                        onPress={() => { setTemplateId(t.id); setUniverse(null); }}>
                        <Text style={[st.chipTxt, templateId === t.id && st.chipTxtOn]}>{t.name_pattern.replace('{Category}', '…')}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              );
            })}
            {selectedTemplate && (
              <View style={{ marginTop: 12 }}>
                <Text style={st.lbl}>
                  {needsLeaf ? 'Which category?' : 'Narrow to one category (optional)'}
                </Text>
                <TouchableOpacity style={st.leafBtn} onPress={() => setLeafModal(true)}>
                  <Text style={st.leafBtnTxt}>
                    {leafId ? (leaves.find(l => l.id === leafId)?.label || 'Picked') : needsLeaf ? 'Pick a category…' : 'All categories'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        ) : (
          <View style={{ marginTop: 12 }}>
            <Text style={st.lbl}>Collections are curated looks — mixed categories, your call on products</Text>
            <View style={st.chipWrap}>
              {collections.map(c => (
                <TouchableOpacity key={c.id} style={[st.chip, collectionId === c.id && st.chipOn]}
                  onPress={() => { setCollectionId(c.id); setUniverse(null); }}>
                  <Text style={[st.chipTxt, collectionId === c.id && st.chipTxtOn]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <TouchableOpacity style={[st.cta, (!conceptReady || pickerBusy) && st.ctaOff]}
          disabled={!conceptReady || pickerBusy} onPress={runPicker}>
          <Text style={st.ctaTxt}>{pickerBusy ? 'Checking products…' : 'Show my products'}</Text>
        </TouchableOpacity>

        {universe && (
          <View style={{ marginTop: 14 }}>
            <Text style={st.universeCount}>
              {universe.length === 0
                ? 'No products match this concept from your scope right now — pick another concept or widen your scope.'
                : `${universe.length} product${universe.length === 1 ? '' : 's'} available for this post`}
            </Text>
            {universe.length > 0 && (
              <TouchableOpacity style={st.cta} onPress={() => setStep(3)}>
                <Text style={st.ctaTxt}>Choose post type →</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      <Modal visible={leafModal} animationType="slide" onRequestClose={() => setLeafModal(false)}>
        <SafeAreaView style={st.safe}>
          <View style={st.header}>
            <TouchableOpacity onPress={() => setLeafModal(false)}><Text style={st.back}>‹</Text></TouchableOpacity>
            <Text style={st.hTitle}>Pick a category</Text><View style={{ width: 24 }} />
          </View>
          <FlatList data={leaves} keyExtractor={l => l.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={st.leafRow}
                onPress={() => { setLeafId(item.id); setUniverse(null); setLeafModal(false); }}>
                <Text style={[st.leafRowTxt, leafId === item.id && { color: '#F6B11E' }]}>{item.label}</Text>
              </TouchableOpacity>
            )} />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );

  // ── Step 3: post type + upload ─────────────────────────────────────────────
  if (step === 3) return (
    <SafeAreaView style={st.safe}>
      <Header title="What are you posting?" />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {POST_TYPES.map(t => (
          <TouchableOpacity key={t.key}
            style={[st.radioRow, postFormat === t.key && st.radioRowOn, t.locked && { opacity: 0.45 }]}
            disabled={t.locked}
            onPress={() => { setPostFormat(t.key); if (t.key === 'static' && slides.length > 1) setSlides(s => s.slice(0, 1)); }}>
            <View>
              <Text style={[st.radioTxt, postFormat === t.key && st.radioTxtOn]}>{t.label} {t.locked ? '🔒' : ''}</Text>
              <Text style={st.radioSub}>{t.sub}</Text>
            </View>
            <Text style={st.radioDot}>{postFormat === t.key ? '●' : '○'}</Text>
          </TouchableOpacity>
        ))}

        {postFormat && (
          <View style={{ marginTop: 14 }}>
            <Text style={st.lbl}>{postFormat === 'static' ? 'Your photo' : `Your photos (up to ${maxSlides})`}</Text>
            <View style={st.chipWrap}>
              {slides.map((s, i) => (
                <View key={s.r2_key} style={st.thumbWrap}>
                  <Image source={{ uri: s.uri }} style={st.thumb} />
                  <TouchableOpacity style={st.thumbX}
                    onPress={() => { setSlides(sl => sl.filter((_, j) => j !== i)); setPins(t => t.filter(x => x.media_index !== i).map(x => ({ ...x, media_index: x.media_index > i ? x.media_index - 1 : x.media_index }))); }}>
                    <Text style={{ color: '#fff', fontSize: 11 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {slides.length < maxSlides && (
                <TouchableOpacity style={st.addThumb} onPress={pickImages} disabled={uploadPct != null}>
                  <Text style={{ fontSize: 26, color: '#999' }}>＋</Text>
                </TouchableOpacity>
              )}
            </View>
            {uploadPct != null && <Text style={st.progress}>Uploading… {Math.round(uploadPct * 100)}%</Text>}
            <Text style={st.hint}>Real photos or an LTK-style collage — any shape. Products come next.</Text>
          </View>
        )}

        <TouchableOpacity style={[st.cta, (!postFormat || slides.length === 0) && st.ctaOff]}
          disabled={!postFormat || slides.length === 0}
          onPress={() => setStep(4)}>
          <Text style={st.ctaTxt}>Select products →</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );

  // ── Step 4: select the post's products (the shop list) ─────────────────────
  if (step === 4) return (
    <SafeAreaView style={st.safe}>
      <Header title="Which products are in this post?" />
      <FlatList
        data={universe || []}
        keyExtractor={p => p.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        ListHeaderComponent={
          <Text style={[st.hint, { marginBottom: 10 }]}>
            These appear under “Shop the post”. From your {selectedTemplate ? 'concept' : 'collection'}-filtered list ({(universe || []).length}).
          </Text>
        }
        renderItem={({ item }) => {
          const on = selectedIds.includes(item.id);
          return (
            <TouchableOpacity style={[st.prodRow, on && st.prodRowOn]}
              onPress={() => setSelectedIds(ids => on ? ids.filter(x => x !== item.id) : [...ids, item.id])}>
              {item.image_url
                ? <Image source={{ uri: item.image_url }} style={st.prodImg} />
                : <View style={[st.prodImg, { backgroundColor: '#eee' }]} />}
              <View style={{ flex: 1 }}>
                <Text style={st.prodName} numberOfLines={1}>{item.name}</Text>
                <Text style={st.prodPrice}>₹{item.offer_price ?? item.price}{item.discount_value ? `  · ${item.discount_value}% off` : ''}</Text>
              </View>
              <Text style={{ fontSize: 16, color: on ? '#F6B11E' : '#CCC' }}>{on ? '✓' : '○'}</Text>
            </TouchableOpacity>
          );
        }}
      />
      <View style={st.footerBar}>
        <TouchableOpacity style={[st.cta, { flex: 1, marginTop: 0 }, selectedIds.length === 0 && st.ctaOff]}
          disabled={selectedIds.length === 0} onPress={() => setStep(5)}>
          <Text style={st.ctaTxt}>Continue with {selectedIds.length || 'no'} product{selectedIds.length === 1 ? '' : 's'} →</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  // ── Step 5: optional price tags + finish ───────────────────────────────────
  return (
    <SafeAreaView style={st.safe}>
      <Header title="Price tags (optional)" />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={[st.hint, { marginBottom: 8 }]}>
          Want “shop the look” tags on the photo? Tap where a product sits, then pick it — the name and price appear automatically. Or skip: your {selectedIds.length} product{selectedIds.length === 1 ? '' : 's'} already show under “Shop the post”.
        </Text>
        <FlatList
          horizontal pagingEnabled showsHorizontalScrollIndicator={false}
          data={slides} keyExtractor={s => s.r2_key}
          onMomentumScrollEnd={e => setActiveSlide(Math.round(e.nativeEvent.contentOffset.x / SLIDE_W))}
          renderItem={({ item, index }) => {
            const ratio = item.width && item.height ? item.height / item.width : 1.25;
            const h = Math.min(SLIDE_W * ratio, WIN.height * 0.5);
            return (
              <Pressable onPress={(e) => onImageTap(index, e)}
                onLayout={(e) => { slideSize.current[index] = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height }; }}
                style={{ width: SLIDE_W, height: h }}>
                <Image source={{ uri: item.uri }} style={{ width: SLIDE_W, height: h, borderRadius: 14 }} />
                {pins.filter(t => t.media_index === index).map((t, i) => (
                  <View key={i} style={[st.tagPin, { left: `${t.x_pct}%`, top: `${t.y_pct}%` }]}>
                    <Text style={st.tagPinTxt}>{t.name} · ₹{t.price}</Text>
                  </View>
                ))}
              </Pressable>
            );
          }} />
        <View style={st.dots}>
          {slides.map((_, i) => <View key={i} style={[st.dot, i === activeSlide && st.dotOn]} />)}
        </View>

        {pins.length > 0 && (
          <View style={st.chipWrap}>
            {pins.map((t, i) => (
              <View key={i} style={[st.chip, st.chipOn]}>
                <Text style={st.chipTxtOn}>{t.name} <Text onPress={() => setPins(ts => ts.filter((_, j) => j !== i))}> ✕</Text></Text>
              </View>
            ))}
          </View>
        )}

        <Text style={[st.lbl, { marginTop: 14 }]}>Price-tag style</Text>
        <View style={st.chipWrap}>
          {TAG_STYLES.map(s => (
            <TouchableOpacity key={s.key} style={[st.chip, tagStyle === s.key && st.chipOn]} onPress={() => setTagStyle(s.key)}>
              <Text style={[st.chipTxt, tagStyle === s.key && st.chipTxtOn]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[st.lbl, { marginTop: 14 }]}>Caption</Text>
        <TextInput value={caption} onChangeText={setCaption} multiline placeholder="Weekend coffee runs in my favourite denims ☕"
          style={st.captionInput} placeholderTextColor="#999" />

        <TouchableOpacity style={[st.cta, submitting && st.ctaOff]}
          disabled={submitting} onPress={submit}>
          <Text style={st.ctaTxt}>{submitting ? 'Submitting…' : pins.length ? 'Submit for review' : 'Submit without tags'}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* pin sheet — ONLY the products selected in step 4 */}
      <Modal visible={!!pinSheet} animationType="slide" transparent onRequestClose={() => setPinSheet(null)}>
        <View style={st.sheetBack}>
          <View style={st.sheet}>
            <Text style={st.sheetTitle}>Which of your selected products is this?</Text>
            <FlatList data={selectedProducts} keyExtractor={p => p.id} style={{ maxHeight: WIN.height * 0.5 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={st.prodRow} onPress={() => placePin(item)}>
                  {item.image_url
                    ? <Image source={{ uri: item.image_url }} style={st.prodImg} />
                    : <View style={[st.prodImg, { backgroundColor: '#eee' }]} />}
                  <View style={{ flex: 1 }}>
                    <Text style={st.prodName} numberOfLines={1}>{item.name}</Text>
                    <Text style={st.prodPrice}>₹{item.offer_price ?? item.price}{pins.some(t => t.product_id === item.id) ? '  · pinned' : ''}</Text>
                  </View>
                </TouchableOpacity>
              )} />
            <TouchableOpacity onPress={() => setPinSheet(null)} style={{ padding: 14, alignItems: 'center' }}>
              <Text style={{ color: '#999', fontWeight: '700' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  back: { fontSize: 30, color: '#1A1A1A', width: 24 },
  hTitle: { fontSize: 16, fontWeight: '800', color: '#1A1A1A', textAlign: 'center' },
  hStep: { fontSize: 11, color: '#999', textAlign: 'center' },
  emptyWrap: { padding: 32, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#1A1A1A', marginBottom: 6 },
  emptySub: { fontSize: 12.5, color: '#777', textAlign: 'center', lineHeight: 18 },
  radioRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1.5, borderColor: '#EEE', borderRadius: 14, padding: 14, marginBottom: 8 },
  radioRowOn: { borderColor: '#1A1A1A', backgroundColor: '#FAFAFA' },
  radioTxt: { fontSize: 13.5, fontWeight: '600', color: '#777' },
  radioTxtOn: { color: '#1A1A1A', fontWeight: '800' },
  radioSub: { fontSize: 11, color: '#AAA', marginTop: 1 },
  radioDot: { fontSize: 14, color: '#F6B11E' },
  lbl: { fontSize: 11, fontWeight: '800', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderColor: '#E5E5E5', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  chipOn: { borderColor: '#1A1A1A', backgroundColor: '#1A1A1A' },
  chipTxt: { fontSize: 12.5, fontWeight: '600', color: '#555' },
  chipTxtOn: { fontSize: 12.5, fontWeight: '700', color: '#fff' },
  cta: { backgroundColor: '#1A1A1A', borderRadius: 14, padding: 15, alignItems: 'center', marginTop: 18 },
  ctaOff: { opacity: 0.35 },
  ctaTxt: { color: '#F6B11E', fontWeight: '800', fontSize: 14 },
  segWrap: { flexDirection: 'row', backgroundColor: '#F2F2F2', borderRadius: 12, padding: 3 },
  seg: { flex: 1, padding: 9, borderRadius: 10, alignItems: 'center' },
  segOn: { backgroundColor: '#fff' },
  segTxt: { fontSize: 12.5, fontWeight: '700', color: '#999' },
  segTxtOn: { color: '#1A1A1A' },
  leafBtn: { borderWidth: 1.5, borderColor: '#E5E5E5', borderRadius: 12, padding: 12 },
  leafBtnTxt: { fontSize: 13, fontWeight: '600', color: '#1A1A1A' },
  leafRow: { paddingHorizontal: 18, paddingVertical: 13, borderBottomWidth: 1, borderColor: '#F2F2F2' },
  leafRowTxt: { fontSize: 13.5, color: '#1A1A1A', fontWeight: '600' },
  universeCount: { fontSize: 13, fontWeight: '700', color: '#1A1A1A', textAlign: 'center' },
  thumbWrap: { position: 'relative' },
  thumb: { width: 76, height: 96, borderRadius: 10 },
  thumbX: { position: 'absolute', top: -6, right: -6, backgroundColor: '#1A1A1A', borderRadius: 999, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  addThumb: { width: 76, height: 96, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#CCC', alignItems: 'center', justifyContent: 'center' },
  progress: { marginTop: 10, fontSize: 12, color: '#777' },
  hint: { fontSize: 11.5, color: '#999', lineHeight: 16, marginTop: 10 },
  tagPin: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, transform: [{ translateX: -20 }, { translateY: -12 }] },
  tagPinTxt: { fontSize: 10, fontWeight: '700', color: '#1A1A1A' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#DDD' },
  dotOn: { backgroundColor: '#1A1A1A' },
  captionInput: { borderWidth: 1.5, borderColor: '#E5E5E5', borderRadius: 12, padding: 12, minHeight: 70, fontSize: 13, color: '#1A1A1A', textAlignVertical: 'top' },
  footerBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 14, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#F0F0F0' },
  sheetBack: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16 },
  sheetTitle: { fontSize: 15, fontWeight: '800', color: '#1A1A1A', marginBottom: 10 },
  prodRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderColor: '#F5F5F5' },
  prodRowOn: { backgroundColor: '#FAFAFA', borderRadius: 10, paddingHorizontal: 8 },
  prodImg: { width: 42, height: 52, borderRadius: 8 },
  prodName: { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
  prodPrice: { fontSize: 11.5, color: '#777' },
});
