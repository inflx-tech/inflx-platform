/**
 * post-performance-v2 — the pieces every screen draws under a link (board S1, B1–B4, C1–C4):
 *   StatLine    the one line: numbers in bold, then the time; or the state's sentence in its tone
 *               (waiting = blue, a problem = orange, gone = red).
 *   SocialNums  the three numbers as boxes (views · likes · comments) with the time line under them
 *               (B1, B4, C4); falls back to the one line when there are no numbers.
 *   SocialLine  the post's line: "On social media · 60,900 views · 4,790 likes · 253 comments · 2 links".
 *   LinkCard    one link on the post stats screens: its place and date, the link, Open, the numbers.
 * Contract: features/post-performance-v2 · master rules v1.35 §13A
 */
import React from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { day10 } from '../shoot/copy10';
import { shortLink12 } from './bits12';
import { STATS, statLine, socialLine, indian } from './copyStats';

const TONE = { wait: T.state.waiting.fg, warn: T.state.yourMove.fg, gone: T.state.declined.fg, plain: T.ink2 };

export function StatLine({ stats, side = 'creator', testID, many = false, style }) {
  const line = statLine(stats, side);
  if (!line) return null;
  const text = line.text === STATS.story && many ? STATS.stories : line.text;
  return (
    <Text style={[k.line, { color: TONE[line.tone] || T.ink2 }, style]} testID={testID}>
      {line.numbers ? <Text style={k.numbers}>{line.numbers}</Text> : null}
      {line.numbers && text ? ' · ' : ''}
      {text}
    </Text>
  );
}

/** The three boxes. Drawn only when the link has numbers; otherwise the one line. */
export function SocialNums({ stats, side = 'brand', testID }) {
  const line = statLine(stats, side);
  if (!line) return null;
  const hasNumbers = !!(stats && stats.updatedAt) && ['ok', 'stopped', 'unreadable', 'other_account'].includes(stats.state) && !(stats.state === 'other_account' && side !== 'brand');
  if (!hasNumbers) return <StatLine stats={stats} side={side} testID={testID} />;
  return (
    <View testID={testID}>
      <View style={k.nums}>
        <View style={k.stat}><Text style={k.statV}>{stats.views == null ? '—' : indian(stats.views)}</Text><Text style={k.statL}>{STATS.views}</Text></View>
        <View style={k.stat}><Text style={k.statV}>{stats.likesHidden ? '—' : indian(stats.likes)}</Text><Text style={k.statL}>{stats.likesHidden ? STATS.likesHidden.toLowerCase() : STATS.likes}</Text></View>
        <View style={k.stat}><Text style={k.statV}>{stats.commentsOff ? '—' : indian(stats.comments)}</Text><Text style={k.statL}>{stats.commentsOff ? STATS.commentsOff.toLowerCase() : STATS.comments}</Text></View>
      </View>
      <Text style={[k.line, { color: TONE[line.tone] || T.ink2 }]} testID={testID ? `${testID}-when` : undefined}>{line.text}</Text>
    </View>
  );
}

/** "On social media · …" under a post (B3, C3), or "Social links not added yet" in blue. */
export function SocialLine({ sum, side = 'creator', testID, style }) {
  const line = socialLine(sum, side);
  if (!line) return null;
  if (!line.tail) return <Text style={[k.line, { color: TONE[line.tone] || T.ink2 }, style]} testID={testID}>{line.text}</Text>;
  return (
    <Text style={[k.line, { color: TONE[line.tone] || T.ink2 }, style]} testID={testID}>
      <Text style={k.numbers}>{line.text}</Text>{` · ${line.tail}`}
    </Text>
  );
}

/** One link on the post stats screens (B4, C4): "Instagram reel · 10 Oct", the link, Open, the numbers. */
export function LinkCard({ item, side = 'creator', testID }) {
  if (!item) return null;
  const open = () => Linking.openURL(item.url).catch(() => {});
  return (
    <View style={k.card} testID={testID}>
      <View style={k.head}>
        <View style={{ flex: 1 }}>
          <Text style={k.title}>{item.label}{item.date ? ` · ${day10(item.date)}` : ''}</Text>
          <TouchableOpacity onPress={open} accessibilityRole="link" testID={testID ? `${testID}-link` : undefined}><Text style={k.link} numberOfLines={1}>{shortLink12(item.url)}</Text></TouchableOpacity>
        </View>
        <TouchableOpacity onPress={open} accessibilityRole="button" testID={testID ? `${testID}-open` : undefined}><Text style={k.open}>Open</Text></TouchableOpacity>
      </View>
      <SocialNums stats={item.stats} side={side} testID={testID ? `${testID}-nums` : undefined} />
    </View>
  );
}

const k = StyleSheet.create({
  line: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2, lineHeight: 18, marginTop: 4 },
  numbers: { fontFamily: fonts.sansBold, color: T.ink },
  nums: { flexDirection: 'row', gap: 6, marginTop: 6 },
  stat: { flex: 1, borderWidth: 1, borderColor: T.border, borderRadius: 10, paddingVertical: 6, alignItems: 'center' },
  statV: { fontFamily: fonts.sansBold, fontSize: 14.5, color: T.ink },
  statL: { fontFamily: fonts.sansRegular, fontSize: 10.5, color: T.ink3 },
  card: { borderRadius: 12, borderWidth: 1, borderColor: T.border, padding: 12, marginBottom: 8, backgroundColor: '#FFFFFF' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink },
  link: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, marginTop: 1 },
  open: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: T.ink, textDecorationLine: 'underline' },
});
