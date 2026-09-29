'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../../lib/api';

/**
 * Admin → Comment reports (follower-app-v2 · rules v1.7 §4.15).
 *
 * Shoppers can report any comment on an INFLX post. Each reported comment waits here, oldest
 * report first, until INFLX removes it (it disappears from the post) or keeps it (the reports
 * are closed and it stays). The creator's own hide and reply come with the post-performance board.
 *
 * Reads GET /admin/shopper/comments. Writes POST /admin/shopper/comments/:id/decide
 * { decision: 'removed' | 'kept' }. Capability: approvals.
 */

export default function CommentReportsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [toast, setToast] = useState('');
  function showToast(m) { setToast(m); setTimeout(() => setToast(''), 3000); }

  const load = useCallback(async () => {
    setLoading(true); setLoadError('');
    const res = await adminApi.listReportedComments();
    setLoading(false);
    if (res.success) setItems(res.data?.comments || []);
    else setLoadError(res.error?.message || 'Could not load the reports.');
  }, []);

  useEffect(() => { load(); }, [load]);

  async function decide(row, decision) {
    setBusyId(row.id);
    const res = await adminApi.decideComment(row.id, decision);
    setBusyId('');
    if (res.success) {
      showToast(decision === 'removed' ? 'Comment removed from the post.' : 'Comment kept. The reports are closed.');
      load();
    } else {
      showToast(res.error?.message || 'Could not save that.');
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="font-display text-xl font-bold text-t1">Comment reports</h1>
          <p className="text-xs text-t3 mt-0.5">
            Comments shoppers reported on INFLX posts. Remove what breaks the rules; keep the rest.
          </p>
        </div>
        {!loading && !loadError && (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-gold-pale text-yellow-700 whitespace-nowrap">
            {items.length === 0 ? 'nothing waiting' : items.length === 1 ? '1 waiting' : `${items.length} waiting`}
          </span>
        )}
      </div>

      {loadError && <div className="p-4 bg-red-pale rounded-xl text-red text-sm mb-4">{loadError}</div>}

      {loading ? (
        <div className="bg-white rounded-xl border border-border p-12 text-center text-sm text-t3">Loading…</div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="bg-surface2 text-[10px] font-bold uppercase tracking-wider text-t3">
                  <th className="text-left px-5 py-2.5 w-[42%]">Comment</th>
                  <th className="text-left px-3 py-2.5 w-[26%]">On the post</th>
                  <th className="text-left px-3 py-2.5">Decision</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const busy = busyId === row.id;
                  return (
                    <tr key={row.id} className="border-t border-border align-top">
                      <td className="px-5 py-3">
                        <div className="text-sm text-t1 whitespace-pre-wrap break-words">{row.body}</div>
                        <div className="text-[11px] text-t3 mt-1">
                          by {row.author} · reported {row.reports === 1 ? 'once' : `${row.reports} times`} · first {row.ago === 'now' ? 'just now' : /^\d/.test(row.ago) ? `${row.ago} ago` : `on ${row.ago}`}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-t2">
                        <div className="font-bold text-t1">{row.creator}</div>
                        <div>{row.brand}</div>
                        {row.post_code && <div className="text-t3 mt-0.5">Code {row.post_code}</div>}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button onClick={() => decide(row, 'removed')} disabled={busy}
                            className="px-3 py-1.5 bg-red text-white text-xs font-bold rounded-lg hover:opacity-90 disabled:opacity-40 whitespace-nowrap">
                            {busy ? 'Saving…' : 'Remove'}
                          </button>
                          <button onClick={() => decide(row, 'kept')} disabled={busy}
                            className="px-3 py-1.5 bg-white border border-navy/30 text-navy text-xs font-bold rounded-lg hover:bg-navy-pale disabled:opacity-40 whitespace-nowrap">
                            Keep
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr className="border-t border-border">
                    <td colSpan={3} className="px-5 py-10 text-center text-sm text-t3">No reported comments.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-t1 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-xl z-50">{toast}</div>
      )}
    </div>
  );
}
