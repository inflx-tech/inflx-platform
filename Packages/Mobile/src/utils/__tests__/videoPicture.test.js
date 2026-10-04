/**
 * shopper-walk-fixes (W15) — a picture taken from a video, on her phone (utils/videoPrep.js).
 * Contract: features/shopper-walk-fixes · BUILD_API.md §2 · frames B1, C1–C3
 *
 * The compressor is a native module: it is inside the app builds from 30 Sep 2026 and absent in
 * older ones — and in jest. Both paths are tested. The one rule that must never break: a picture
 * that cannot be made is `null`, never an error — the video is uploaded with or without it.
 */

/** How many times the compressor's own module was loaded since the last onPhone(). */
let loads = 0;

/** A fresh copy of the module, on a phone with (`lib`) or without (null) the compressor inside. */
function onPhone(lib) {
  jest.resetModules();
  loads = 0;
  const { NativeModules } = require('react-native');
  if (lib) NativeModules.Compressor = {}; else delete NativeModules.Compressor;
  // Without the native module the JS library must never be loaded at all (it reaches for it at load).
  jest.doMock('react-native-compressor', () => { loads += 1; return lib || {}; });
  return require('../videoPrep');
}

const MB = 1024 * 1024;
/** The library as the builds have it: the thumbnail's own `size` is the picture's size in MEMORY. */
const lib = (over = {}) => ({
  createVideoThumbnail: jest.fn(() => Promise.resolve({ path: 'file:///cache/thumbnails/thumb-1', size: 8294400, mime: 'image/jpeg', width: 1080, height: 1920 })),
  getFileSize: jest.fn(() => Promise.resolve('184320')),
  Image: { compress: jest.fn(() => Promise.resolve('file:///cache/small.jpg')) },
  ...over,
});

afterEach(() => {
  delete require('react-native').NativeModules.Compressor;
  jest.dontMock('react-native-compressor');
  jest.resetModules();
});

describe('an app build without the compressor (installed before 30 Sep 2026, and jest)', () => {
  it('no picture — and the library is never loaded', async () => {
    const { makeVideoPicture, hasCompressor } = onPhone(null);
    expect(hasCompressor()).toBe(false);
    await expect(makeVideoPicture('file:///v.mp4', { maxBytes: MB })).resolves.toBeNull();
    expect(loads).toBe(0);
  });

  it('(the check on the check: with the compressor inside, the library IS loaded)', async () => {
    const { makeVideoPicture } = onPhone(lib());
    await makeVideoPicture('file:///v.mp4', { maxBytes: MB });
    expect(loads).toBe(1);
  });

  it('nothing to take a picture from is no picture either', async () => {
    const { makeVideoPicture } = onPhone(lib());
    await expect(makeVideoPicture(null)).resolves.toBeNull();
    await expect(makeVideoPicture('')).resolves.toBeNull();
  });
});

