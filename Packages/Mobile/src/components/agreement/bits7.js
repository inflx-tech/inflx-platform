/**
 * Item 7 — the pieces the agreement screens are built from: the reference line,
 * a money row that is right-aligned and tabular, the totalled line under a dark
 * rule, the signature block (green when signed, outlined when not), the
 * shortfall card, and the "what happened just now" list.
 * Contract: features/item7-agreement · mockups P1–P16 · prompt §8
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { rupees5 } from '../invitations/copy5';
import { C7, stamp7, shortDate7 } from './copy7';

/** "INFLX-2026-00123 · DRAFT" — mono, uppercase, above the content. */
export function Reference7({ reference, suffix, testID }) {
  const text = [reference || C7.brand.draft, suffix].filter(Boolean).join(' · ');
  return <Text style={b.ref} testID={testID || 'agreement-reference'}>{text}</Text>;
}

/** A label and a value, the value right-aligned and tabular. */
export function MoneyRow7({ label, value, strong, testID }) {
  return (
    <View style={b.row} testID={testID}>
      <Text style={[b.rowLabel, strong && b.rowLabelStrong]}>{label}</Text>
      <Text style={[b.rowValue, strong && b.rowValueStrong]}>{value}</Text>
    </View>
  );
}

/** The totalled line: a dark rule above, the number bold below. */
export function TotalRow7({ label, value, testID }) {
  return (
    <View testID={testID}>
      <View style={b.rule} />
      <View style={b.row}>
        <Text style={b.totalLabel}>{label}</Text>
        <Text style={b.totalValue}>{value}</Text>
      </View>
    </View>
  );
}

/** A plain label/value line for terms. */
export function TermRow7({ label, value, testID }) {
  if (value == null || value === '') return null;
  return (
    <View style={b.row} testID={testID}>
      <Text style={b.rowLabel}>{label}</Text>
      <Text style={b.termValue}>{value}</Text>
    </View>
  );
}

/** A titled card, the shape every section on these screens uses. */
export function Card7({ title, children, tone, titleIcon, testID }) {
  const bg = tone === 'tint' ? T.surface : '#FFFFFF';
  return (
    <View style={[b.card, { backgroundColor: bg }]} testID={testID}>
      {/* `titleIcon` is an optional MaterialCommunityIcons name before the title — item 10's
          locked card carries a padlock (V2). Additive; every existing caller is unchanged. */}
      {title ? (
        <View style={b.cardTitleRow}>
          {titleIcon ? <Icon name={titleIcon} size={13} color={T.ink2} style={{ marginRight: 6 }} /> : null}
          <Text style={b.cardTitle}>{title}</Text>
        </View>
      ) : null}
      {children}
    </View>
  );
}

/**
 * A signature block. Signed is a green surface card; unsigned is outlined.
 * The device and the address are shown because they are what makes it hold up.
 */
export function SignatureBlock7({ who, name, at, device, ip, forBrand, testID }) {
  const signed = !!at;
  return (
    <View style={[b.sig, signed ? b.sigSigned : b.sigOpen]} testID={testID || `signature-${who.toLowerCase()}`}>
      <Text style={b.sigWho}>{who.toUpperCase()}</Text>
      <Text style={b.sigName}>{name || '—'}</Text>
      {forBrand ? <Text style={b.sigFor}>for {forBrand}</Text> : null}
      <Text style={b.sigWhen}>{signed ? `Signed ${stamp7(at)}` : C7.creator.notSignedYet}</Text>
      {signed && (device || ip) ? (
        <Text style={b.sigMeta}>{[device, ip].filter(Boolean).join(' · ')}</Text>
      ) : null}
    </View>
  );
}

/** P10 — the shortfall, named as an amount, in the declined-red family. */
export function ShortfallCard7({ shortfall, available, needed, children, testID }) {
  return (
    <View style={b.short} testID={testID || 'shortfall'}>
      <Text style={b.shortTitle}>{C7.brand.addToSign(rupees5(shortfall))}</Text>
      <Text style={b.shortBody}>{C7.brand.shortLine(rupees5(available), rupees5(needed))}</Text>
      {children}
    </View>
  );
}

