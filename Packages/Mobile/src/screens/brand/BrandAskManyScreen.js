import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ig } from '../../theme/ig';
import { brandApi } from '../../services/api';
// Dates are chosen, not typed. Contract: features/collab-terms-by-aim (item 2)
import DateField from '../../components/DateField';

/**
 * BrandAskManyScreen — asking a group, or everyone matching a filter.
 * Contract: features/stage-1-find-each-other-and-agree
 *
 * The reach funnel comes FIRST, always: matched → reachable → will be sent, with the
 * reason for every drop named. A brand who asks for 41 and silently reaches 30 assumes
 * eleven people ignored them. Naming muted, opted-out, in-cooldown and already-asked
 * turns a mystery into a fact.
 *
 * Every number here is already computed on the server — matched, reachable, each drop
 * reason and the cap — by a preview that was built long ago and has never had a screen
 * on any surface. This screen is the first thing to ask for it.
 *
 * Sending to many produces MANY separate conversations, never one shared deal. That is
 * stated on screen, because "ask the group" otherwise implies a single negotiation.
 */
const AIMS = [
  { key: 'conversion', label: 'Pay per sale' },
  { key: 'engagement', label: 'Pay for content' },
  { key: 'hybrid', label: 'Fee + commission' },
];

export default function BrandAskManyScreen({ route, navigation }) {
  const { groupId, groupName, filters } = route.params || {};
  const isGroup = !!groupId;

  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(!isGroup);   // a group has no filter to preview
  const [aim, setAim] = useState('conversion');
  const [pct, setPct] = useState('');
  const [fee, setFee] = useState('');
  const [postBy, setPostBy] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (isGroup) return;
    (async () => {
      const res = await brandApi.previewBroadcast(filters || {});
      if (res.success) setPreview(res.data);
      setLoading(false);
    })();
  }, [isGroup, filters]);

  async function send() {
    const terms = { aim, money: {}, time: {} };
    if (pct.trim() !== '') terms.money.commission_pct = Number(pct);
    if (fee.trim() !== '') terms.money.fee = Number(fee);
    if (postBy.trim() !== '') terms.time.post_by = postBy.trim();

    if (Object.keys(terms.money).length === 0) {
      return Alert.alert('Set the money first', 'A commission or a fee — otherwise there is nothing to agree.');
    }

    setBusy(true);
    const res = isGroup
      ? await brandApi.askGroup(groupId, terms, message || null)
      : await brandApi.askMany(filters || {}, terms, message || null);
    setBusy(false);

    if (!res.success) return Alert.alert('Could not send', res.error?.message || 'Please try again.');
    setResult(res.data);
  }

  // ── After sending: the honest outcome, including who was skipped and why ────
  if (result) {
    const skipped = result.skipped || [];
    return (
      <View style={s.container}>
        <View style={s.nav}>
          <View style={{ flex: 1 }}>
            <Text style={s.navTitle}>Sent</Text>
            <Text style={s.navSub}>{isGroup ? String(groupName || '').toUpperCase() : 'BY FILTER'}</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.popToTop()} style={s.close} activeOpacity={0.6}>
            <Icon name="close" size={22} color={ig.text} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <View style={s.bigNum}>
            <Text style={s.bigN}>{result.sent_count}</Text>
            <Text style={s.bigL}>
              {result.sent_count === 1 ? 'creator was asked' : 'creators were asked'}
            </Text>
          </View>

          {skipped.length > 0 && (
            <View style={s.skipBox}>
              <Text style={s.skipH}>{skipped.length} skipped, and why</Text>
              {skipped.map((sk, i) => (
                <Text key={i} style={s.skipT}>• {sk.reason}</Text>
              ))}
            </View>
          )}

          <Text style={s.note}>
            {result.sent_count === 1
              ? 'That is one conversation, negotiated on its own.'
              : `Those are ${result.sent_count} separate conversations. You negotiate with each one on their own, and may end up with ${result.sent_count} different deals — that is intended.`}
          </Text>

          <TouchableOpacity style={s.pri} onPress={() => navigation.popToTop()} activeOpacity={0.85}>
            <Text style={s.priT}>Back to Creators</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.container}>
        <View style={s.nav}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.back} activeOpacity={0.6}>
            <Icon name="chevron-left" size={24} color={ig.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.navTitle}>{isGroup ? 'Ask the group' : 'Ask many'}</Text>
            <Text style={s.navSub}>{isGroup ? String(groupName || '').toUpperCase() : 'ONE SET OF TERMS, MANY CREATORS'}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {/* The funnel — first, always. */}
          {!isGroup && (
            <View style={s.sec}>
              <Text style={s.secH}>Who this reaches</Text>
              {loading ? (
                <ActivityIndicator color={ig.text} style={{ marginVertical: 12 }} />
              ) : preview ? (
                <View style={s.funnel}>
                  <View style={s.fTop}>
                    <Text style={s.fTopN}>{preview.matched}</Text>
                    <Text style={s.fTopL}>MATCH WHAT{'\n'}YOU ASKED FOR</Text>
                  </View>
                  <View style={s.fRow}>
                    <Text style={[s.fN, { color: ig.green }]}>{preview.reachable}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.fL}>can be reached</Text>
                      {(preview.drops || preview.reasons || []).length > 0 && (
                        <Text style={s.fSmall}>
                          {(preview.drops || preview.reasons || []).map(d => d.reason || d).join(' · ')}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={s.fRow}>
                    <Text style={s.fN}>{Math.min(preview.reachable, preview.cap ?? preview.reachable)}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.fL}>will be sent</Text>
                      {preview.cap != null && preview.reachable > preview.cap && (
                        <Text style={s.fSmall}>
                          {preview.reachable - preview.cap} left out — your limit is {preview.cap} in one go
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              ) : (
                <Text style={s.muted}>Could not work out who this reaches. Try again.</Text>
              )}
            </View>
          )}

          {isGroup && (
            <View style={s.sec}>
              <View style={s.info}>
                <Icon name="information-outline" size={15} color={ig.blue} />
                <Text style={s.infoT}>
                  Everyone on this list is checked before sending — anyone who has muted brand
                  requests, or already has an open request from you, is named rather than
                  silently dropped.
                </Text>
              </View>
            </View>
          )}

          <View style={s.sec}>
            <Text style={s.secH}>The terms they all get</Text>

            <Text style={s.label}>What you want from it</Text>
            <View style={s.aims}>
              {AIMS.map(a => (
                <TouchableOpacity
                  key={a.key}
                  style={[s.aim, aim === a.key && s.aimOn]}
                  onPress={() => setAim(a.key)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.aimT, aim === a.key && s.aimTOn]}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {aim !== 'engagement' && (
              <>
                <Text style={s.label}>Commission %</Text>
                <TextInput style={s.input} keyboardType="numeric" value={pct} onChangeText={setPct} placeholder="15" placeholderTextColor={ig.mut2} />
              </>
            )}
            {aim !== 'conversion' && (
              <>
                <Text style={s.label}>Fee ₹</Text>
                <TextInput style={s.input} keyboardType="numeric" value={fee} onChangeText={setFee} placeholder="12000" placeholderTextColor={ig.mut2} />
              </>
            )}

            <Text style={s.label}>Post by</Text>
            <DateField value={postBy} onChange={setPostBy} style={{ marginBottom: 0 }} />

            <Text style={s.label}>A note (optional)</Text>
            <TextInput
              style={[s.input, { height: 76, textAlignVertical: 'top' }]}
              multiline value={message} onChangeText={setMessage}
              placeholder="Why you'd like to work with them"
              placeholderTextColor={ig.mut2}
            />
          </View>

          <View style={s.sec}>
            <View style={s.warn}>
              <Text style={s.warnT}>
                Each creator negotiates separately. You may end up with different deals —
                that is intended.
              </Text>
            </View>
            <TouchableOpacity style={s.pri} onPress={send} disabled={busy} activeOpacity={0.85}>
              <Text style={s.priT}>
                {busy ? 'Sending…'
                  : isGroup ? 'Send to the group'
                  : preview ? `Send to ${Math.min(preview.reachable, preview.cap ?? preview.reachable)}`
                  : 'Send'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: ig.bg },
  nav: { flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingBottom: 12, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  close: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 18, fontWeight: '800', color: ig.text },
  navSub: { fontSize: 10.5, fontWeight: '700', color: ig.mut, marginTop: 1, letterSpacing: 0.3 },

  sec: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  secH: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, color: ig.mut, textTransform: 'uppercase', marginBottom: 10 },

  funnel: { borderWidth: 1, borderColor: ig.line, borderRadius: 12, overflow: 'hidden' },
  fTop: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: ig.text, paddingHorizontal: 13, paddingVertical: 11 },
  fTopN: { fontSize: 22, fontWeight: '800', color: ig.bg },
  fTopL: { fontSize: 9.5, fontWeight: '800', color: ig.bg, letterSpacing: 0.4, lineHeight: 13 },
  fRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 13, paddingVertical: 10, borderTopWidth: 1, borderTopColor: ig.lineSoft },
  fN: { fontSize: 16, fontWeight: '800', color: ig.text, minWidth: 30 },
  fL: { fontSize: 12.5, fontWeight: '700', color: ig.text2 },
  fSmall: { fontSize: 10.5, color: ig.mut, fontWeight: '600', marginTop: 2, lineHeight: 15 },

  info: { flexDirection: 'row', gap: 8, backgroundColor: ig.blueBg, borderRadius: 11, padding: 12 },
  infoT: { flex: 1, fontSize: 11.5, color: ig.blue, fontWeight: '700', lineHeight: 17 },

  label: { fontSize: 9.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, color: ig.mut, marginBottom: 5, marginTop: 12 },
  input: { borderWidth: 1, borderColor: ig.line, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 10, fontSize: 14, fontWeight: '700', color: ig.text },

  aims: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' },
  aim: { borderWidth: 1, borderColor: ig.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  aimOn: { backgroundColor: ig.text, borderColor: ig.text },
  aimT: { fontSize: 11.5, fontWeight: '700', color: ig.mut },
  aimTOn: { color: ig.bg },

  warn: { backgroundColor: ig.bgSoft, borderRadius: 11, padding: 12 },
  warnT: { fontSize: 11.5, color: ig.mut, fontWeight: '700', lineHeight: 17 },

  pri: { backgroundColor: ig.text, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 11 },
  priT: { color: ig.bg, fontSize: 13.5, fontWeight: '800' },
  muted: { fontSize: 12, color: ig.mut, fontWeight: '600' },

  bigNum: { alignItems: 'center', paddingVertical: 22 },
  bigN: { fontSize: 46, fontWeight: '800', color: ig.text },
  bigL: { fontSize: 13, fontWeight: '700', color: ig.mut, marginTop: 4 },
  skipBox: { backgroundColor: ig.yBg, borderRadius: 11, padding: 13, marginTop: 6 },
  skipH: { fontSize: 12, fontWeight: '800', color: ig.yInk, marginBottom: 6 },
  skipT: { fontSize: 11.5, color: ig.yInk, fontWeight: '600', lineHeight: 18 },
  note: { fontSize: 12, color: ig.mut, fontWeight: '600', lineHeight: 18, marginTop: 14 },
});
