/**
 * Item 11 — every string the Remote screens show, word for word from the locked mockups
 * (R1–R16) and the gap-check prompt §6–§7.
 * Contract: features/item11-remote
 *
 * MSG11 MIRRORS backend/src/services/productionCopy.js. The server decides every refusal and
 * sends the sentence with it, so a screen normally shows what it was given; these exist for
 * the checks the app makes before it asks (a pincode of five digits, a note over 200
 * characters) and so a reviewer can read both halves side by side and see they match.
 *
 * Dates go through item 10's helpers — no Intl, because Hermes ships without the locale data.
 */
import { day10, longDay10, whenShort10, stamp10, istDay10, todayIst10, dayParts } from '../shoot/copy10';
import { rupees5, first } from '../invitations/copy5';

export { day10, longDay10, whenShort10, stamp10, istDay10, todayIst10, rupees5, first };

export const MSG11 = {
  NAME_REQUIRED: 'Enter your name.',
  PHONE_REQUIRED: 'Enter a 10-digit mobile number.',
  STREET_REQUIRED: 'Enter your street and house.',
  // features/courier-ready-addresses — a courier keeps 190 characters of an address and no more.
  STREET_LONG: 'Keep it under 190 characters.',
  PINCODE_REQUIRED: 'Enter a 6-digit pincode.',
  STATE_REQUIRED: 'Choose your state.',
  CITY_REQUIRED: 'Choose your nearest major city.',
  NOTE_LONG: 'Keep it under 200 characters.',
  SIZES_LONG: 'Keep it under 100 characters.',
  CHECK_NOTE_LONG: 'Keep it under 300 characters.',
  BOX_REQUIRED: 'Choose a box size.',
  WEIGHT_REQUIRED: 'Enter the packed weight.',
  NO_LINES: 'Add at least one product.',
  TOO_MANY_LINES: 'A parcel can hold up to 20 products.',
  TOO_MANY_OF_VARIANT: 'At most 5 of one size.',
  VARIANT_REQUIRED: 'Choose a size for this product.',
  PICKUP_DAY_PAST: 'Choose a pickup day from tomorrow.',
};

/** A day, in the words R12's chips use: "Tomorrow", "Fri 1 Nov". */
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function pickupDayLabel(day, today) {
  const p = dayParts(day);
  if (!p) return '';
  const t = dayParts(today);
  const diff = Math.round((Date.UTC(p.y, p.m, p.d) - Date.UTC(t.y, t.m, t.d)) / 86400000);
  if (diff === 1) return 'Tomorrow';
  return `${DAYS[p.wd]} ${day10(day)}`;
}

/** The three box presets of R6, in the words the screen uses. */
export const BOXES11 = [
  { key: 'small',  label: 'Small',  dims: '25 × 20 × 5 cm' },
  { key: 'medium', label: 'Medium', dims: '35 × 25 × 10 cm' },
  { key: 'large',  label: 'Large',  dims: '45 × 35 × 15 cm' },
  { key: 'other',  label: 'Other',  dims: 'Type the size' },
];

/** The tracking step line of R8. */
export const TRACK_STEPS = ['Booked', 'Collected', 'On the way', 'Out for delivery', 'Delivered'];
export function trackIndex(parcel) {
  if (!parcel) return -1;
  if (parcel.deliveredAt) return 4;
  if (parcel.outForDeliveryAt) return 3;
  if (parcel.collectedAt) return 2;
  if (parcel.bookedAt) return 1;
  return 0;
}

