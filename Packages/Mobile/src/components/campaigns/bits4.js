/**
 * Item 4 — the small pieces the Campaigns tab is built from: state chip, progress bar, counts
 * line, a text field with a counter, the campaign card (C1) and the set card (C6, C9).
 * Contract: features/item4-campaigns-sets · mockups C1, C6, C8, C9 · prompt §8
 */
import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { FieldError } from '../settings/primitives';
import { C4, STATE_TONE, countsLine4 } from './copy4';

/** Draft / Live / Completed / Expired / Date passed, on the item 2 state palette. */
export function StateChip4({ state, datePassed, testID }) {
  const key = state === 'draft' && datePassed ? 'datePassed' : state;
  const tone = T.state[STATE_TONE[key] || 'ended'];
  return (
    <View style={[st.chip, { backgroundColor: tone.bg }]} testID={testID || `chip-${key}`}>
      <Text style={[st.chipText, { color: tone.fg }]}>{C4.chips[key] || state}</Text>
    </View>
  );
}

/**
 * The bar fills to the invited count: green for signed, blue for waiting, and the rest stays
 * grey (APPROVAL.md Q9). Nothing renders for zero invitations.
 */
export function ProgressBar4({ counts, testID }) {
  if (!counts || !counts.invited) return null;
  const g = counts.signed / counts.invited, b = counts.waiting / counts.invited;
  return (
    <View style={st.bar} testID={testID || 'progress-bar'}>
      <View style={[st.seg, { flex: g, backgroundColor: T.state.active.fg }]} />
      <View style={[st.seg, { flex: b, backgroundColor: T.state.waiting.fg }]} />
      <View style={[st.seg, { flex: Math.max(0, 1 - g - b) }]} />
    </View>
  );
}

export function CountsLine4({ counts, detail, testID }) {
  const line = countsLine4(counts, { detail });
  if (!line) return null;
  return <Text style={st.muted} testID={testID || 'counts-line'}>{line}</Text>;
}

/** A labelled text field with an optional character counter and hint. */
export function TextField4({ label, value, onChangeText, placeholder, max, hint, error, multiline, required, autoFocus, testID }) {
  const n = (value || '').length;
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={st.label}>{label}{required ? <Text style={{ color: T.danger }}> *</Text> : null}</Text> : null}
      <TextInput
        style={[st.input, multiline && st.inputMulti, error && st.inputError]}
        value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={T.ink3}
        maxLength={max} multiline={!!multiline} autoFocus={autoFocus} testID={testID}
      />
      {max ? <Text style={[st.counter, n > max && { color: T.danger }]} testID={testID ? `${testID}-counter` : undefined}>{`${n} / ${max}`}</Text> : null}
      {hint ? <Text style={st.hint}>{hint}</Text> : null}
      <FieldError text={error} />
    </View>
  );
}

/** C1 — one campaign. */
export function CampaignCard4({ c, onPress }) {
  const draft = c.state === 'draft';
  const line = draft ? C4.list.draftLine(c.setCount) : (c.nextPostingDate ? C4.list.setsLine(c.setCount, c.nextPostingDate) : C4.list.setsLineNoNext(c.setCount));
  return (
    <TouchableOpacity style={st.card} onPress={onPress} activeOpacity={0.8} testID={`campaign-card-${c.id}`} accessibilityRole="button">
      <View style={st.row}>
        <Text style={st.name} numberOfLines={2}>{c.name}</Text>
        <StateChip4 state={c.state} />
      </View>
      <Text style={st.muted}>{line}</Text>
      {!draft ? <ProgressBar4 counts={c.counts} /> : null}
      {!draft ? <CountsLine4 counts={c.counts} /> : null}
    </TouchableOpacity>
  );
}

/** C6 / C9 — one set inside the campaign detail. `children` renders the state-specific extras. */
export function SetCard4({ s, onPress, children }) {
  const past = s.state === 'expired' || s.state === 'completed';
  return (
    <TouchableOpacity style={st.card} onPress={onPress} activeOpacity={0.8} testID={`set-card-${s.id}`} accessibilityRole="button">
      <View style={st.row}>
        <Text style={st.setName} numberOfLines={2}>{s.name}</Text>
        <StateChip4 state={s.state} datePassed={s.datePassed} />
      </View>
      {past ? (
        <Text style={st.muted}>{C4.detail.posted(s)}</Text>
      ) : (
        <>
          <Text style={st.muted}>{C4.detail.meta(s)}</Text>
          <Text style={st.muted}>{s.postingDate ? C4.detail.dates(s.postingDate, s.cutoff) : C4.detail.noDate}</Text>
        </>
      )}
      {s.state === 'live' ? <><ProgressBar4 counts={s.counts} /><CountsLine4 counts={s.counts} /></> : null}
      {s.state === 'draft' && !s.datePassed ? <Text style={st.muted}>{C4.detail.noCreators}</Text> : null}
      {s.state === 'completed' ? <Text style={st.muted}>{C4.setDetail.completedLine(s.counts.signed)}</Text> : null}
      {children}
    </TouchableOpacity>
  );
}

export const st = StyleSheet.create({
  chip: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, alignSelf: 'flex-start' },
  chipText: { fontFamily: fonts.sansBold, fontSize: 11 },
  bar: { height: 6, borderRadius: 99, backgroundColor: T.surface, overflow: 'hidden', flexDirection: 'row', marginTop: 4 },
  seg: { height: '100%' },
  muted: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, marginTop: 4 },
  label: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink, marginBottom: 6 },
  input: { height: 44, borderWidth: 1.5, borderColor: T.border, borderRadius: 12, paddingHorizontal: 12, fontFamily: fonts.sansRegular, fontSize: 14, color: T.ink, backgroundColor: T.bg },
  inputMulti: { height: 84, paddingTop: 10, textAlignVertical: 'top' },
  inputError: { borderColor: T.danger },
  counter: { fontFamily: fonts.sansRegular, fontSize: 11, color: T.ink3, textAlign: 'right', marginTop: 4 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, marginTop: 4, lineHeight: 16 },
  card: { borderWidth: 1, borderColor: T.border, borderRadius: 14, padding: 12, marginBottom: 10, backgroundColor: T.bg },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1, fontFamily: fonts.sansBold, fontSize: 15, color: T.ink },
  setName: { flex: 1, fontFamily: fonts.sansBold, fontSize: 14, color: T.ink },
});
