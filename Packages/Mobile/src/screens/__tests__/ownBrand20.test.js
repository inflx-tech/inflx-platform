/**
 * Item 20 — a creator who owns a brand, every screen of the locked board (L1–L6, B1–B3, C1–C5,
 * S1–S3, M1–M2). Contract: features/item20-own-brand · master rules v1.33 §2D
 *
 * React Native has no compile step: a bad import or a typo fails on the DEVICE. Every screen is
 * mounted here with the server's real read shape (ownBrand.service / shoppablePosts.service /
 * postPlaces.service / postLinks.service / walletRead.service), copied from the API.
 */
import React from 'react';
import { render, waitFor, fireEvent, act } from '@testing-library/react-native';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb) => { const R = require('react'); R.useEffect(() => { const c = cb(); return typeof c === 'function' ? c : undefined; }, [cb]); },
  createNavigationContainerRef: () => ({ isReady: () => false, navigate: jest.fn() }),
}));
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');
jest.mock('@react-native-clipboard/clipboard', () => ({ setString: jest.fn(), getString: jest.fn(() => Promise.resolve('')) }));
jest.mock('react-native-image-picker', () => ({ launchImageLibrary: jest.fn() }));
const mockSetRole = jest.fn();
jest.mock('../../../App', () => ({ AuthContext: require('react').createContext({ setRole: mockSetRole }) }));
jest.mock('../../services/api', () => {
  const f = () => jest.fn();
  return {
    api: { get: f(), post: f(), patch: f(), delete: f() },
    authApi: { changePhoneStart: f(), changePhoneVerifyOld: f(), changePhoneSendNew: f(), changePhoneConfirm: f() },
    influencerApi: {
      register: f(), getMe: f(), getInvitationSettings: f(), getMySocial: f(), submitForReview: f(),
      brandLink: f(), linkSameNumberBrand: f(), sendBrandLinkCode: f(), confirmBrandLinkCode: f(), removeBrandLink: f(),
      postPlaces: f(), addPostPlace: f(), updatePostPlace: f(), removePostPlace: f(),
      createHome: f(), postBrands: f(), createPost: f(), createOwnPost: f(), getPost: f(), postOptions: f(), updatePost: f(),
      postStats: f(), takeDownPost: f(), deletePost: f(),
    },
    brandApi: { getMe: f(), getPitchSettings: f(), submitForReview: f(), linkedCreators: f(), removeLinkedCreator: f(), setPostStats: f() },
    referenceApi: {
      offeredStates: jest.fn().mockResolvedValue({ success: true, data: { items: [{ id: 1, name: 'Telangana', cities: [{ id: 10, name: 'Hyderabad' }] }] } }),
      brandCategories: jest.fn().mockResolvedValue({ success: true, data: { items: [{ code: 'WOMEN', label: 'Women' }] } }),
    },
    onAccountGate: () => () => {}, emitAccountGate: jest.fn(), clearSession: jest.fn(), uploadFile: jest.fn(),
  };
});
const { influencerApi, brandApi } = require('../../services/api');
const InfluencerRegisterScreen = require('../auth/InfluencerRegisterScreen').default;
const ProfileScreen = require('../influencer/ProfileScreen').default;
const MyBrandScreen = require('../influencer/MyBrandScreen').default;
const BrandProfileScreen = require('../brand/BrandProfileScreen').default;
const BrandLinkedCreatorsScreen = require('../brand/BrandLinkedCreatorsScreen').default;
const CreateHomeScreen = require('../create/CreateHomeScreen').default;
const PostBrandScreen = require('../create/PostBrandScreen').default;
const PostTypeScreen = require('../create/PostTypeScreen').default;
const PostStatusScreen = require('../create/PostStatusScreen').default;
const PostStatsScreen = require('../create/PostStatsScreen').default;
const { default: BrandWalletSalesScreen, BrandWalletSaleScreen } = require('../brand/BrandWalletSalesScreen');
const { noticeTarget } = require('../../components/home/open19');
const { O20 } = require('../../components/ownbrand/copy20');
const { CP } = require('../../components/create/copyCreate');

const ok = (data) => ({ success: true, data });
const no = (code, message, status = 422, field) => ({ success: false, error: { code, message, ...(field ? { field } : {}) }, status });
const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), setParams: jest.fn(), addListener: jest.fn(() => () => {}), dispatch: jest.fn() });
const flat = (r) => JSON.stringify(r.toJSON());

/* The server's shapes (ownBrand.service brandCard / linkOut). */
const BRAND = { id: 'b1', name: 'Kavya Fashions', logo_url: null, category: 'fashion', city: 'Hyderabad', status: 'approved', status_chip: 'Approved', note: null, can_post: true };
const PENDING_BRAND = { ...BRAND, status: 'pending', status_chip: 'Under review', can_post: false, note: 'Kavya Fashions is under review. You can post for it once INFLX approves it.' };
const LINK = { brand: BRAND, linked_at: '2026-10-10T04:30:00.000Z', linked_on: '2026-10-10', via: 'code', posts: { live: 3, in_review: 1 }, can_create: true };

beforeEach(() => jest.clearAllMocks());

/* ───────────────────────────────────────────── L1–L4 · sign-up, step 3 */

async function toStep3(r) {
  fireEvent.changeText(r.getByTestId('reg-name'), 'Ravi Teja');
  fireEvent.press(r.getByTestId('reg-state'));
  await waitFor(() => r.getByTestId('reg-state-option-1'));
  fireEvent.press(r.getByTestId('reg-state-option-1'));
  fireEvent.press(r.getByTestId('reg-city'));
  await waitFor(() => r.getByTestId('reg-city-option-10'));
  fireEvent.press(r.getByTestId('reg-city-option-10'));
  fireEvent.press(r.getByTestId('reg-continue-1'));
  fireEvent.changeText(r.getByTestId('reg-instagram'), 'ravi.kf');
  fireEvent.press(r.getByTestId('reg-continue-2'));
  await waitFor(() => expect(influencerApi.brandLink).toHaveBeenCalled());
}
const registered = () => influencerApi.register.mockResolvedValue(ok({ influencer: { id: 'c1' }, user_status: 'pending', claim: {} }));

