/**
 * Every word the brand's wallet says, from the locked mockups W1–W9.
 * Contract: features/brand-wallet-on-the-phone
 *
 * Two sentences here are load-bearing and were argued for in the spec:
 *   · "Nothing is committed to anyone until you sign" — a brand who believes that adding money
 *     SPENDS money will not add money. It is said on the way in and again on the way out.
 *   · the test-mode paragraph — while payments are simulated the screen says so rather than
 *     implying a card was charged. It disappears when live payments are switched on, and not one
 *     screen changes.
 */

const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export const WALLET = {
  // Item 17: the Wallet tab's own words moved to copy17.js with the rebuilt tab (board BW1, BW2).
  add: {
    title: 'Add money',
    howMuch: 'How much',
    quick: [5000, 10000, 25000, 50000],
    exact: (n) => `Exactly ${rupees(n)}`,
    commitsNothing: 'This money sits in your wallet until you sign an agreement. Nothing is committed to anyone until then.',
    extraStays: 'Add more than you need and the extra stays in your wallet for the next agreement.',
    payBy: 'Paid by UPI, card or net banking.',
    cta: (n) => `Add ${rupees(n)}`,
    ctaPlain: 'Add money',

    // W4 — arriving from an agreement that cannot be signed yet.
    needTitle: (who, n) => `${who}'s agreement needs ${rupees(n)}`,
    needBody: (who, fee, campaignFee) =>
      `${rupees(fee)} for ${who} and ${rupees(campaignFee)} campaign fee. We'll bring you straight back to sign.`,
    needBodyPlain: (who) => `We'll bring you straight back to ${who}'s agreement.`,

    // W5
    paying: 'Talking to your bank',
    payingHint: "Don't close the app. If you cancelled, nothing has been taken.",
    testMode:
      'While the platform is in test mode this step completes on its own and no real money moves. ' +
      'It becomes a real payment sheet the moment live payments are switched on — the screens do not change.',

    // W6
    addedTitle: (n) => `${rupees(n)} added`,
    addedBody: (n) => `Your wallet now has ${rupees(n)} available.`,
    backTo: (who) => `Back to ${who}'s agreement`,
    backToAgreement: 'Back to the agreement',
    stay: 'Stay in Wallet',
    nothingCommitted: (who) => `Nothing is committed to ${who} yet. The money moves when you sign.`,
    nothingCommittedPlain: 'Nothing is committed to anyone yet. The money moves when you sign an agreement.',

    // W7 — she cancelled, or the bank refused.
    failedTitle: 'Payment not completed',
    failedBody: 'Nothing has been taken from your account, and your wallet is unchanged.',
    // The one case where we must NOT claim the wallet is unchanged: the payment went through and
    // our confirmation did not. Never say "nothing was taken" when we do not know.
    unsureTitle: "We couldn't confirm the payment",
    unsureBody: 'If money left your account it will be credited within a few minutes. Check your wallet before trying again.',
    retry: 'Try again',

    errors: {
      min: 'Enter at least ₹1.',
      max: 'Enter an amount under ₹10,00,000.',
      number: 'Enter an amount in rupees.',
    },
  },
};

// Item 17: the ledger-row labels (txLabel / txAmount) went with the tab's activity list — History
// (BW10) gets its words from the server now.
export const rupeesW = rupees;
