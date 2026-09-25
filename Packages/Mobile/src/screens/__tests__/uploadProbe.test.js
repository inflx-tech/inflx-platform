/**
 * Item 12, Phase 2b — the streaming upload helper and the real-phone proof screen.
 * Contract: features/item12-content · check 45
 *
 * The helper is the part that must survive a 200 MB video on a device. Jest cannot run React
 * Native's networking, so this proves the contract the device relies on: the body handed to
 * XMLHttpRequest is `{ uri }` (streamed by RN from disk — never a Blob read into memory), the
 * signed headers are sent exactly, progress is reported, and every failure has a code.
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

/* ── a fake XMLHttpRequest that records what the helper does ── */
class FakeXHR {
  constructor() { FakeXHR.last = this; this.headers = {}; this.upload = {}; }
  open(method, url) { this.method = method; this.url = url; }
  setRequestHeader(k, v) { this.headers[k] = v; }
  send(body) { this.body = body; FakeXHR.onSend && FakeXHR.onSend(this); }
}

describe('uploadContentFile — the streaming PUT', () => {
  const realXHR = global.XMLHttpRequest;
  beforeEach(() => { global.XMLHttpRequest = FakeXHR; FakeXHR.onSend = null; });
  afterAll(() => { global.XMLHttpRequest = realXHR; });
  const { uploadContentFile } = jest.requireActual('../../services/api');
  const UP = { url: 'https://r2.example/collab-content/ci/f.mp4?X-Amz-SignedHeaders=content-length%3Bcontent-type%3Bhost', method: 'PUT', headers: { 'Content-Type': 'video/mp4' } };

  it('sends { uri } — streamed from disk, never read into memory — with the signed headers and no Authorization', async () => {
    FakeXHR.onSend = (x) => { x.upload.onprogress({ lengthComputable: true, loaded: 50, total: 200 }); x.status = 200; x.onload(); };
    const progress = [];
    await expect(uploadContentFile(UP, 'file:///cache/v.mp4', { onProgress: (p) => progress.push(p) })).resolves.toEqual({ ok: true });
    const x = FakeXHR.last;
    expect(x.method).toBe('PUT');
    expect(x.url).toBe(UP.url);
    expect(x.body).toEqual({ uri: 'file:///cache/v.mp4', type: 'video/mp4', name: 'upload' });
    expect(x.headers).toEqual({ 'Content-Type': 'video/mp4' });
    expect(x.timeout).toBeGreaterThanOrEqual(30 * 60 * 1000);   // not the old 5 minutes
    expect(progress).toEqual([0.25]);
  });

  it('a refusal by storage, a network drop and a timeout each reject with a code', async () => {
    FakeXHR.onSend = (x) => { x.status = 403; x.responseText = 'SignatureDoesNotMatch'; x.onload(); };
    await expect(uploadContentFile(UP, 'file:///a')).rejects.toMatchObject({ code: 'UPLOAD_REJECTED', status: 403 });
    FakeXHR.onSend = (x) => x.onerror();
    await expect(uploadContentFile(UP, 'file:///a')).rejects.toMatchObject({ code: 'UPLOAD_NETWORK' });
    FakeXHR.onSend = (x) => x.ontimeout();
    await expect(uploadContentFile(UP, 'file:///a')).rejects.toMatchObject({ code: 'UPLOAD_TIMEOUT' });
  });
});

/* ── the screen ── */
jest.mock('react-native-image-picker', () => ({ launchImageLibrary: jest.fn() }));
jest.mock('../../services/api', () => ({
  influencerApi: { uploadProbeUrl: jest.fn(), uploadProbeConfirm: jest.fn(), uploadProbeStatus: jest.fn() },
  uploadContentFile: jest.fn(),
}));
const api = require('../../services/api');
const picker = require('react-native-image-picker');
import UploadProbeScreen from '../influencer/UploadProbeScreen';