describe('L1–L4 — creator sign-up asks once, "Do you run a brand on INFLX?"', () => {
  it('step 1 says three steps, and the stepper has three bars', () => {
    const r = render(<InfluencerRegisterScreen navigation={nav()} />);
    r.getByText('Three quick steps. You can add the rest later.');
    expect(r.getByTestId('stepper').children).toHaveLength(3);
    r.getByTestId('step-3-off');
  });

  it('L1: the same number has a brand account — its card, and one tap links it', async () => {
    registered();
    influencerApi.brandLink.mockResolvedValue(ok({ link: null, same_number: BRAND }));
    influencerApi.linkSameNumberBrand.mockResolvedValue(ok({ link: LINK }));
    const r = render(<InfluencerRegisterScreen navigation={nav()} />);
    await toStep3(r);
    await waitFor(() => r.getByTestId('link-same'));
    r.getByTestId('step-3-on');
    r.getByText('Do you run a brand on INFLX?'); r.getByText('This number also has a brand account.');
    r.getByText('Kavya Fashions'); r.getByText('Fashion · Hyderabad'); r.getByText('Approved');
    r.getByText('Link it and you can post for your own store from this app. No campaign or agreement needed.');
    expect(r.queryByTestId('reg-continue-2')).toBeNull();                 // the sign-up button is gone on this step
    expect(mockSetRole).not.toHaveBeenCalled();
    fireEvent.press(r.getByTestId('link-same-yes'));
    await waitFor(() => expect(influencerApi.linkSameNumberBrand).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockSetRole).toHaveBeenCalledWith('influencer'));
  });

  it('L1: "Not now" goes straight into the app, linking nothing', async () => {
    registered();
    influencerApi.brandLink.mockResolvedValue(ok({ link: null, same_number: BRAND }));
    const r = render(<InfluencerRegisterScreen navigation={nav()} />);
    await toStep3(r);
    await waitFor(() => r.getByTestId('link-not-now'));
    fireEvent.press(r.getByTestId('link-not-now'));
    expect(mockSetRole).toHaveBeenCalledWith('influencer');
    expect(influencerApi.linkSameNumberBrand).not.toHaveBeenCalled();
  });

  it('L2: no brand on this number — two answers; "No" goes in', async () => {
    registered();
    influencerApi.brandLink.mockResolvedValue(ok({ link: null, same_number: null }));
    const r = render(<InfluencerRegisterScreen navigation={nav()} />);
    await toStep3(r);
    await waitFor(() => r.getByTestId('link-ask'));
    r.getByText('If you own a store that is on INFLX, link it and post for it yourself.');
    r.getByText("No, I'm a creator only"); r.getByText('You can link a brand later from Profile.');
    r.getByText('Yes, I run a brand'); r.getByText("You'll confirm with a code sent to the brand's number.");
    fireEvent.press(r.getByTestId('link-continue'));                       // nothing chosen: nothing happens
    expect(mockSetRole).not.toHaveBeenCalled();
    fireEvent.press(r.getByTestId('link-choice-no'));
    fireEvent.press(r.getByTestId('link-continue'));
    expect(mockSetRole).toHaveBeenCalledWith('influencer');
  });

  it('L3 → L4: the brand\'s number, the code sent to it, linked', async () => {
    registered();
    influencerApi.brandLink.mockResolvedValue(ok({ link: null, same_number: null }));
    influencerApi.sendBrandLinkCode.mockResolvedValue(ok({ linked: false, sent_to: '+91 98••• ••345', expires_in: 900 }));
    influencerApi.confirmBrandLinkCode.mockResolvedValue(ok({ link: LINK }));
    const r = render(<InfluencerRegisterScreen navigation={nav()} />);
    await toStep3(r);
    await waitFor(() => r.getByTestId('link-ask'));
    fireEvent.press(r.getByTestId('link-choice-yes'));
    fireEvent.press(r.getByTestId('link-continue'));
    r.getByTestId('link-number');
    r.getByText("Your brand's number"); r.getByText("The mobile number your brand signs in with on INFLX. We'll text it a code.");
    r.getByText('No brand on INFLX yet? Register it in the INFLX Brand app first, then link it from Profile.');
    fireEvent.changeText(r.getByTestId('link-phone'), '98490 12345');      // spaces are dropped
    fireEvent.press(r.getByTestId('link-send'));
    await waitFor(() => expect(influencerApi.sendBrandLinkCode).toHaveBeenCalledWith('+919849012345'));
    await waitFor(() => r.getByTestId('link-code'));
    r.getByText('Enter the code'); r.getByText('Sent to +91 98••• ••345');
    r.getByText("The code goes to the brand's phone. If someone else holds it, ask them for the code.");
    fireEvent.changeText(r.getByTestId('link-otp-0'), '472913');           // a paste fills every box
    fireEvent.press(r.getByTestId('link-confirm'));
    await waitFor(() => expect(influencerApi.confirmBrandLinkCode).toHaveBeenCalledWith('472913'));
    await waitFor(() => expect(mockSetRole).toHaveBeenCalledWith('influencer'));
  });

  it('the server\'s refusals are shown in its own words: no brand, a wrong code, and a try that has ended', async () => {
    registered();
    influencerApi.brandLink.mockResolvedValue(ok({ link: null, same_number: null }));
    const r = render(<InfluencerRegisterScreen navigation={nav()} />);
    await toStep3(r);
    await waitFor(() => r.getByTestId('link-ask'));
    fireEvent.press(r.getByTestId('link-choice-yes'));
    fireEvent.press(r.getByTestId('link-continue'));

    influencerApi.sendBrandLinkCode.mockResolvedValueOnce(no('NO_BRAND', 'No brand on INFLX uses this number.', 404, 'phone'));
    fireEvent.changeText(r.getByTestId('link-phone'), '9849012345');
    fireEvent.press(r.getByTestId('link-send'));
    await waitFor(() => expect(r.getByTestId('link-field-error').props.children).toBe('No brand on INFLX uses this number.'));
    r.getByTestId('link-number');                                          // still on the number step

    influencerApi.sendBrandLinkCode.mockResolvedValueOnce(ok({ linked: false, sent_to: '+91 98••• ••345', expires_in: 900 }));
    fireEvent.press(r.getByTestId('link-send'));
    await waitFor(() => r.getByTestId('link-code'));
    influencerApi.confirmBrandLinkCode.mockResolvedValueOnce(no('WRONG_CODE', "That code isn't right.", 401, 'otp'));
    fireEvent.changeText(r.getByTestId('link-otp-0'), '111111');
    fireEvent.press(r.getByTestId('link-confirm'));
    await waitFor(() => expect(r.getByTestId('link-field-error').props.children).toBe("That code isn't right."));
    expect(r.getByTestId('link-otp-0').props.value).toBe('');              // the boxes are cleared for another try

    influencerApi.confirmBrandLinkCode.mockResolvedValueOnce(no('TOO_MANY_ATTEMPTS', 'Too many wrong codes. Start again.', 429));
    fireEvent.changeText(r.getByTestId('link-otp-0'), '222222');
    fireEvent.press(r.getByTestId('link-confirm'));
    await waitFor(() => r.getByTestId('link-error'));
    expect(flat(r)).toContain('Too many wrong codes. Start again.');
    expect(r.queryByTestId('link-confirm')).toBeNull();
    fireEvent.press(r.getByTestId('link-start-again'));
    r.getByTestId('link-number');
    expect(mockSetRole).not.toHaveBeenCalled();
  });

  it('if the question cannot be asked he goes straight in, as before', async () => {
    registered();
    influencerApi.brandLink.mockResolvedValue({ success: false, error: { code: 'NETWORK' } });
    const r = render(<InfluencerRegisterScreen navigation={nav()} />);
    await toStep3(r);
    await waitFor(() => expect(mockSetRole).toHaveBeenCalledWith('influencer'));
    expect(r.queryByTestId('link-ask')).toBeNull();
  });
});

