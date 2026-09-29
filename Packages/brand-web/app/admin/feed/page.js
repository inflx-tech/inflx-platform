'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { adminApi } from '../../../lib/api';

/**
 * Admin → Feed (follower-app-v2 · rules v1.7 §5.12, §5.14).
 *
 * The shopper app's Home and Play are ordered by the rules feed (Stage A) until INFLX switches on
 * the feed that learns (Stage B). This page is how that decision gets made:
 *   · the readiness panel — how much real shopper behaviour has been recorded;
 *   · the preview — for one shopper, "feed today" beside "feed if learning were on".
 * The switch itself and the four dials live on Platform settings, with every other number.
 *
 * Reads GET /admin/shopper/feed/readiness and GET /admin/shopper/feed/preview?phone=.
 * Capability: settings.
 */

function Column({ title, rows }) {
  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-2.5 bg-surface2 text-[10px] font-bold uppercase tracking-wider text-t3">{title}</div>
      {rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-t3">No live posts for this shopper yet.</div>
      ) : (
        <ol>
          {rows.map((r) => (
            <li key={`${title}-${r.id}`} className="px-4 py-2 border-t border-border first:border-t-0 flex items-baseline gap-3">
              <span className="text-xs font-bold text-t3 w-6 text-right">{r.position}</span>
              <span className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-t1 break-words">{r.title}</span>
                <span className="block text-[11px] text-t3">
                  {r.creator} · {r.brand}{r.again ? ' · seen before' : ''}{r.score != null ? ` · score ${r.score}` : ''}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function FeedPage() {
  const [ready, setReady] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [phone, setPhone] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [previewError, setPreviewError] = useState('');

  const load = useCallback(async () => {
    setLoadError('');
    const res = await adminApi.feedReadiness();
    if (res.success) setReady(res.data);
    else setLoadError(res.error?.message || 'Could not load the readiness numbers.');
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runPreview(e) {
    e.preventDefault();
    if (!phone.trim()) { setPreviewError("Enter a shopper's phone number."); return; }
    setBusy(true); setPreviewError(''); setPreview(null);
    const res = await adminApi.feedPreview(phone.trim());
    setBusy(false);
    if (!res.success) { setPreviewError(res.error?.message || 'Could not build the preview.'); return; }
    if (!res.data?.found) { setPreviewError('No shopper has that number.'); return; }
    setPreview(res.data);
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-4">
        <h1 className="font-display text-xl font-bold text-t1">Feed</h1>
        <p className="text-xs text-t3 mt-0.5">
          How the shopper app orders Home and Play. The switch and the four dials are on{' '}
          <Link href="/admin/settings/platform" className="text-navy font-semibold hover:underline">Platform settings</Link>.
        </p>
      </div>

      {loadError && <div className="p-4 bg-red-pale rounded-xl text-red text-sm mb-4">{loadError}</div>}

      <div className="bg-white rounded-xl border border-border p-5 mb-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="font-display text-base font-bold text-t1">Readiness for the feed that learns</div>
          {ready && (
            <span className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${ready.learning_on ? 'bg-green-pale text-green' : 'bg-surface2 text-t2'}`}>
              {ready.learning_on ? 'Learning is ON' : 'Learning is off · the rules feed is running'}
            </span>
          )}
        </div>
        {!ready && !loadError && <div className="text-sm text-t3 mt-3">Loading…</div>}
        {ready && (
          <>
            <div className="text-sm text-t1 mt-3">{ready.line}</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              {[
                ['Shoppers with 20+ actions', ready.shoppers_20_actions],
                ['Shoppers active, 30 days', ready.active_shoppers_30d],
                ['Actions recorded', ready.actions],
                ['Days of data', ready.days_of_data],
              ].map(([label, n]) => (
                <div key={label} className="rounded-lg bg-surface2 px-3 py-2.5">
                  <div className="text-lg font-bold text-t1">{Number(n || 0).toLocaleString('en-IN')}</div>
                  <div className="text-[11px] text-t3">{label}</div>
                </div>
              ))}
            </div>
            <div className="text-[11px] text-t3 mt-3">{ready.guide}</div>
          </>
        )}
      </div>

      <div className="bg-white rounded-xl border border-border p-5 mb-5">
        <div className="font-display text-base font-bold text-t1">Preview for one shopper</div>
        <p className="text-xs text-t3 mt-0.5">See what she gets today beside what she would get with learning on. Nothing changes for her.</p>
        <form onSubmit={runPreview} className="flex items-center gap-2 mt-3 flex-wrap">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Shopper's phone number"
            className="border border-border rounded-lg px-3 py-2 text-sm w-64 max-w-full" />
          <button type="submit" disabled={busy} className="px-4 py-2 bg-navy text-white text-sm font-bold rounded-lg hover:opacity-90 disabled:opacity-40">
            {busy ? 'Building…' : 'Show preview'}
          </button>
        </form>
        {previewError && <div className="mt-3 bg-red-pale border border-red/20 text-red text-xs rounded-lg px-3 py-2">{previewError}</div>}
      </div>

      {preview && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Column title="Feed today (rules)" rows={preview.today} />
          <Column title="Feed if learning were on" rows={preview.learning} />
        </div>
      )}
    </div>
  );
}
