'use client';

/**
 * Creator Verification Queue
 *
 * Admin works through creator_profiles in `claimed` state — the user
 * signed up with an IG handle, the system linked them to a scraped
 * profile (or created a stub + fired a scrape), now admin calls them
 * and marks Verified or Rejected.
 *
 * Conflict clusters: when one user matched multiple scraped rows
 * (ig_handle hit one row, youtube_handle hit another), they all share
 * a `claim_user_id`. Cluster size > 1 means admin must pick which row
 * is the real one — verifying one auto-rejects the siblings.
 *
 * Backed by /v1/admin/creator-verifications/*.
 */

import { useEffect, useState, useCallback } from 'react';
import { adminApi, fmtNum } from '../../../../lib/api';

const STATUS_TABS = [
  { key: 'claimed',  label: 'Pending', icon: '⏳' },
  { key: 'verified', label: 'Verified', icon: '✅' },
  { key: 'rejected', label: 'Rejected', icon: '❌' },
];

export default function VerificationsPage() {
  const [tab, setTab] = useState('claimed');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await adminApi.listVerifications(tab);
    setLoading(false);
    if (res.success) {
      setRows(res.data?.verifications || []);
    } else {
      setError(res.error?.message || 'Failed to load verification queue');
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  // Group rows by claim_user_id so conflict clusters render together.
  const clusters = groupByClaimUser(rows);

  return (
    <div className="space-y-3 max-w-6xl mx-auto">
      <div className="bg-white rounded-xl border border-border p-4">
        <h1 className="font-display text-lg font-bold text-t1 mb-1">🔍 Creator Verifications</h1>
        <p className="text-xs text-t3">
          Influencers who signed up and claimed an IG handle. Call them, confirm identity, then verify or reject.
        </p>
      </div>

      {/* Tabs */}
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
          <div className="text-4xl mb-2">{tab === 'claimed' ? '🎉' : '—'}</div>
          <div className="text-sm font-semibold text-t1">
            {tab === 'claimed' ? 'Queue clear — no pending verifications' : `No ${tab} profiles`}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {clusters.map(cluster => (
            <ClusterCard
              key={cluster.key}
              cluster={cluster}
              onChange={load}
              readOnly={tab !== 'claimed'}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function groupByClaimUser(rows) {
  // Solo rows (no claim_user_id, e.g. a 'verified' row whose claim was cleared
  // historically) get their own cluster keyed by id.
  const map = new Map();
  for (const r of rows) {
    const key = r.claim_user_id || `solo:${r.id}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        claim_user_id: r.claim_user_id,
        claim_user_name: r.claim_user_name,
        claim_user_phone: r.claim_user_phone,
        influencer_row_id: r.influencer_row_id,
        influencer_ig: r.influencer_ig,
        influencer_yt: r.influencer_yt,
        rows: [],
      });
    }
    map.get(key).rows.push(r);
  }
  return Array.from(map.values());
}

function ClusterCard({ cluster, onChange, readOnly }) {
  const isConflict = cluster.rows.length > 1;
  return (
    <div className={`bg-white rounded-xl border overflow-hidden ${isConflict ? 'border-orange/40' : 'border-border'}`}>
      {/* Cluster header — claiming user info */}
      <div className={`px-3 py-2 ${isConflict ? 'bg-orange/10' : 'bg-surface2'} border-b border-border`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-xs text-t1">
              {cluster.claim_user_name || '—'}
            </span>
            {cluster.claim_user_phone && (
              <span className="text-[10px] text-t3 font-mono">{cluster.claim_user_phone}</span>
            )}
            {cluster.influencer_ig && (
              <span className="text-[10px] text-t3">
                signed up as <span className="font-semibold text-t2">@{cluster.influencer_ig}</span>
              </span>
            )}
            {cluster.influencer_yt && (
              <span className="text-[10px] text-t3">
                yt: <span className="font-semibold text-t2">{cluster.influencer_yt}</span>
              </span>
            )}
          </div>
          {isConflict && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange text-white whitespace-nowrap">
              ⚠ CONFLICT — {cluster.rows.length} candidates
            </span>
          )}
        </div>
        {isConflict && (
          <p className="mt-1 text-[10px] text-t3 leading-relaxed">
            This user matched multiple scraped profiles. Verifying one will auto-reject the others.
          </p>
        )}
      </div>

      {/* Rows */}
      <div className="divide-y divide-border">
        {cluster.rows.map(r => (
          <ProfileRow
            key={r.id}
            row={r}
            onChange={onChange}
            readOnly={readOnly}
          />
        ))}
      </div>
    </div>
  );
}

function ProfileRow({ row, onChange, readOnly }) {
  const [busy, setBusy] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [err, setErr] = useState(null);

  async function doVerify() {
    if (!confirm(`Verify @${row.ig_handle} as the correct profile for this user?`)) return;
    setBusy(true); setErr(null);
    const res = await adminApi.verifyCreator(row.id);
    setBusy(false);
    if (!res.success) { setErr(res.error?.message || 'Verify failed'); return; }
    onChange();
  }

  async function doReject() {
    if (!rejectReason.trim()) { setErr('Reason required'); return; }
    setBusy(true); setErr(null);
    const res = await adminApi.rejectCreator(row.id, rejectReason.trim());
    setBusy(false);
    if (!res.success) { setErr(res.error?.message || 'Reject failed'); return; }
    setShowReject(false);
    setRejectReason('');
    onChange();
  }

  async function doReset() {
    if (!confirm(`Reset @${row.ig_handle} back to unclaimed? Another user will be able to claim it.`)) return;
    setBusy(true); setErr(null);
    const res = await adminApi.resetCreator(row.id);
    setBusy(false);
    if (!res.success) { setErr(res.error?.message || 'Reset failed'); return; }
    onChange();
  }

  // Pending = no scrape data has landed yet (stub row from signup)
  const isPending = !row.followers_count && !row.full_name;

  return (
    <div className="p-3 flex items-start gap-3">
      {/* Avatar */}
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

      {/* Body */}
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
          <StatusPill status={row.verification_status} />
          {isPending && (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-gold-pale text-yellow-700">
              SCRAPE PENDING
            </span>
          )}
          {row.follower_tier && (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-gold/10 text-yellow-700 border border-gold/30">
              {row.follower_tier}
            </span>
          )}
        </div>

        <div className="text-[11px] text-t3 flex flex-wrap gap-x-3 gap-y-0.5">
          {row.followers_count > 0 && <span>{fmtNum(row.followers_count)} followers</span>}
          {row.youtube_handle && <span>YT: {row.youtube_handle}</span>}
          {row.bio_email && <span>✉ {row.bio_email}</span>}
          {row.bio_phone && <span>📞 {row.bio_phone}</span>}
          {row.claim_requested_at && (
            <span>requested {new Date(row.claim_requested_at).toLocaleString()}</span>
          )}
        </div>

        {row.rejection_reason && (
          <div className="mt-1 text-[11px] text-red bg-red/5 border border-red/20 rounded px-2 py-1">
            Rejected: {row.rejection_reason}
          </div>
        )}

        {err && (
          <div className="mt-1 text-[11px] text-red">{err}</div>
        )}

        {showReject && !readOnly && (
          <div className="mt-2 flex items-stretch gap-2">
            <input
              type="text"
              placeholder="Why rejecting? (visible to admins)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="flex-1 px-2 py-1 border border-border rounded text-xs"
              disabled={busy}
            />
            <button
              onClick={doReject}
              disabled={busy}
              className="px-3 py-1 rounded text-xs font-bold bg-red text-white disabled:opacity-50"
            >
              Confirm reject
            </button>
            <button
              onClick={() => { setShowReject(false); setRejectReason(''); setErr(null); }}
              disabled={busy}
              className="px-3 py-1 rounded text-xs font-bold bg-surface2 text-t3"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Actions */}
      {!readOnly && (
        <div className="flex gap-1 flex-shrink-0">
          {row.verification_status === 'claimed' && !showReject && (
            <>
              <button
                onClick={doVerify}
                disabled={busy}
                className="px-2.5 py-1 rounded text-[11px] font-bold bg-teal-deep text-white hover:bg-teal-deep/90 disabled:opacity-50"
              >
                ✓ Verify
              </button>
              <button
                onClick={() => setShowReject(true)}
                disabled={busy}
                className="px-2.5 py-1 rounded text-[11px] font-bold bg-surface2 text-t2 hover:bg-red/10 hover:text-red"
              >
                Reject
              </button>
            </>
          )}
        </div>
      )}
      {readOnly && row.verification_status === 'rejected' && (
        <button
          onClick={doReset}
          disabled={busy}
          className="px-2.5 py-1 rounded text-[11px] font-bold bg-surface2 text-t2 hover:bg-gold/15 hover:text-gold flex-shrink-0"
        >
          Reset → unclaimed
        </button>
      )}
    </div>
  );
}

function StatusPill({ status }) {
  const cfg = {
    claimed:   { c: 'bg-gold-pale text-yellow-700',     label: 'CLAIMED' },
    verified:  { c: 'bg-teal-pale text-teal-deep',      label: 'VERIFIED' },
    rejected:  { c: 'bg-red-pale text-red',             label: 'REJECTED' },
    unclaimed: { c: 'bg-surface2 text-t3',              label: 'UNCLAIMED' },
  };
  const s = cfg[status] || cfg.unclaimed;
  return <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${s.c}`}>{s.label}</span>;
}
