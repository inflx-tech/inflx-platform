/**
 * stock-asked-once — a one-size product is bought by colour alone (board S1).
 * Contract: features/stock-asked-once · 03-expected-outputs.md (D)
 *
 * Sunglasses have no real size. The listing files each colour's stock under a stand-in size
 * ("Free Size"), and until now the shopper had to tap that lone chip before she could buy: the
 * button read "Choose a size". The server now says which products are like this (`one_size`):
 *
 *   · no "Size" row; the colours are the choice, and the first one in stock is chosen already
 *   · Add to bag / Buy now are ready at once, and what goes to the bag is that colour with its
 *     one size — the order line reads "White · Free Size" exactly as before
 *   · a colour with none left is crossed out; "Only 2 left" is said of the colour she is on
 *   · the same on the bag-icon sheet, the product page, and the product pop-up inside a deal
 *   · a product with real sizes, and any product from a server that does not send the flag, is
 *     exactly as it was
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

let mockNav = null;
jest.mock('../../../services/api', () => ({
  followerApi: {
    deal: jest.fn(), dealPrice: jest.fn(), bagPrice: jest.fn(), getBag: jest.fn(), putBag: jest.fn(), mergeBag: jest.fn(),
    saveProduct: jest.fn(), unsaveProduct: jest.fn(), postEvents: jest.fn(() => Promise.resolve({ success: true })),
  },
  setDeviceHeader: jest.fn(), clearSession: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../../services/events', () => ({ track: jest.fn(), flush: jest.fn() }));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => cb(), [cb]); },
  useNavigation: () => mockNav,
}));

const { shopStore } = require('../../../components/shop/shopStore');
const bag = require('../../../components/shop/bag');
const { SizeSheet, ChoicePicker, ProductPopup, chosen, isOneSize, isSoldOut, priceFor } = require('../../../components/shop/orderBits');
const Product = require('../ProductScreen').default;

const texts = (node) => node.findAll((n) => typeof n.type === 'string' && n.type === 'Text').map((n) => [].concat(n.props.children).filter((c) => typeof c === 'string' || typeof c === 'number').join(''));
const off = (el) => el.props.accessibilityState.disabled;
const on = (el) => el.props.accessibilityState.selected;
const struck = (el) => el.findAll((n) => n.type === 'Text' && StyleSheet.flatten(n.props.style || {}).textDecorationLine === 'line-through').length > 0;
const bagNow = async () => JSON.parse(await AsyncStorage.getItem('inflx_bag_v1')) || [];
const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), pop: jest.fn(), isFocused: jest.fn(() => true), addListener: jest.fn(() => () => {}) });

const one = (left, soldOut = false) => [{ size: 'Free Size', price: 1499, shopper_price: 1499, left, sold_out: soldOut }];
/** The founder's own product, as the deal data sends it once the server knows it is one-size. */
const SUN = (over = {}) => ({
  id: 'sun', name: 'Computer sunglasses', price: 1499, shopper_price: 1499, image_url: 'https://x/sun.jpg', images: ['https://x/sun.jpg'],
  in_deal: false, category: null, sold_out: false, one_size: true,
  colours: [
    { colour: 'White', images: ['https://x/sun-white.jpg'], sizes: one(null) },
    { colour: 'Black', images: ['https://x/sun-black.jpg'], sizes: one(2) },
    { colour: 'Blue', images: [], sizes: one(0, true) },
  ],
  details: null, size_chart: null, set_qty: null, brand_label: 'Jhon Jcabos', category_path: 'Unisex › Sunglasses & Eyewear', specs: [],
  ...over,
});
const POLO = { id: 'polo', name: 'Blue polo', image_url: null, price: 999, shopper_price: 999, sold_out: false, colours: [
  { colour: 'Blue', images: [], sizes: [{ size: 'M', price: 999, shopper_price: 999, left: null, sold_out: false }, { size: 'XL', price: 999, shopper_price: 999, left: null, sold_out: false }] }] };
const POST = { id: 'p1', creator: { id: 'c1', name: 'Kartikeya Rao' }, brand: { id: 'b1', name: 'Aveen fashion boutique and desiner studio' }, offer: null };

