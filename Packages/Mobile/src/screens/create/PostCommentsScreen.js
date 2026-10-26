/**
 * PostCommentsScreen — C5 her post's comments: newest first, her replies under them, hidden ones
 * greyed with Unhide; Reply opens the box, one yellow Send. The brand opens the same screen from its
 * post stats (B5) read-only: visible comments and her replies, no buttons.
 * Contract: features/post-engagement-stats · rules §4.15 · board v1 (locked 26 Oct 2026)
 */
import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { influencerApi, brandApi } from '../../services/api';
import { Skeleton, LoadError, useToast } from '../../components/settings/feedback';
import { PrimaryButton, TextButton } from '../../components/settings/primitives';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
// ui-walk-fixes rule 3: a screen someone types on scrolls in a FormScroll, never a plain ScrollView.
import { FormScroll } from '../../components/shell/FormScroll';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { INFLX } from '../../components/content/copyInflx';
import { s as b } from '../../components/create/bitsCreate';

export default function PostCommentsScreen({ navigation, route }) {
  const { postId, title, brand } = route.params || {};
  const [d, setD] = useState(null);
  const [status, setStatus] = useState('loading');
  const [replyTo, setReplyTo] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const { toast, show } = useToast();

  const load = useCallback(async () => {
    const r = brand ? await brandApi.setPostComments(brand.campaignId, brand.setId, postId) : await influencerApi.postComments(postId);
    if (!r || !r.success) { setStatus('error'); return; }
    setD(r.data); setStatus('ready');
  }, [postId, brand]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const fail = (r) => show((r && r.error && r.error.message) || '');

  async function send() {
    const body = text.trim();
    if (!body || !replyTo || busy) return;
    setBusy(true);
    const r = await influencerApi.postReply(postId, { reply_to: replyTo, body });
    setBusy(false);
    if (!r || !r.success) { fail(r); return; }
    setText(''); setReplyTo(null);
    load();
  }
  async function toggleHidden(c) {
    const r = c.hidden ? await influencerApi.commentUnhide(c.id) : await influencerApi.commentHide(c.id);
    if (!r || !r.success) { fail(r); return; }
    load();
  }

  const readOnly = !!brand;
  return (
    <View style={base.screen} testID="post-comments">
      <Header title={INFLX.title(title || (d && d.post_title) || '')} onBack={() => navigation.goBack()} />
      {status === 'loading' ? <Skeleton /> : status === 'error' ? <LoadError onRetry={load} /> : (
        <>
          <FormScroll contentContainerStyle={st.body} testID="comments-scroll">
            <Text style={b.rowMeta} testID="comments-sub">
              {INFLX.sub(d.total)}{readOnly ? ` · ${INFLX.readOnly(d.creator_name)}` : ''}
            </Text>
            {d.comments.length ? d.comments.map((c) => (
              <View key={c.id} style={[st.card, c.hidden ? st.dim : null]} testID={`comment-${c.id}`}>
                <View style={st.top}><Text style={st.name}>{c.author.name}</Text><Text style={st.ago}>{c.ago}</Text></View>
                <Text style={st.body}>{c.body}</Text>
                {!readOnly && !c.hidden ? (
                  <View style={st.actions}>
                    <TextButton label={INFLX.reply} onPress={() => { setReplyTo(c.id); setText(''); }} testID={`reply-${c.id}`} />
                    <TextButton label={INFLX.hide} onPress={() => toggleHidden(c)} testID={`hide-${c.id}`} />
                  </View>
                ) : null}
                {!readOnly && c.hidden ? (
                  <View style={st.actions}>
                    <Text style={st.hiddenLine} testID={`hidden-${c.id}`}>{INFLX.hiddenLine}</Text>
                    <TextButton label={INFLX.unhide} onPress={() => toggleHidden(c)} testID={`unhide-${c.id}`} />
                  </View>
                ) : null}
                {(c.replies || []).map((r) => (
                  <View key={r.id} style={st.reply} testID={`reply-row-${r.id}`}>
                    <View style={st.top}>
                      <View style={st.who}><Text style={st.name}>{readOnly ? r.author.name : INFLX.you}</Text>{readOnly ? <Text style={st.tag}>{INFLX.creatorTag}</Text> : null}</View>
                      <Text style={st.ago}>{r.ago}</Text>
                    </View>
                    <Text style={st.body}>{r.body}</Text>
                  </View>
                ))}
              </View>
            )) : <Text style={b.hint}>{INFLX.none}</Text>}
          </FormScroll>
          {!readOnly && replyTo ? (
            <View style={st.bar} testID="reply-bar">
              <TextInput
                style={st.input} value={text} onChangeText={setText} maxLength={300} multiline
                placeholder={INFLX.replyAs(d.creator_name)} placeholderTextColor={T.ink3} testID="reply-input" />
              <View style={st.barRow}>
                <Text style={st.counter}>{INFLX.counter(text.length)}</Text>
                <TouchableOpacity onPress={() => { setReplyTo(null); setText(''); }} testID="reply-cancel"><Text style={st.cancel}>{INFLX.cancel}</Text></TouchableOpacity>
              </View>
              <PrimaryButton label={INFLX.send} onPress={send} disabled={!text.trim() || busy} busy={busy} testID="reply-send" />
            </View>
          ) : null}
        </>
      )}
      {toast}
    </View>
  );
}

const st = StyleSheet.create({
  body: { padding: 16, paddingBottom: 24 },
  card: { borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 11, marginTop: 10 },
  dim: { opacity: 0.55 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  name: { fontFamily: fonts.sansBold, fontSize: 12.5, color: T.ink },
  who: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tag: { fontFamily: fonts.sansRegular, fontSize: 10.5, color: T.ink2, borderWidth: 1, borderColor: T.border, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  ago: { fontFamily: fonts.sansRegular, fontSize: 11, color: T.ink3 },
  body: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink, lineHeight: 18 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4 },
  hiddenLine: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: T.ink2 },
  reply: { marginTop: 8, marginLeft: 12, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: T.border },
  bar: { borderTopWidth: 1, borderTopColor: T.border, padding: 12, backgroundColor: T.bg },
  input: { minHeight: 44, maxHeight: 120, borderWidth: 1.5, borderColor: T.ink, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 8, fontFamily: fonts.sansRegular, fontSize: 13.5, color: T.ink },
  barRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 6 },
  counter: { fontFamily: fonts.sansRegular, fontSize: 11, color: T.ink3 },
  cancel: { fontFamily: fonts.sansBold, fontSize: 12, color: T.ink2 },
});
