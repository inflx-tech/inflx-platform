/**
 * F6 Comments — anyone can read, newest first; liking and commenting ask a guest to sign in; any
 * comment can be reported. Text only, up to 300 characters.
 * Contract: features/follower-app-v2 · board F6 · rules v1.7 §4.15
 * The creator's reply and hide come with the post-performance board (Level 5).
 *
 * shopper-app-fixes:
 *   F7  The comments are read again every time this screen comes in front — so back from signing
 *       in she is shown as signed in, with the box to write. (They were read once, on opening, and
 *       she landed back on "Sign in to like and comment".)
 *   N5  The older comments load as she reaches the end of the list (30 at a time).
 */
import React, { useCallback, useRef, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { followerApi } from '../../services/api';
import { CS } from '../../components/shop/copyShop';
import { TopBar, Avatar, PrimaryBtn, Loading, Empty, C } from '../../components/shop/bitsShop';
import { track } from '../../services/events';
import { fonts, settingsTokens as T } from '../../theme/tokens';

export default function CommentsScreen({ navigation, route }) {
  const { postId } = route.params || {};
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [reported, setReported] = useState({});
  const [gone, setGone] = useState(null);       // N1: the post has ended — the server's own sentence
  const older = useRef(false);      // the next older ones are on their way
  const noOlder = useRef(false);    // the server had none older to give

  const load = useCallback(async () => {
    const res = await followerApi.comments(postId);
    // A re-read that fails leaves what she is reading on the screen; only a first read can fail the page.
    if (!res || !res.success) {
      // N1: an ended post is not a failed connection — say what the server says, with nothing to retry.
      if (res && res.error && res.error.code === 'NOT_FOUND' && res.error.message) { setGone(res.error.message); setStatus('error'); return; }
      setStatus((was) => (was === 'ready' ? was : 'error'));
      return;
    }
    setGone(null);
    noOlder.current = false;
    setData(res.data); setStatus('ready');
  }, [postId]);

  // F7 — on opening, and again whenever she comes back to it (from signing in).
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // N5 — the end of the list: the 30 before the oldest one shown.
  async function loadOlder() {
    const shown = data ? data.comments : [];
    if (older.current || noOlder.current || !shown.length || shown.length >= data.total) return;
    older.current = true;
    const res = await followerApi.comments(postId, shown[shown.length - 1].at);
    older.current = false;
    if (!res || !res.success) return;                       // asked again at the next reach of the end
    const page = res.data.comments || [];
    if (!page.length) { noOlder.current = true; return; }
    setData((d) => {
      if (!d) return d;
      const have = new Set(d.comments.map((c) => c.id));
      return { ...d, total: res.data.total, comments: [...d.comments, ...page.filter((c) => !have.has(c.id))] };
    });
  }

  async function send() {
    const body = text.trim();
    if (!body) { setError('Write something first.'); return; }
    setSending(true); setError('');
    const res = await followerApi.addComment(postId, body);
    setSending(false);
    if (!res || !res.success) { setError(res && res.error ? res.error.message : CS.loadError); return; }
    track('comment', postId, 'post');
    setText('');
    load();
  }

  async function report(c) {
    const res = await followerApi.reportComment(c.id);
    if (res && res.success) setReported((r) => ({ ...r, [c.id]: true }));
  }

  if (status === 'loading') return <SafeAreaView style={st.safe}><TopBar onBack={() => navigation.goBack()} /><Loading /></SafeAreaView>;
  if (status === 'error') {
    return (
      <SafeAreaView style={st.safe}>
        <TopBar onBack={() => navigation.goBack()} />
        {gone ? <Empty title={gone} testID="comments-gone" /> : <Empty title={CS.loadError} action={CS.retry} onAction={load} />}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={st.safe} edges={['top', 'bottom']}>
      <TopBar title={CS.comments(data.total)} onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          data={data.comments}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 12 }}
          onEndReached={loadOlder}
          onEndReachedThreshold={0.6}
          testID="comments-list"
          ListEmptyComponent={<Text style={[st.meta, { padding: 20, textAlign: 'center' }]}>{CS.noComments}</Text>}
          renderItem={({ item: c }) => (
            <View style={st.cmt} testID={`comment-${c.id}`}>
              <Avatar name={c.author.name} size={30} />
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={st.body}>
                  <Text style={st.name}>{c.author.name}{c.author.creator ? ` · ${CS.creatorTag}` : ''} </Text>{c.body}
                </Text>
                <Text style={st.meta}>
                  {c.ago}
                  {data.signed_in && c.can_report ? (
                    reported[c.id] ? <Text> · {CS.reported}</Text>
                      : <Text onPress={() => report(c)} style={{ textDecorationLine: 'underline' }} testID={`report-${c.id}`}> · {CS.report}</Text>
                  ) : null}
                </Text>
              </View>
            </View>
          )}
        />
        {data.signed_in ? (
          <View style={st.compose}>
            {error ? <Text style={st.err}>{error}</Text> : null}
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
              <TextInput value={text} onChangeText={(v) => setText(v.slice(0, 300))} placeholder={CS.addComment} placeholderTextColor={C.ink3}
                style={st.input} multiline maxLength={300} testID="comment-input" />
              <TouchableOpacity onPress={send} disabled={sending} style={st.send} testID="comment-send">
                <Text style={st.sendText}>{CS.send}</Text>
              </TouchableOpacity>
            </View>
            <Text style={st.counter}>{CS.counter(text.length)}</Text>
          </View>
        ) : (
          <View style={st.guest} testID="comments-sign-in">
            <Text style={st.guestTitle}>{data.sign_in.title}</Text>
            <Text style={st.meta}>{data.sign_in.body}</Text>
            <PrimaryBtn label={CS.signInCta} onPress={() => navigation.navigate('FollowerLogin', { reason: 'comment' })} testID="comments-sign-in-cta" />
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  cmt: { flexDirection: 'row', gap: 8, paddingVertical: 8 },
  name: { fontFamily: fonts.sansBold, color: C.ink },
  body: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: C.ink },
  meta: { fontFamily: fonts.sansRegular, fontSize: 11, color: C.ink3 },
  compose: { borderTopWidth: 1, borderTopColor: C.border, padding: 12, gap: 4 },
  input: { flex: 1, minHeight: 42, maxHeight: 110, borderWidth: 1.5, borderColor: C.border, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 9, fontFamily: fonts.sansRegular, fontSize: 13, color: C.ink },
  send: { height: 42, paddingHorizontal: 14, borderRadius: 12, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  sendText: { fontFamily: fonts.sansBold, fontSize: 13, color: C.ink },
  counter: { fontFamily: fonts.sansRegular, fontSize: 11, color: C.ink3, textAlign: 'right' },
  err: { fontFamily: fonts.sansSemiBold, fontSize: 11.5, color: T.danger },
  guest: { borderTopWidth: 1, borderTopColor: C.border, padding: 14, gap: 8, backgroundColor: C.surface },
  guestTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: C.ink },
});