beforeEach(async () => { jest.clearAllMocks(); await AsyncStorage.clear(); shopStore._reset(); bag._resetBag(); mockNav = nav(); });

describe('what is chosen', () => {
  it('a one-size product: before she taps, the first colour in stock with its one size; then the colour she tapped', () => {
    expect(isOneSize(SUN())).toBe(true);
    expect(chosen(SUN(), { colour: null, size: null })).toEqual({ colour: 'White', size: 'Free Size' });
    expect(chosen(SUN(), null)).toEqual({ colour: 'White', size: 'Free Size' });
    expect(chosen(SUN(), { colour: 'Black', size: null })).toEqual({ colour: 'Black', size: 'Free Size' });
    // the first colour has sold out: the next one that has stock
    const whiteGone = SUN({ colours: [{ colour: 'White', images: [], sizes: one(0, true) }, { colour: 'Black', images: [], sizes: one(5) }] });
    expect(chosen(whiteGone, { colour: null, size: null })).toEqual({ colour: 'Black', size: 'Free Size' });
    // a quantity she set travels with it (the deal pop-up)
    expect(chosen(SUN(), { colour: null, size: null, qty: 2 })).toEqual({ colour: 'White', size: 'Free Size', qty: 2 });
  });

  it('a product with real sizes, a product with none, and a server that does not send the flag: exactly what she tapped', () => {
    const sel = { colour: null, size: null };
    expect(chosen(POLO, sel)).toBe(sel);
    expect(isOneSize(POLO)).toBe(false);
    expect(chosen({ id: 'belt', colours: [], one_size: true }, sel)).toBe(sel);          // nothing to choose at all
    expect(isOneSize({ id: 'belt', colours: [], one_size: true })).toBe(false);
    expect(chosen(SUN({ one_size: undefined }), sel)).toBe(sel);                         // an older server
    expect(chosen(null, sel)).toBe(sel);
  });

  it('the price is the chosen colour\'s, with nothing tapped', () => {
    const p = SUN({ shopper_price: 1199, colours: [{ colour: 'White', images: [], sizes: [{ size: 'Free Size', price: 1499, shopper_price: 1199, left: null, sold_out: false }] }] });
    expect(priceFor(p, chosen(p, { colour: null, size: null }))).toEqual({ pays: 1199, normal: 1499, seen: 1499 });
  });
});

