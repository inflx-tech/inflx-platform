/**
 * Every sentence on the ordering screens, in one place — the words of the locked board.
 * Contract: features/shopper-ordering · board shopper-ordering-mockups-final.html · rules v1.13 §6
 * Plus features/shopper-walk-fixes (board S1–S7, G1–G2): the product page, the second after
 * Add to bag, and a deal that stays whole in the bag.
 */
export const CO = {
  // O1, O2 — simple posts
  addToBag: 'Add to bag',
  buyNow: 'Buy now',
  goToBag: (n) => `Go to bag · ${n}`,
  inYourBag: (size) => `✓ In your bag${size ? ` · ${size}` : ''}`,
  colour: (c) => `Colour: ${c}`,
  size: 'Size',
  sizeChart: 'Size chart ›',
  onlyLeft: (n) => `Only ${n} left`,
  chooseSize: 'Choose a size',
  addedToBag: 'Added to your bag',
  // shopper-walk-fixes · S5–S7: the second after Add to bag
  addedLine: '✓ Added to your bag',
  goToBagNow: 'Go to bag ›',
  // shopper-walk-fixes · S1–S4: products in a post, and the product page
  addProduct: (name) => `Add ${name} to bag`,
  saveProduct: 'Save with this post',
  savedProduct: 'Saved with this post',
  photoCount: (i, n) => `${i} / ${n}`,
  productDetails: 'Product details',
  description: 'Description',
  brandRow: 'Brand',
  categoryRow: 'Category',
  returnsRow: 'Returns',
  soldBy: (brand, first) => [brand ? `Sold by ${brand}` : null, first ? `from ${first}'s post` : null].filter(Boolean).join(' · '),
  productGone: 'This product is no longer in this post.',
  // D1 — a deal post
  buildDeal: 'Build your deal',
  dealCounts: (p, g) => `${p} product${p === 1 ? '' : 's'}${g ? ` · ${g} gift${g === 1 ? '' : 's'}` : ''}`,
  tillDate: (d) => `till ${d}`,
  till: (d) => `Till ${d}.`,
  // P1–P3 — picking
  tapToChoose: 'Tap to choose',
  picked: (c, s) => `✓ Picked${[c, s].filter(Boolean).length ? ` · ${[c, s].filter(Boolean).join(' · ')}` : ''}`,
  chosen: '✓ Chosen',
  pick: (c, s) => `Pick${[c, s].filter(Boolean).length ? ` · ${[c, s].filter(Boolean).join(' · ')}` : ''}`,
  remove: 'Remove',
  change: 'Change',
  quantity: 'Quantity',
  nothingPicked: 'Nothing picked yet',
  reviewDeal: 'Review your deal',
  soldOut: 'Sold out',
  // shopper-app-fixes · F6: every size of the product has gone
  soldOutEverySize: 'Sold out in every size',
  countsToward: (line) => `Counts toward ${line}`,
  // shopper-app-fixes · N7: "1 size", and nothing at all for a product with no sizes
  sizesCount: (c, s) => [c > 1 ? `${c} colours` : null, s ? `${s} size${s === 1 ? '' : 's'}` : null].filter(Boolean).join(' · '),
  // shopper-app-fixes · N1: a post that has ended, when the server sends no sentence of its own
  postEnded: 'This post is no longer in the shop',
  // B — BOGO
  youPayFor: '1 · The one you pay for',
  yourFreeOne: '2 · Your free one',
  nextFree: 'Next: your free one',
  pickPair: 'Pick this pair',
  sameProduct: 'The same product, any colour or size',
  backToPaid: '‹ Back to the paid one',
  anotherPair: '+ Another pair',
  free: 'Free',
  // K — bundle
  putInSet: (n, of) => `Put in set · slot ${n} of ${of}`,
  tapToFill: 'Tap a product to fill',
  inSet: (size) => `✓ In set${size ? ` · ${size}` : ''}`,
  setOnePrice: (price) => `the set costs ${price}`,
  done: (c, s) => `Done${[c, s].filter(Boolean).length ? ` · ${[c, s].filter(Boolean).join(' · ')}` : ''}`,
  tapToChooseColourSize: 'Tap to choose colour and size',
  // G — free gift
  stepBuy: '1 · Choose what you buy',
  stepGift: '2 · Choose your gift',
  worth: (v) => `worth ${v}`,
  left: (n) => `${n} left`,
  allGiven: 'All given',
  chooseGift: 'Choose this gift',
  yourGift: (name) => `Your gift: ${name}`,
  giftAddedByItself: 'added by itself when you reach it',
  nextChooseGift: 'Next: choose your gift',
  giftLocked: 'Unlocks when you reach the offer',
  // D4 — review
  yourDeal: 'Your deal',
  freeGift: (name) => `Free gift: ${name}`,
  changeGift: 'Change gift',
  items: (n) => `${n} item${n === 1 ? '' : 's'}`,
  youPay: 'You pay',
  youSave: (v) => `You save ${v}`,
  gift: 'Gift',
  freeWorth: (v) => `Free (worth ${v})`,
  // O6, O7, D11 — the bag
  bag: (n) => `Bag · ${n} item${n === 1 ? '' : 's'}`,
  bagEmpty: 'Your bag is empty',
  bagEmptySub: 'Add from a post and it waits here.',
  // shopper-app-fixes · F9: a bag that could not be read is never shown as an empty one
  bagTitle: 'Bag',
  bagLoadFailed: "Couldn't load your bag",
  bagNotSaved: "Couldn't update your bag",
  editDeal: 'Edit deal',
  // shopper-walk-fixes · G1, G2: a deal made of fixed pieces stays whole (set, bundle, buy one get one)
  removeDeal: 'Remove deal',
  wholeDeal: 'The whole deal',
  dealWhole: {
    fixed: 'Sold as a set. To change a size, or to buy two sets, tap Edit deal.',
    pick_any: 'A bundle is bought together. To change it, tap Edit deal.',
    mix_match: 'A bundle is bought together. To change it, tap Edit deal.',
    bogo: 'To add another pair, tap Edit deal.',
  },
  times: (n) => `×${n}`,
  addMore: '+ Add more from this post',
  moveToSaved: 'Move to Saved',
  unticked: "Unticked items stay in the bag and don't go to checkout. Deals are worked out on the ticked items.",
  itemsNormal: 'Items (normal price)',
  offerSavings: 'Offer savings',
  delivery: 'Delivery',
  codFee: 'Cash on delivery fee',
  total: 'Total',
  freeDelivery: 'Free',
  continueTo: (v) => `Continue · ${v}`,
  signInToOrder: 'Sign in to place your order',
  signInToOrderSub: 'Your bag, saves and follows move to your account.',
  getOtp: 'Get OTP',
  // O9, O10 — addresses
  chooseAddress: 'Choose an address',
  addresses: 'Addresses',
  addNew: '+ Add a new address',
  deliverHere: 'Deliver here',
  edit: 'Edit',
  delete: 'Delete',
  defaultTag: 'Default',
  addAddress: 'Add an address',
  editAddress: 'Edit address',
  f: { name: 'Name', phone: 'Mobile number (10 digits)', house: 'House, flat, building', area: 'Area, street', landmark: 'Landmark (optional)',
    pincode: 'Pincode (6 digits)', city: 'City', state: 'State' },
  labels: ['Home', 'Work', 'Other'],
  makeDefault: 'Make this my default address',
  saveAddress: 'Save address',
  pickState: 'Choose the state',
  deleteAsk: 'Delete this address? Past orders keep their own copy.',
  // O11, O12 — review and pay
  reviewOrder: 'Review order',
  savingNote: (v) => `You're saving ${v}`,
  deliverTo: 'Deliver to',
  arrivesBy: (d) => `Arrives by ${d}`,
  fromPost: (name) => `from ${name}'s post`,
  paymentMethod: 'Payment method',
  payOnline: 'UPI, cards, net banking',
  payOnlineSub: 'Google Pay, PhonePe, Paytm, cards, net banking — through Razorpay',
  cod: 'Cash on delivery',
  codSub: (fee) => (fee > 0 ? `A ₹${fee} fee is added` : 'No extra fee'),
  placeOrder: (v) => `Place order · ${v}`,
  parcels: (n) => `${n} parcel${n === 1 ? '' : 's'}, one payment`,
  changed: 'Something changed since your bag. Check the new total before you pay.',
  holdNote: 'An online payment has 15 minutes; your items are held meanwhile.',
  paymentCancelled: 'Payment cancelled. Nothing was charged.',
  paymentFailed: "The payment didn't go through. Nothing was ordered.",
  // shopper-app-fixes · F1: she paid, but INFLX could not be reached to confirm it. Not a failure:
  // her items stay held and the payment is matched to this order by itself. She must not pay twice.
  paymentUnconfirmed: "We couldn't confirm your payment yet. Please don't pay again. Tap Check again, or look in My orders in a minute.",
  checkAgain: 'Check again',
  // shopper-app-fixes · F1: the payment arrived after the items had been released, and they are gone
  soldOutWhilePaying: 'It sold out while you were paying. Your payment is being refunded.',
  testPayment: 'Test payment',
  testPaymentBody: 'Payments are in test mode. Confirm to simulate a successful payment.',
  confirm: 'Confirm',
  cancel: 'Cancel',
  // O13
  orderPlaced: 'Order placed',
  paidBy: (v, how) => `${v} ${how === 'cod' ? 'to pay on delivery' : 'paid online'}`,
  myOrders: 'My orders',
  keepShopping: 'Keep shopping',
  // O14, O15
  noOrders: 'No orders yet',
  noOrdersSub: 'What you buy shows here, with where it is.',
  // shopper-app-fixes · N4: a search or a filter with no match is not "No orders yet"
  nothingMatches: 'Nothing matches',
  nothingMatchesSub: (q, filter) => (q && filter ? `No order under “${filter}” matches “${q}”.`
    : q ? `No order matches “${q}”.` : `You have no orders under “${filter}”.`),
  // N4 adds Packed and Out for delivery, in the order a parcel moves
  filters: [['', 'All'], ['confirmed', 'Confirmed'], ['packed', 'Packed'], ['dispatched', 'Shipped'], ['out_for_delivery', 'Out for delivery'],
    ['delivered', 'Delivered'], ['cancelled', 'Cancelled']],
  track: 'Track',
  cancelItem: 'Cancel',
  needHelp: 'Need help',
  courier: (name, t) => `${name} · ${t}`,
  paid: 'Paid',
  // shopper-app-fixes · N3: cash on delivery is paid when the parcel is handed over, not before
  toPayOnDelivery: (v) => `To pay ${v} on delivery`,
  viewPost: 'See the post',
  cancelClosed: 'It has shipped. You can return it once delivered.',
  // O16, O17
  cancelTitle: 'Cancel',
  why: 'Why are you cancelling?',
  writeNote: 'Write a note',
  confirmCancel: 'Cancel item',
  cancelled: 'Cancelled',
  refundOnWay: (v) => `Refund of ${v} to your original payment method in 5–7 working days.`,
  noRefund: 'A refund is not needed; this was pay on delivery.',
  refundFailed: "We couldn't start the refund. INFLX will sort it out and tell you.",
  cancelledWhat: 'The stock goes back to the store and the creator is not paid for it.',
};

/** 'YYYY-MM-DD' or ISO → 'Sat, 4 Oct'. */
export function dayLabel(v) {
  if (!v) return '';
  const d = new Date(String(v).length === 10 ? `${v}T00:00:00` : v);
  if (Number.isNaN(d.getTime())) return '';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}
