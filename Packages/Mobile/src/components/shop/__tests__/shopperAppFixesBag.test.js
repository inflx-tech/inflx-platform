/**
 * shopper-app-fixes — the bag itself, the size sheet, and the size's own price.
 * Contract: features/shopper-app-fixes · 01-spec.md (F6, F9, F10) · BUILD_API.md
 *
 *   F9   · the bag icon's count is read once when the app opens (the first icon asks), without the
 *          "just added" mark; a signed-in shopper with nothing on the phone gets it at sign-in too
 *        · a bag that could not be read is an error, never an empty bag: `loadBag` throws, and
 *          `addToBag` / `replacePost` save nothing after it; the size sheet says it
 *   F6   · sold out in every size: "Sold out in every size", Add and Buy now off; the products
 *          sheet's tile reads "Out of stock" once the deal data says so
 *   F10  · `priceFor`: the chosen size's own price, as the server sends it per size; the size
 *          sheet shows it and hands it back as `price_seen`
 */
import React from 'react';
import { Vibration, StyleSheet } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../../../services/api', () => ({
  followerApi: {
    deal: jest.fn(), getBag: jest.fn(), putBag: jest.fn(), mergeBag: jest.fn(),
    saveProduct: jest.fn(), unsaveProduct: jest.fn(), postEvents: jest.fn(() => Promise.resolve({ success: true })),
  },
  setDeviceHeader: jest.fn(), clearSession: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../../services/events', () => ({ track: jest.fn(), flush: jest.fn() }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => cb(), [cb]); } }));

const { followerApi } = require('../../../services/api');
const { shopStore } = require('../shopStore');
const bag = require('../bag');
const { BagButton, SizeSheet, ChoicePicker, priceFor, isSoldOut, chosenSize } = require('../orderBits');
const { ShopSheet } = require('../bitsShop');

const ok = (data) => ({ success: true, data });
const OFFLINE = { success: false, error: { code: 'NETWORK_ERROR', message: 'Cannot connect to server. Check your connection.' } };
const texts = (node) => node.findAll((n) => typeof n.type === 'string' && n.type === 'Text').map((n) => [].concat(n.props.children).filter((c) => typeof c === 'string' || typeof c === 'number').join(''));
const off = (el) => el.props.accessibilityState.disabled;
const phoneBag = async () => JSON.parse(await AsyncStorage.getItem('inflx_bag_v1')) || [];
const line = (ref, product_id, extra = {}) => ({ ref, post_id: 'p1', product_id, gift_item_id: null, colour: 'Blue', size: 'M', qty: 1, role: 'buy', ticked: true, price_seen: null, ...extra });
const row = (id, product_id, extra = {}) => ({ id, ...line(id, product_id, extra) });     // a line as her account holds it
const marked = (icon) => StyleSheet.flatten(icon.props.style).borderWidth === 1.5;       // the ring that says "just added" (S6)

async function guest() { await AsyncStorage.clear(); shopStore._reset(); }
async function signedIn() {
  await AsyncStorage.setItem('inflx_token', 't');
  await AsyncStorage.setItem('inflx_user', JSON.stringify({ role: 'follower' }));
  shopStore._reset();
}
// Every test starts as the app does when it has just been opened: nothing counted yet.
beforeEach(async () => { jest.clearAllMocks(); await guest(); bag._resetBag(); });

/* ═══════════════════════════════════════════ F9 · the count when the app opens */

