/**
 * Item 19 — the pieces Home is drawn with (board item19-home-v3, BH1–BH6 / CH1–CH5).
 *
 *   HomeHead      the name and the bell with its unread count
 *   Section19     a section heading: title, count, and "See all ›" (the whole line opens the list)
 *   NeedCard19    one row of Needs you (or of a full Waiting list): who, one sentence, the context,
 *                 and ONE button (RowAction5) or one tag (StatusTag5) — never both
 *   WaitRows19    Waiting on others on Home: compact rows in one box
 *   MoneyLines19  the Wallet's own three lines (Figs17 / Fig17)
 *   CampaignRows19 / RunRows19   the fourth section
 *   StoreLink19   her store link in one line with Copy
 *
 * Row actions are RowAction5 — ink outline, never yellow. Home's only yellow button is on the
 * first-day screen (the mono rule: one main button per screen).
 * Contract: features/item19-home
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { RowAction5, StatusTag5 } from '../invitations/steps5';
import { Avatar } from '../../screens/brand/BrandBlockedCreatorsScreen';
import { Figs17, Fig17 } from '../wallet/bits17';
import { StateChip4 } from '../campaigns/bits4';
import { CopyButton } from '../create/bitsLinks';
import { H19, buttonFor } from './copy19';

/** The icon for a row that is not about one person. */
export const ROW_ICON = {
  pitch: 'send-outline', pool: 'account-multiple-outline', orders: 'package-variant-closed', wallet: 'wallet-outline',
  post: 'camera-outline', sentBack: 'undo-variant', instagram: 'instagram', youtube: 'youtube', paused: 'pause-circle-outline',
};

