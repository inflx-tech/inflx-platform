/**
 * ReviewBlock — the two pieces both Profile tabs share (C4 / B3):
 *   CompletenessNote      amber "N things left" + the missing labels
 *   SubmitForReviewBlock  "Submit for review" (disabled until complete, with the hint),
 *                         "Sent for review · date" once submitted and still pending,
 *                         nothing at all once approved
 *   Dot                   the red dot on a row that owns a missing item
 * Contract: features/registration-and-profile · spec §6
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { PrimaryButton } from '../settings/primitives';
import { thingsLeft, listLabels, finishItems, REVIEW_COPY } from './completeness';

export function Dot({ testID }) {
  return <View style={s.dot} testID={testID} accessibilityLabel="Needs attention" />;
}

export function CompletenessNote({ completeness, userStatus }) {
  if (!completeness || completeness.complete || userStatus === 'approved') return null;
  const n = Math.max(0, Number(completeness.total || 0) - Number(completeness.done || 0));
  if (!n) return null;
  return (
    <View style={s.note} testID="completeness-note">
      <Text style={s.noteTitle} testID="completeness-count">{thingsLeft(n)}</Text>
      <Text style={s.noteBody}>{listLabels(completeness.missing_labels)}</Text>
    </View>
  );
}

export function SubmitForReviewBlock({ completeness, userStatus, submittedAt, onSubmit, busy }) {
  if (userStatus === 'approved') return null;
  if (submittedAt && userStatus === 'pending') {
    return <Text style={s.sent} testID="review-sent">{REVIEW_COPY.sent(submittedAt)}</Text>;
  }
  const complete = !!(completeness && completeness.complete);
  const n = completeness ? Math.max(0, Number(completeness.total || 0) - Number(completeness.done || 0)) : 0;
  return (
    <View style={s.block} testID="review-block">
      <PrimaryButton label={REVIEW_COPY.submit} onPress={onSubmit} disabled={!complete} busy={busy} busyLabel="Sending" testID="submit-for-review" />
      {!complete ? <Text style={s.hint} testID="submit-hint">{finishItems(n)}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.danger, marginRight: 8 },
  note: { marginHorizontal: 18, marginTop: 8, marginBottom: 6, backgroundColor: T.state.yourMove.bg, borderRadius: 12, padding: 12 },
  noteTitle: { fontFamily: fonts.sansBold, fontSize: 13.5, color: T.state.yourMove.fg },
  noteBody: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.state.yourMove.fg, marginTop: 2, lineHeight: 17 },
  block: { paddingHorizontal: 18, paddingTop: 18 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, textAlign: 'center', marginTop: 8 },
  sent: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: T.state.waiting.fg, textAlign: 'center', paddingHorizontal: 18, paddingTop: 18 },
});