describe('F9 · the bag icon has its number as soon as the app is open', () => {
  it('signed in: the first bag icon reads her bag once — it used to show nothing until she opened the bag', async () => {
    await signedIn();
    followerApi.getBag.mockResolvedValue(ok({ lines: [row('a', 'polo', { qty: 2 }), row('b', 'casio'), row('g', null, { gift_item_id: 'coin', role: 'gift' })] }));
    const first = render(<BagButton />);
    expect(first.queryByTestId('bag-count')).toBeNull();                       // not known yet
    await waitFor(() => expect(first.getByTestId('bag-count').props.children).toBe(3));    // a free gift is not counted
    expect(first.getByTestId('open-bag').props.accessibilityLabel).toBe('Bag, 3 items');
    expect(marked(first.getByTestId('open-bag'))).toBe(false);                 // a number, not "you just added something"
    // every other icon has it at once, and her bag is not read again for it
    const second = render(<BagButton />);
    expect(second.getByTestId('bag-count').props.children).toBe(3);
    await act(async () => {});
    expect(followerApi.getBag).toHaveBeenCalledTimes(1);
  });

  it('a guest: the count comes from the bag kept on the phone', async () => {
    await AsyncStorage.setItem('inflx_bag_v1', JSON.stringify([line('a', 'polo', { qty: 4 })]));
    const r = render(<BagButton />);
    await waitFor(() => expect(r.getByTestId('bag-count').props.children).toBe(4));
    expect(followerApi.getBag).not.toHaveBeenCalled();
    expect(marked(r.getByTestId('open-bag'))).toBe(false);
  });

  it('adding after that still marks the icon — only the count read at opening is quiet', async () => {
    await AsyncStorage.setItem('inflx_bag_v1', JSON.stringify([line('a', 'polo')]));
    const r = render(<BagButton />);
    await waitFor(() => expect(r.getByTestId('bag-count').props.children).toBe(1));
    await act(async () => { await bag.addToBag([line('b', 'casio')]); });
    expect(r.getByTestId('bag-count').props.children).toBe(2);
    expect(marked(r.getByTestId('open-bag'))).toBe(true);
  });

  it('any read is quiet — opening the Bag before the first count is back does not mark the icon either', async () => {
    await signedIn();
    let answer;
    followerApi.getBag.mockReturnValueOnce(new Promise((res) => { answer = res; }));       // the count read at opening, still on its way
    followerApi.getBag.mockResolvedValue(ok({ lines: [row('a', 'polo', { qty: 2 })] }));
    const r = render(<BagButton />);
    await act(async () => { await bag.loadBag(); });                                       // she opens the Bag
    expect(r.getByTestId('bag-count').props.children).toBe(2);
    expect(marked(r.getByTestId('open-bag'))).toBe(false);
    await act(async () => { answer(ok({ lines: [] })); });
    expect(r.getByTestId('bag-count').props.children).toBe(2);
  });

  it('a read that fails leaves the icon as it was, and the next icon asks again', async () => {
    await signedIn();
    followerApi.getBag.mockResolvedValue(OFFLINE);
    const first = render(<BagButton />);
    await waitFor(() => expect(followerApi.getBag).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(first.queryByTestId('bag-count')).toBeNull();
    followerApi.getBag.mockResolvedValue(ok({ lines: [row('a', 'polo')] }));
    const second = render(<BagButton />);
    await waitFor(() => expect(second.getByTestId('bag-count').props.children).toBe(1));
    expect(first.getByTestId('bag-count').props.children).toBe(1);             // the first icon is told too
    expect(followerApi.getBag).toHaveBeenCalledTimes(2);
  });

  it('a slow first read never undoes a newer count', async () => {
    await signedIn();
    let answer;
    followerApi.getBag.mockReturnValueOnce(new Promise((res) => { answer = res; }));
    followerApi.getBag.mockResolvedValue(ok({ lines: [row('a', 'polo')] }));
    followerApi.putBag.mockImplementation(async (lines) => ok({ lines: lines.map((l, i) => ({ id: `s${i}`, ...l })) }));
    const r = render(<BagButton />);
    await act(async () => { await bag.addToBag([line('b', 'casio')]); });       // she adds before the first read is back
    expect(r.getByTestId('bag-count').props.children).toBe(2);
    await act(async () => { answer(ok({ lines: [] })); });                     // the old answer arrives late
    expect(r.getByTestId('bag-count').props.children).toBe(2);
  });

  it('sign-in with nothing on the phone to move: the icon is told what is in her account\'s bag', async () => {
    const r = render(<BagButton />);
    await act(async () => {});
    expect(r.queryByTestId('bag-count')).toBeNull();                           // a guest with an empty bag
    await signedIn();
    followerApi.getBag.mockResolvedValue(ok({ lines: [row('a', 'polo', { qty: 2 })] }));
    await act(async () => { await bag.mergeBagAfterSignIn(); });
    expect(followerApi.mergeBag).not.toHaveBeenCalled();
    expect(r.getByTestId('bag-count').props.children).toBe(2);
  });
});

/* ═══════════════════════════════════════════ F9 · a failed read is not an empty bag */

describe('F9 · a bag that could not be read is never treated as an empty one', () => {
  it('loadBag throws "Couldn\'t load your bag"; addToBag and replacePost then save NOTHING', async () => {
    await signedIn();
    followerApi.getBag.mockResolvedValue(OFFLINE);
    await expect(bag.loadBag()).rejects.toThrow("Couldn't load your bag");
    await expect(bag.addToBag([line('n', 'polo')])).rejects.toThrow("Couldn't load your bag");
    await expect(bag.replacePost('p1', [line('n', 'polo')])).rejects.toThrow("Couldn't load your bag");
    expect(followerApi.putBag).not.toHaveBeenCalled();                         // it used to PUT [the new line] over her real bag
    followerApi.getBag.mockRejectedValue(new Error('boom'));                   // however the read fails
    await expect(bag.addToBag([line('n', 'polo')])).rejects.toThrow("Couldn't load your bag");
    followerApi.getBag.mockResolvedValue(undefined);
    await expect(bag.loadBag()).rejects.toThrow("Couldn't load your bag");
    expect(followerApi.putBag).not.toHaveBeenCalled();
  });

  it('when the read works, an add is her real bag plus the new line', async () => {
    await signedIn();
    followerApi.getBag.mockResolvedValue(ok({ lines: [row('a', 'polo'), row('b', 'casio')] }));
    followerApi.putBag.mockImplementation(async (lines) => ok({ lines: lines.map((l, i) => ({ id: `s${i}`, ...l })) }));
    await bag.addToBag([line('n', 'tee', { size: 'L' })]);
    expect(followerApi.putBag).toHaveBeenCalledTimes(1);
    expect(followerApi.putBag.mock.calls[0][0].map((l) => l.product_id)).toEqual(['polo', 'casio', 'tee']);
  });

  it('the bag icon keeps its number when a read fails — it is not blanked to nothing', async () => {
    await signedIn();
    followerApi.getBag.mockResolvedValue(ok({ lines: [row('a', 'polo', { qty: 3 })] }));
    const r = render(<BagButton />);
    await waitFor(() => expect(r.getByTestId('bag-count').props.children).toBe(3));
    followerApi.getBag.mockResolvedValue(OFFLINE);
    await act(async () => { await bag.loadBag().catch(() => {}); });
    expect(r.getByTestId('bag-count').props.children).toBe(3);                 // it used to drop to no number at all
  });

  it('her session ended in that very request: she is a guest now, and her bag is the phone\'s — no error', async () => {
    await signedIn();
    await AsyncStorage.setItem('inflx_bag_v1', JSON.stringify([line('local', 'polo')]));
    followerApi.getBag.mockImplementation(async () => {
      await AsyncStorage.multiRemove(['inflx_token', 'inflx_refresh_token', 'inflx_user']);       // what the request layer does on a refused session
      return { success: false, error: { code: 'UNAUTHORIZED', message: 'Session expired. Please log in again.' } };
    });
    const lines = await bag.loadBag();
    expect(lines.map((l) => l.ref)).toEqual(['local']);
    await bag.addToBag([line('n', 'casio')]);
    expect((await phoneBag()).map((l) => l.product_id)).toEqual(['polo', 'casio']);
    expect(followerApi.putBag).not.toHaveBeenCalled();
  });

  it('a guest\'s bag is read from the phone and saved to it, as before', async () => {
    await bag.addToBag([line('a', 'polo')]);
    await bag.addToBag([line('b', 'polo')]);                                   // same post, product, colour, size: the quantity goes up
    expect((await phoneBag()).map((l) => [l.product_id, l.qty])).toEqual([['polo', 2]]);
    expect(followerApi.getBag).not.toHaveBeenCalled();
  });
});

/* ═══════════════════════════════════════════ F10 · the chosen size's price */

describe('F10 · priceFor — the numbers are the server\'s, per size', () => {
  const POLO = { id: 'polo', price: 999, shopper_price: 799, colours: [
    { colour: 'Blue', sizes: [{ size: 'M', price: 999, shopper_price: 799, left: null, sold_out: false }, { size: 'XL', price: 1199, shopper_price: 959, left: null, sold_out: false }] },
    { colour: 'Red', sizes: [{ size: 'M', price: 1099, shopper_price: 879, left: null, sold_out: false }] }] };

  it('before a size is chosen: the product\'s own price', () => {
    expect(priceFor(POLO, { colour: null, size: null })).toEqual({ pays: 799, normal: 999, seen: 999 });
    expect(priceFor(POLO, null)).toEqual({ pays: 799, normal: 999, seen: 999 });
  });

  it('a chosen size: what she pays for THAT size, its price to strike through, and its price as price_seen', () => {
    expect(priceFor(POLO, { colour: 'Blue', size: 'XL' })).toEqual({ pays: 959, normal: 1199, seen: 1199 });
    expect(priceFor(POLO, { colour: null, size: 'XL' })).toEqual({ pays: 959, normal: 1199, seen: 1199 });      // the first colour, as the picker shows it
    expect(priceFor(POLO, { colour: 'Red', size: 'M' })).toEqual({ pays: 879, normal: 1099, seen: 1099 });
    expect(chosenSize(POLO, { colour: 'Red', size: 'M' }).price).toBe(1099);
  });

  it('no discount on the size: pays equals its price (nothing is struck)', () => {
    const plain = { id: 'tee', price: 999, shopper_price: 999, colours: [{ colour: null, sizes: [{ size: 'XL', price: 1199, shopper_price: 1199 }] }] };
    expect(priceFor(plain, { colour: null, size: 'XL' })).toEqual({ pays: 1199, normal: 1199, seen: 1199 });
  });

  it('a server that does not yet send a size\'s shopper_price: nothing is worked out here — the product\'s pair is shown, but price_seen is still the size\'s', () => {
    const older = { id: 'polo', price: 999, shopper_price: 799, colours: [{ colour: 'Blue', sizes: [{ size: 'XL', price: 1199, left: null, sold_out: false }] }] };
    expect(priceFor(older, { colour: 'Blue', size: 'XL' })).toEqual({ pays: 799, normal: 999, seen: 1199 });
  });

  it('a product with no sizes, and no product at all', () => {
    expect(priceFor({ id: 'belt', price: 999, shopper_price: 999, colours: [] }, { colour: null, size: null })).toEqual({ pays: 999, normal: 999, seen: 999 });
    expect(priceFor({ id: 'belt', price: 999, colours: [] }, {})).toEqual({ pays: 999, normal: 999, seen: 999 });
    expect(priceFor(null, {})).toEqual({ pays: null, normal: null, seen: null });
  });
});

/* ═══════════════════════════════════════════ F6 · F9 · F10 · the size sheet */

describe('the size sheet', () => {
  const POST = { id: 'p1', creator: { id: 'c1', name: 'Priya Sharma' }, offer: { line: '20% off applied' } };
  const POLO = { id: 'polo', name: 'Blue polo', image_url: null, price: 999, shopper_price: 799, sold_out: false, colours: [
    { colour: 'Blue', images: [], sizes: [{ size: 'M', price: 999, shopper_price: 799, left: null, sold_out: false }, { size: 'XL', price: 1199, shopper_price: 959, left: 2, sold_out: false },
      { size: 'XXL', price: 1199, shopper_price: 959, left: null, sold_out: true }] }] };
  const GONE = { ...POLO, sold_out: true, colours: [{ colour: 'Blue', images: [], sizes: POLO.colours[0].sizes.map((s) => ({ ...s, sold_out: true, left: 0 })) }] };
  const sheet = (product, props = {}) => {
    const onAdd = jest.fn(() => Promise.resolve());
    const onBuyNow = jest.fn();
    const r = render(<SizeSheet post={POST} product={product} visible onClose={jest.fn()} onAdd={onAdd} onBuyNow={onBuyNow} {...props} />);
    return { ...r, onAdd, onBuyNow };
  };

  it('F10 · choosing a size shows that size\'s price, and Add / Buy now hand its own price on as price_seen', async () => {
    const r = sheet(POLO);
    expect(texts(r.getByTestId('size-sheet-price'))).toEqual(['₹799', '  ₹999']);          // before a size: the product's
    fireEvent.press(r.getByTestId('size-sheet-size-XL'));
    expect(texts(r.getByTestId('size-sheet-price'))).toEqual(['₹959', '  ₹1,199']);        // it stayed ₹799 / ₹999
    await act(async () => { fireEvent.press(r.getByTestId('size-sheet-add')); });
    expect(r.onAdd).toHaveBeenCalledWith({ colour: 'Blue', size: 'XL', price_seen: 1199 });
    fireEvent.press(r.getByTestId('size-sheet-buy'));
    expect(r.onBuyNow).toHaveBeenCalledWith({ colour: 'Blue', size: 'XL', price_seen: 1199 });
    fireEvent.press(r.getByTestId('size-sheet-size-M'));
    expect(texts(r.getByTestId('size-sheet-price'))).toEqual(['₹799', '  ₹999']);
  });

  it('F6 · sold out in every size: it says so, and Add and Buy now stay off', () => {
    expect(isSoldOut(GONE)).toBe(true);
    expect(isSoldOut({ ...GONE, sold_out: false })).toBe(true);                // every size gone, whatever the flag says
    expect(isSoldOut(POLO)).toBe(false);
    expect(isSoldOut({ id: 'belt', sold_out: true, colours: [] })).toBe(true);
    expect(isSoldOut({ id: 'belt', colours: [] })).toBe(false);
    expect(isSoldOut(null)).toBe(false);

    const r = sheet(GONE);
    expect(r.getByTestId('size-sheet-sold-out').props.children).toBe('Sold out in every size');   // it was three crossed-out sizes and no words
    expect(off(r.getByTestId('size-sheet-add'))).toBe(true);
    expect(off(r.getByTestId('size-sheet-buy'))).toBe(true);
    expect(texts(r.getByTestId('size-sheet-add'))).toEqual(['Sold out']);
    for (const s of ['M', 'XL', 'XXL']) expect(off(r.getByTestId(`size-sheet-size-${s}`))).toBe(true);
    fireEvent.press(r.getByTestId('size-sheet-add')); fireEvent.press(r.getByTestId('size-sheet-buy'));
    expect(r.onAdd).not.toHaveBeenCalled();
    expect(r.onBuyNow).not.toHaveBeenCalled();
  });

  it('F6 · one size left: nothing is said, and it can be bought', () => {
    const r = sheet(POLO);
    expect(r.queryByTestId('size-sheet-sold-out')).toBeNull();
    fireEvent.press(r.getByTestId('size-sheet-size-M'));
    expect(off(r.getByTestId('size-sheet-add'))).toBe(false);
  });

  it('F6 · the same sentence wherever the sizes are shown (the product page and the pop-ups use this picker)', () => {
    const r = render(<ChoicePicker product={GONE} value={{ colour: null, size: null }} onChange={jest.fn()} testIDPrefix="product" />);
    expect(r.getByTestId('product-sold-out').props.children).toBe('Sold out in every size');
    const some = render(<ChoicePicker product={POLO} value={{ colour: null, size: null }} onChange={jest.fn()} testIDPrefix="product" />);
    expect(some.queryByTestId('product-sold-out')).toBeNull();
  });

  it('F9 · an add that fails is said in the sheet; choosing again clears it', async () => {
    const r = sheet(POLO);
    r.onAdd.mockRejectedValueOnce(new Error("Couldn't load your bag"));
    fireEvent.press(r.getByTestId('size-sheet-size-M'));
    await act(async () => { fireEvent.press(r.getByTestId('size-sheet-add')); });
    expect(r.getByTestId('size-sheet-failed').props.children).toBe("Couldn't load your bag");
    expect(r.queryByTestId('added-line')).toBeNull();
    fireEvent.press(r.getByTestId('size-sheet-size-XL'));
    expect(r.queryByTestId('size-sheet-failed')).toBeNull();
    r.onAdd.mockRejectedValueOnce({});                                         // an error with no words of its own
    await act(async () => { fireEvent.press(r.getByTestId('size-sheet-add')); });
    expect(r.getByTestId('size-sheet-failed').props.children).toBe("Couldn't update your bag");
  });
});

/* ═══════════════════════════════════════════ F6 · F9 · "Products in this post" (bitsShop.js) */

describe('"Products in this post" with the real sheet', () => {
  // The sheet's first render loads a great deal of React Native under jest (a second or two here,
  // more when every suite runs at once), so these two are given room; nothing in them waits on a clock.
  const ROOM = 30000;
  const SIZES = (gone) => [{ colour: 'Blue', images: [], sizes: [{ size: 'M', price: 1200, shopper_price: 960, left: null, sold_out: gone }, { size: 'L', price: 1200, shopper_price: 960, left: null, sold_out: gone }] }];
  const POST = {
    id: 'p1', creator: { id: 'c1', name: 'Priya' }, brand: { id: 'b1', name: 'Sri Lakshmi Silks' },
    offer: { id: 'o1', type: 'discount', line: '20% off applied', how: 'Every product is 20% off.' }, deal_page: false,
    products: [{ id: 'pr1', name: 'Mangalagiri cotton saree', image_url: null, price: 1200, shopper_price: 960, struck: true, in_stock: true },
      { id: 'pr2', name: 'Kanchi silk saree', image_url: null, price: 5200, shopper_price: 4160, struck: true, in_stock: true }],
    mine: { saved_products: [] },
  };
  const DEAL = (pr1Gone) => ok({
    post: { id: 'p1', creator: POST.creator, brand: POST.brand }, offer: null, deal_page: false, returns: null, gifts: [], categories: [],
    products: [{ id: 'pr1', name: 'Mangalagiri cotton saree', price: 1200, shopper_price: 960, images: [], image_url: null, colours: SIZES(pr1Gone), sold_out: pr1Gone },
      { id: 'pr2', name: 'Kanchi silk saree', price: 5200, shopper_price: 4160, images: [], image_url: null, colours: SIZES(false), sold_out: false }],
  });

  it('F6 · once the deal data says a product has sold out, its tile reads "Out of stock" and has no bag icon — the others keep theirs', async () => {
    followerApi.deal.mockResolvedValue(DEAL(true));
    const r = render(<ShopSheet post={POST} visible onClose={jest.fn()} surface="home" />);
    await waitFor(() => expect(r.queryByTestId('shop-add-pr1')).toBeNull(), { timeout: 10000 });
    expect(texts(r.getByTestId('shop-tile-pr1'))).toContain('Out of stock');
    r.getByTestId('shop-add-pr2');
    expect(texts(r.getByTestId('shop-tile-pr2'))).not.toContain('Out of stock');
  }, ROOM);

  it('F9 · her bag cannot be read: the add says "Couldn\'t load your bag" in the size sheet, and nothing is saved over her bag', async () => {
    await signedIn();
    followerApi.deal.mockResolvedValue(DEAL(false));
    followerApi.getBag.mockResolvedValue(OFFLINE);
    const onClose = jest.fn();
    const r = render(<ShopSheet post={POST} visible onClose={onClose} surface="home" />);
    await waitFor(() => expect(followerApi.deal).toHaveBeenCalledWith('p1'));
    fireEvent.press(r.getByTestId('shop-add-pr1'));
    await r.findByTestId('size-sheet');
    await waitFor(() => expect(r.queryByTestId('size-sheet-waiting')).toBeNull());
    fireEvent.press(r.getByTestId('size-sheet-size-M'));
    await act(async () => { fireEvent.press(r.getByTestId('size-sheet-add')); });
    expect(r.getByTestId('size-sheet-failed').props.children).toBe("Couldn't load your bag");
    expect(followerApi.putBag).not.toHaveBeenCalled();                         // it used to save [this one item] as her whole bag
    expect(Vibration.vibrate).not.toHaveBeenCalled();
    expect(r.queryByTestId('size-sheet-add-go')).toBeNull();                   // not "Go to bag ›"
    expect(onClose).not.toHaveBeenCalled();
    expect(off(r.getByTestId('size-sheet-add'))).toBe(false);                  // she can try again
  }, ROOM);
});
