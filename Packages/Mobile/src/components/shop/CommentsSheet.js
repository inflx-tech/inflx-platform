/**
 * Comments, as a sheet that comes up from the bottom of the screen she is on
 * (shopper-feed-sound-comments-sheet · board C1–C3).
 *
 * It used to be a page of its own (F6): a tap on the comment mark left the post. Now the post
 * stays where it is, the comments rise over the lower part of it, and closing them (✕, a tap above
 * the sheet, Back) leaves her exactly where she was.
 *
 * What comments ARE is unchanged from the page (follower-app-v2 · board F6 · rules v1.7 §4.15):
 * anyone can read, newest first; liking and commenting ask a guest to sign in; any comment can be
 * reported; text only, up to 300 characters.
 *   F7  back from signing in she is shown as signed in, with the box to write
 *   N1  a post that has ended says so in the server's own sentence, with nothing to retry
 *   N5  the older comments load as she reaches the end of the list (30 at a time)
 *
 * The sheet is a Modal, and a Modal stays on top of every page. So when she goes to sign in it
 * steps aside (`away`) and comes back, read again, when this screen is in front once more.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, Pressable, Modal, KeyboardAvoidingView, Platform, StyleSheet, Dimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { followerApi } from '../../services/api';
import { CS } from './copyShop';
import { Avatar, PrimaryBtn, Loading, Empty, C } from './bitsShop';
import { engaged } from './engaged';
import { track } from '../../services/events';
import { fonts, settingsTokens as T } from '../../theme/tokens';

/** How much of the screen the sheet takes: the post stays in sight above it. */
export const SHEET_PART = 0.72;

export default function CommentsSheet({ post, visible, onClose, navigation, surface = 'post' }) {
  const postId = post ? post.id : null;
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [reported, setReported] = useState({});
  const [gone, setGone] = useState(null);       // N1: the post has ended — the server's own sentence
  const [away, setAway] = useState(false);      // the sign-in page is open over this screen
  const awayRef = useRef(false);
  const older = useRef(false);      // the next older ones are on their way
  const noOlder = useRef(false);    // the server had none older to give
  const asked = useRef(0);          // which read is the newest — a slow answer for another post is dropped

  const load = useCallback(async () => {
    if (!postId) return;
    asked.current += 1;
    const mine = asked.current;
    const res = await followerApi.comments(postId);
    if (mine !== asked.current) return;
    // A re-read that fails leaves what she is reading on the screen; only a first read can fail the sheet.
    if (!res || !res.success) {
      // N1: an ended post is not a failed connection — say what the server says, with nothing to retry.
      if (res && res.error && res.error.code === 'NOT_FOUND' && res.error.message) { setGone(res.error.message); setStatus('error'); return; }
      setStatus((was) => (was === 'ready' ? was : 'error'));
      return;
    }
    setGone(null);
    noOlder.current = false;
    setData(res.data); setStatus('ready');
    // The number on the post's own card follows what was just read.
    engaged.setPost(postId, { comments: res.data.total });
  }, [postId]);

  // Opened: its comments are read. For ANOTHER post the sheet starts clean; for the same post
  // again, what she was reading stays while it is read afresh, and so does what she was writing.
  const shownFor = useRef(null);
  useEffect(() => {
    if (!visible || !postId) return;
    if (shownFor.current !== postId) {
      shownFor.current = postId;
      setData(null); setStatus('loading'); setText(''); setError(''); setReported({}); setGone(null);
    }
    awayRef.current = false; setAway(false);
    load();
  }, [visible, postId, load]);

  // F7 — back from signing in: the sheet returns, read again, so the box to write is there.
  useFocusEffect(useCallback(() => {
    if (!awayRef.current) return;
    awayRef.current = false; setAway(false);
    load();
  }, [load]));

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
    track('comment', postId, surface);
    setText('');
    load();
  }

  async function report(c) {
    const res = await followerApi.reportComment(c.id);
    if (res && res.success) setReported((r) => ({ ...r, [c.id]: true }));
  }

  function signIn() {
    awayRef.current = true; setAway(true);
    if (navigation) navigation.navigate('FollowerLogin', { reason: 'comment' });
  }

  if (!post) return null;
  const height = Math.round(Dimensions.get('window').height * SHEET_PART);
  const title = status === 'ready' && data ? CS.comments(data.total) : CS.comments(post.counts ? post.counts.comments : 0);

  return (
    <Modal visible={visible && !away} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={st.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" testID="comments-sheet-dim" />
        {/* As tall as SHEET_PART of the screen; when the keypad takes that room, as tall as what is left. */}
        <View style={[st.sheet, { height, maxHeight: '100%' }]} testID="comments-sheet">
          <View style={st.grip} />
          <View style={st.head}>
            <Text style={st.title} testID="comments-title">{title}</Text>
            <TouchableOpacity onPress={onClose} style={st.x} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} testID="comments-sheet-close"
              accessibilityRole="button" accessibilityLabel="Close">
              <Icon name="close" size={20} color={C.ink} />
            </TouchableOpacity>
          </View>

          {status === 'loading' ? <Loading /> : status === 'error' ? (
            gone ? <Empty title={gone} testID="comments-gone" /> : <Empty title={CS.loadError} action={CS.retry} onAction={load} />
          ) : (
            <>
              <FlatList
                data={data.comments}
                keyExtractor={(c) => c.id}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 12 }}
                keyboardShouldPersistTaps="handled"
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
                  <PrimaryBtn label={CS.signInCta} onPress={signIn} testID="comments-sign-in-cta" />
                </View>
              )}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.42)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: 'hidden' },
  grip: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: C.border, marginTop: 8 },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 8, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  title: { flex: 1, fontFamily: fonts.sansBold, fontSize: 15, color: C.ink },
  x: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
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
