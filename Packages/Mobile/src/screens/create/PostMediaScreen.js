/**
 * PostMediaScreen — P10 (step 7): photo or video, single or carousel (up to 10), the upload with the
 * copyrighted-music warning right where she uploads, and how product tags look. A saved photo can be
 * tapped to tag products on it (P11a). Files go straight to storage through the URL the server signs
 * (size and type locked), then the post keeps their keys.
 * Contract: features/shoppable-posts-v2 · rules §4.7 · founder Q3 (10 slides, 90 s a clip)
 *
 * shopper-walk-fixes (W15 · frame C3): a video she adds gets a picture taken from it on her phone.
 * The picture is uploaded through the post's own upload-url call as a JPEG, and its key rides on
 * that slide (`cover_r2_key`) in EVERY save of `media` from then on — the server replaces the list
 * whole, so a save without it would drop the picture. The slide's tile shows the picture with a
 * play mark and the video's length (it was an <Image> pointed at a video, which draws nothing),
 * and a tap plays the video in the file viewer. A picture that cannot be made or uploaded never
 * stops the video being added.
 */
import React, { useEffect, useState } from 'react';
import { View, ScrollView, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { prepareVideo, makeVideoPicture } from '../../utils/videoPrep';
import { influencerApi, uploadContentFile } from '../../services/api';
import { Skeleton, LoadError } from '../../components/settings/feedback';
import { Chip } from '../../components/settings/primitives';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { CP } from '../../components/create/copyCreate';
import { StepTop, Footer, ErrorLine, Warn, useDraft, s as b } from '../../components/create/bitsCreate';
import { VideoFace12 } from '../../components/content/bits12';
import { COVER_PUT_MS_12 } from '../../components/content/copy12';
import MediaViewer12 from '../../components/content/MediaViewer12';

const MAX = 10;
const MAX_VIDEO_S = 90;
/** The server keeps the picture taken from a post's video only up to 2 MB, and a heavier one would refuse the whole save. */
const COVER_MAX = 2 * 1024 * 1024;

export const isVideoSlide = (slide) => String((slide && slide.mime) || '').toLowerCase().startsWith('video/');

/**
 * W15 — the picture her phone takes from a video slide, sent to storage through the post's own
 * upload-url call as a JPEG. `{ key, uri }`, or null when there is none (an older app build, a
 * video the phone cannot read, a refusal, a lost signal). It never throws: the video is already
 * uploaded, and it is added with or without its picture.
 */
export async function uploadVideoPicture(postId, videoUri) {
  try {
    const picture = await makeVideoPicture(videoUri, { maxBytes: COVER_MAX });
    if (!picture) return null;
    const u = await influencerApi.postUploadUrl(postId, { content_type: 'image/jpeg', size_bytes: picture.size });
    if (!u || !u.success) return null;
    await uploadContentFile(u.data, picture.uri, { timeoutMs: COVER_PUT_MS_12 });
    return { key: u.data.key, uri: picture.uri };
  } catch (_) {
    return null;
  }
}

/** A slide as the server takes it. A video's picture goes with it on every save; a slide without one is sent as before. */
export const slideBody = ({ r2_key, mime, width, height, duration_s, cover_r2_key }) => (
  cover_r2_key ? { r2_key, mime, width, height, duration_s, cover_r2_key } : { r2_key, mime, width, height, duration_s });

/**
 * A post's video slides as the file viewer's files (frame C3: "Tapping it plays it"), and where
 * each plays from: her phone's own copy when she has just added it, else INFLX's address for it.
 */
export const slideFiles = (slides) => (slides || []).map((x) => ({ id: x.r2_key, kind: 'video' }));
export const slideLink = (slides) => (id) => {
  const x = (slides || []).find((y) => y.r2_key === id);
  const url = x && (x.local || x.url);
  return Promise.resolve(url ? { success: true, data: { view: { url, kind: 'video', mime: x.mime } } } : { success: false });
};

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
    // W15 — the video is up; now its picture, taken from the file that was uploaded. No picture is not a failure.
    const cover = kind === 'video' ? await uploadVideoPicture(postId, file.uri) : null;
    out.push({ r2_key: u.data.key, mime, width: a.width || null, height: a.height || null, duration_s: kind === 'video' ? Number(a.duration) || null : null, local: a.uri,
      ...(cover ? { cover_r2_key: cover.key, cover_local: cover.uri } : {}) });
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
  const [viewer, setViewer] = useState(null);           // a video she tapped: { label, files, index }

  useEffect(() => {
    if (!post) return;
    setKind(post.media_kind || 'image');
    setLayout(post.media_layout || 'carousel');
    setLook(post.tag_style || 'soft_editorial');
    // W15: a saved video's picture comes back with it, and must go out again with every save.
    setSlides(post.media.map(m => ({ r2_key: m.r2_key, mime: m.mime, width: m.width, height: m.height, duration_s: m.duration_s, url: m.url,
      ...(m.cover_r2_key ? { cover_r2_key: m.cover_r2_key, cover_url: m.cover_url || null } : {}) })));
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
    return { media_kind: kind, media_layout: layout, tag_style: look, media: slides.map(slideBody) };
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
              {slides.map((x, i) => {
                // C3 — a video: the picture taken from it (her phone's copy first), the play mark and
                // its length; with no picture, the dark tile. A tap plays it. A photo is as before.
                const video = isVideoSlide(x);
                return (
                  <TouchableOpacity key={x.r2_key} style={m.slide} testID={`slide-${i}`}
                    onPress={video ? () => setViewer({ label: CP.video, files: slideFiles(slides), index: i }) : kind === 'image' ? () => tagPhoto(i) : undefined}>
                    {video
                      ? <VideoFace12 url={x.cover_local || x.cover_url || null} durationS={x.duration_s} />
                      : x.local || x.url ? <Image source={{ uri: x.local || x.url }} style={m.img} /> : null}
                    <Text style={m.n}>{i + 1}</Text>
                    <TouchableOpacity style={m.x} onPress={() => setSlides(v => v.filter((_, j) => j !== i))} testID={`remove-${i}`}><Text style={m.xt}>×</Text></TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
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
      {/* C3 — a tapped video plays here, from her phone's copy or INFLX's address; nothing sits under it. */}
      <MediaViewer12 open={viewer} fetchUrl={slideLink(slides)} onClose={() => setViewer(null)} />
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
