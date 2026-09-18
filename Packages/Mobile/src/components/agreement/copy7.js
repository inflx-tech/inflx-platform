/**
 * Item 7 — every word the agreement screens say.
 * Mirrors backend/src/services/agreementCopy.js; the two are kept identical.
 * Contract: features/item7-agreement · rules v1.20 §9 · mockups P1–P16
 */
import { rupees5 } from '../invitations/copy5';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2026-10-17' → '17 Oct'. Lists and sentences. */
export const shortDate7 = (d) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ''));
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}` : String(d || '');
};
/** '2026-10-17' → '17 Oct 2026'. The document, and dates that must be unambiguous. */
export const longDate7 = (d) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ''));
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : String(d || '');
};
/** '…T16:32:00Z' → '4:32 pm'. */
export const timeOf7 = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
};
export const stamp7 = (iso) => (iso ? `${longDate7(String(iso).slice(0, 10))}, ${timeOf7(iso)}` : '');

/** The server's refusals, word for word (§7 of the gap-check prompt). */
export const MSG7 = {
  NOT_ACCEPTED: (name) => `${name} hasn't accepted the terms yet.`,
  ALREADY_OUT: (name) => `An agreement is already out with ${name}.`,
  CLOSED: (date) => `Signatures for this set closed on ${date}.`,
  CANT_EDIT: "An agreement can't be changed once it's sent.",
  NAME_EMPTY: 'Type your full name to sign.',
  TICKS: 'Tick both boxes to sign.',
  HER_FIRST: (name) => `${name} hasn't signed yet.`,
  ALREADY_SIGNED: 'This is already signed.',
  SHORT: (amount) => `Add ${amount} to your wallet to sign this agreement.`,
  WITHDRAW_TOO_LATE: (name) => `${name} has already signed, so this can't be withdrawn.`,
  DECLINE_REASON: 'Choose a reason.',
  DECLINE_NOTE: 'Keep it under 200 characters.',
  NOT_COMPLETE: "The agreement can be downloaded once you've both signed.",
};

export const AIM_LABEL7 = { conversion: 'Pay for Sale', engagement: 'Pay for Content', hybrid: 'Hybrid' };

/** The six reasons she may give at signing — item 5's five plus the agreement itself. */
export const DECLINE_REASONS7 = [
  { code: 'agreement_terms', label: 'The agreement terms' },
  { code: 'fee_too_low', label: 'Fee too low' },
  { code: 'schedule_conflict', label: "Dates don't suit" },
  { code: 'too_much_work', label: 'Too much work' },
  { code: 'other', label: 'Other' },
];