/* ───────────────────────────────────────────── L5 · L6 · the creator's Profile */

const ME = { influencer: { id: 'c1', full_name: 'Ravi Teja', instagram_handle: 'ravi.kf', city_name: 'Hyderabad', niche: ['fashion'], needsNiche: false },
  user_status: 'approved', completeness: { complete: true, missing: [], missing_labels: [], done: 6, total: 6 } };
function profileMocks(link) {
  influencerApi.getMe.mockResolvedValue(ok(ME));
  influencerApi.getInvitationSettings.mockResolvedValue(ok({ summary: { labelState: 'open', aims: ['conversion', 'engagement', 'hybrid'], modes: ['visit', 'shipment'] } }));
  influencerApi.getMySocial.mockResolvedValue(ok(null));
  influencerApi.brandLink.mockResolvedValue(ok({ link, same_number: null }));
}

describe('L5 — Profile: the My brand row', () => {
  it('linked: the brand\'s name and "Linked"; it opens My brand; it sits between Invitation settings and Legal', async () => {
    profileMocks(LINK);
    const n = nav();
    const r = render(<ProfileScreen navigation={n} route={{ params: {} }} />);
    await waitFor(() => r.getByTestId('row-my-brand'));
    await waitFor(() => r.getByText('Kavya Fashions'));
    r.getByText('My brand'); r.getByText('Linked');
    const order = flat(r);
    expect(order.indexOf('row-invitation-settings')).toBeLessThan(order.indexOf('row-my-brand'));
    expect(order.indexOf('row-my-brand')).toBeLessThan(order.indexOf('row-legal'));
    fireEvent.press(r.getByTestId('row-my-brand'));
    expect(n.navigate).toHaveBeenCalledWith('MyBrand');
  });

  it('not linked: the row asks the question, and is never one of the "things left"', async () => {
    profileMocks(null);
    const r = render(<ProfileScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => r.getByTestId('row-my-brand'));
    r.getByText('Do you run a brand on INFLX?');
    expect(r.queryByText('Linked')).toBeNull();
    expect(flat(r)).not.toMatch(/things? left/);
  });
});