describe('the picker', () => {
  const picker = (product, value = { colour: null, size: null }) => {
    const onChange = jest.fn();
    return { ...render(<ChoicePicker product={product} value={value} onChange={onChange} testIDPrefix="pick" />), onChange };
  };

  it('a one-size product: the colours and no "Size" row; the first colour in stock is on', () => {
    const r = picker(SUN());
    expect(r.toJSON()).not.toBeNull();
    expect(texts(r.root)).toEqual(['Colour: White', 'White', 'Black', 'Blue']);           // no "Size", no "Free Size"
    expect(r.queryByTestId('pick-size-Free Size')).toBeNull();
    expect(on(r.getByTestId('pick-colour-White'))).toBe(true);
    expect(on(r.getByTestId('pick-colour-Black'))).toBe(false);
    expect(r.queryByTestId('pick-left')).toBeNull();                                      // White has plenty
    expect(r.queryByTestId('pick-sold-out')).toBeNull();
  });

  it('a colour with none left is crossed out and cannot be chosen; tapping another hands on that colour with its one size', () => {
    const r = picker(SUN());
    const blue = r.getByTestId('pick-colour-Blue');
    expect(off(blue)).toBe(true);
    expect(struck(blue)).toBe(true);
    expect(struck(r.getByTestId('pick-colour-White'))).toBe(false);
    fireEvent.press(blue);
    expect(r.onChange).not.toHaveBeenCalled();
    fireEvent.press(r.getByTestId('pick-colour-Black'));
    expect(r.onChange).toHaveBeenCalledWith({ colour: 'Black', size: 'Free Size' });
  });

  it('"Only 2 left" is said of the colour she is on', () => {
    const r = picker(SUN(), { colour: 'Black', size: 'Free Size' });
    expect(r.getByTestId('pick-left').props.children).toBe('Only 2 left');
    expect(texts(r.root)[0]).toBe('Colour: Black');
  });

  it('every colour gone: "Sold out", every colour crossed out, none on', () => {
    const gone = SUN({ sold_out: true, colours: [{ colour: 'White', images: [], sizes: one(0, true) }, { colour: 'Black', images: [], sizes: one(0, true) }] });
    expect(isSoldOut(gone)).toBe(true);
    const r = picker(gone);
    expect(r.getByTestId('pick-sold-out').props.children).toBe('Sold out');               // not "Sold out in every size"
    for (const c of ['White', 'Black']) { expect(off(r.getByTestId(`pick-colour-${c}`))).toBe(true); expect(on(r.getByTestId(`pick-colour-${c}`))).toBe(false); }
    expect(r.queryByTestId('pick-left')).toBeNull();
  });

  it('a one-size product with no colour name has nothing to show, and is still ready', () => {
    const plain = SUN({ colours: [{ colour: null, images: [], sizes: one(null) }] });
    const r = picker(plain);
    expect(texts(r.root)).toEqual([]);
    expect(chosen(plain, { colour: null, size: null })).toEqual({ colour: null, size: 'Free Size' });
  });

  it('unchanged: a product with real sizes shows "Size" and its chips; so does a one-size product from a server that does not send the flag', () => {
    const r = picker(POLO);
    expect(texts(r.root)).toEqual(['Colour: Blue', 'Blue', 'Size', 'M', 'XL']);
    const old = picker(SUN({ one_size: undefined }));
    expect(texts(old.root)).toEqual(['Colour: White', 'White', 'Black', 'Blue', 'Size', 'Free Size']);
    expect(old.getByTestId('pick-size-Free Size')).toBeTruthy();
  });
});

describe('the sheet from the bag icon', () => {
  const sheet = (product, props = {}) => {
    const onAdd = jest.fn(() => Promise.resolve());
    const onBuyNow = jest.fn();
    return { ...render(<SizeSheet post={POST} product={product} visible onClose={jest.fn()} onAdd={onAdd} onBuyNow={onBuyNow} {...props} />), onAdd, onBuyNow };
  };

  it('a one-size product: Add to bag and Buy now are ready at once — she no longer has to tap "Free Size"', async () => {
    const r = sheet(SUN());
    expect(off(r.getByTestId('size-sheet-add'))).toBe(false);
    expect(off(r.getByTestId('size-sheet-buy'))).toBe(false);
    expect(texts(r.getByTestId('size-sheet-add'))).toEqual(['Add to bag']);               // it read "Choose a size"
    expect(texts(r.root)).not.toContain('Size');
    await act(async () => { fireEvent.press(r.getByTestId('size-sheet-add')); });
    expect(r.onAdd).toHaveBeenCalledWith({ colour: 'White', size: 'Free Size', price_seen: 1499 });
    fireEvent.press(r.getByTestId('size-sheet-colour-Black'));
    fireEvent.press(r.getByTestId('size-sheet-buy'));
    expect(r.onBuyNow).toHaveBeenCalledWith({ colour: 'Black', size: 'Free Size', price_seen: 1499 });
  });

  it('every colour gone: "Sold out", and nothing can be added', () => {
    const r = sheet(SUN({ sold_out: true, colours: [{ colour: 'White', images: [], sizes: one(0, true) }] }));
    expect(off(r.getByTestId('size-sheet-add'))).toBe(true);
    expect(off(r.getByTestId('size-sheet-buy'))).toBe(true);
    expect(texts(r.getByTestId('size-sheet-add'))).toEqual(['Sold out']);
    fireEvent.press(r.getByTestId('size-sheet-add'));
    expect(r.onAdd).not.toHaveBeenCalled();
  });

  it('unchanged: a product with real sizes still asks for one', () => {
    const r = sheet(POLO);
    expect(off(r.getByTestId('size-sheet-add'))).toBe(true);
    expect(texts(r.getByTestId('size-sheet-add'))).toEqual(['Choose a size']);
    fireEvent.press(r.getByTestId('size-sheet-size-M'));
    expect(off(r.getByTestId('size-sheet-add'))).toBe(false);
  });
});

