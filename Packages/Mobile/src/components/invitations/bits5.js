/**
 * Item 5 — the small pieces the invitation screens are built from: stepper, the locked set
 * card, chips, the amber minimum box, the review row, the set's creator row, the creator's
 * invitation card, the deliverables editor and a key-value row.
 * Contract: features/item5-invitations · mockups I1–I15 · prompt §8
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { Avatar } from '../../screens/brand/BrandBlockedCreatorsScreen';
import { FieldError, TagRow, SecondaryButton } from '../settings/primitives';
// ui-walk-fixes (board D) — the deliverables chooser counts with the app's own minus / number /
// plus (item 11's stepper, at field height) instead of a box that opens the keypad.
import { QtyStepper11 } from '../remote/bits11';
import { C5, MSG5, GROUP_TONE, DELIVERABLE_TYPES, aimLabel5, modeLabel5, longDate5, shortDate5, rupees5, fmtPct5 } from './copy5';
// Item 6 — the negotiation lines on a set row (N20). Contract: features/item6-negotiation
import { C6 } from '../negotiation/copy6';
import { C7 } from '../agreement/copy7';
// ui-walk-fixes (board F) — a row's labelled button, its status tag, and the rule that picks one.
import { RowAction5, StatusTag5, CardLink5, setRowStep, cardStep, cardNext, a } from './steps5';

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
export function ReviewRow5({ name, avatarUrl, line, source, below, endsSoon, error, onPress, testID }) {
  return (
    <TouchableOpacity style={b.row} onPress={onPress} activeOpacity={0.7} testID={testID}>
      <Avatar name={name} url={avatarUrl} size={40} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={b.name} numberOfLines={1}>{name}</Text>
        <Text style={b.meta} numberOfLines={1}>{line}</Text>
        {source ? <Text style={b.source} numberOfLines={1} testID="review-source">{C5.review.from(source)}</Text> : null}
        {error ? <Text style={b.rowError}>{error}</Text> : null}
      </View>
      {/* creator-terms-v2 (T7): "Ends soon" joins the below-minimum warning. */}
      {/* ui-walk-fixes (board I8 drift): "OK" is green and "Below min" amber. The row used to pass
          'ok' and 'below' as tones — names the palette does not have — so both came out grey. */}
      <Chip5 label={error ? C5.pick.cantInvite : below ? C5.review.below : endsSoon ? C5.review.endsSoon : C5.review.ok}
        tone={error ? 'declined' : below ? GROUP_TONE.below : endsSoon ? 'yourMove' : GROUP_TONE.ok} testID={endsSoon && !error && !below ? 'chip-ends-soon' : undefined} />
    </TouchableOpacity>
  );
}

/**
 * I9 — one creator on the set, meta by group.
 *
 * ui-walk-fixes (board F, frames F1 / F2): the row is two lines. Above, the name and the status
 * sentence (which may wrap to a second line) with the ⋯ at the top right; below, on a line of its
 * own, the row's ONE button or tag (steps5.setRowStep). A button names the step the brand owes
 * and keeps testID `chip-<id>`; a tag says who is being waited for (`tag-<id>`) and takes no press.
 * The status sentences are still the server's (spec U11).
 */