/** P12 — locked / released / still locked, the three numbers that just moved. */
export function MoneyMoved7({ locked, released, stillLocked, creatorName, testID }) {
  if (locked == null) return null;
  return (
    <Card7 title={C7.brand.whatHappenedNow} tone="tint" testID={testID || 'money-moved'}>
      <MoneyRow7 label={C7.brand.locked} value={rupees5(locked)} />
      <MoneyRow7 label={C7.brand.releasedTo(creatorName)} value={rupees5(released)} />
      <MoneyRow7 label={C7.brand.stillLocked} value={rupees5(stillLocked)} strong />
    </Card7>
  );
}

/** The row that opens the standard terms, with their version. */
export function StandardTermsRow7({ version, sub, onPress, testID }) {
  const Wrap = onPress ? require('react-native').TouchableOpacity : View;
  return (
    <Wrap style={b.terms} onPress={onPress} testID={testID || 'standard-terms'}>
      <View style={{ flex: 1 }}>
        <Text style={b.termsTitle}>{C7.creator.standardTerms}</Text>
        <Text style={b.termsSub}>{sub || C7.creator.standardTermsSub(version)}</Text>
      </View>
      {onPress ? <Text style={b.chev}>›</Text> : null}
    </Wrap>
  );
}

/** A tinted sentence box — amber for your move, blue waiting, green done. */
export function StateBox7({ tone = 'wait', text, testID }) {
  if (!text) return null;
  const c = tone === 'move' ? T.state.yourMove : tone === 'done' ? T.state.completed : tone === 'ended' ? T.state.ended : T.state.waiting;
  return (
    <View style={[b.state, { backgroundColor: c.bg }]} testID={testID || `state-${tone}`}>
      <Text style={[b.stateText, { color: c.fg }]}>{text}</Text>
    </View>
  );
}

export const b = StyleSheet.create({
  ref: { fontFamily: fonts.monoMedium, fontSize: 11, letterSpacing: 1, color: T.ink3, textTransform: 'uppercase', marginBottom: 10 },
  card: { borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: T.border },
  cardTitle: { fontFamily: fonts.sansBold, fontSize: 12.5, color: T.ink2 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 6, gap: 12 },
  rowLabel: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink2, flexShrink: 1 },
  rowLabelStrong: { fontFamily: fonts.sansBold, color: T.ink },
  rowValue: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink, textAlign: 'right', fontVariant: ['tabular-nums'] },
  rowValueStrong: { fontSize: 14 },
  termValue: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink, textAlign: 'right', flexShrink: 1, maxWidth: '62%' },
  rule: { height: 1, backgroundColor: T.ink, marginTop: 8, marginBottom: 2 },
  totalLabel: { fontFamily: fonts.sansBold, fontSize: 13.5, color: T.ink },
  totalValue: { fontFamily: fonts.sansBold, fontSize: 15, color: T.ink, fontVariant: ['tabular-nums'] },
  sig: { borderRadius: 12, padding: 12, marginBottom: 8 },
  sigSigned: { backgroundColor: T.state.completed.bg },
  sigOpen: { borderWidth: 1, borderColor: T.border, backgroundColor: '#FFFFFF' },
  sigWho: { fontFamily: fonts.sansBold, fontSize: 10, letterSpacing: 1, color: T.ink3 },
  sigName: { fontFamily: fonts.sansBold, fontSize: 14, color: T.ink, marginTop: 3 },
  sigFor: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2 },
  sigWhen: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, marginTop: 2 },
  sigMeta: { fontFamily: fonts.sansRegular, fontSize: 11, color: T.ink3, marginTop: 1 },
  short: { borderRadius: 14, padding: 14, marginBottom: 12, backgroundColor: T.state.declined.bg },
  shortTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: T.state.declined.fg },
  shortBody: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.state.declined.fg, marginTop: 4, marginBottom: 10 },
  terms: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: T.border, padding: 12, marginBottom: 12 },
  termsTitle: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink },
  termsSub: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, marginTop: 2 },
  chev: { fontFamily: fonts.sansRegular, fontSize: 20, color: T.ink3 },
  state: { borderRadius: 12, padding: 12, marginBottom: 12 },
  stateText: { fontFamily: fonts.sansSemiBold, fontSize: 13, lineHeight: 19 },
});