export const C11 = {
  /* ── R1 · the brand, waiting ─────────────────────────────────────────── */
  brand: {
    waiting: (name) => `${first(name)} sends her delivery address first. You pick the products once she has — nothing to do yet.`,
    pickDisabled: 'Opens when her address arrives.',
    pick: 'Pick products',
    addressLocked: 'Locked',
    herSizes: 'Her sizes',
    scopeLine: (label) => `Her selling scope · ${label}`,
    scopeCatalogue: 'Your catalogue',
    ofTwenty: (n) => `${n} of 20`,
    pickHint: 'Return items come back after the shoot at your cost. Gifts are hers to keep. At most 5 of one size.',
    noReturnPickup: (pin, name) => `Couriers can't collect returns from ${pin}. If you mark this Return, ${first(name)} sends it back herself and you cover the cost directly.`,

    /* R6 · booking */
    collectedFrom: 'Collected from',
    branchNeedsAddress: 'Needs a street address and pincode',
    weightHint: 'Weigh it packed. If the courier finds it heavier, the difference is charged to you later.',
    shippingTo: (name) => `Shipping to ${first(name)}`,
    returnLocked: (n) => `Return pickup, locked for ${n} item${n === 1 ? '' : 's'}`,
    fromWallet: 'From your wallet',
    gstLine: "GST included. Courier chosen by INFLX. Anything the return doesn't use comes back to you.",
    availableLine: 'Available in your wallet',
    feeNeverUsed: (fee, name) => `The ${rupees5(fee)} locked for ${first(name)}'s fee is never used for shipping.`,
    bookAndPay: (n) => `Book and pay ${rupees5(n)}`,
    shortTitle: (n) => `Add ${rupees5(n)} to book this parcel`,
    shortBody: (n) => `You have ${rupees5(n)} available`,
    addMoney: 'Add money',
    backToProducts: 'Back to products',

    /* R7 · booked */
    bookedOn: (date, branch) => `Booked on ${day10(date)}. The courier collects from ${branch || 'your branch'}.`,
    downloadLabel: 'Download label',
    labelHint: 'Print it and stick it on the parcel before the courier arrives.',
    cancelBooking: 'Cancel booking',
    cancelHint: (n) => `Only until the courier collects. You get the ${rupees5(n)} back and can change the products.`,
    cancelConfirm: 'Cancel this booking?',
    cancelConfirmBody: (n) => `The courier is told, ${rupees5(n)} comes back to your wallet, and the product list opens again.`,

    /* R10 · a difference */
    differenceTitle: (name, date) => `${first(name)} reported a difference on ${day10(date)}.`,
    differenceBody: 'Her shoot carries on. If you want INFLX to look at it, report it — it becomes a dispute and stays on record.',
    report: 'Report to INFLX',
    carryOn: "It's fine, carry on",
    reported: 'Reported to INFLX',

    /* R13 · the return arrived */
    returnHere: (branch, date) => `Your move. The return reached ${branch || 'your branch'} on ${day10(date)}.`,
    autoConfirms: (date) => `If you do nothing, this confirms itself on ${longDay10(date)}.`,
    confirmReturn: 'Confirm the return',
    somethingWrong: "Something's missing or damaged",

    /* R14 · done */
    returnConfirmed: (date) => `Return confirmed on ${day10(date)}. That's everything on the products side.`,
    recordTitle: 'The parcel, start to finish',
    charges: 'Courier charges',
    chargeShipping: 'Shipping',
    chargeReturn: 'Return pickup',
    chargeBack: 'Back to your wallet',
    owed: (n) => `Owed from a parcel — ${rupees5(n)}`,

    /* R15a · Return → Gift */
    giftTitle: (name) => `Let ${first(name)} keep it?`,
    giftBody: "It won't come back, and nothing is charged. You can't turn it into a Return again.",
    giftConfirm: 'She keeps it',

    /* R15b · every other state */
    attemptFailed: (n, why) => `The courier couldn't deliver${why ? ` — ${why}` : ''}. ${n === 1 ? 'One attempt' : `${n} attempts`} so far; they'll try again.`,
    backToStore: (why) => `The parcel came back to the store${why ? ` — ${why}` : ''}.`,
    bookAgain: 'Book it again',
    bookAgainOnce: 'You can book it again once.',
    overdue: (name, date) => `${first(name)}'s return was due ${day10(date)} and hasn't been sent. Nothing moves on its own — you can report it to INFLX if you need to.`,
    reportOverdue: 'Report it to INFLX',
    delayed: (locked, name, fee) => `Nothing moved: ${rupees5(locked)} is still locked and ${first(name)} keeps her ${rupees5(fee)}.`,
    weightDiff: (courier, n, x, y) => `${courier || 'The courier'} charged ${rupees5(n)} more: weighed ${x} kg, entered ${y} kg. Taken from your wallet — or owed from your next money in if it's short.`,
  },

  /* ── the creator ─────────────────────────────────────────────────────── */
  creator: {
    /* R2 */
    cardTitle: 'Send your delivery address',
    yourMove: 'Your move',

    /* R3 */
    formTitle: 'Where should they send it?',
    nameLabel: 'Your name',
    phoneLabel: 'Contact number',
    phoneHint: 'Your login number. Change it if the courier should call someone else.',
    streetLabel: 'House and street',
    streetHint: 'House or flat number, building, street and area.',
    pincodeLabel: 'Pincode',
    stateLabel: 'State',
    cityLabel: 'Your nearest major city',
    cityHint: 'From your profile. Change it if you want it sent somewhere else.',
    noteLabel: 'Delivery note',
    notePlaceholder: 'A landmark, or a good time to deliver',
    sizesLabel: 'Your sizes',
    sizesHint: (brand) => `So ${brand} send the right sizes.`,
    sizesPlaceholder: 'Top M, bottom 28, shoe 6',
    reviewAndSend: 'Review and send',

    /* R4a · the confirm sheet */
    confirmTitle: 'Send this to them?',
    coverageOk: (pin) => `Couriers deliver and collect returns at ${pin}.`,
    coverageNoReturn: (pin, brand) => `Couriers deliver to ${pin} but can't collect returns from it. You can still send it — ${brand} will be told before they choose what to send back.`,
    lockWarning: (brand) => `This is where they ship your products. You can't change it after sending.`,
    notYet: 'Not yet',
    sendIt: 'Send',

    /* R8 */
    onTheWay: 'On the way',
    whatsComing: "What's coming",
    giftsYours: (brand) => `Gifts are yours to keep. Return items go back after your shoot — ${brand} pay for that too.`,
    tagReturn: 'Return',
    tagGift: 'Gift',
    attemptFailed: "The courier couldn't deliver today. Please be available for the next attempt.",

    /* R9 · checking */
    checkTitle: 'What turned up?',
    checkHint: (brand) => `Something wrong won't stop your shoot. ${brand} are told, and you carry on.`,
    received: 'Received',
    missing: 'Missing',
    damaged: 'Damaged',
    // ui-walk-fixes (closing pass): this was a second `notePlaceholder` in this same block. The
    // later one silently won, so the Delivery note box on her address screen (R3, above) asked
    // "What was wrong?". It has its own key now; its one reader is ThreeWayCheck11 (bits11.js).
    checkNotePlaceholder: 'What was wrong?',
    save: 'Save',

    /* R11 · shoot done */
    checkedOn: (date) => `Checked on ${day10(date)}. Shoot whenever you're ready.`,
    finished: "I've finished the shoot",
    finishedHint: (brand) => `Tap this once you've shot. It opens your content step. ${brand} don't need to confirm it.`,
    returnCard: (n, date) => `${n} item${n === 1 ? '' : 's'} to send back · Back by ${longDay10(date)}`,

    /* R12 · the return */
    sendBack: 'Send it back',
    pickADay: 'When can they collect?',
    yourAddress: 'They collect from',
    payNothing: (brand) => `You pay nothing. ${brand} cover the return.`,
    bookPickup: 'Book the pickup',
    pickupBooked: (date) => `Pickup booked for ${longDay10(date)}. Have the items ready.`,

    /* Q1 · the no-courier return */
    selfSendTitle: (pin, brand) => `Couriers can't collect from ${pin}. Send it back to ${brand} yourself — they cover the cost — then tap I've sent it back.`,
    selfSent: "I've sent it back",
    selfSentNoteLabel: 'How did you send it? (optional)',
    selfSentNotePlaceholder: 'India Post, receipt number…',
    selfSentDone: (date) => `You marked it sent on ${day10(date)}. Nothing more to do.`,

    /* R16 · every other state */
    notSentYet: (brand) => `${brand} haven't sent your products yet. Nothing for you to do.`,
    backToStore: (brand) => `Your parcel went back to ${brand}. They'll send it again.`,
    correctAddress: 'Correct my address',
    correctOnce: 'You can correct it once.',
    keepIt: (brand) => `${brand} say you can keep it. It doesn't need to go back.`,
    overdue: (date) => `The items were due back on ${longDay10(date)}. It costs you nothing — book the pickup when you can.`,
    delayed: (fee) => `The posting date passed before the shoot finished. Nothing has changed — what you were paid at signing stays yours${fee ? `: ${rupees5(fee)}` : ''}.`,
  },

  /* ── shared ──────────────────────────────────────────────────────────── */
  steps: ['Agreement signed', 'Products', 'Content', 'Live and paid'],
  loadWhat: 'this shoot',
  saveFailed: "That didn't go through. Try again.",
};
