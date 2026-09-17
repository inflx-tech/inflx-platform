/**
 * The words on the creator's temporary wallet.
 * Contract: features/creator-wallet-and-first-payment
 *
 * Written for someone who has just been paid for the first time and wants to know three things:
 * what is mine, what is still coming, and when. Nothing here promises a date the platform cannot
 * keep — the second payment depends on the brand confirming her post is live, and it says so.
 */
export const CREATOR_WALLET = {
  title: 'Wallet',

  yours: 'Yours now',
  yoursHint: 'Money that has been released to you.',

  stillToCome: 'Still to come',
  stillToComeSub: 'held for you',

  earnedEver: 'Earned so far',
  earnedEverSub: 'across all collaborations',

  commissionTitle: (amount) => `${amount} commission on the way`,
  commissionBody: 'Commission is confirmed after the return window closes, then it moves into your wallet.',

  waitingOn: 'Held for you',
  aCollaboration: 'A collaboration',
  tranche: (n) => (n === 2 ? 'When your post goes live and the brand confirms it'
    : n === 3 ? 'After your post has stayed live'
      : 'On signing'),

  nothingHeldTitle: 'Nothing held right now',
  nothingHeldBody: 'When a brand signs an agreement with you, the money is locked here and released in three parts.',

  standInNote:
    'This is a simple view while the full wallet is being designed. Withdrawals and your payment ' +
    'and tax details are in Profile for now.',
};
