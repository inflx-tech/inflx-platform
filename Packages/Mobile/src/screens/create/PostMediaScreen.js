/**
 * PostMediaScreen — P10 (step 7): photo or video, single or carousel (up to 10), the upload with the
 * copyrighted-music warning right where she uploads, and how product tags look. A saved photo can be
 * tapped to tag products on it (P11a). Files go straight to storage through the URL the server signs
 * (size and type locked), then the post keeps their keys.
 * Contract: features/shoppable-posts-v2 · rules §4.7 · founder Q3 (10 slides, 90 s a clip)
 */
import React, { useEffect, useState } from 'react';
import { View, ScrollView, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { prepareVideo } from '../../utils/videoPrep';
import { influencerApi, uploadContentFile } from '../../services/api';
import { Skeleton, LoadError } from '../../components/settings/feedback';
import { Chip } from '../../components/settings/primitives';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { CP } from '../../components/create/copyCreate';
import { StepTop, Footer, ErrorLine, Warn, useDraft, s as b } from '../../components/create/bitsCreate';

const MAX = 10;
const MAX_VIDEO_S = 90;

/** Pick files and send each one to storage. Returns the slides to keep, or throws with a message. */
export async function pickAndUpload(postId, kind, room, onStep) {
  const r = await launchImageLibrary({ mediaType: kind === 'video' ? 'video' : 'photo', selectionLimit: room });
  if (!r || r.didCancel || !r.assets || !r.assets.length) return [];
  const out = [];
  for (let i = 0; i < r.assets.length; i += 1) {
    const a = r.assets[i];
    if (kind === 'video' && Number(a.duration) > MAX_VIDEO_S) throw new Error(CP.tooLong);
    onStep && onStep(i + 1, r.assets.length);
    // rules v1.7 §4.7: a video is made smaller on her phone first (new app build; else as picked).
    const file = kind === 'video' ? await prepareVideo(a) : { uri: a.uri, size: a.fileSize, mime: a.type || 'image/jpeg' };
    const mime = file.mime || (kind === 'video' ? 'video/mp4' : 'image/jpeg');
    const u = await influencerApi.postUploadUrl(postId, { content_type: mime, size_bytes: file.size, filename: a.fileName });
    if (!u.success) throw new Error(u.error?.message || CP.uploadFailed);
    await uploadContentFile(u.data, file.uri);
    out.push({ r2_key: u.data.key, mime, width: a.width || null, height: a.height || null, duration_s: kind === 'video' ? Number(a.duration) || null : null, local: a.uri });
  }
  return out;
}

export default function PostMediaScreen({ navigation, route }) {
  const { postId, fix } = route.params || {};
  const { post, status, reload } = useDraft(postId);
  const [kind, setKind] = useState('image');
  const [layout, setLayout] = useState('carousel');
  const [slides, setSlides] = useState([]);
  const [look, setLook] = useState('soft_editorial');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!post) return;
    setKind(post.media_kind || 'image');
    setLayout(post.media_layout || 'carousel');
    setLook(post.tag_style || 'soft_editorial');
    setSlides(post.media.map(m => ({ r2_key: m.r2_key, mime: m.mime, width: m.width, height: m.height, duration_s: m.duration_s, url: m.url })));
  }, [post]);

  const room = layout === 'single' ? 1 - slides.length : MAX - slides.length;

  async function add() {
    setErr('');
    try {
      setBusy(true);
      const more = await pickAndUpload(postId, kind, Math.max(room, 0), (i, n) => setProgress(CP.uploading(i, n)));
      setSlides(v => [...v, ...more]);
    } catch (e) { setErr(e.message || CP.uploadFailed); }
    setBusy(false); setProgress('');
  }

  function body() {
    return { media_kind: kind, media_layout: layout, tag_style: look,
      media: slides.map(({ r2_key, mime, width, height, duration_s }) => ({ r2_key, mime, width, height, duration_s })) };
  }

  async function save(extra = {}) {
    const r = await influencerApi.updatePost(postId, { ...body(), ...extra });
    if (!r.success) { setErr(r.error?.message || ''); return null; }
    return r.data.post;
  }

  async function tagPhoto(i) {
    setBusy(true); setErr('');
    const p = await save();
    setBusy(false);
    if (p) navigation.navigate('PostTag', { postId, index: i });
  }

  async function next() {
    setBusy(true); setErr('');
    const p = await save(fix ? {} : { draft_step: 8 });
    setBusy(false);
    if (!p) return;
    if (fix) navigation.goBack(); else navigation.navigate('PostReview', { postId });
  }

  function switchKind(k) { if (k !== kind) { setKind(k); setSlides([]); } }
  function switchLayout(l) { setLayout(l); if (l === 'single' && slides.length > 1) setSlides(v => v.slice(0, 1)); }

  return (
    <View style={base.screen} testID="post-media">
      <Header title={CP.mediaTitle} onBack={() => navigation.goBack()} />
      {status === 'loading' ? <Skeleton /> : status === 'error' ? <LoadError onRetry={reload} /> : (
        <>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <StepTop step={fix ? null : 7} question={CP.mediaTitle} />
            <Text style={b.label}>{CP.type}</Text>
            <View style={base.chips}>
              <Chip label={CP.photo} selected={kind === 'image'} onPress={() => switchKind('image')} testID="kind-photo" />
              <Chip label={CP.video} selected={kind === 'video'} onPress={() => switchKind('video')} testID="kind-video" />
            </View>
            <Text style={b.label}>{CP.layout}</Text>
            <View style={base.chips}>
              <Chip label={CP.single} selected={layout === 'single'} onPress={() => switchLayout('single')} testID="layout-single" />
              <Chip label={CP.carousel} selected={layout === 'carousel'} onPress={() => switchLayout('carousel')} testID="layout-carousel" />
            </View>
            <View style={m.strip}>
              {slides.map((x, i) => (
                <TouchableOpacity key={x.r2_key} style={m.slide} onPress={kind === 'image' ? () => tagPhoto(i) : undefined} testID={`slide-${i}`}>
                  {x.local || x.url ? <Image source={{ uri: x.local || x.url }} style={m.img} /> : null}
                  <Text style={m.n}>{i + 1}</Text>
                  <TouchableOpacity style={m.x} onPress={() => setSlides(v => v.filter((_, j) => j !== i))} testID={`remove-${i}`}><Text style={m.xt}>×</Text></TouchableOpacity>
                </TouchableOpacity>
              ))}
              {room > 0 ? <TouchableOpacity style={[m.slide, m.add]} onPress={add} disabled={busy} testID="add-media"><Text style={m.plus}>+</Text></TouchableOpacity> : null}
            </View>
            {progress ? <Text style={b.hint}>{progress}</Text> : null}
            <Text style={b.hint}>{CP.mediaHint(kind)}</Text>
            <Warn text={CP.music} testID="music" />
            {kind === 'image' ? (
              <>
                <Text style={b.label}>{CP.tagLook}</Text>
                <View style={base.chips}>
                  {Object.keys(CP.tagStyles).map(k => <Chip key={k} label={CP.tagStyles[k]} selected={look === k} onPress={() => setLook(k)} testID={`look-${k}`} />)}
                </View>
              </>
            ) : null}
            <ErrorLine text={err} />
          </ScrollView>
          <Footer label={CP.next} disabled={busy || !slides.length} busy={busy} onPress={next} />
        </>
      )}
    </View>
  );
}

const m = StyleSheet.create({
  strip: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  slide: { width: 86, height: 108, borderRadius: 10, backgroundColor: T.surface, marginRight: 8, marginBottom: 8, overflow: 'hidden' },
  img: { width: '100%', height: '100%' },
  n: { position: 'absolute', left: 6, top: 6, fontFamily: fonts.sansBold, fontSize: 11, color: T.bg, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8, paddingHorizontal: 5, overflow: 'hidden' },
  x: { position: 'absolute', right: 4, top: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  xt: { color: T.bg, fontFamily: fonts.sansBold, fontSize: 14, marginTop: -2 },
  add: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: T.ink3, alignItems: 'center', justifyContent: 'center', backgroundColor: T.bg },
  plus: { fontFamily: fonts.sansBold, fontSize: 26, color: T.ink2 },
});
