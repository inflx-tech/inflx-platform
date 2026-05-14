'use client';

/**
 * Campaign-driven creator invitations queue.
 *
 * When a brand picks an unverified creator (one only in our scraped pool,
 * not yet on Inflx) in the campaign wizard, a creator_invitations row is
 * created automatically. This page surfaces that queue so admin can run
 * cold outreach: "Brand X wants you for a campaign — please sign up."
 *
 * Status flow:
 *   pending   → just created by brand; admin hasn't contacted yet
 *   contacted → admin ran outreach (WhatsApp/SMS/call); waiting on signup
 *   converted → creator signed up + claimed → auto-converts to a real
 *               campaign_influencers row (handled in influencer.register)
 *   expired   → admin gave up
 *   declined  → creator signed up but rejected the offer
 *
 * Backed by /v1/admin/creator-invitations/*.
 */

import { useEffect, useState, useCallback } from 'react';
import { adminApi, fmtNum, fmtRupees } from '../../../../lib/api';

const STATUS_TABS = [
  { key: 'pending',   label: 'New',       icon: '🔔' },
  { key: 'contacted', label: 'Contacted', icon: '📞' },
  { key: 'converted', label: 'Converted', icon: '✅' },
  { key: 'expired',   label: 'Expired',   icon: '⌛' },
  { key: 'declined',  label: 'Declined',  icon: '❌' },
];

export default function InvitationsPage() {
  const [tab, setTab] = useState('pending');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await adminApi.listInvitations(tab);
    setLoading(false);
    if (res.success) {
      setRows(res.data?.invitations || []);
    } else {
      setError(res.error?.message || 'Failed to load invitations');
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-3 max-w-6xl mx-auto">
      <div className="bg-white rounded-xl border border-border p-4">
        <h1 className="font-display text-lg font-bold text-t1 mb-1">📨 Campaign Invitations</h1>
        <p className="text-xs text-t3">
          Brands selected these creators in campaigns, but they're not on Inflx yet. Run cold
          outreach — every signup here closes a high-intent funnel.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-border p-1.5 inline-flex gap-1">
        {STATUS_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === t.key
                ? 'bg-gold/15 text-gold'
                : 'text-t3 hover:bg-surface2'
            }`}
          >
            <span className="mr-1">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red/10 border border-red/30 rounded-xl p-3 text-xs text-red">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border border-border p-8 text-center text-t3 text-sm">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-8 text-center">
          <div className="text-4xl mb-2">{tab === 'pending' ? '🎉' : '—'}</div>
          <div className="text-sm font-semibold text-t1">
            {tab === 'pending' ? 'No new invitations' : `No ${tab} invitations`}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden divide-y divide-border">
          {rows.map(r => <InvitationRow key={r.id} row={r} onChange={load} tab={tab} />)}
        </div>
      )}
    </div>
  );
}

function InvitationRow({ row, onChange, tab }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function doContacted() {
    setBusy(true); setErr(null);
    const res = await adminApi.markInvitationContacted(row.id);
    setBusy(false);
    if (!res.success) { setErr(res.error?.message || 'Failed'); return; }
    onChange();
  }

  async function doExpire() {
    if (!confirm(`Mark invitation for @${row.ig_handle} as expired? Brand will see "we tried but couldn't reach them".`)) return;
    setBusy(true); setErr(null);
    const res = await adminApi.expireInvitation(row.id);
    setBusy(false);
    if (!res.success) { setErr(res.error?.message || 'Failed'); return; }
    onChange();
  }

  const waitingDays = row.invited_at
    ? Math.floor((Date.now() - new Date(row.invited_at).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="p-3 flex items-start gap-3">
      {row.profile_pic_url ? (
        <img
          src={row.profile_pic_url}
          alt=""
          className="w-10 h-10 rounded-full bg-surface2 object-cover flex-shrink-0"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-surface2 flex items-center justify-center text-[10px] font-bold text-t3 flex-shrink-0">
          {(row.ig_handle || '?').slice(0, 2).toUpperCase()}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <a
            href={`https://instagram.com/${row.ig_handle}`}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-sm text-t1 hover:text-orange"
          >
            @{row.ig_handle}
          </a>
          {row.full_name && <span className="text-xs text-t3">· {row.full_name}</span>}
          {row.follower_tier && (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-gold/10 text-yellow-700 border border-gold/30">
              {row.follower_tier}
            </span>
          )}
          {row.followers_count > 0 && (
            <span className="text-[10px] text-t3">{fmtNum(row.followers_count)} followers</span>
          )}
        </div>

        <div className="text-[11px] text-t3 mb-1">
          From <span className="font-semibold text-t1">{row.brand_name || '(unknown brand)'}</span>
          {row.proposed_fee && (
            <> · proposed fee <span className="font-semibold text-t1">{fmtRupees(row.proposed_fee)}</span></>
          )}
          {waitingDays != null && (
            <> · waiting {waitingDays}d</>
          )}
        </div>

        <div className="text-[11px] text-t3 flex flex-wrap gap-x-3 gap-y-0.5">
          {row.bio_email && <span>✉ <a href={`mailto:${row.bio_email}`} className="hover:text-orange">{row.bio_email}</a></span>}
          {row.bio_phone && <span>📞 <a href={`tel:${row.bio_phone}`} className="hover:text-orange">{row.bio_phone}</a></span>}
        </div>

        {row.brand_message && (
          <div className="mt-1.5 text-[11px] text-t2 bg-surface2 border border-border rounded px-2 py-1.5">
            <span className="font-bold text-t3 mr-1">Brand message:</span>{row.brand_message}
          </div>
        )}

        {row.contacted_at && (
          <div className="mt-1 text-[10px] text-t3">
            Contacted {new Date(row.contacted_at).toLocaleString()}
          </div>
        )}

        {err && <div className="mt-1 text-[11px] text-red">{err}</div>}
      </div>

      <div className="flex gap-1 flex-shrink-0">
        {tab === 'pending' && (
          <>
            <button
              onClick={doContacted}
              disabled={busy}
              className="px-2.5 py-1 rounded text-[11px] font-bold bg-teal-deep text-white hover:bg-teal-deep/90 disabled:opacity-50"
            >
              ✓ Mark contacted
            </button>
            <button
              onClick={doExpire}
              disabled={busy}
              className="px-2.5 py-1 rounded text-[11px] font-bold bg-surface2 text-t2 hover:bg-red/10 hover:text-red"
            >
              Expire
            </button>
          </>
        )}
        {tab === 'contacted' && (
          <button
            onClick={doExpire}
            disabled={busy}
            className="px-2.5 py-1 rounded text-[11px] font-bold bg-surface2 text-t2 hover:bg-red/10 hover:text-red"
          >
            Give up · Expire
          </button>
        )}
      </div>
    </div>
  );
}