export function SetCreatorRow5({ row, onPress, onMore, onChip, testID }) {
  let meta = row.termsLine;
  const step = setRowStep(row);
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
      } else if (row.actions && row.actions.sendAgreement) {
        meta = C5.set.accepted(row.answeredAt || row.sentAt);
      } else {
        meta = row.moveRequest && !row.moveRequest.answer
          ? (row.moveRequest.goLiveDate ? C6.set.askedFor(row.moveRequest.goLiveDate, day(row.moveRequest.requestedAt)) : C6.set.askedForMode(row.moveRequest.shootMode, day(row.moveRequest.requestedAt)))
          : C6.set.countered(neg && neg.lastCounter ? neg.lastCounter.line : row.termsLine, day(neg && neg.lastCounter ? neg.lastCounter.at : row.sentAt));
      }
      break;
    case 'negotiating':
      meta = neg && neg.lastCounter
        ? (neg.lastCounter.by === 'brand' ? C6.set.youCountered(neg.lastCounter.line, day(neg.lastCounter.at)) : C6.set.countered(neg.lastCounter.line, day(neg.lastCounter.at)))
        : row.termsLine;
      break;
    case 'waiting':
      // Item 7: an agreement out and unsigned reads as what it is, not as an
      // unanswered invitation.
      meta = row.agreement && row.agreement.sentAt
        ? C5.set.agreementSent(row.agreement.sentAt)
        : [row.termsLine, C5.set.sent(row.sentAt)].filter(Boolean).join(' · ');
      break;
    case 'accepted': meta = C5.set.accepted(row.answeredAt || row.sentAt); break;
    // Item 10 walk fix: once signed, the row says where the SHOOT has got to rather than
    // repeating the signature date for ever. Which button or tag goes with the sentence —
    // "Plan the visit", "Confirm shoot", "Review it", "Confirm live", "Her move", "Active" — is
    // steps5.setRowStep's, read from the same stage.
    case 'signed':
      // Item 12: after the shoot, the row says where the content is.
      if (row.content && row.content.line) {
        meta = row.content.line;
      } else if (row.goingLive && row.goingLive.line) {
        // Item 14 (S2): a Pay for Sale row after the shoot says where going live stands.
        meta = row.goingLive.line;
      } else if (row.shoot && row.shoot.line) {
        meta = row.shoot.line;
      } else if (row.remote && row.remote.line) {
        // ui-walk-fixes (F2): a Remote row says where the shoot has got to. The server has sent
        // this line since item 11 and it was never drawn.
        meta = row.remote.line;
      } else {
        meta = C5.set.signedByBoth(row.signedAt);
      }
      break;
    case 'deferred': meta = [row.deferredGoLiveDate ? C5.set.wants(row.deferredGoLiveDate) : null, row.deferredAt ? shortDate5(new Date(row.deferredAt).toISOString().slice(0, 10)) : null].filter(Boolean).join(' · '); break;
    case 'declined': meta = [row.declineReasonLabel, row.answeredAt ? shortDate5(new Date(row.answeredAt).toISOString().slice(0, 10)) : null].filter(Boolean).join(' · '); break;
    case 'expired': meta = C5.set.expiredMeta; break;
    case 'withdrawn': meta = row.status === 'removed' ? C5.set.removedMeta(row.removedAt) : C5.set.withdrawnMeta(row.withdrawnAt); break;
    default: break;
  }
  return (
    <TouchableOpacity style={a.row} onPress={onPress} activeOpacity={0.7} testID={testID || `set-creator-${row.id}`}>
      <Avatar name={row.name} url={row.avatarUrl} size={40} />
      <View style={a.rowBody}>
        <View style={a.rowTop}>
          <View style={a.rowWords}>
            <Text style={b.name} numberOfLines={1}>{row.name}</Text>
            {meta ? <Text style={[b.meta, a.rowMeta]} numberOfLines={2} testID={`meta-${row.id}`}>{meta}</Text> : null}
          </View>
          {onMore ? <TouchableOpacity onPress={onMore} style={[b.more, a.rowMore]} accessibilityLabel="More" testID={`more-${row.id}`}><Text style={b.moreText}>⋯</Text></TouchableOpacity> : null}
        </View>
        {step ? (
          <View style={a.rowStep}>
            {/* The button does what a tap on the row does; a tag takes no press of its own. */}
            {step.kind === 'button'
              ? <RowAction5 label={step.label} onPress={onChip || onPress} testID={`chip-${row.id}`} />
              : <StatusTag5 label={step.label} tone={step.tone} testID={`tag-${row.id}`} />}
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

/**
 * I11 / I15 — the creator's card.
 *
 * ui-walk-fixes (board F, frame F7): the tag reads "Your move" (amber) whenever it is her turn —
 * on an Active card too, where it used to stay "Active" — "Waiting" carries a clock, and "Active"
 * is green. A card she has something to do on carries a labelled button ("Review & sign", else
 * "Open") that does what a tap on the card does. An Active card carries the underlined
 * "Agreement" link when the screen passes `onAgreement`. The tag keeps testID `card-chip-<group>`.
 *
 * Spec U25: (a) an Active card waiting on the brand to START the next step — a store visit not yet
 * planned, a Remote parcel not yet shipped — says so in a labelled row, "Next" + what comes next
 * (steps5.cardNext, testID `next-line-<id>`); every other stage keeps the server's own sentence
 * with no label. (b) A brand-new invitation that is hers to answer carries the amber "Your move"
 * tag and an "Open" button (steps5.hersToAnswer); her own application, and an invitation waiting
 * on the brand's answer to a date she asked for, carry neither.
 */
export function InvitationCard5({ card, onPress, onAgreement, testID }) {
  const money = card.goal === 'conversion' ? C5.creator.commission(card.commissionPct)
    : card.goal === 'hybrid' ? `${rupees5(card.fee)} + ${fmtPct5(card.commissionPct)}` : rupees5(card.fee);
  const tags = [aimLabel5(card.goal), modeLabel5(card.shootMode), card.postingDate ? C5.creator.posts(card.postingDate) : null].filter(Boolean);
  const chipLabel = C5.creator.chips[card.group];
  const tone = GROUP_TONE[card.group] || 'ended';
  const step = cardStep(card);
  // U25(a): what the brand starts next, when that is all the card is waiting for — else null.
  const next = cardNext(card);
  const agreementLink = card.group === 'signed' && card.agreement && onAgreement ? onAgreement : null;
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
        {step ? <StatusTag5 label={step.label} tone={step.tone} testID={`card-chip-${card.group}`} />
          : chipLabel ? <Chip5 label={chipLabel} tone={tone} testID={`card-chip-${card.group}`} /> : null}
      </View>
      <View style={{ marginTop: 8 }}><TagRow items={tags} /></View>
      <Text style={b.money}>{C5.creator.youEarn(money)}</Text>
      {card.group === 'invited' && card.cutoff ? <Text style={b.meta}>{C5.creator.replyBy(card.cutoff, card.daysLeft)}</Text> : null}
      {sentence ? <View style={[b.sentence, { backgroundColor: (T.state[tone] || T.state.ended).bg }]}><Text style={[b.sentenceText, { color: (T.state[tone] || T.state.ended).fg }]}>{sentence}</Text></View> : null}
      {/* Item 10 (V4): under Active, one line says the only thing that matters yet — where and when.
          F7 / U25(a): where the next step is the brand's to start, that line is the labelled row
          "Next · {what comes next}" instead; every other stage keeps the server's sentence. */}
      {next ? (
        <View style={a.cardNext} testID={`next-line-${card.id}`}>
          <Text style={a.cardNextLabel}>{C7.creator.next}</Text>
          <Text style={a.cardNextValue}>{next}</Text>
        </View>
      ) : card.content && card.content.line ? <Text style={[b.meta, { marginTop: 8, color: T.ink }]} testID={`content-line-${card.id}`}>{card.content.line}</Text>
        : card.goingLive && card.goingLive.line ? <Text style={[b.meta, { marginTop: 8, color: T.ink }]} testID={`going-live-line-${card.id}`}>{card.goingLive.line}</Text>
        : card.shoot && card.shoot.line ? <Text style={[b.meta, { marginTop: 8, color: T.ink }]} testID={`shoot-line-${card.id}`}>{card.shoot.line}</Text>
        // ui-walk-fixes (F7, board R2): the Remote line the server has always sent and the card never drew.
        : card.remote && card.remote.line ? <Text style={[b.meta, { marginTop: 8, color: T.ink }]} testID={`remote-line-${card.id}`}>{card.remote.line}</Text> : null}
      {(step && step.button) || agreementLink ? (
        <View style={a.cardFoot}>
          {step && step.button ? <RowAction5 label={step.button} onPress={onPress} testID={`card-action-${card.id}`} /> : null}
          {agreementLink ? <CardLink5 label={C7.creator.agreementLink} icon="download" onPress={agreementLink} testID={`card-agreement-${card.id}`} /> : null}
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

/* ── the deliverables chooser (ui-walk-fixes board D, frames D1–D8) ───────────────────────── */

export const DELIVERABLE_MIN = 1;
export const DELIVERABLE_MAX = 20;

/**
 * A count as the stepper can show it: a whole number from 1 to 20, whatever arrived. The chooser
 * is handed rows it did not make — the server's thread, the pool's agreed terms — and a count
 * there may be a string, a zero, a 25 or nothing at all.
 */
export function deliverableCount5(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return DELIVERABLE_MIN;
  return Math.min(DELIVERABLE_MAX, Math.max(DELIVERABLE_MIN, n));
}

/**
 * The rule for the lines themselves, as the creator's counter has always checked it before the
 * server does: every count a whole number from 1 to 20, and no type twice. Returns the sentence,
 * or null. (An empty list is each screen's own sentence, so it is not judged here.) The new
 * controls cannot produce either fault; rows that arrive from elsewhere still can.
 */
export function deliverableRowsError5(rows) {
  const seen = new Set();
  for (const r of rows || []) {
    const n = Number(r.count);
    if (!Number.isInteger(n) || n < DELIVERABLE_MIN || n > DELIVERABLE_MAX) return MSG5.DELIVERABLE_COUNT;
    if (seen.has(r.type)) return MSG5.DELIVERABLE_DUP;
    seen.add(r.type);
  }
  return null;
}

/**
 * Room kept clear under an opened list: an ordinary gap, so the list's last line is not pressed
 * against the bottom edge of the page. It was 96, for a button strip that floated over the page;
 * since board C no home of the chooser has one — every strip sits under the page, in the column.
 */
const LIST_ROOM_BELOW = 16;

/**
 * Where the page must be scrolled to for an opened type list to be wholly in view — or null when
 * it already is. Never moves the box that was tapped off the top of the page. All four positions
 * are the phone's own window measurements; `offset` is where the page is scrolled to now.
 */
export function scrollForList5({ offset, viewTop, viewHeight, anchorTop, listBottom, room = LIST_ROOM_BELOW }) {
  const over = listBottom - (viewTop + viewHeight - room);
  if (!(over > 0)) return null;
  const by = Math.min(over, Math.max(0, anchorTop - viewTop - 8));
  return by > 0 ? Math.max(0, offset + by) : null;
}

/** Measure the tapped box and its list against the page that scrolls, and move the page. */
function bringListIntoView5(scrollRef, anchor, list) {
  const sv = scrollRef && scrollRef.current;
  if (!sv || !anchor || !list || typeof sv.scrollTo !== 'function' || typeof sv.measureInWindow !== 'function') return;
  try {
    const within = (typeof sv.getInnerViewRef === 'function' && sv.getInnerViewRef())
      || (typeof sv.getInnerViewNode === 'function' && sv.getInnerViewNode()) || null;
    if (!within) return;
    sv.measureInWindow((sx, viewTop, sw, viewHeight) => {
      anchor.measureInWindow((ax, anchorTop) => {
        list.measureInWindow((lx, listTop, lw, listHeight) => {
          list.measureLayout(within, (x, yInPage) => {
            const y = scrollForList5({ offset: yInPage - (listTop - viewTop), viewTop, viewHeight, anchorTop, listBottom: listTop + listHeight });
            if (y != null) sv.scrollTo({ y, animated: true });
          }, () => {});
        });
      });
    });
  } catch (e) { /* a list that was not moved into view is still a list she can scroll to */ }
}

/**
 * I4, redrawn (board D) — "What she delivers": one line per deliverable.
 *
 *   [ Instagram reel        ⌄ ]  [ −  1  + ]  [✕]
 *   [ + Add another ]
 *   Reels, posts, stories, YouTube videos and shorts.
 *
 * · The type box and "+ Add another" open the five types IN PLACE — a list in the flow of the
 *   page that pushes everything under it down. Never a floating menu (a ScrollView clips one and
 *   Android gives it no taps), never a second pop-up (one of its five homes is already a pop-up).
 * · A type that already has a line is grey with "Added" and cannot be chosen again; a line's own
 *   type is ticked. Choosing closes the list; so does a second tap on the box (spec U12).
 * · The number is minus / number / plus, 1 to 20, with no keypad.
 * · "+ Add another" is gone when all five types have a line, and back when one is removed.
 *
 * Props are the same four as before — rows, onChange, error, testID — and what is handed back is
 * still [{ type, count }], so the five homes (brand terms, brand counter pop-up, creator counter,
 * pitch form, pitch counter) and the server are untouched. `scrollRef` is new and optional: the
 * ref of the ScrollView the chooser sits in, so an opened list can be moved into view.
 *
 * testIDs: `-row-N`, `-row-N-remove` and `-add` are as they were. `-row-N-<type>` is still "make
 * line N this type" — it is now a line of the opened list, not a pill. `-row-N-count` is the
 * stepper (`-count-minus`, `-count-value`, `-count-plus`). New: `-row-N-type` (the box), `-list`,
 * `-add-<type>`.
 */
export function DeliverablesEditor5({ rows, onChange, error, testID = 'deliverables', scrollRef }) {
  const [open, setOpen] = useState(null);   // null · 'add' · the index of the line whose box is open
  const anchorRef = useRef(null);
  const listRef = useRef(null);
  const moved = useRef(null);               // the opening the page was last moved for
  const fixed = useRef(null);               // the rows last handed back with their counts put right
  const list = Array.isArray(rows) ? rows : [];
  const tidy = (rs) => rs.map(r => ({ ...r, count: deliverableCount5(r.count) }));

  // Rows that arrive with a count the stepper cannot show are put right once, straight away —
  // otherwise the line would read "20" while the rule underneath still saw the 25 and refused it.
  useEffect(() => {
    const sig = JSON.stringify(list);
    if (fixed.current !== sig && list.some(r => r.count !== deliverableCount5(r.count))) {
      fixed.current = sig;
      onChange(tidy(list));
    }
  });
  // A list left open on a line that is no longer there (the screen replaced the rows) is closed,
  // so it cannot reappear under a line added later.
  useEffect(() => { if (typeof open === 'number' && open >= list.length) setOpen(null); }, [open, list.length]);

  const used = new Set(list.map(r => r.type));
  const allAdded = DELIVERABLE_TYPES.every(t => used.has(t.code));
  const openRow = typeof open === 'number' && open < list.length ? open : null;
  const openAdd = open === 'add' && !allAdded;

  const show = (next) => { moved.current = null; setOpen(next); };
  const update = (i, patch) => onChange(tidy(list).map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const remove = (i) => { show(null); onChange(tidy(list).filter((_, j) => j !== i)); };
  const retype = (i, code) => { show(null); if (list[i] && list[i].type !== code) update(i, { type: code }); };
  const add = (code) => { show(null); onChange([...tidy(list), { type: code, count: DELIVERABLE_MIN }]); };
  const onListLayout = () => {
    if (moved.current === open) return;      // once for each opening, not on every re-layout
    moved.current = open;
    bringListIntoView5(scrollRef, anchorRef.current, listRef.current);
  };

  /** The five types, in the flow of the page. `own` is the type of the line it was opened from. */
  const typeList = (own, taken, onPick, idPrefix, style) => (
    <View ref={listRef} onLayout={onListLayout} collapsable={false} style={[d.list, style]} testID={`${testID}-list`}>
      {DELIVERABLE_TYPES.map((t, k) => {
        const mine = own === t.code;
        const gone = !mine && taken.has(t.code);
        return (
          <Pressable key={t.code} onPress={() => { if (!gone) onPick(t.code); }} disabled={gone}
            accessibilityRole="button" accessibilityState={{ disabled: !!gone, selected: !!mine }}
            style={[d.opt, k === DELIVERABLE_TYPES.length - 1 && d.optLast, mine && d.optMine]} testID={`${idPrefix}-${t.code}`}>
            <Text style={[d.optText, gone && d.optTextGone]} numberOfLines={1}>{t.label}</Text>
            {gone ? <Text style={d.added}>{C5.terms.added}</Text> : mine ? <Icon name="check" size={15} color={T.ink} /> : null}
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View testID={testID}>
      {list.map((r, i) => {
        const isOpen = openRow === i;
        const t = DELIVERABLE_TYPES.find(x => x.code === r.type);
        const others = new Set(list.filter((_, j) => j !== i).map(x => x.type));
        return (
          // The line's place is its key: its type may change under it, and the open list must not be lost when it does.
          <View key={`line-${i}`}>
            <View ref={isOpen ? anchorRef : undefined} collapsable={false} style={d.row} testID={`${testID}-row-${i}`}>
              <Pressable onPress={() => show(isOpen ? null : i)} accessibilityRole="button" accessibilityState={{ expanded: !!isOpen }}
                style={[d.type, isOpen && d.typeOpen]} testID={`${testID}-row-${i}-type`}>
                <Text style={d.typeText} numberOfLines={1}>{t ? t.label : String(r.type || '')}</Text>
                <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={T.ink3} />
              </Pressable>
              <QtyStepper11 tall max={DELIVERABLE_MAX} value={deliverableCount5(r.count)} onChange={(n) => update(i, { count: n })} testID={`${testID}-row-${i}-count`} />
              <TouchableOpacity onPress={() => remove(i)} style={d.remove} hitSlop={REMOVE_SLOP} accessibilityRole="button" accessibilityLabel="Remove" testID={`${testID}-row-${i}-remove`}>
                <Icon name="close" size={15} color={T.ink2} />
              </TouchableOpacity>
            </View>
            {isOpen ? typeList(r.type, others, (code) => retype(i, code), `${testID}-row-${i}`, d.listUnderRow) : null}
          </View>
        );
      })}
      {allAdded ? null : (
        <View ref={openAdd ? anchorRef : undefined} collapsable={false} style={d.addWrap}>
          <SecondaryButton strong inline icon="plus" label={C5.terms.addAnother} onPress={() => show(openAdd ? null : 'add')} testID={`${testID}-add`} />
        </View>
      )}
      {openAdd ? typeList(null, used, add, `${testID}-add`, d.listUnderAdd) : null}
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
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, marginTop: 6, lineHeight: 16 },
});

/** ui-walk-fixes (board D) — the deliverables chooser's own styles. */
const REMOVE_SLOP = { top: 6, bottom: 6, left: 3, right: 6 };
const d = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  type: { flex: 1, minWidth: 0, height: 42, borderRadius: 12, borderWidth: 1.5, borderColor: T.border, backgroundColor: T.bg, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 4 },
  typeOpen: { borderColor: T.ink },
  typeText: { flex: 1, minWidth: 0, fontFamily: fonts.sansMedium, fontSize: 13, color: T.ink },
  remove: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center', backgroundColor: T.bg },
  // "+ Add another" is the shared outlined button, kept to the left at the width of its words.
  addWrap: { alignSelf: 'flex-start', minWidth: 172 },
  list: { borderWidth: 1.5, borderColor: T.ink, borderRadius: 12, overflow: 'hidden', backgroundColor: T.bg },
  listUnderRow: { marginBottom: 8 },
  listUnderAdd: { marginTop: 8 },
  opt: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.border },
  optLast: { borderBottomWidth: 0 },
  optMine: { backgroundColor: T.surface },
  optText: { flexShrink: 1, fontFamily: fonts.sansSemiBold, fontSize: 13, color: T.ink },
  optTextGone: { fontFamily: fonts.sansMedium, color: T.disabledText },
  added: { fontFamily: fonts.sansMedium, fontSize: 11, color: T.disabledText },
});