describe('L6 — My brand', () => {
  it('linked: the card, when, his posts, what he can do, and Remove link asks first', async () => {
    influencerApi.brandLink.mockResolvedValue(ok({ link: LINK, same_number: null }));
    influencerApi.removeBrandLink.mockResolvedValue(ok({ removed: true }));
    const n = nav();
    const r = render(<MyBrandScreen navigation={n} route={{ params: {} }} />);
    await waitFor(() => r.getByTestId('my-brand-linked'));
    r.getByText('Kavya Fashions'); r.getByText('Fashion · Hyderabad'); r.getByText('Approved');
    r.getByText('10 Oct 2026');
    expect(r.getByTestId('my-brand-posts').props.children).toBe('3 live · 1 with INFLX');
    r.getByText(O20.can); r.getByText('You can link one brand. You work with other brands as usual.');
    fireEvent.press(r.getByTestId('my-brand-create'));
    expect(n.navigate).toHaveBeenCalledWith('CreateTab');

    fireEvent.press(r.getByTestId('my-brand-remove'));
    expect(influencerApi.removeBrandLink).not.toHaveBeenCalled();          // it asks first
    r.getByText('Remove your link to Kavya Fashions?');
    r.getByText("Your live posts for it stay live. You can't make new ones until you link again.");
    influencerApi.brandLink.mockResolvedValue(ok({ link: null, same_number: null }));
    await act(async () => { fireEvent.press(r.getByTestId('confirm-primary')); });
    await waitFor(() => expect(influencerApi.removeBrandLink).toHaveBeenCalledTimes(1));
    await waitFor(() => r.getByTestId('my-brand-unlinked'));
  });

  it('the brand is still under review: it says so, and offers no post', async () => {
    influencerApi.brandLink.mockResolvedValue(ok({ link: { ...LINK, brand: PENDING_BRAND, can_create: false }, same_number: null }));
    const r = render(<MyBrandScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => r.getByTestId('my-brand-note'));
    r.getByText('Under review');
    r.getByText('Kavya Fashions is under review. You can post for it once INFLX approves it.');
    expect(r.queryByTestId('my-brand-create')).toBeNull();
    r.getByTestId('my-brand-remove');
  });

  it('not linked: no question here — straight to the brand\'s number; a brand on his own number is offered first', async () => {
    influencerApi.brandLink.mockResolvedValue(ok({ link: null, same_number: null }));
    const r = render(<MyBrandScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => r.getByTestId('my-brand-unlinked'));
    r.getByText('Link the brand you run, then post for it from Create. No campaign or agreement needed.');
    r.getByTestId('link-number');
    expect(r.queryByTestId('link-ask')).toBeNull();
    expect(r.queryByTestId('link-back')).toBeNull();

    influencerApi.brandLink.mockResolvedValue(ok({ link: null, same_number: BRAND }));
    const r2 = render(<MyBrandScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => r2.getByTestId('link-same'));
    expect(r2.queryByTestId('link-not-now')).toBeNull();                   // "Not now" belongs to sign-up
    fireEvent.press(r2.getByTestId('link-other'));
    r2.getByTestId('link-number');
  });
});

/* ───────────────────────────────────────────── B1–B3 · the brand's side */

const LINKED = [
  { influencerId: 'c1', name: 'Ravi Teja', instagramHandle: 'ravi.kf', avatarUrl: null, linkedAt: '2026-10-10T04:30:00.000Z', linkedOn: '2026-10-10' },
  { influencerId: 'c2', name: 'Sneha N', instagramHandle: 'sneha.kf', avatarUrl: null, linkedAt: '2026-10-02T04:30:00.000Z', linkedOn: '2026-10-02' },
];

describe('B1 — the notice opens the right screen on each phone', () => {
  it('the brand\'s "… linked a creator account" opens Linked creators; the creator\'s "… removed your link" opens My brand', () => {
    expect(noticeTarget({ type: 'own_brand.linked', data_json: { screen: 'linked_creators', influencer_id: 'c1' } }))
      .toEqual({ tab: 'ProfileTab', screen: 'BrandLinkedCreators', params: {} });
    expect(noticeTarget({ type: 'own_brand.removed', data_json: { screen: 'my_brand' } }))
      .toEqual({ tab: 'ProfileTab', screen: 'MyBrand', params: {} });
  });
});

describe('B2 · B3 — Linked creators', () => {
  it('the brand\'s Profile has the row, after Pitch settings, with how many are linked', async () => {
    brandApi.getMe.mockResolvedValue(ok({ brand: { id: 'b1', business_name: 'Kavya Fashions', category: 'fashion', sub_categories: ['WOMEN'] }, user_status: 'approved', branches: [{ id: 'br1' }], mainCity: { name: 'Hyderabad' }, completeness: { complete: true, missing: [], missing_labels: [] } }));
    brandApi.getPitchSettings.mockResolvedValue(ok({ summary: { labelState: 'open', aims: ['conversion'], modes: ['visit'] } }));
    brandApi.linkedCreators.mockResolvedValue(ok({ linked: LINKED }));
    const n = nav();
    const r = render(<BrandProfileScreen navigation={n} route={{ params: {} }} />);
    await waitFor(() => r.getByTestId('row-linked-creators'));
    await waitFor(() => r.getByText('2 people post for your brand'));
    const order = flat(r);
    expect(order.indexOf('row-pitch-settings')).toBeLessThan(order.indexOf('row-linked-creators'));
    expect(order.indexOf('row-linked-creators')).toBeLessThan(order.indexOf('row-brand-overview'));
    fireEvent.press(r.getByTestId('row-linked-creators'));
    expect(n.navigate).toHaveBeenCalledWith('BrandLinkedCreators');
  });

  it('B2: who is linked, and how to add someone', async () => {
    brandApi.linkedCreators.mockResolvedValue(ok({ linked: LINKED }));
    const r = render(<BrandLinkedCreatorsScreen navigation={nav()} />);
    await waitFor(() => r.getByTestId('linked-c1'));
    r.getByText('Linked creators');
    r.getByText('People who post for your brand as its own team. They need no campaign, agreement or commission. Each one linked with a code sent to your number.');
    r.getByText('Ravi Teja'); r.getByText('@ravi.kf · Linked 10 Oct');
    r.getByText('Sneha N'); r.getByText('@sneha.kf · Linked 2 Oct');
    r.getByText('To add someone: in the INFLX Creator app they open Profile › My brand and enter the code sent to your number.');
  });

  it('B3: Remove asks first, then the row is gone', async () => {
    brandApi.linkedCreators.mockResolvedValue(ok({ linked: LINKED }));
    brandApi.removeLinkedCreator.mockResolvedValue(ok({ removed: true }));
    const r = render(<BrandLinkedCreatorsScreen navigation={nav()} />);
    await waitFor(() => r.getByTestId('remove-c1'));
    fireEvent.press(r.getByTestId('remove-c1'));
    expect(brandApi.removeLinkedCreator).not.toHaveBeenCalled();
    r.getByText('Remove Ravi Teja?');
    r.getByText("Their live posts for your brand stay live. They can't make new ones, and they are told.");
    await act(async () => { fireEvent.press(r.getByTestId('confirm-primary')); });
    await waitFor(() => expect(brandApi.removeLinkedCreator).toHaveBeenCalledWith('c1'));
    await waitFor(() => expect(r.queryByTestId('linked-c1')).toBeNull());
    r.getByTestId('linked-c2');
  });

  it('nobody linked yet', async () => {
    brandApi.linkedCreators.mockResolvedValue(ok({ linked: [] }));
    const r = render(<BrandLinkedCreatorsScreen navigation={nav()} />);
    await waitFor(() => r.getByText('Nobody is linked yet'));
  });
});