const nav = { goBack: jest.fn(), navigate: jest.fn() };
const VIDEO = { uri: 'file:///cache/v.mp4', type: 'video/mp4', fileSize: 200 * 1024 * 1024, fileName: 'diwali.mp4', duration: 42 };

describe('UploadProbeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    picker.launchImageLibrary.mockResolvedValue({ assets: [VIDEO] });
    api.influencerApi.uploadProbeUrl.mockResolvedValue({ success: true, data: { probeToken: 't', upload: { url: 'u', method: 'PUT', headers: { 'Content-Type': 'video/mp4' } } } });
  });

  it('a 200 MB MP4: picked, streamed, verified byte for byte, deleted — PASSED', async () => {
    api.uploadContentFile.mockImplementation((up, uri, { onProgress }) => { onProgress(1); return Promise.resolve({ ok: true }); });
    const size = VIDEO.fileSize;
    api.influencerApi.uploadProbeConfirm.mockResolvedValue({ success: true, data: { declared: { size, contentType: 'video/mp4' }, landed: { size, contentType: 'video/mp4' }, match: true, deleted: true } });
    const r = render(<UploadProbeScreen navigation={nav} />);
    fireEvent.press(r.getByTestId('probe-pick'));
    await waitFor(() => r.getByTestId('probe-asset'));
    expect(r.getByText('200.0 MB · video/mp4 · 42s')).toBeTruthy();
    fireEvent.press(r.getByTestId('probe-upload'));
    await waitFor(() => r.getByTestId('probe-result-pass'));
    expect(api.influencerApi.uploadProbeUrl).toHaveBeenCalledWith({ mime: 'video/mp4', sizeBytes: size, lieAboutSize: false });
    expect(api.uploadContentFile.mock.calls[0][1]).toBe('file:///cache/v.mp4');
    expect(r.getByText(/Arrived byte for byte: 20,97,15,200 bytes, video\/mp4/)).toBeTruthy();
  });

  it('the size lock: storage refuses the file (403) — PASSED; if storage accepted it — FAILED', async () => {
    api.uploadContentFile.mockRejectedValueOnce(Object.assign(new Error('UPLOAD_REJECTED'), { code: 'UPLOAD_REJECTED', status: 403 }));
    api.influencerApi.uploadProbeConfirm.mockResolvedValue({ success: true, data: { declared: {}, landed: null, match: false, deleted: true } });
    const r = render(<UploadProbeScreen navigation={nav} />);
    fireEvent.press(r.getByTestId('probe-pick'));
    await waitFor(() => r.getByTestId('probe-asset'));
    fireEvent.press(r.getByTestId('probe-lock'));
    await waitFor(() => r.getByTestId('probe-result-pass'));
    expect(api.influencerApi.uploadProbeUrl).toHaveBeenCalledWith(expect.objectContaining({ lieAboutSize: true }));

    api.uploadContentFile.mockResolvedValueOnce({ ok: true });
    fireEvent.press(r.getByTestId('probe-lock'));
    await waitFor(() => r.getByTestId('probe-result-fail'));
    expect(r.getByText(/ACCEPTED a file of the wrong size/)).toBeTruthy();
  });

  it('refuses a file that is not an MP4, JPG or PNG, or is over its limit, before anything is sent', async () => {
    picker.launchImageLibrary.mockResolvedValueOnce({ assets: [{ ...VIDEO, type: 'video/quicktime' }] });
    const r = render(<UploadProbeScreen navigation={nav} />);
    fireEvent.press(r.getByTestId('probe-pick'));
    await waitFor(() => r.getByText('Pick an MP4 video, or a JPG or PNG photo.'));
    picker.launchImageLibrary.mockResolvedValueOnce({ assets: [{ ...VIDEO, fileSize: 200 * 1024 * 1024 + 1 }] });
    fireEvent.press(r.getByTestId('probe-pick'));
    await waitFor(() => r.getByText(/over the limit/));
    expect(api.influencerApi.uploadProbeUrl).not.toHaveBeenCalled();
  });
});
