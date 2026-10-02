/**
 * ui-walk-fixes · board H — the one runtime check for the video player (utils/videoPlayer.js).
 * Contract: features/ui-walk-fixes · check 31 · research/C10 (FIX FINAL 6, FIX RISKS "test loading")
 *
 * The check moved out of the shopper's ShopVideo so the brand / creator file viewer can ask the
 * same question. Three things must stay true:
 *   · it is ONE check with ONE answer — ShopVideo hands out the very same functions, so the
 *     shopper's tests (video16) and its "Update INFLX to play videos" note cannot drift apart;
 *   · the player module is loaded ONLY when this app build has its native view — an older build,
 *     and every jest suite, never loads react-native-video (it is not mocked in jest.setup.js);
 *   · nothing else in the app imports the player directly.
 */
import fs from 'fs';
import path from 'path';
import { UIManager } from 'react-native';

let mockLoads = 0;
jest.mock('react-native-video', () => { mockLoads += 1; return { __esModule: true, default: 'THE-PLAYER' }; });
jest.mock('../../../services/events', () => ({ track: jest.fn() }));

const shared = require('../../../utils/videoPlayer');
const shop = require('../../shop/ShopVideo');

// React Native's jest setup makes UIManager.getViewManagerConfig a jest.fn of its own (it knows no
// 'RCTVideo'). Each test gives it an answer and hands the original back afterwards.
const cfg = UIManager.getViewManagerConfig;
const original = cfg.getMockImplementation();
beforeEach(() => { cfg.mockClear(); shared._setPlayerForTests(undefined); });
afterEach(() => { cfg.mockImplementation(original); shared._setPlayerForTests(undefined); });

it('one check, one answer: ShopVideo re-exports the shared functions themselves', () => {
  expect(shop.hasPlayer).toBe(shared.hasPlayer);
  expect(shop._setPlayerForTests).toBe(shared._setPlayerForTests);
  shop._setPlayerForTests(null);
  expect(shared.hasPlayer()).toBe(false);
  expect(shared.getPlayer()).toBeNull();
  const Fake = () => null;
  shared._setPlayerForTests(Fake);
  expect(shop.hasPlayer()).toBe(true);
  expect(shared.getPlayer()).toBe(Fake);
});

it('an app build without the native view (and jest): no player, and the module is never loaded', () => {
  const before = mockLoads;
  cfg.mockImplementation(() => null);
  expect(shared.hasPlayer()).toBe(false);
  expect(shared.getPlayer()).toBeNull();
  expect(mockLoads).toBe(before);
});

it('an app build with the native view: the module is loaded then, once', () => {
  const before = mockLoads;
  cfg.mockImplementation((name) => (name === 'RCTVideo' ? {} : null));
  expect(shared.hasPlayer()).toBe(true);
  expect(shared.getPlayer()).toBe('THE-PLAYER');
  expect(cfg).toHaveBeenCalledWith('RCTVideo');
  expect(shared.hasPlayer()).toBe(true);
  expect(mockLoads).toBe(before + 1);
  expect(cfg).toHaveBeenCalledTimes(1);                 // checked once
});

it('a player that will not load is "no player", not a crash', () => {
  cfg.mockImplementation(() => { throw new Error('boom'); });
  expect(shared.hasPlayer()).toBe(false);
  expect(shared.getPlayer()).toBeNull();
});

describe('nobody imports the player directly', () => {
  const SRC = path.resolve(__dirname, '../../..');
  const walk = (dir, out = []) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== '__tests__' && e.name !== 'node_modules') walk(p, out); } else if (e.name.endsWith('.js')) out.push(p);
    }
    return out;
  };
  const files = walk(SRC);

  it('reads the source tree', () => { expect(files.length).toBeGreaterThan(100); });

  it("the only file that names the module is utils/videoPlayer.js, and it does so with a lazy require", () => {
    const naming = files
      .filter((f) => /['"]react-native-video['"]/.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(SRC, f).split(path.sep).join('/'));
    expect(naming).toEqual(['utils/videoPlayer.js']);
    const src = fs.readFileSync(path.join(SRC, 'utils/videoPlayer.js'), 'utf8');
    expect(src).not.toMatch(/^import[^\n]*['"]react-native-video['"]/m);
    expect(src).toMatch(/require\('react-native-video'\)/);
  });

  // The title said "keeps nothing of a private file on the phone". That is true of a VIDEO only
  // (spec U26): a photo is drawn by the standard picture component, which keeps its own copy.
  it('the file viewer asks the shared check, and gives the player no cache — no private video is kept on the phone', () => {
    const src = fs.readFileSync(path.join(SRC, 'components/content/MediaViewer12.js'), 'utf8');
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    expect(code).toMatch(/from '\.\.\/\.\.\/utils\/videoPlayer'/);
    expect(code).not.toMatch(/ShopVideo/);              // no shopper code in the brand / creator apps' viewer
    expect(code).not.toMatch(/bufferConfig|cacheSizeMB|shouldCache/);
  });
});