/* ───────────────────────────────────────────── C1–C5 · posting for his own brand */

/* shoppablePosts.service shape(), trimmed to what the screens read. */
const post = (over) => ({ id: 'p1', state: 'live', status: 'approved', title: 'Any 2 kurtas for ₹1,999', caption: 'Any 2 kurtas for ₹1,999', code: 'KF7Q2', kind: 'offer',
  goes_live_on: null, live_since: '2026-10-08', own_brand: true, for_line: 'Kavya Fashions · your brand',
  collaboration: { id: null, brand_id: 'b1', brand_name: 'Kavya Fashions', brand_logo: null, campaign_name: null, set_name: null, posting_date: null },
  offer: { type: 'Discount', deal: '20% off', name: 'Festive 20', ends_on: '2026-11-20' }, products: [], media: [], facets: {}, draft_step: null,
  submitted_at: '2026-10-10T04:00:00.000Z', approved_at: '2026-10-08T04:00:00.000Z', sent_back: null, removed: null,
  sales: { orders: 14, commission: 0, sales: 27986 }, sales_words: '14 sales · ₹27,986', can: {}, ...over });
const COLLAB_POST = post({ id: 'p2', own_brand: false, for_line: 'Kora · Festive Edit · Kurta drop', code: 'KR4T9',
  collaboration: { id: 'ci1', brand_id: 'b9', brand_name: 'Kora', campaign_name: 'Festive Edit', set_name: 'Kurta drop', posting_date: '2026-10-20' },
  sales: { orders: 2, commission: 310, sales: 3100 }, sales_words: '2 sales · ₹310 to you' });
const HOME = { needs: [], counts: { live: 0, approved: 0, in_review: 0, sent_back: 0, removed: 0, draft: 0 }, total: 0, recent: [], collections: 0, can_post: true,
  own_brand: { id: 'b1', name: 'Kavya Fashions', logo_url: null, open: true }, store_link: 'inflx.in/s/ravi.kf' };

describe('C1 — Create opens on the link alone', () => {
  it('a linked, approved brand: the card is open, and the empty line names his brand', async () => {
    influencerApi.createHome.mockResolvedValue(ok(HOME));
    const n = nav();
    const r = render(<CreateHomeScreen navigation={n} />);
    await waitFor(() => r.getByTestId('create-home'));
    expect(r.queryByTestId('cant-post')).toBeNull();
    expect(r.getByTestId('no-posts').props.children).toBe('No posts yet. Make your first one for Kavya Fashions.');
    fireEvent.press(r.getByTestId('new-post'));
    expect(n.navigate).toHaveBeenCalledWith('PostBrand');
  });

  it('a linked brand INFLX has not approved yet: the card is closed and says why; with no link the old line stays', async () => {
    influencerApi.createHome.mockResolvedValue(ok({ ...HOME, can_post: false, own_brand: { ...HOME.own_brand, open: false } }));
    const r = render(<CreateHomeScreen navigation={nav()} />);
    await waitFor(() => r.getByTestId('cant-post'));
    expect(r.getByTestId('cant-post').props.children).toBe('Posting opens when INFLX approves your brand.');
    expect(r.getByTestId('no-posts').props.children).toBe(CP.nothingYet);

    influencerApi.createHome.mockResolvedValue(ok({ ...HOME, can_post: false, own_brand: null }));
    const r2 = render(<CreateHomeScreen navigation={nav()} />);
    await waitFor(() => r2.getByTestId('cant-post'));
    expect(r2.getByTestId('cant-post').props.children).toBe(CP.cantPostYet);
  });
});

const BRANDS = [
  { id: 'b1', name: 'Kavya Fashions', logo_url: null, own: true, open: true, line: 'Anything your store sells. No collaboration needed.' },
  { id: 'b8', name: 'Nomad Bags', logo_url: null, own: false, open: true, line: '1 collaboration' },
  { id: 'b9', name: 'Kora', logo_url: null, own: false, open: false, line: 'Opens after your shoot plan' },
];