describe('an app build with the compressor', () => {
  it('a JPEG made from the video; its size is the FILE\'s, read back — never the size the call itself reports', async () => {
    const l = lib();
    const { makeVideoPicture } = onPhone(l);
    const out = await makeVideoPicture('file:///cache/reel.mp4', { maxBytes: MB });
    expect(l.createVideoThumbnail).toHaveBeenCalledWith('file:///cache/reel.mp4');
    expect(l.getFileSize).toHaveBeenCalledWith('file:///cache/thumbnails/thumb-1');
    expect(out).toEqual({ uri: 'file:///cache/thumbnails/thumb-1', size: 184320, mime: 'image/jpeg' });
    expect(out.size).not.toBe(8294400);                 // 1080 × 1920 × 4: the picture in memory, not the file
    expect(l.Image.compress).not.toHaveBeenCalled();    // within the limit: used as it is
  });

  it('with no limit given, the picture is used as it is', async () => {
    const l = lib({ getFileSize: jest.fn(() => Promise.resolve('3500000')) });
    const { makeVideoPicture } = onPhone(l);
    expect(await makeVideoPicture('file:///v.mp4')).toEqual({ uri: 'file:///cache/thumbnails/thumb-1', size: 3500000, mime: 'image/jpeg' });
    expect(l.Image.compress).not.toHaveBeenCalled();
  });

  it('a frame of a 4K video is over the limit: it is made again at 1280, and that one is sent', async () => {
    const sizes = { 'file:///cache/thumbnails/thumb-1': '2600000', 'file:///cache/small.jpg': '212000' };
    const l = lib({ getFileSize: jest.fn((uri) => Promise.resolve(sizes[uri])) });
    const { makeVideoPicture, PICTURE } = onPhone(l);
    expect(PICTURE).toEqual({ maxSize: 1280, quality: 0.8 });
    const out = await makeVideoPicture('file:///v.mp4', { maxBytes: MB });
    expect(l.Image.compress).toHaveBeenCalledWith('file:///cache/thumbnails/thumb-1', { compressionMethod: 'manual', maxWidth: 1280, maxHeight: 1280, quality: 0.8, output: 'jpg' });
    expect(out).toEqual({ uri: 'file:///cache/small.jpg', size: 212000, mime: 'image/jpeg' });
  });

  it('still over the limit after that, or a library that cannot make it smaller: no picture', async () => {
    const heavy = lib({ getFileSize: jest.fn(() => Promise.resolve('2600000')) });
    await expect(onPhone(heavy).makeVideoPicture('file:///v.mp4', { maxBytes: MB })).resolves.toBeNull();
    expect(heavy.Image.compress).toHaveBeenCalledTimes(1);
    const noImage = lib({ getFileSize: jest.fn(() => Promise.resolve('2600000')), Image: undefined });
    await expect(onPhone(noImage).makeVideoPicture('file:///v.mp4', { maxBytes: MB })).resolves.toBeNull();
  });

  it('exactly at the limit is within it', async () => {
    const l = lib({ getFileSize: jest.fn(() => Promise.resolve(String(MB))) });
    expect(await onPhone(l).makeVideoPicture('file:///v.mp4', { maxBytes: MB })).toEqual({ uri: 'file:///cache/thumbnails/thumb-1', size: MB, mime: 'image/jpeg' });
    expect(l.Image.compress).not.toHaveBeenCalled();
  });
});

describe('a picture that cannot be made is null — never an error, so it can never stop a video being uploaded', () => {
  const failing = [
    ['the phone cannot read the video (the call rejects)', { createVideoThumbnail: jest.fn(() => Promise.reject(new Error('File doesn\'t exist or not supported'))) }],
    ['the call throws outright', { createVideoThumbnail: jest.fn(() => { throw new Error('boom'); }) }],
    ['the call answers with nothing', { createVideoThumbnail: jest.fn(() => Promise.resolve(null)) }],
    ['the call answers without a file', { createVideoThumbnail: jest.fn(() => Promise.resolve({ size: 10, mime: 'image/jpeg' })) }],
    ['the file\'s size cannot be read (the library answers "")', { getFileSize: jest.fn(() => Promise.resolve('')) }],
    ['the file\'s size is not a whole number', { getFileSize: jest.fn(() => Promise.resolve('12.5')) }],
    ['reading the size fails', { getFileSize: jest.fn(() => Promise.reject(new Error('gone'))) }],
    ['an older copy of the library with no thumbnail call', { createVideoThumbnail: undefined }],
    ['making it smaller fails', { getFileSize: jest.fn(() => Promise.resolve('2600000')), Image: { compress: jest.fn(() => Promise.reject(new Error('oom'))) } }],
    ['making it smaller answers with no file', { getFileSize: jest.fn(() => Promise.resolve('2600000')), Image: { compress: jest.fn(() => Promise.resolve('')) } }],
  ];
  it.each(failing)('%s', async (_, over) => {
    const { makeVideoPicture } = onPhone(lib(over));
    await expect(makeVideoPicture('file:///v.mp4', { maxBytes: MB })).resolves.toBeNull();
  });

  it('the library itself will not load', async () => {
    jest.resetModules();
    require('react-native').NativeModules.Compressor = {};
    jest.doMock('react-native-compressor', () => { throw new Error('native module missing'); });
    const { makeVideoPicture } = require('../videoPrep');
    await expect(makeVideoPicture('file:///v.mp4', { maxBytes: MB })).resolves.toBeNull();
  });
});

describe('making a video smaller is untouched by this', () => {
  it('prepareVideo still returns the original on a build without the compressor', async () => {
    const { prepareVideo } = onPhone(null);
    expect(await prepareVideo({ uri: 'file:///big.mp4', fileSize: 48000000, type: 'video/mp4' })).toEqual({ uri: 'file:///big.mp4', size: 48000000, mime: 'video/mp4', shrunk: false });
  });
});
