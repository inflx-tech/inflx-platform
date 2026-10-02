/**
 * ui-walk-fixes — board F (frames F1, F2, F7): what you can do is a button, what you are waiting
 * for is a tag.
 * Contract: features/ui-walk-fixes · spec U3, U11 · research C06, C08
 *
 * Until this board an action and a status were the same 11px pill: "Send agreement" looked exactly
 * like the "Live" tag and was the only way to send. Two new pieces replace the pill on the brand's
 * set rows and the creator's Collabs cards — Chip5 itself is untouched, it has other callers:
 *
 *   RowAction5   a labelled button that names the step and ends in a small arrow. Ink outline on
 *                white, never yellow (yellow is the one main button of a screen) and never a black
 *                fill (black already means "selected"). 34 high as the board draws it, 44 to touch.
 *   StatusTag5   a small pale tag with an icon. Not a button: it has no outline and takes no press.
 *
 * and two rules that say which of the two a row or a card carries:
 *
 *   setRowStep(row)   the brand's set row
 *   cardStep(card)    the creator's card
 *   cardNext(card)    the creator's Active card waiting on the brand to start the next step: the
 *                     words of its labelled "Next" row (spec U25), or null
 *
 * Both read only what the server sends on the row. Nothing here invents a status sentence
 * (spec U11): the sentence stays the server's, the button names the step it describes.
 *
 * One turn is NOT worked out here: a store visit whose time is still being agreed. Its stage is
 * 'sent' on both sides of the conversation, so whose turn it is comes from the server
 * (`shoot.yourMove`, backend invitationRows.service.js `shootYourMove`) and is never guessed.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { C5 } from './copy5';
import { C6 } from '../negotiation/copy6';
import { C7 } from '../agreement/copy7';

/** The icon each tone carries: an alert for "your move", a clock for waiting, a tick for the rest. */
export const TAG_ICON = { yourMove: 'alert-circle-outline', waiting: 'clock-outline', active: 'check', completed: 'check' };

/** 34 high (the board's .rowbtn) plus 5 above and below: 44 to touch. */
export const ROW_ACTION_HEIGHT = 34;
export const ROW_ACTION_SLOP = { top: 5, bottom: 5, left: 6, right: 6 };

/** A labelled button on a row or a card. The label is its own Text; the arrow is an icon beside it. */
export function RowAction5({ label, onPress, testID }) {
  return (
    <TouchableOpacity
      style={a.btn}
      onPress={onPress}
      disabled={!onPress}
      hitSlop={ROW_ACTION_SLOP}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      <Text style={a.btnText} numberOfLines={1}>{label}</Text>
      <Icon name="chevron-right" size={15} color={T.ink} style={a.btnChev} />
    </TouchableOpacity>
  );
}