export const C7 = {
  // ── brand ────────────────────────────────────────────────────────────────
  brand: {
    title: (name) => `Agreement · ${name}`,
    draft: 'DRAFT',
    twoOfYou: 'The two of you',
    whatAgreed: 'What was agreed',
    noteFromYou: 'Note from you',
    standardTerms: 'INFLX standard terms',
    standardTermsSub: (v) => `Version ${v} · what the platform does, disputes, cancellation`,
    notEditable: 'Nothing here can be edited. It is built from the terms you both agreed.',
    sendForSignature: 'Send for signature',
    // P3 — the send confirm
    confirmTitle: (name) => `Send this agreement to ${name}?`,
    whatHappens: 'What happens',
    sheSigns: (name) => name,
    first: 'First',
    youSign: 'You sign',
    afterHer: 'After her',
    bothBy: 'Both by',
    confirmHint: (name) => `Nothing can be changed once it is sent. If you need different terms, remove ${name} from the set and invite her again while there is still time.`,
    notYet: 'Not yet',
    send: 'Send',
    sent: 'Agreement sent.',
    // P9 / P10 — the money
    sheSignedYouComplete: (name, date) => `${name} signed on ${shortDate7(date)}. Your signature completes it.`,
    whatItCosts: 'What it costs you',
    theirFee: (name) => `${name}'s fee`,
    campaignFee: (pct) => `INFLX campaign fee · ${pct}%`,
    lockedWhenYouSign: 'Locked when you sign',
    paidOutAs: 'Paid out as',
    toHerWhenYouSign: (name) => `To ${name} when you sign`,
    whenLive: 'When her content is live',
    afterItStaysLive: 'After it stays live',
    enough: (amount) => `Your wallet has ${amount} available. Enough.`,
    locksHint: (amount) => `Signing locks ${amount} of your balance for this collaboration. It can't be spent on anything else.`,
    signAndLock: (amount) => `Sign and lock ${amount}`,
    signAndComplete: 'Sign and complete',
    addToSign: (shortfall) => `Add ${shortfall} to sign`,
    shortLine: (available, needed) => `Your wallet has ${available} available and this needs ${needed}.`,
    addToWallet: (shortfall) => `Add ${shortfall} to wallet`,
    bringYouBack: "We'll bring you straight back here to sign.",
    waitingIfNobody: (name, signedAt, cutoff) => `${name} signed on ${shortDate7(signedAt)} and is waiting. If nobody signs by ${shortDate7(cutoff)}, this closes on its own.`,
    // P11 — the last signature sheet
    signSheetTitle: 'Sign this agreement',
    signerName: "Type the signer's full name",
    signingFor: (brand) => `Signing for ${brand}.`,
    tickRead: (brand) => `I have read the agreement and the INFLX standard terms, and I agree to them for ${brand}.`,
    tickMoney: (locked, released, name) => `I understand ${locked} will be locked now and ${released} released to ${name} straight away.`,
    tickComplete: 'I understand this completes the agreement and opens the shoot plan.',
    irreversible: 'After this, the terms can never be changed inside this collaboration.',
    // P12 — done
    bothSigned: (date) => `Signed by both on ${shortDate7(date)}. This collaboration is live.`,
    signatures: 'SIGNATURES',
    whatHappenedNow: 'What happened just now',
    locked: 'Locked',
    releasedTo: (name) => `Released to ${name}`,
    stillLocked: 'Still locked',
    next: 'Next',
    nextShip: (name) => `Ship the products to ${name}. The shoot plan is open now.`,
    nextVisit: (name) => `Book the store visit with ${name}. The shoot plan is open now.`,
    download: 'Download',
    shootPlan: 'Shoot plan',
    // Item 10 (V1): the button's real name for a store visit.
    planTheVisit: 'Plan the visit',
    // P14 — withdraw
    withdrawTitle: 'Withdraw this agreement?',
    withdrawBody: (name) => `${name} hasn't signed yet. She goes back to waiting for an agreement, and you can send the same one again.`,
    withdrawHint: (name) => `The terms can't be changed. To offer something different, remove ${name} from the set and invite her again while there is still time.`,
    keepIt: 'Keep it',
    withdraw: 'Withdraw',
    withdrawn: 'Agreement withdrawn.',
  },

  // ── creator ──────────────────────────────────────────────────────────────
  creator: {
    title: 'Agreement',
    signBy: (date, days) => `Sign by ${shortDate7(date)} · ${days} ${days === 1 ? 'day' : 'days'} left`,
    whatYouGet: 'What you get',
    fee: 'Fee',
    whenBothSign: 'When you both sign',
    whenLive: 'When your content is live',
    afterItStaysLive: 'After it stays live',
    commission: 'Commission',
    commissionOn: (pct) => `${pct}% on what you sell`,
    commissionPaid: (days) => `After the ${days}-day return window`,
    whatYouDo: 'What you do',
    youPost: 'You post',
    postsOn: 'Posts on',
    mode: 'Mode',
    brandCanReuse: 'Brand can reuse',
    youCanSell: 'You can sell',
    shoppablePosts: 'Shoppable posts',
    atLeast: (n) => `At least ${n}`,
    returningTitle: 'Returning the products',
    returning: (days, brand) => `Send back anything you don't keep within ${days} days of posting. ${brand} pay the return shipping.`,
    standardTerms: 'INFLX standard terms',
    standardTermsSub: (v) => `Version ${v} · read before you sign`,
    noteFrom: (brand) => `Note from ${brand}`,
    sign: 'Sign',
    decline: 'Decline',
    // P6 — her sign sheet
    signSheetTitle: 'Sign this agreement',
    yourName: 'Type your full name',
    nameHint: 'As it should appear on the agreement.',
    tickRead: 'I have read the agreement and the INFLX standard terms, and I agree to them.',
    tickBinding: (brand) => `I understand this becomes binding once ${brand} sign too.`,
    recordHint: 'We record your name, the time and the device you signed from.',
    signAgreement: 'Sign agreement',
    signed: 'Signed. Waiting for them.',
    // P7 — signed, waiting
    waitingFor: (brand, cutoff) => `Signed. Waiting for ${brand} to sign by ${shortDate7(cutoff)}.`,
    nothingBinding: (cutoff) => `Nothing is binding until both signatures are on it. If they don't sign by ${shortDate7(cutoff)}, this closes and neither of you owes anything.`,
    notSignedYet: 'Not signed yet',
    // P8 — declining
    declineTitle: 'Decline this agreement?',
    declineBody: (brand) => `This ends the collaboration with ${brand} for this set. They can invite you again if there is still time.`,
    whyTitle: 'Why are you saying no?',
    noteLabel: 'Anything else (optional)',
    noteHint: 'The brand sees this.',
    declineAgreement: 'Decline agreement',
    declined: 'Agreement declined.',
    // P4 / P16 — the cards
    readyToSign: (cutoff) => `Agreement ready to sign · by ${shortDate7(cutoff)}`,
    waitingForAgreement: (brand) => `Waiting for the agreement from ${brand}.`,
    inWallet: (amount, date) => `${amount} is in your wallet. Signed ${shortDate7(date)}.`,
    // A commission-only collaboration pays nothing on signing — there is no fixed money to
    // pay 25% of. Saying "₹0 is in your wallet" describes it as a failure when it is simply
    // how a Pay for Sale deal works: she earns when she sells.
    signedEarnAsYouSell: (date) => `Signed ${shortDate7(date)}. You earn as you sell.`,
    // Both signed, and the first payment has not landed yet — the rules pay it at the
    // signature, so this is a state we should almost never see, and must not call zero.
    signedPaymentComing: (date) => `Signed ${shortDate7(date)}. Your first payment is on its way.`,
    nextTheyShip: 'They ship your products',
    nextBookVisit: 'Book your store visit',
    agreementLink: 'Agreement',
    // Item 10: the button that opens her store visit from the signed agreement.
    storeVisit: 'Store visit',
  },
};

/** The three payments, as amounts, in her words. */
export const splitRows7 = (money, creator = true) => {
  if (!money || !money.split) return [];
  const c = creator ? C7.creator : C7.brand;
  return [
    { label: creator ? c.whenBothSign : 'On signing', value: rupees5(money.split.t1) },
    { label: c.whenLive, value: rupees5(money.split.t2) },
    { label: c.afterItStaysLive, value: rupees5(money.split.t3) },
  ];
};

export default C7;
