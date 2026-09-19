const fs = require('fs');
const path = require('path');

/**
 * Pass 0 of the cleaning plan — close the front door.
 * Contract: Docs/THE_CUT.md (founder decision, 2026-09-02: "INFLX is a fashion platform.")
 *
 * WHAT THIS GUARDS, AND WHY IT IS WORTH GUARDING
 * The business-type list was written out THREE times — once in the brand website's
 * signup form, once in this app's signup screen, and nowhere on the server, which
 * accepted any non-empty string. So both forms were a suggestion rather than a gate.
 *
 * The whole point of pass 0 is that no new wrong data can enter while everything else
 * is being removed. If a future change re-adds a business type to either form, or drops
 * the server check, that guarantee is silently gone and the mess starts refilling
 * behind the cleanup. These assertions are what notice.
 */

// __dirname is <repo>/Packages/Mobile/src/screens/auth/__tests__
const MOBILE = path.resolve(__dirname, '../../../..');   // -> Packages/Mobile
const REPO   = path.resolve(MOBILE, '../..');            // -> repo root
const read   = (p) => fs.readFileSync(p, 'utf8');

const RETIRED = [
  'restaurant', 'bakery', 'grocery', 'packaged_food',
  'car_rental', 'bike_rental', 'hotel_homestay', 'travel_packages',
  'salon', 'home_beauty', 'pet_grooming',
  'gym_fitness', 'clinic_doctor', 'dental_clinic', 'diagnostic_lab', 'coaching_center',
  'home_services', 'pest_control', 'laundry', 'interior_design', 'coworking_space',
  'function_hall', 'wedding_planner', 'photography', 'florist', 'legal_ca',
  'furniture', 'electronics', 'jewellery', 'footwear', 'optical', 'pet_shop',
  'flowers_gifting', 'hardware',
];

describe('the server is the real gate', () => {
  const model = read(path.join(REPO, 'backend/src/services/businessCategory.model.js'));
  const controller = read(path.join(REPO, 'backend/src/controllers/brand.controller.js'));

  it('there is exactly one accepted category, and it is fashion', () => {
    expect(model).toMatch(/ACCEPTED_CATEGORIES\s*=\s*\['fashion'\]/);
  });

  it('⚠️ registration refuses anything else', () => {
    // Without this the two forms are cosmetic — a direct request registers a
    // pest-control business and pass 0 has achieved nothing. The gate is the
    // call, whatever the register handler names its local (it was `category`,
    // features/registration-and-profile's rewrite calls it `cat`).
    expect(controller).toMatch(/if \(!businessCategory\.isAcceptedCategory\(\w+\)\)/);
  });

  it('⚠️ and so does editing the profile afterwards', () => {
    // Closing signup alone would not hold: a brand could register as fashion and then
    // switch itself to restaurant from the profile edit, which is the same door in a
    // different wall. `category` is in that endpoint's allowed-fields list.
    expect(controller).toContain('updates.category !== undefined && !businessCategory.isAcceptedCategory(updates.category)');
  });

  it('but only when the field is actually being written', () => {
    // The nine existing brands — one of them a restaurant — must keep working. They
    // edit addresses and logos without re-categorising, and a blanket check would
    // lock them out of their own profile.
    expect(controller).toContain('updates.category !== undefined &&');
  });
});

describe('neither signup form offers a retired business type', () => {
  const mobileForm = read(path.join(MOBILE, 'src/screens/auth/BrandRegisterScreen.js'));
  const webForm    = read(path.join(REPO, 'Packages/brand-web/app/login/page.js'));

  it.each(RETIRED)('the phone app does not offer "%s"', (value) => {
    expect(mobileForm).not.toContain(`'${value}'`);
  });

  it.each(RETIRED)('the website does not offer "%s"', (value) => {
    expect(webForm).not.toContain(`'${value}'`);
  });

  it('both send fashion, and nothing else', () => {
    expect(mobileForm).toMatch(/const CATEGORY = 'fashion'/);
    expect(webForm).toMatch(/const CATEGORY = 'fashion'/);
  });

  it('the two-step industry picker is gone from both, not just hidden', () => {
    // A picker left in place with one option is worse than a statement, and it leaves
    // the retired list sitting in the file for someone to re-enable by accident.
    expect(mobileForm).not.toContain('INDUSTRY_HIERARCHY');
    expect(webForm).not.toContain('INDUSTRY_HIERARCHY');
  });

  it('a stale saved draft cannot resurrect an old category on the website', () => {
    // The website keeps a device-local draft of the signup step. One saved before the
    // cut can carry category:"restaurant"; restoring it would put a dead choice back
    // into a form that no longer offers it.
    expect(webForm).not.toContain('setCategory(d.category');
  });
});
