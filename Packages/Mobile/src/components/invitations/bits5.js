/**
 * Item 5 — the small pieces the invitation screens are built from: stepper, the locked set
 * card, chips, the amber minimum box, the review row, the set's creator row, the creator's
 * invitation card, the deliverables editor and a key-value row.
 * Contract: features/item5-invitations · mockups I1–I15 · prompt §8
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { Avatar } from '../../screens/brand/BrandBlockedCreatorsScreen';
import { FieldError, TagRow } from '../settings/primitives';
import { NumberField } from '../../screens/brand/BrandPitchSettingsScreen';
import { C5, GROUP_TONE, DELIVERABLE_TYPES, aimLabel5, modeLabel5, longDate5, shortDate5, rupees5, fmtPct5 } from './copy5';
// Item 6 — the negotiation lines on a set row (N20). Contract: features/item6-negotiation
import { C6 } from '../negotiation/copy6';
import { C7 } from '../agreement/copy7';

/** "Creator 1 of 3" / "All 3 creators" */
export function Stepper5({ text, testID }) {
  return <Text style={b.stepper} testID={testID || 'stepper'}>{text}</Text>;
}

/** A tinted chip on the item 2 palette. */
export function Chip5({ label, tone = 'ended', testID }) {
  const t = T.state[tone] || T.state.ended;
  return (
    <View style={[b.chip, { backgroundColor: t.bg }]} testID={testID}>
      <Text style={[b.chipText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

/** The set's own terms, locked at the top of every terms screen and on Review (I3–I5, I8). */
export function LockedSetCard5({ set, showCutoff, testID }) {
  const rows = [
    [C5.terms.rows.aim, aimLabel5(set.goal)],
    [C5.terms.rows.posts, longDate5(set.postingDate)],
    [C5.terms.rows.mode, [modeLabel5(set.shootMode), set.branch && set.branch.name].filter(Boolean).join(' · ')],
  ];
  if (showCutoff) rows.push([C5.terms.rows.closes, longDate5(set.cutoff)]);
  return (
    <View style={b.locked} testID={testID || 'locked-set'}>
      <Text style={b.lockedTitle}>🔒 {C5.terms.lockedTitle}</Text>
      {rows.map(([k, v]) => (
        <View key={k} style={b.kv}><Text style={b.k}>{k}</Text><Text style={b.v}>{v}</Text></View>
      ))}
    </View>
  );
}

/** The amber "Below {name}'s minimum…" box. Never blocks. */
export function MinBox5({ text, testID }) {
  if (!text) return null;
  return <View style={b.min} testID={testID || 'min-warning'}><Text style={b.minText}>{text}</Text></View>;
}

export function KV5({ k, v, testID }) {
  return <View style={b.kv} testID={testID}><Text style={b.k}>{k}</Text><Text style={b.v}>{v}</Text></View>;
}

export function GroupHeader5({ title, count, testID }) {
  return (
    <View style={b.groupHead} testID={testID}>
      <Text style={b.groupTitle}>{title}</Text>
      <Text style={b.groupCount}>{count}</Text>
    </View>
  );
}

/** I8 — one creator on Review: name · terms line · OK / Below min. */
export function ReviewRow5({ name, avatarUrl, line, source, below, error, onPress, testID }) {
  return (
    <TouchableOpacity style={b.row} onPress={onPress} activeOpacity={0.7} testID={testID}>
      <Avatar name={name} url={avatarUrl} size={40} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={b.name} numberOfLines={1}>{name}</Text>
        <Text style={b.meta} numberOfLines={1}>{line}</Text>
        {source ? <Text style={b.source} numberOfLines={1} testID="review-source">{C5.review.from(source)}</Text> : null}
        {error ? <Text style={b.rowError}>{error}</Text> : null}
      </View>
      <Chip5 label={error ? C5.pick.cantInvite : below ? C5.review.below : C5.review.ok} tone={error ? 'declined' : below ? 'below' : 'ok'} />
    </TouchableOpacity>
  );
}

/** I9 — one creator on the set, meta by group. */
export function SetCreatorRow5({ row, onPress, onMore, onChip, testID }) {
  let meta = row.termsLine;
  let chip = null;
  const neg = row.negotiation;
  const day = (v) => (v ? new Date(v).toISOString().slice(0, 10) : null);
  switch (row.group) {
    // Item 6 (N20): the brand's own move rises to the top — a counter waiting on her, or a
    // request to move nobody has answered.
    case 'yourMove':
      // Item 7 (P1): two different "your move"s sit in this one group — one
      // creator needs an agreement sent, another has signed and is waiting.
      if (row.actions && row.actions.signAgreement) {
        meta = C5.set.signedWaiting(row.agreement && row.agreement.creatorSignedAt);
        chip = { label: C5.set.signChip, tone: 'active' };
      } else if (row.actions && row.actions.sendAgreement) {
        meta = C5.set.accepted(row.answeredAt || row.sentAt);
        chip = { label: C5.set.sendAgreement, tone: 'active' };
      } else {
        meta = row.moveRequest && !row.moveRequest.answer
          ? (row.moveRequest.goLiveDate ? C6.set.askedFor(row.moveRequest.goLiveDate, day(row.moveRequest.requestedAt)) : C6.set.askedForMode(row.moveRequest.shootMode, day(row.moveRequest.requestedAt)))
          : C6.set.countered(neg && neg.lastCounter ? neg.lastCounter.line : row.termsLine, day(neg && neg.lastCounter ? neg.lastCounter.at : row.sentAt));
        chip = { label: C6.set.yourMoveChip, tone: 'yourMove' };
      }
      break;
    case 'negotiating':
      meta = neg && neg.lastCounter
        ? (neg.lastCounter.by === 'brand' ? C6.set.youCountered(neg.lastCounter.line, day(neg.lastCounter.at)) : C6.set.countered(neg.lastCounter.line, day(neg.lastCounter.at)))
        : row.termsLine;
      chip = { label: C6.set.waitingChip, tone: 'waiting' };
      break;
    case 'waiting':
      // Item 7: an agreement out and unsigned reads as what it is, not as an
      // unanswered invitation.
      meta = row.agreement && row.agreement.sentAt
        ? C5.set.agreementSent(row.agreement.sentAt)
        : [row.termsLine, C5.set.sent(row.sentAt)].filter(Boolean).join(' · ');
      break;
    case 'accepted': meta = C5.set.accepted(row.answeredAt || row.sentAt); break;
    case 'signed': meta = C5.set.signedByBoth(row.signedAt); break;
    case 'deferred': meta = [row.deferredGoLiveDate ? C5.set.wants(row.deferredGoLiveDate) : null, row.deferredAt ? shortDate5(new Date(row.deferredAt).toISOString().slice(0, 10)) : null].filter(Boolean).join(' · '); chip = { label: C5.set.anotherSet, tone: 'waiting' }; break;
    case 'declined': meta = [row.declineReasonLabel, row.answeredAt ? shortDate5(new Date(row.answeredAt).toISOString().slice(0, 10)) : null].filter(Boolean).join(' · '); break;
    case 'expired': meta = C5.set.expiredMeta; break;
    case 'withdrawn': meta = row.status === 'removed' ? C5.set.removedMeta(row.removedAt) : C5.set.withdrawnMeta(row.withdrawnAt); break;
    default: break;
  }
  return (
    <TouchableOpacity style={b.row} onPress={onPress} activeOpacity={0.7} testID={testID || `set-creator-${row.id}`}>
      <Avatar name={row.name} url={row.avatarUrl} size={40} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={b.name} numberOfLines={1}>{row.name}</Text>
        {meta ? <Text style={b.meta} numberOfLines={1}>{meta}</Text> : null}
      </View>
      {chip ? <TouchableOpacity onPress={onChip} disabled={!onChip} testID={`chip-${row.id}`}><Chip5 label={chip.label} tone={chip.tone} /></TouchableOpacity> : null}
      {onMore ? <TouchableOpacity onPress={onMore} style={b.more} accessibilityLabel="More" testID={`more-${row.id}`}><Text style={b.moreText}>⋯</Text></TouchableOpacity> : null}
    </TouchableOpacity>
  );
}

/** I11 / I15 — the creator's card. */
export function InvitationCard5({ card, onPress, testID }) {
  const money = card.goal === 'conversion' ? C5.creator.commission(card.commissionPct)
    : card.goal === 'hybrid' ? `${rupees5(card.fee)} + ${fmtPct5(card.commissionPct)}` : rupees5(card.fee);
  const tags = [aimLabel5(card.goal), modeLabel5(card.shootMode), card.postingDate ? C5.creator.posts(card.postingDate) : null].filter(Boolean);
  const chipLabel = C5.creator.chips[card.group];
  const tone = GROUP_TONE[card.group] || 'ended';
  let sentence = null;
  if (card.group === 'accepted') sentence = C5.creator.waitingFor(card.brand.name);
  else if (card.group === 'expired') sentence = C5.creator.expiredBody(card.cutoff);
  else if (card.group === 'withdrawn') sentence = C5.creator.withdrawnBody(card.brand.name, card.endedAt);
  else if (card.group === 'closed') sentence = C5.creator.closedBody(card.brand.name);
  else if (card.group === 'declined') sentence = C5.creator.declinedBody(card.endedAt);
  // Item 6 (N12) — the three endings of a move request, in her words, and the two thread states.
  else if (card.group === 'pooled') sentence = card.pool && card.pool.wantsGoLiveDate ? C6.creatorMove.agreedBody(card.pool.wantsGoLiveDate) : C6.creatorMove.agreedBodyMode;
  else if (card.group === 'deferred') sentence = C5.creator.deferredBody;
  else if (card.group === 'yourMove') sentence = card.negotiation && card.negotiation.lastCounter ? `${card.brand.name} countered ${card.negotiation.lastCounter.line}.` : C6.thread.yourMoveMe;
  else if (card.group === 'negotiating') sentence = C5.creator.negotiatingBody;
  else if (card.moveRequest && card.moveRequest.answer === 'kept') sentence = C6.creatorMove.keptBody(card.brand.name, card.postingDate, card.cutoff);
  // Item 7 (P4, P7, P16) — the agreement, in her words. The signature is what
  // moves a collaboration out of Invites, so an Active card says what she has
  // been paid and what happens next.
  if (card.group === 'signed') {
    // ⚠️ This used to read card.firstPayment, which the server never sent, and fall back to 0 —
    // so a creator with ₹3,000 in her wallet was told she had nothing. Three cases now, and
    // none of them invents a number:
    //   · paid            — say the amount the signature actually moved
    //   · commission-only — nothing is paid on signing, and that is not a zero
    //   · signed, unpaid  — the rules pay at the signature, so this is nearly impossible; if it
    //                       happens, say the payment is coming rather than that it is zero
    const signedAt = card.agreement && card.agreement.bothSignedAt;
    if (!signedAt) sentence = null;
    else if (card.firstPayment > 0) sentence = C7.creator.inWallet(rupees5(card.firstPayment), signedAt);
    else if (card.hasUpfrontMoney === false) sentence = C7.creator.signedEarnAsYouSell(signedAt);
    else sentence = C7.creator.signedPaymentComing(signedAt);
  } else if (card.agreement && card.agreement.line) {
    sentence = card.agreement.line;
  }
  return (
    <TouchableOpacity style={b.card} onPress={onPress} activeOpacity={0.8} testID={testID || `invitation-card-${card.id}`}>
      <View style={b.cardTop}>
        <Avatar name={card.brand.name} url={card.brand.logoUrl} size={40} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={b.name} numberOfLines={1}>{card.brand.name}</Text>
          <Text style={b.meta} numberOfLines={1}>{[card.campaignName, card.setName].filter(Boolean).join(' · ')}</Text>
        </View>
        {chipLabel ? <Chip5 label={chipLabel} tone={tone} testID={`card-chip-${card.group}`} /> : null}
      </View>
      <View style={{ marginTop: 8 }}><TagRow items={tags} /></View>
      <Text style={b.money}>{C5.creator.youEarn(money)}</Text>
      {card.group === 'invited' && card.cutoff ? <Text style={b.meta}>{C5.creator.replyBy(card.cutoff, card.daysLeft)}</Text> : null}
      {sentence ? <View style={[b.sentence, { backgroundColor: (T.state[tone] || T.state.ended).bg }]}><Text style={[b.sentenceText, { color: (T.state[tone] || T.state.ended).fg }]}>{sentence}</Text></View> : null}
      {/* Item 10 (V4): under Active, one line says the only thing that matters yet — where and when. */}
      {card.shoot && card.shoot.line ? <Text style={[b.meta, { marginTop: 8, color: T.ink }]} testID={`shoot-line-${card.id}`}>{card.shoot.line}</Text> : null}
    </TouchableOpacity>
  );
}

/** I4 — rows of type + count, ✕ to remove, "Add another". */
export function DeliverablesEditor5({ rows, onChange, error, testID = 'deliverables' }) {
  const used = new Set(rows.map(r => r.type));
  const update = (i, patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const remove = (i) => onChange(rows.filter((_, j) => j !== i));
  const add = () => { const next = DELIVERABLE_TYPES.find(t => !used.has(t.code)) || DELIVERABLE_TYPES[0]; onChange([...rows, { type: next.code, count: 1 }]); };
  return (
    <View testID={testID}>
      {rows.map((r, i) => (
        <View key={`${r.type}-${i}`} style={b.delRow} testID={`${testID}-row-${i}`}>
          <View style={{ flex: 1 }}>
            <View style={b.typeWrap}>
              {DELIVERABLE_TYPES.map(t => (
                <TouchableOpacity key={t.code} style={[b.typeChip, r.type === t.code && b.typeChipOn]} onPress={() => update(i, { type: t.code })} testID={`${testID}-row-${i}-${t.code}`}>
                  <Text style={[b.typeChipText, r.type === t.code && b.typeChipTextOn]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={{ width: 84, marginLeft: 8 }}>
            <NumberField value={String(r.count == null ? '' : r.count)} onChangeText={(v) => update(i, { count: v === '' ? '' : Number(v) })} placeholder="1" testID={`${testID}-row-${i}-count`} />
          </View>
          <TouchableOpacity onPress={() => remove(i)} style={b.x} accessibilityLabel="Remove" testID={`${testID}-row-${i}-remove`}><Text style={b.xText}>✕</Text></TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity onPress={add} testID={`${testID}-add`}><Text style={b.add}>+ {C5.terms.addAnother}</Text></TouchableOpacity>
      <Text style={b.hint}>{C5.terms.deliverHint}</Text>
      <FieldError text={error} />
    </View>
  );
}

export const b = StyleSheet.create({
  stepper: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: T.ink2, marginBottom: 10 },
  chip: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, alignSelf: 'flex-start' },
  chipText: { fontFamily: fonts.sansBold, fontSize: 11 },
  locked: { backgroundColor: T.surface, borderRadius: 14, padding: 12, marginBottom: 14 },
  lockedTitle: { fontFamily: fonts.sansBold, fontSize: 12.5, color: T.ink2, marginBottom: 4 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, gap: 10 },
  k: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink2 },
  v: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink, textAlign: 'right', flexShrink: 1 },
  min: { borderRadius: 12, padding: 10, backgroundColor: T.state.yourMove.bg, marginTop: 6, marginBottom: 6 },
  minText: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: T.state.yourMove.fg, lineHeight: 17 },
  groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 4 },
  groupTitle: { fontFamily: fonts.sansBold, fontSize: 13.5, color: T.ink },
  groupCount: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: T.ink2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.border },
  name: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: T.ink },
  meta: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, marginTop: 2 },
  rowError: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: T.danger, marginTop: 2 },
  source: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: T.ink3, marginTop: 2 },
  more: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  moreText: { fontFamily: fonts.sansBold, fontSize: 20, color: T.ink },
  card: { borderWidth: 1, borderColor: T.border, borderRadius: 14, padding: 12, marginBottom: 10, backgroundColor: T.bg },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  money: { fontFamily: fonts.sansBold, fontSize: 13.5, color: T.ink, marginTop: 8 },
  sentence: { borderRadius: 10, padding: 10, marginTop: 8 },
  sentenceText: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, lineHeight: 17 },
  delRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  typeWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  typeChip: { borderWidth: 1, borderColor: T.border, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6, marginRight: 6, marginBottom: 6, backgroundColor: T.bg },
  typeChipOn: { backgroundColor: T.ink, borderColor: T.ink },
  typeChipText: { fontFamily: fonts.sansSemiBold, fontSize: 11.5, color: T.ink },
  typeChipTextOn: { color: '#FFFFFF' },
  x: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  xText: { fontFamily: fonts.sansBold, fontSize: 14, color: T.ink2 },
  add: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink, marginTop: 2 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, marginTop: 6, lineHeight: 16 },
});