export function HomeHead({ title, unread = 0, onBell, top = 0 }) {
  return (
    <View style={[s.head, { paddingTop: top }]}>
      <Text style={s.title} numberOfLines={1} testID="home-title">{title}</Text>
      {onBell ? (
        <TouchableOpacity style={s.bell} onPress={onBell} accessibilityRole="button" accessibilityLabel={H19.bellLabel(unread)} testID="home-bell"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Icon name="bell-outline" size={20} color={T.ink} />
          {unread > 0 ? <View style={s.badge} testID="home-bell-count"><Text style={s.badgeText}>{unread > 9 ? '9+' : String(unread)}</Text></View> : null}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** A section heading. The whole line is the door when there is one. */
export function Section19({ title, count, urgent, link, onPress, testID }) {
  const body = (
    <View style={s.sec}>
      <Text style={s.secTitle}>
        {title}
        {count != null && count !== '' ? <Text style={urgent ? s.secCountUrgent : s.secCount}>{` · ${count}`}</Text> : null}
      </Text>
      {link && onPress ? (
        <View style={s.secLink}>
          <Text style={s.secLinkText}>{link}</Text>
          <Icon name="chevron-right" size={15} color={T.ink} />
        </View>
      ) : null}
    </View>
  );
  if (!onPress) return <View testID={testID}>{body}</View>;
  return <TouchableOpacity onPress={onPress} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={link ? `${title}, ${link}` : title} testID={testID}>{body}</TouchableOpacity>;
}

function Who({ who, size = 26 }) {
  if (who.type === 'creator') return <Avatar name={who.name} url={who.avatarUrl} size={size} />;
  if (who.type === 'brand') return <Avatar name={who.name} url={who.logoUrl} size={size} />;
  return <View style={[s.icon, { width: size, height: size, borderRadius: size / 2 }]}><Icon name={ROW_ICON[who.icon] || 'circle-outline'} size={14} color={T.ink} /></View>;
}

/** One row: Needs you (a button) or Waiting (a tag). */
export function NeedCard19({ row, side, onPress, testID }) {
  const waiting = row.side === 'waiting';
  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.85} accessibilityRole="button" testID={testID}>
      <View style={s.cardTop}>
        <Who who={row.who} />
        <Text style={s.cardName} numberOfLines={2}>{row.who.name}</Text>
        {row.delayed ? <StatusTag5 label={H19.delayed} tone="delayed" icon="alert-circle-outline" testID={testID ? `${testID}-delayed` : undefined} /> : null}
        {row.why ? <Text style={waiting ? s.whyCalm : s.why} numberOfLines={1} testID={testID ? `${testID}-why` : undefined}>{row.why}</Text> : null}
      </View>
      <Text style={s.cardLine} testID={testID ? `${testID}-line` : undefined}>{row.line}</Text>
      <View style={s.cardFoot}>
        <Text style={s.cardCtx} numberOfLines={2}>{row.context}</Text>
        {waiting
          ? <StatusTag5 label={row.tag} tone={row.tone || 'waiting'} testID={testID ? `${testID}-tag` : undefined} />
          : <RowAction5 label={buttonFor(side, row.kind)} onPress={onPress} testID={testID ? `${testID}-button` : undefined} />}
      </View>
    </TouchableOpacity>
  );
}

/** Waiting on others, on Home: who, one line, the tag. */
export function WaitRows19({ rows, onPress }) {
  return (
    <View style={s.box}>
      {rows.map((r, i) => (
        <TouchableOpacity key={r.id} style={[s.wrow, i === rows.length - 1 ? null : s.line]} onPress={() => onPress(r)} activeOpacity={0.8} accessibilityRole="button" testID={`wait-${i}`}>
          <Who who={r.who} />
          <View style={s.wtext}>
            <Text style={s.wname} numberOfLines={1}>{r.who.name}</Text>
            <Text style={s.wline} numberOfLines={2}>{r.line}</Text>
          </View>
          <StatusTag5 label={r.tag} tone={r.tone || 'waiting'} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

/** The Wallet's own lines. `open(line)` opens that line's list. */
export function MoneyLines19({ lines, open }) {
  return (
    <Figs17>
      {lines.map((l) => (
        <Fig17 key={l.key} testID={`money-${l.key}`} label={H19.moneyLabel[l.key]} sub={H19.moneySub(l)} value={H19.inr(l.amount)} onPress={() => open(l)} />
      ))}
    </Figs17>
  );
}

/** Brand: the campaigns that are live. */
export function CampaignRows19({ rows, onPress }) {
  return (
    <View style={s.box}>
      {rows.map((c, i) => (
        <TouchableOpacity key={c.id} style={[s.crow, i === rows.length - 1 ? null : s.line]} onPress={() => onPress(c)} activeOpacity={0.8} accessibilityRole="button" testID={`campaign-${i}`}>
          <View style={s.crowHead}>
            <Text style={s.crowName} numberOfLines={2}>{c.name}</Text>
            <StateChip4 state={c.state} />
          </View>
          <Text style={s.crowLine}>{H19.setsLine(c)}</Text>
          {H19.countsLine(c) ? <Text style={s.crowLine}>{H19.countsLine(c)}</Text> : null}
        </TouchableOpacity>
      ))}
    </View>
  );
}

/** Creator: her collaborations that are signed and running. */
export function RunRows19({ rows, onPress }) {
  return (
    <View style={s.box}>
      {rows.map((r, i) => (
        <TouchableOpacity key={r.id} style={[s.crow, i === rows.length - 1 ? null : s.line]} onPress={() => onPress(r)} activeOpacity={0.8} accessibilityRole="button" testID={`running-${i}`}>
          <View style={s.crowHead}>
            <Avatar name={r.brand.name} url={r.brand.logoUrl} size={26} />
            <Text style={[s.crowName, { marginLeft: 8 }]} numberOfLines={1}>{r.brand.name}</Text>
            <StatusTag5 label={r.chip} tone={r.completed ? 'completed' : 'active'} />
          </View>
          <Text style={s.crowLine}>{H19.runLine1(r)}</Text>
          {H19.runLine2(r) ? <Text style={s.crowLine}>{H19.runLine2(r)}</Text> : null}
        </TouchableOpacity>
      ))}
    </View>
  );
}

/** Her store link, one line. `link` is the display form (inflx.in/s/handle). */
export function StoreLink19({ link }) {
  if (!link) return null;
  return (
    <View style={s.slim} testID="home-store-link">
      <Icon name="link-variant" size={16} color={T.ink2} />
      <Text style={s.slimText} numberOfLines={1}>{link}</Text>
      <CopyButton text={`https://${link}`} testID="home-store-copy" />
    </View>
  );
}

/** "Nothing needs you right now." and the other one-line empty sections. */
export function Calm19({ text, tone = 'active', testID }) {
  const t = tone === 'plain' ? { bg: T.surface, fg: T.ink2 } : T.state.active;
  return (
    <View style={[s.calm, { backgroundColor: t.bg }]} testID={testID}>
      {tone === 'plain' ? null : <Icon name="check" size={15} color={t.fg} style={{ marginRight: 8 }} />}
      <Text style={[s.calmText, { color: t.fg }]}>{text}</Text>
    </View>
  );
}

/** A plain line that opens something (the first-day screen's two rows). */
export function OpenRow19({ icon, title, sub, onPress, testID }) {
  return (
    <TouchableOpacity style={s.grow} onPress={onPress} activeOpacity={0.8} accessibilityRole="button" testID={testID}>
      <View style={[s.icon, { width: 30, height: 30, borderRadius: 15 }]}><Icon name={icon} size={16} color={T.ink} /></View>
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={s.wname}>{title}</Text>
        {sub ? <Text style={s.wline}>{sub}</Text> : null}
      </View>
      <Icon name="chevron-right" size={18} color={T.ink3} />
    </TouchableOpacity>
  );
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  body: { paddingHorizontal: 18, paddingBottom: 40 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 6 },
  title: { flex: 1, fontFamily: fonts.sansBold, fontSize: 22, color: T.ink, paddingRight: 12 },
  bell: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -5, right: -5, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: T.state.yourMove.fg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { fontFamily: fonts.sansBold, fontSize: 10, color: '#FFFFFF' },

  sec: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 10 },
  secTitle: { fontFamily: fonts.sansBold, fontSize: 16, color: T.ink, flexShrink: 1 },
  secCount: { fontFamily: fonts.sansBold, fontSize: 16, color: T.ink2 },
  secCountUrgent: { fontFamily: fonts.sansBold, fontSize: 16, color: T.state.yourMove.fg },
  secLink: { flexDirection: 'row', alignItems: 'center', paddingLeft: 10 },
  secLinkText: { fontFamily: fonts.sansBold, fontSize: 12.5, color: T.ink, textDecorationLine: 'underline' },

  card: { borderWidth: 1, borderColor: T.border, borderRadius: 14, padding: 12, marginBottom: 8, backgroundColor: T.bg },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  cardName: { flex: 1, fontFamily: fonts.sansBold, fontSize: 14, color: T.ink, marginLeft: 8, marginRight: 8 },
  why: { fontFamily: fonts.sansBold, fontSize: 11.5, color: T.state.yourMove.fg, marginLeft: 6 },
  whyCalm: { fontFamily: fonts.sansSemiBold, fontSize: 11.5, color: T.ink2, marginLeft: 6 },
  cardLine: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink, lineHeight: 18, marginTop: 7 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  cardCtx: { flex: 1, fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, paddingRight: 10 },
  icon: { backgroundColor: T.surface, alignItems: 'center', justifyContent: 'center' },

  box: { borderWidth: 1, borderColor: T.border, borderRadius: 14, paddingHorizontal: 12 },
  line: { borderBottomWidth: 1, borderBottomColor: T.border },
  wrow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  wtext: { flex: 1, marginLeft: 9, marginRight: 8 },
  wname: { fontFamily: fonts.sansBold, fontSize: 13.5, color: T.ink },
  wline: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, lineHeight: 16, marginTop: 1 },

  crow: { paddingVertical: 11 },
  crowHead: { flexDirection: 'row', alignItems: 'center' },
  crowName: { flex: 1, fontFamily: fonts.sansBold, fontSize: 14, color: T.ink, marginRight: 8 },
  crowLine: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, marginTop: 3 },

  slim: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.surface, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 11, marginTop: 10 },
  slimText: { flex: 1, fontFamily: fonts.sansSemiBold, fontSize: 13, color: T.ink, marginLeft: 8, marginRight: 8 },
  calm: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingVertical: 11, paddingHorizontal: 12 },
  calmText: { flex: 1, fontFamily: fonts.sansSemiBold, fontSize: 13 },
  grow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: T.border, borderRadius: 14, padding: 12, marginTop: 10 },

  // first day
  note: { backgroundColor: T.surface, borderRadius: 12, padding: 12, marginTop: 8 },
  noteText: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink2, lineHeight: 18 },
  noteBold: { fontFamily: fonts.sansBold, color: T.ink },
  step: { flexDirection: 'row', borderWidth: 1, borderColor: T.border, borderRadius: 14, padding: 12, marginTop: 8 },
  stepN: { width: 22, height: 22, borderRadius: 11, backgroundColor: T.ink, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNText: { fontFamily: fonts.sansBold, fontSize: 11, color: '#FFFFFF' },
  stepTitle: { fontFamily: fonts.sansBold, fontSize: 13.5, color: T.ink },
  stepSub: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, lineHeight: 16, marginTop: 1 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2, lineHeight: 18, backgroundColor: T.surface, borderRadius: 12, padding: 11, marginBottom: 10 },
});