describe('C2 — step 1: his brand is in the list, and skips "Which collaboration?"', () => {
  it('his own brand is first, tagged; picking it makes the post and goes to its type — seven steps', async () => {
    influencerApi.postBrands.mockResolvedValue(ok({ brands: BRANDS }));
    influencerApi.createOwnPost.mockResolvedValue(ok({ post: post({ id: 'new1', state: 'draft' }) }));
    const n = nav();
    const r = render(<PostBrandScreen navigation={n} />);
    await waitFor(() => r.getByTestId('brand-b1'));
    expect(r.getByTestId('brand-b1-tag').props.children).toBe('Your brand');
    expect(r.queryByTestId('brand-b8-tag')).toBeNull();
    r.getByText('Anything your store sells. No collaboration needed.');
    expect(r.getByTestId('step-count').props.children).toBe(CP.step(1));   // nothing picked yet (two brands are open)
    fireEvent.press(r.getByTestId('brand-b1'));
    expect(r.getByTestId('step-count').props.children).toBe('Step 1 of 7');
    await act(async () => { fireEvent.press(r.getByTestId('next')); });
    expect(influencerApi.createOwnPost).toHaveBeenCalledWith('b1');
    expect(n.navigate).toHaveBeenCalledWith('PostType', { postId: 'new1' });
    expect(n.navigate).not.toHaveBeenCalledWith('PostCollab', expect.anything());
  });

  it('another brand works exactly as before: eight steps, on to "Which collaboration?"', async () => {
    influencerApi.postBrands.mockResolvedValue(ok({ brands: BRANDS }));
    const n = nav();
    const r = render(<PostBrandScreen navigation={n} />);
    await waitFor(() => r.getByTestId('brand-b8'));
    fireEvent.press(r.getByTestId('brand-b8'));
    expect(r.getByTestId('step-count').props.children).toBe('Step 1 of 8');
    await act(async () => { fireEvent.press(r.getByTestId('next')); });
    expect(n.navigate).toHaveBeenCalledWith('PostCollab', { brandId: 'b8' });
    expect(influencerApi.createOwnPost).not.toHaveBeenCalled();
  });

  it('a refusal to start the post is shown, and he stays on the step', async () => {
    influencerApi.postBrands.mockResolvedValue(ok({ brands: [BRANDS[0]] }));
    influencerApi.createOwnPost.mockResolvedValue(no('NOT_POSTABLE', 'You can post for this brand once INFLX approves it.'));
    const n = nav();
    const r = render(<PostBrandScreen navigation={n} />);
    await waitFor(() => r.getByTestId('brand-b1'));
    await act(async () => { fireEvent.press(r.getByTestId('next')); });   // the only open brand is picked for him
    await waitFor(() => r.getByText('You can post for this brand once INFLX approves it.'));
    expect(n.navigate).not.toHaveBeenCalled();
  });
});

const OPTIONS = { post_id: 'p1', own_brand: true, collaboration: { id: null, brand_name: 'Kavya Fashions', campaign_name: null, set_name: null, posting_date: null },
  kinds: { offer: { available: true, count: 4, why: null }, price: { available: true, count: 38, why: null } }, offer_types: [], offer_types_hidden: null, offers: [], pool: null, price_products: [], price_bands: [], theme_tags: [] };

describe('C3 — step 2: the counts are the store\'s own', () => {
  it('"Step 2 of 7", and the offers are the ones running in his store', async () => {
    influencerApi.getPost.mockResolvedValue(ok({ post: post({ state: 'draft', draft_step: 3, kind: null }) }));
    influencerApi.postOptions.mockResolvedValue(ok(OPTIONS));
    const r = render(<PostTypeScreen navigation={nav()} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => r.getByTestId('kind-offer'));
    expect(r.getByTestId('step-count').props.children).toBe('Step 2 of 7');
    r.getByText('4 offers running in your store'); r.getByText('38 products without offers');
  });

  it('a collaboration post still says "Step 3 of 8" and "in this collaboration"', async () => {
    influencerApi.getPost.mockResolvedValue(ok({ post: { ...COLLAB_POST, state: 'draft', draft_step: 3, kind: null } }));
    influencerApi.postOptions.mockResolvedValue(ok({ ...OPTIONS, own_brand: false }));
    const r = render(<PostTypeScreen navigation={nav()} route={{ params: { postId: 'p2' } }} />);
    await waitFor(() => r.getByTestId('kind-offer'));
    expect(r.getByTestId('step-count').props.children).toBe('Step 3 of 8');
    r.getByText('4 offers in this collaboration');
  });
});

const PLACES = { post_id: 'p1', can_edit: true,
  places: [
    { id: 'pl1', place: 'reel', label: 'Instagram reel', short: 'Reel', channel: 'ig', link: 'https://instagram.com/reel/C9xK2', link_display: 'instagram.com/reel/C9xK2', shared_on: '2026-10-08' },
    { id: 'pl2', place: 'story', label: 'Instagram story', short: 'Story', channel: 'ig', link: null, link_display: null, shared_on: '2026-10-09' },
  ],
  options: [{ key: 'reel', label: 'Instagram reel', link: 'needed' }, { key: 'post', label: 'Instagram post', link: 'needed' }, { key: 'story', label: 'Instagram story', link: 'optional' },
    { key: 'youtube_video', label: 'YouTube video', link: 'needed' }, { key: 'youtube_short', label: 'YouTube Short', link: 'needed' }, { key: 'facebook_post', label: 'Facebook post', link: 'needed' }] };