describe('the product pop-up inside a deal', () => {
  it('a one-size product: the main button is ready, says what will be picked, and hands on the colour with its one size', () => {
    const onPrimary = jest.fn();
    const r = render(<ProductPopup product={SUN()} visible onClose={jest.fn()} allowQty primaryLabel={(s) => `Pick · ${s.colour} · ${s.size}`} onPrimary={onPrimary} testID="pop" />);
    expect(off(r.getByTestId('pop-primary'))).toBe(false);
    expect(texts(r.getByTestId('pop-primary'))).toEqual(['Pick · White · Free Size']);
    fireEvent.press(r.getByTestId('pop-colour-Black'));
    expect(texts(r.getByTestId('pop-primary'))).toEqual(['Pick · Black · Free Size']);
    fireEvent.press(r.getByTestId('pop-primary'));
    expect(onPrimary).toHaveBeenCalledWith({ colour: 'Black', size: 'Free Size', qty: 1 });
  });

  it('unchanged: a product with real sizes reads "Choose a size" until one is tapped', () => {
    const r = render(<ProductPopup product={POLO} visible onClose={jest.fn()} primaryLabel={() => 'Pick'} onPrimary={jest.fn()} testID="pop" />);
    expect(off(r.getByTestId('pop-primary'))).toBe(true);
    expect(texts(r.getByTestId('pop-primary'))).toEqual(['Choose a size']);
  });
});

describe('the product page', () => {
  const DATA = (product) => ({
    post: { id: 'p1', code: 'D8E11A', title: 'Nothing goes wrong with these', creator: POST.creator, brand: POST.brand },
    offer: null, deal_page: false, returns: { hours: 168, words: '7 days', line: 'Within 7 days of delivery' },
    products: [product], gifts: [], categories: [],
  });
  const open = async (product) => {
    const n = nav();
    const r = render(<Product navigation={n} route={{ params: { postId: 'p1', productId: product.id, post: { ...POST, products: [] }, data: DATA(product), surface: 'home' } }} />);
    await r.findByTestId('product-page');
    return { ...r, n };
  };

  it('a one-size product: no "Size" row, Add to bag ready, and the bag gets the colour with its one size', async () => {
    const r = await open(SUN());
    expect(r.queryByTestId('product-size-Free Size')).toBeNull();
    expect(off(r.getByTestId('product-add'))).toBe(false);
    expect(off(r.getByTestId('product-buy-now'))).toBe(false);
    expect(texts(r.getByTestId('product-add'))).toEqual(['Add to bag']);
    expect(r.getByTestId('product-photos-0').props.source).toEqual({ uri: 'https://x/sun-white.jpg' });   // the chosen colour's own photo
    await act(async () => { fireEvent.press(r.getByTestId('product-add')); });
    expect(await bagNow()).toEqual([expect.objectContaining({ post_id: 'p1', product_id: 'sun', colour: 'White', size: 'Free Size', qty: 1, price_seen: 1499 })]);
  });

  it('she taps another colour: its photo, and that colour goes to the bag', async () => {
    const r = await open(SUN());
    fireEvent.press(r.getByTestId('product-colour-Black'));
    expect(r.getByTestId('product-photos-0').props.source).toEqual({ uri: 'https://x/sun-black.jpg' });
    expect(r.getByTestId('product-left').props.children).toBe('Only 2 left');
    await act(async () => { fireEvent.press(r.getByTestId('product-add')); });
    expect(await bagNow()).toEqual([expect.objectContaining({ product_id: 'sun', colour: 'Black', size: 'Free Size' })]);
  });

  it('unchanged: a product with real sizes reads "Choose a size" until one is tapped', async () => {
    const r = await open({ ...POLO, images: [], in_deal: false, details: null, specs: [] });
    expect(off(r.getByTestId('product-add'))).toBe(true);
    expect(texts(r.getByTestId('product-add'))).toEqual(['Choose a size']);
    fireEvent.press(r.getByTestId('product-size-M'));
    expect(off(r.getByTestId('product-add'))).toBe(false);
  });
});
