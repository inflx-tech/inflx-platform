/**
 * The Create tab's shared parts: the step header, choice cards, the state chip, the footer button,
 * the draft loader, and where a draft carries on.
 * Contract: features/shoppable-posts-v2 · boards P1–P20
 */
import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import { PrimaryButton } from '../settings/primitives';
import { CP, STATE_LABEL } from './copyCreate';
import { O20 } from '../ownbrand/copy20';

/** Where a post opens: a draft carries on at its step (4.2); anything else opens its status screen. */
export function routeFor(post) {
  if (!post) return null;
  if (post.state !== 'draft') return { name: 'PostStatus', params: { postId: post.id } };
  const step = post.draft_step || 3;
  if (step <= 3 || !post.kind) return { name: 'PostType', params: { postId: post.id } };
  if (post.kind === 'price' && step <= 5) return { name: 'PostPrice', params: { postId: post.id } };
  if (step === 4) return { name: 'PostOffer', params: { postId: post.id } };
  if (step === 5) return { name: 'PostProducts', params: { postId: post.id } };
  if (step === 6) return { name: 'PostTheme', params: { postId: post.id } };
  if (step === 7) return { name: 'PostMedia', params: { postId: post.id } };
  return { name: 'PostReview', params: { postId: post.id } };
}

/** The post, and (when asked) its options, loaded on every focus. */
export function useDraft(postId, { withOptions = false } = {}) {
  const [post, setPost] = useState(null);
  const [options, setOptions] = useState(null);
  const [status, setStatus] = useState('loading');
  const load = useCallback(async () => {
    const [p, o] = await Promise.all([influencerApi.getPost(postId), withOptions ? influencerApi.postOptions(postId) : Promise.resolve({ success: true, data: null })]);
    if (!p.success || !o.success) { setStatus('error'); return; }
    setPost(p.data.post); setOptions(o.data); setStatus('ready');
  }, [postId, withOptions]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  return { post, setPost, options, status, reload: load };
}

/**
 * `own` (item 20): a post for the brand he runs skips "Which collaboration?", so it has seven
 * steps — step 1 stays 1, every later step is one earlier.
 */
export function StepTop({ step, question, own }) {
  return (
    <View style={s.top}>
      {step ? <Text style={s.eyebrow} testID="step-count">{own ? O20.step(Math.max(1, step - 1)) : CP.step(step)}</Text> : null}
      <Text style={s.q}>{question}</Text>
    </View>
  );
}

export function ChoiceCard({ title, sub, meta, selected, disabled, onPress, logo, initials, testID, tag }) {
  return (
    <TouchableOpacity style={[s.card, selected && s.cardOn, disabled && s.cardOff]} onPress={onPress} disabled={disabled} testID={testID} accessibilityState={{ selected: !!selected, disabled: !!disabled }}>
      {logo || initials ? (
        logo ? <Image source={{ uri: logo }} style={s.logo} /> : <View style={s.logo}><Text style={s.initials}>{initials}</Text></View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={[s.cardTitle, disabled && s.dim]}>{title}</Text>
        {tag ? <Text style={s.cardTag} testID={testID ? `${testID}-tag` : undefined}>{tag}</Text> : null}
        {sub ? <Text style={[s.cardSub, disabled && s.dim]}>{sub}</Text> : null}
        {meta ? <Text style={[s.cardMeta, disabled && s.dim]}>{meta}</Text> : null}
      </View>
      {selected ? <Text style={s.tick}>✓</Text> : null}
    </TouchableOpacity>
  );
}

export const initialsOf = (name) => String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

const TONE = { live: 'active', approved: 'waiting', in_review: 'waiting', sent_back: 'yourMove', removed: 'ended', draft: 'ended' };
export function StateChip({ state }) {
  const tone = T.state[TONE[state] || 'ended'];
  return <Text style={[s.chip, { color: tone.fg, backgroundColor: tone.bg }]}>{STATE_LABEL[state] || state}</Text>;
}

export function Footer({ label, onPress, disabled, busy, testID }) {
  return (
    <View style={s.footer}>
      <PrimaryButton label={label} onPress={onPress} disabled={disabled} busy={busy} testID={testID || 'next'} />
    </View>
  );
}

export function Warn({ text, testID }) {
  if (!text) return null;
  return <View style={s.warn} testID={testID}><Text style={s.warnText}>⚠ {text}</Text></View>;
}

export function ErrorLine({ text }) {
  if (!text) return null;
  return <Text style={s.err} testID="step-error">{text}</Text>;
}

export const s = StyleSheet.create({
  top: { marginBottom: 12 },
  eyebrow: { fontFamily: fonts.sansBold, fontSize: 11, color: T.ink3, letterSpacing: 0.6, marginBottom: 4, textTransform: 'uppercase' },
  q: { fontFamily: fonts.sansBold, fontSize: 18, color: T.ink },
  card: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: T.border, borderRadius: 14, padding: 12, marginBottom: 10, backgroundColor: T.bg },
  cardOn: { borderColor: T.ink, borderWidth: 2, padding: 11 },
  cardOff: { backgroundColor: T.surface },
  cardTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: T.ink },
  cardSub: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2, marginTop: 3, lineHeight: 17 },
  cardMeta: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: T.ink3, marginTop: 4 },
  dim: { color: T.disabledText },
  cardTag: { alignSelf: 'flex-start', fontFamily: fonts.sansSemiBold, fontSize: 11, color: T.state.completed.fg, backgroundColor: T.state.completed.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden', marginTop: 4 },
  logo: { width: 40, height: 40, borderRadius: 20, backgroundColor: T.surface, marginRight: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initials: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink2 },
  tick: { fontFamily: fonts.sansBold, fontSize: 16, color: T.ink, marginLeft: 8 },
  chip: { fontFamily: fonts.sansSemiBold, fontSize: 11, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: T.border, backgroundColor: T.bg },
  warn: { backgroundColor: T.state.yourMove.bg, borderRadius: 10, padding: 10, marginVertical: 8 },
  warnText: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: T.state.yourMove.fg, lineHeight: 17 },
  err: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: T.danger, marginVertical: 6 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, lineHeight: 17, marginVertical: 6 },
  label: { fontFamily: fonts.sansBold, fontSize: 12, color: T.ink3, letterSpacing: 0.4, marginTop: 12, marginBottom: 8, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.border },
  rowName: { fontFamily: fonts.sansSemiBold, fontSize: 13.5, color: T.ink, flex: 1, marginRight: 8 },
  rowMeta: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2 },
  strike: { textDecorationLine: 'line-through', color: T.ink3 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: T.ink3, marginRight: 10, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: T.ink, borderColor: T.ink },
  boxTick: { color: T.bg, fontFamily: fonts.sansBold, fontSize: 13 },
  thumb: { width: 40, height: 50, borderRadius: 6, backgroundColor: T.surface, marginRight: 10 },
});