describe('C5 · S1 · S2 — the post\'s own page', () => {
  it('C5: with INFLX — the same check in his store\'s words, no posting date, and who it is for', async () => {
    influencerApi.getPost.mockResolvedValue(ok({ post: post({ state: 'in_review', status: 'submitted', code: null }) }));
    const r = render(<PostStatusScreen navigation={nav()} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => r.getByTestId('post-status-in_review'));
    r.getByText("INFLX. We check the products and offer are from your store, and that there's no copyrighted music.");
    r.getByText('As soon as INFLX approves it.');
    expect(flat(r)).not.toContain('last day to go live');
    expect(r.getByTestId('post-for').props.children.join('')).toBe('Kavya Fashions · your brand');
    expect(r.queryByTestId('places-card')).toBeNull();                     // nothing to record until INFLX approves it
    expect(influencerApi.postPlaces).not.toHaveBeenCalled();
  });

  it('S1: live — what it sold, and the card of places with Add a place', async () => {
    influencerApi.getPost.mockResolvedValue(ok({ post: post() }));
    influencerApi.postPlaces.mockResolvedValue(ok(PLACES));
    const r = render(<PostStatusScreen navigation={nav()} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => r.getByTestId('places-card'));
    r.getByText('14 sales · ₹27,986');
    r.getByText('Where did you share it?'); r.getByText('Add your reel, post or video. Nobody approves this. It is for your own numbers.');
    r.getByText('Instagram reel'); r.getByText('instagram.com/reel/C9xK2'); r.getByText('8 Oct');
    r.getByText('Instagram story'); r.getByText('no link'); r.getByText('9 Oct');
    r.getByTestId('place-add');
    r.getByText("An approved post can't be changed. You can take it down: it leaves the shop and keeps its sales history.");
    expect(flat(r)).not.toContain('earnings history');
  });

  it('S2: add a place — a story needs no link; the server\'s refusal is shown in the sheet', async () => {
    influencerApi.getPost.mockResolvedValue(ok({ post: post() }));
    influencerApi.postPlaces.mockResolvedValue(ok({ ...PLACES, places: [] }));
    const r = render(<PostStatusScreen navigation={nav()} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => r.getByTestId('place-add'));
    fireEvent.press(r.getByTestId('place-add'));
    for (const o of PLACES.options) r.getByTestId(`place-opt-${o.key}`);    // the six places
    r.getByText('Link');
    r.getByText('Put your Instagram link from Share in the caption or bio. Visits and orders are counted from that link.');

    influencerApi.addPostPlace.mockResolvedValueOnce(no('VALIDATION_ERROR', 'Paste the link.', 422, 'link'));
    await act(async () => { fireEvent.press(r.getByTestId('place-save')); });
    expect(influencerApi.addPostPlace).toHaveBeenCalledWith('p1', { place: 'reel', link: '' });
    await waitFor(() => expect(r.getByTestId('place-error').props.children).toBe('Paste the link.'));

    fireEvent.press(r.getByTestId('place-opt-story'));
    r.getByText('Link (optional)');
    influencerApi.addPostPlace.mockResolvedValueOnce(ok({ ...PLACES, places: [PLACES.places[1]] }));
    await act(async () => { fireEvent.press(r.getByTestId('place-save')); });
    expect(influencerApi.addPostPlace).toHaveBeenLastCalledWith('p1', { place: 'story', link: '' });
    await waitFor(() => r.getByTestId('place-pl2'));

    fireEvent.press(r.getByTestId('place-pl2'));                           // tap a place to change or remove it
    r.getByText('Change this place');
    influencerApi.removePostPlace.mockResolvedValueOnce(ok({ ...PLACES, places: [] }));
    await act(async () => { fireEvent.press(r.getByTestId('place-remove')); });
    expect(influencerApi.removePostPlace).toHaveBeenCalledWith('p1', 'pl2');
    await waitFor(() => expect(r.queryByTestId('place-pl2')).toBeNull());
  });

  it('sent back and removed: his store\'s words; "Start over" makes another post for his brand; no commission line', async () => {
    influencerApi.getPost.mockResolvedValue(ok({ post: post({ state: 'sent_back', status: 'rejected', code: null, sent_back: { reason: 'Show the product in the first frame', count: 1 } }) }));
    influencerApi.createOwnPost.mockResolvedValue(ok({ post: post({ id: 'new2', state: 'draft' }) }));
    const n = nav();
    const r = render(<PostStatusScreen navigation={n} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => r.getByTestId('post-status-sent_back'));
    r.getByText('Photos and videos, caption, products, theme tags. Not the brand, post type or offer. For those, start a new post.');
    expect(r.queryByText(CP.postingNotMoved)).toBeNull();                  // there is no posting date
    await act(async () => { fireEvent.press(r.getByTestId('start-over')); });
    expect(influencerApi.createOwnPost).toHaveBeenCalledWith('b1');
    expect(influencerApi.createPost).not.toHaveBeenCalled();
    expect(n.navigate).toHaveBeenCalledWith('PostType', { postId: 'new2' });

    influencerApi.getPost.mockResolvedValue(ok({ post: post({ state: 'removed', status: 'removed', removed: { reason: 'taken_down', at: '2026-10-12T05:00:00.000Z', why: 'You took this post down.', offer_ended_on: null } }) }));
    influencerApi.postPlaces.mockResolvedValue(ok({ ...PLACES, can_edit: false }));
    const r2 = render(<PostStatusScreen navigation={nav()} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => r2.getByTestId('post-status-removed'));
    r2.getByText('It sold');
    expect(r2.getByTestId('removed-money').props.children).toBe('₹27,986');
    expect(r2.queryByText(CP.youEarned)).toBeNull();
    expect(r2.queryByText(CP.returnWindow)).toBeNull();
    await waitFor(() => r2.getByTestId('places-card'));                    // the record stays, read-only
    expect(r2.queryByTestId('place-add')).toBeNull();
  });

  it('a collaboration post\'s page is as it was: its own words, no places card', async () => {
    influencerApi.getPost.mockResolvedValue(ok({ post: COLLAB_POST }));
    const r = render(<PostStatusScreen navigation={nav()} route={{ params: { postId: 'p2' } }} />);
    await waitFor(() => r.getByTestId('post-status-live'));
    r.getByText('2 sales · ₹310 to you'); r.getByText(CP.noEdits);
    expect(r.queryByTestId('places-card')).toBeNull();
    expect(influencerApi.postPlaces).not.toHaveBeenCalled();
    expect(r.getByTestId('post-for').props.children.join('')).toBe('Kora · Festive Edit · Kurta drop · 20 Oct');
  });
});

/* ───────────────────────────────────────────── S3 · Stats */