/** A status: pale, with an icon, and never button-shaped. */
export function StatusTag5({ label, tone = 'waiting', icon, testID }) {
  const t = T.state[tone] || T.state.ended;
  const name = icon || TAG_ICON[tone];
  return (
    <View style={[a.tag, { backgroundColor: t.bg }]} testID={testID}>
      {name ? <Icon name={name} size={12} color={t.fg} style={a.tagIcon} /> : null}
      <Text style={[a.tagText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

/** A quiet underlined link with an icon — "Agreement" on an Active card (frame F7, board P16). */
export function CardLink5({ label, icon, onPress, testID }) {
  return (
    <TouchableOpacity
      style={a.link}
      onPress={onPress}
      hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      {icon ? <Icon name={icon} size={14} color={T.ink} style={a.linkIcon} /> : null}
      <Text style={a.linkText}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ───────────────────────────────────────────────────── the brand's set row */

/** An agreement that is out and unsigned. The server's own flag first; the status as a second witness. */
export function agreementOut5(row) {
  const act = (row && row.actions) || {};
  return !!(act.withdrawAgreement || (row && row.agreement && row.agreement.status === 'pending_influencer'));
}

/**
 * The creator's own steps, the mirror of the server's CONTENT_MINE.creator and SALE_MINE.creator
 * (backend/src/services/invitationRows.service.js). The server sends `yourMove` for the reader's
 * side only, so "it is HER move" is read from the step's name.
 */
const HER_CONTENT = ['send_content', 'make_changes', 'post_and_link'];
const HER_SALE = ['make_posts', 'send_social', 'make_changes', 'post_and_link'];

const button = (label, open) => ({ kind: 'button', label, open });
const tag = (label, tone, open = null) => ({ kind: 'tag', label, tone, open });

/** The agreed visit time has come and gone with nothing marked — the server's line asks for a new time. */
const visitPassed = (shoot, now) => shoot.stage === 'agreed' && !!shoot.visitAt && new Date(shoot.visitAt).getTime() < now;

/**
 * The one button or tag a set row carries, and the screen its tap opens.
 *   → { kind: 'button' | 'tag', label, tone?, open } or null (a row that carries neither).
 * `open` is one of agreementPreview · agreement · thread · content · goingLive · shoot · remote,
 * or null when the row keeps whatever its tap did before.
 */
export function setRowStep(row, now = Date.now()) {
  const S = C5.set;
  const act = row.actions || {};
  switch (row.group) {
    case 'yourMove':
      if (act.signAgreement) return button(S.signChip, 'agreement');
      if (act.sendAgreement) return button(S.sendAgreement, 'agreementPreview');
      return button(C6.set.reply, 'thread');
    case 'negotiating':
      return tag(C6.set.waitingChip, 'waiting', 'thread');
    case 'waiting':
      return agreementOut5(row) ? tag(S.waitingToSign, 'waiting', 'agreement') : tag(C6.set.waitingChip, 'waiting');
    case 'signed': {
      // Nobody owes a step: green "Active" while the collaboration runs, the purple tag once it
      // has finished (F2: "a finished row carries a purple tag") — the server's own status, so a
      // Pay for Content row whose sentence reads "Completed." is not called "Active" beside it.
      const rest = (open = null) => (row.status === 'completed' ? tag(S.completedTag, 'completed', open) : tag(S.activeTag, 'active', open));
      const c = row.content;
      if (c && c.line) {
        if (c.yourMove) return button(c.move === 'confirm_live' ? S.confirmLive : S.reviewIt, 'content');
        if (HER_CONTENT.includes(c.move)) return tag(S.herMove, 'waiting', 'content');
        // Reported: it is with INFLX. Neither a running collaboration nor a finished one.
        if (c.move === 'reported') return tag(C6.set.waitingChip, 'waiting', 'content');
        return rest('content');
      }
      const g = row.goingLive;
      if (g && g.line) {
        if (g.yourMove) return button(g.move === 'confirm_live' ? S.confirmLive : S.reviewIt, 'goingLive');
        if (g.completed) return tag(S.completedSelling, 'completed', 'goingLive');
        if (HER_SALE.includes(g.move)) return tag(S.herMove, 'waiting', 'goingLive');
        if (g.move === 'reported') return tag(C6.set.waitingChip, 'waiting', 'goingLive');
        return rest('goingLive');
      }
      const sh = row.shoot;
      if (sh && sh.line) {
        if (sh.stage === 'not_sent' || visitPassed(sh, now)) return button(S.planVisit, 'shoot');
        if (sh.stage === 'attended') return button(S.confirmShoot, 'shoot');
        if (sh.stage === 'sent') {
          // The time is still being agreed, and 'sent' is both "the plan is with her" and "she
          // asked for another time — it is with you". Only the visit's own conversation knows
          // which, so the turn is the server's (`shoot.yourMove`), never guessed from the stage:
          // his turn is a "Reply" button, hers a "Waiting" tag. A server that does not say
          // (an older one) gets neither — the row still opens the visit, and claims nothing.
          if (sh.yourMove === true) return button(C6.set.reply, 'shoot');
          if (sh.yourMove === false) return tag(C6.set.waitingChip, 'waiting', 'shoot');
          return null;
        }
        return rest('shoot');
      }
      const rm = row.remote;
      if (rm && rm.line) {
        // Her address is in and nothing is booked: the products are the brand's to pick and send.
        if (rm.stage === 'sent') return button(S.openStep, 'remote');
        if (rm.stage === 'not_sent' || rm.stage === 'delivered' || rm.stage === 'checked') return tag(C6.set.waitingChip, 'waiting', 'remote');
        return rest('remote');
      }
      return rest();
    }
    case 'deferred':
      return tag(S.anotherSet, 'yourMove');
    default:
      return null;
  }
}

/* ───────────────────────────────────────────────────── the creator's card */

/**
 * Whether an Active card is waiting on HER.
 *
 * Content, going live and the store visit: the server says so (`yourMove`). For the visit that
 * matters: while the time is being agreed the stage reads 'sent' whether the plan is with her or
 * she has asked for another time and is waiting on the brand, and only the visit's own
 * conversation knows which. So the card never guesses a visit's turn from its stage — a server
 * that does not send the flag gets "Active" and no button, which claims nothing.
 *
 * The Remote shoot has no conversation and no flag; each of its stages has one owner, so it is
 * read from the stage, the way the Remote screen decides which button she gets:
 *   'not_sent'  — her delivery address
 *   'delivered' — say what turned up
 *   'checked'   — mark the shoot done
 * Every other Remote stage is waiting on the brand or the courier.
 */
export function herMoveOnActive(card) {
  if (card.content && card.content.line) return !!card.content.yourMove;
  if (card.goingLive && card.goingLive.line) return !!card.goingLive.yourMove;
  if (card.shoot && card.shoot.line) return card.shoot.yourMove === true;
  if (card.remote && card.remote.line) return ['not_sent', 'delivered', 'checked'].includes(card.remote.stage);
  return false;
}

/**
 * A brand-new invitation that is HERS to answer (spec U25): the server says she may answer it
 * (`canAnswer`), and she is not waiting on the brand's answer to a date she asked for.
 *
 * Two cards share the group 'invited' and are not hers to answer:
 *   · her own application to an open group — the server sends `canAnswer: false`;
 *   · an invitation she has asked to be moved from, which the brand has not answered yet
 *     (`moveRequest` with no `answer`) — the card opens that conversation, and it is with the brand.
 * Once the brand answers "kept" the invitation is hers again.
 */
export function hersToAnswer(card) {
  if (!card || card.group !== 'invited' || card.canAnswer !== true) return false;
  return !(card.moveRequest && !card.moveRequest.answer);
}

/**
 * What comes next on an Active card that is waiting on the BRAND to start the next step — the
 * labelled "Next" row of frame F7 (spec U25). Two stages only, each read from what the server
 * sends on the card and never guessed:
 *
 *   a Store Visit with no plan sent yet   the card carries no `shoot` (the server sends one only
 *                                         once a plan is out) and no `remote`, and the set's mode
 *                                         is a store visit → "{Brand} plans your store visit"
 *   a Remote parcel not yet shipped       `remote.stage === 'sent'`: her address is in and nothing
 *                                         is booked → "They ship your products"
 *
 * Every other stage keeps the server's own sentence with no label, so this answers null: once
 * there is content or going live, any store visit the server describes, any other Remote stage
 * (her address, the parcel on its way, her check, her shoot), and a finished collaboration.
 *   → the sentence, or null.
 */
export function cardNext(card) {
  if (!card || card.group !== 'signed' || card.status === 'completed') return null;
  if (card.content || card.goingLive || card.shoot) return null;
  if (card.remote) return card.remote.stage === 'sent' ? C7.creator.nextTheyShip : null;
  // No visit on the card at all. That is "not planned yet" only for a store-visit set whose
  // agreement both have signed — the one moment the plan is the brand's to send.
  const bothSigned = !!(card.agreement && card.agreement.bothSignedAt);
  const brand = card.brand && card.brand.name;
  if (card.shootMode === 'visit' && bothSigned && brand) return C7.creator.nextTheyPlanVisit(brand);
  return null;
}

/**
 * The creator's card: its tag, and its button when she has something to do.
 *   → { label, tone, button } for the states the board draws (F7), or null — the card keeps the
 *     plain chip it has always had (Accepted, Agreed, Expired, Declined …).
 */
export function cardStep(card) {
  const K = C5.creator;
  switch (card.group) {
    // U25: the card that most needs an answer looks like one — but only when it is hers to give.
    case 'invited': return hersToAnswer(card) ? { label: K.chips.yourMove, tone: 'yourMove', button: K.open } : null;
    case 'toSign': return { label: K.chips.toSign, tone: 'yourMove', button: K.reviewSign };
    case 'yourMove': return { label: K.chips.yourMove, tone: 'yourMove', button: K.open };
    case 'negotiating': return { label: K.chips.negotiating, tone: 'waiting', button: null };
    case 'signedWaiting': return { label: K.chips.signedWaiting, tone: 'waiting', button: null };
    case 'signed':
      return herMoveOnActive(card)
        ? { label: K.chips.yourMove, tone: 'yourMove', button: K.open }
        : { label: K.chips.signed, tone: 'active', button: null };
    default: return null;
  }
}

export const a = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    height: ROW_ACTION_HEIGHT, paddingLeft: 10, paddingRight: 6,
    borderRadius: 10, borderWidth: 1.5, borderColor: T.ink, backgroundColor: T.bg,
  },
  btnText: { fontFamily: fonts.sansBold, fontSize: 12.5, color: T.ink },
  btnChev: { marginLeft: 2 },
  tag: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999 },
  tagIcon: { marginRight: 4 },
  tagText: { fontFamily: fonts.sansBold, fontSize: 11 },
  // F1 — one creator on the set: avatar · name and status sentence · ⋯ at the top right, and the
  // row's one button or tag on its own line under the words, so no sentence is cut short and the
  // button is well away from the ⋯.
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.border },
  rowBody: { flex: 1, marginLeft: 12 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start' },
  rowWords: { flex: 1 },
  rowMeta: { lineHeight: 16 },
  rowMore: { marginTop: -6, marginRight: -6 },
  rowStep: { marginTop: 7, alignItems: 'flex-start' },
  // F7 — the "Next" row of an Active card waiting on the brand (the board's .tline): the label in
  // grey at the left, what comes next in bold at the right.
  cardNext: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginTop: 8 },
  cardNextLabel: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2 },
  cardNextValue: { flex: 1, fontFamily: fonts.sansBold, fontSize: 12.5, color: T.ink, textAlign: 'right' },
  // F7 — the foot of a Collabs card: its button, then the "Agreement" link.
  cardFoot: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 14 },
  link: { flexDirection: 'row', alignItems: 'center', minHeight: 32, paddingHorizontal: 2 },
  linkIcon: { marginRight: 5 },
  linkText: { fontFamily: fonts.sansBold, fontSize: 12.5, color: T.ink, textDecorationLine: 'underline' },
});