const STATS = { post_id: 'p1', title: 'Any 2 kurtas for ₹1,999', code: 'KF7Q2', brand_name: 'Kavya Fashions', own_brand: true, live_since: '2026-10-08', state: 'live',
  totals: { visits: 412, orders: 14, sales: 27986, commission: 0 },
  visits: [
    { channel: 'ig', label: 'Instagram', visits: 268, places: [PLACES.places[0], PLACES.places[1]] },
    { channel: 'wa', label: 'WhatsApp', visits: 96, places: [] },
    { channel: 'yt', label: 'YouTube', visits: 31, places: [{ id: 'pl3', place: 'youtube_short', label: 'YouTube Short', short: 'Short', channel: 'yt', link: 'https://youtube.com/shorts/aB3f', link_display: 'youtube.com/shorts/aB3f', shared_on: '2026-10-08' }] },
    { channel: 'code', label: 'Post code', visits: 17, places: [] },
  ],
  orders: [{ channel: 'ig', label: 'Instagram', orders: 9, sales: 17991, commission: 0 }, { channel: 'wa', label: 'WhatsApp', orders: 3, sales: 5997, commission: 0 }, { channel: 'inflx', label: 'In INFLX', orders: 2, sales: 3998, commission: 0 }] };

describe('S3 — Stats: sales, by channel, with where he shared it', () => {
  it('the third number is sales; each place is listed under its channel, with no number of its own', async () => {
    influencerApi.postStats.mockResolvedValue(ok(STATS));
    const r = render(<PostStatsScreen navigation={nav()} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => r.getByTestId('post-stats'));
    await waitFor(() => r.getByTestId('stat-money'));
    r.getByText('₹27,986'); r.getByText('sales');
    expect(r.queryByText('to you')).toBeNull();
    expect(r.getByTestId('place-line-pl1').props.children).toBe('Reel · 8 Oct');
    expect(r.getByTestId('place-line-pl2').props.children).toBe('Story · 9 Oct');
    expect(r.getByTestId('place-line-pl3').props.children).toBe('Short · 8 Oct');
    r.getByText('"In INFLX" = the shopper found your post inside INFLX, with no tap on your links in the 30 days before buying.');
    expect(flat(r)).not.toContain('You earn on every one');
  });

  it('a collaboration post still shows what he earned', async () => {
    influencerApi.postStats.mockResolvedValue(ok({ ...STATS, own_brand: false, totals: { ...STATS.totals, commission: 2798.6 }, visits: STATS.visits.map(({ places, ...v }) => v) }));
    const r = render(<PostStatsScreen navigation={nav()} route={{ params: { postId: 'p2' } }} />);
    await waitFor(() => r.getByTestId('stat-money'));
    r.getByText('to you'); r.getByText('₹2,798.6');
    expect(r.queryByTestId('place-line-pl1')).toBeNull();
  });
});

/* ───────────────────────────────────────────── M1 · M2 · the brand's Sales money */

/* walletRead.service saleOut(…, 'brand') */
const sale = (over) => ({ id: 'l1', item: 'Indigo block-print kurta', qty: 1, colour: 'Indigo', size: 'M', gift: false, soldAt: '2026-10-10T07:00:00.000Z',
  post: { id: 'p1', code: 'KF7Q2', title: 'Any 2 kurtas' }, campaignName: null, setName: null, offerName: null, ownBrand: true, cashOnDelivery: false,
  orderStatus: 'delivered', deliveredAt: '2026-10-10T12:00:00.000Z', state: 'window', windowUntil: '2026-10-17', at: null,
  creatorName: 'Ravi Teja', creatorFirst: 'Ravi', brandName: 'Kavya Fashions', paid: 1499, commissionPct: 0, feePct: 5, creatorShare: 0, inflxShare: 74.95, brandShare: 1424.05, ...over });

describe('M1 · M2 — a sale through his own post, in the brand\'s wallet', () => {
  it('M1: the row reads "Your own post"; a creator\'s sale still names the creator', async () => {
    brandApi.getWalletSales = jest.fn().mockResolvedValue(ok({ totals: { coming: 2502.22, comingCount: 2, added: 0, addedThisMonth: 0, sales: 2 },
      sales: [sale(), sale({ id: 'l2', item: 'Cotton tote', ownBrand: false, creatorName: 'Ananya Rao', creatorFirst: 'Ananya', post: { id: 'p9', code: 'KR4T9', title: 'Totes' }, campaignName: 'Festive Edit', setName: 'Set A', commissionPct: 12, creatorShare: 155.88, brandShare: 1078.17, paid: 1299, inflxShare: 64.95, state: 'waiting_delivery', windowUntil: null })] }));
    const r = render(<BrandWalletSalesScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => r.getByTestId('wallet-sales-list'));
    r.getByText('Your own post KF7Q2 · return window until 17 Oct');
    r.getByText("Ananya's post KR4T9 · on its way · waiting for delivery");
  });

  it('M2: three lines, not four — no creator\'s share on his own post', () => {
    const r = render(<BrandWalletSaleScreen navigation={nav()} route={{ params: { sale: sale() } }} />);
    r.getByText('Shopper paid'); r.getByText("INFLX's share · 5%"); r.getByText('Your share');
    expect(flat(r)).not.toContain("Creator's share");
    expect(flat(r)).toContain('Your own post KF7Q2');
    r.getByText("In its return window until 17 Oct. Your ₹1,424.05 is added to your wallet when it closes, if it isn't returned.");

    const other = render(<BrandWalletSaleScreen navigation={nav()} route={{ params: { sale: sale({ ownBrand: false, commissionPct: 12, creatorShare: 179.88 }) } }} />);
    other.getByText("Creator's share · 12%");
  });
});
