'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { brandInboxApi, applicationApi, contractApi, fmtRupees } from '../../../lib/api';

const TABS = [
  { key: 'applications', label: 'Applications',     desc: 'Open-group applicants waiting on your approve / reject' },
  { key: 'negotiations', label: 'Negotiations',     desc: 'Counter-offers waiting for your response' },
  { key: 'reviews',      label: 'Content reviews',  desc: 'Submitted deliverables to approve / revise' },
  { key: 'signatures',   label: 'Contract signs',   desc: 'Contracts the influencer signed; needs you to countersign' },
  { key: 'failures',     label: 'Failures',         desc: 'Contracts/PDFs that failed to generate; retry them' },
];

function fmtDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function ApplicationsTab() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({});

  function load() {
    setLoading(true);
    brandInboxApi.applications().then(r => {
      setLoading(false);
      if (r.success) setRows(r.data?.applications || []);
    });
  }
  useEffect(() => { load(); }, []);

  async function act(a, action) {
    if (action === 'reject' && !confirm(`Reject @${a.instagram_handle}? They'll be notified.`)) return;
    setBusy(p => ({ ...p, [a.campaign_influencer_id]: action }));
    const fn = action === 'approve' ? applicationApi.approve : applicationApi.reject;
    const res = await fn(a.campaign_id, a.campaign_influencer_id);
    setBusy(p => { const n = { ...p }; delete n[a.campaign_influencer_id]; return n; });
    if (!res.success) {
      alert(res.error?.message || `Could not ${action} application.`);
      return;
    }
    if (action === 'approve' && res.data?.slots_filled) {
      alert(`Approved. Slots now full — ${res.data.closed_out_count || 0} other applicant(s) were notified.`);
    }
    load();
  }

  if (loading) return <div className="text-sm text-gray-400 p-8 text-center">Loading…</div>;
  if (rows.length === 0) return <div className="text-sm text-gray-400 p-8 text-center">No applications waiting on you.</div>;
  return (
    <div className="space-y-2">
      {rows.map(a => {
        const isBusy = !!busy[a.campaign_influencer_id];
        return (
          <div key={a.campaign_influencer_id} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-sm font-bold text-gray-900">@{a.instagram_handle || '—'}</span>
                  {a.tier && <span className="text-[10px] font-bold uppercase text-navy bg-surface2 px-2 py-0.5 rounded">{a.tier}</span>}
                  <span className="text-xs text-gray-400">·</span>
                  <span className="text-xs text-gray-500 truncate">{a.campaign_name} · {a.set_name}</span>
                </div>
                <div className="text-xs text-gray-500">
                  {a.influencer_name ? `${a.influencer_name} · ` : ''}
                  {a.followers_count != null ? `${Number(a.followers_count).toLocaleString('en-IN')} followers` : ''}
                  {a.engagement_rate != null ? ` · ${parseFloat(a.engagement_rate).toFixed(1)}% ER` : ''}
                  {a.city ? ` · ${a.city}` : ''}
                </div>
                {Array.isArray(a.niche) && a.niche.length > 0 && (
                  <div className="text-[11px] text-gray-500 mt-0.5">Niche: {a.niche.join(', ')}</div>
                )}
              </div>
              <Link
                href={`/dashboard/influencers/${a.influencer_profile_id}`}
                className="text-xs font-bold text-navy whitespace-nowrap"
              >
                View profile →
              </Link>
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => act(a, 'reject')}
                disabled={isBusy}
                className="flex-1 text-xs font-bold text-red-600 border border-red-300 bg-red-50 rounded-lg py-2 disabled:opacity-40"
              >
                {isBusy === 'reject' ? 'Rejecting…' : 'Reject'}
              </button>
              <button
                onClick={() => act(a, 'approve')}
                disabled={isBusy}
                className="flex-1 text-xs font-bold text-white bg-navy rounded-lg py-2 disabled:opacity-40"
              >
                {isBusy === 'approve' ? 'Approving…' : 'Approve'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NegotiationsTab() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    brandInboxApi.negotiations('awaiting_brand').then(r => {
      setLoading(false);
      if (r.success) setRows(r.data?.negotiations || []);
    });
  }, []);
  if (loading) return <div className="text-sm text-gray-400 p-8 text-center">Loading…</div>;
  if (rows.length === 0) return <div className="text-sm text-gray-400 p-8 text-center">Nothing waiting on you here.</div>;
  return (
    <div className="space-y-2">
      {rows.map(n => (
        <div key={n.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between hover:border-orange-300 cursor-pointer"
             onClick={() => router.push(`/dashboard/campaigns/${n.campaign_id}`)}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-bold text-gray-900 truncate">@{n.influencer_handle}</span>
              <span className="text-xs text-gray-400">·</span>
              <span className="text-xs text-gray-500 truncate">{n.campaign_name}</span>
            </div>
            <div className="text-xs text-gray-500">
              Last counter: {n.last_proposed_fee != null ? fmtRupees(n.last_proposed_fee) : '—'}
              <span className="mx-2">·</span>
              {fmtDate(n.created_at)}
              {n.expires_at && <span className="ml-2 text-orange-600">expires {fmtDate(n.expires_at)}</span>}
            </div>
          </div>
          <span className="text-orange-600 font-bold text-xl ml-3">›</span>
        </div>
      ))}
    </div>
  );
}

function ReviewsTab() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    brandInboxApi.deliverables('submitted').then(r => {
      setLoading(false);
      if (r.success) setRows(r.data?.deliverables || []);
    });
  }, []);
  if (loading) return <div className="text-sm text-gray-400 p-8 text-center">Loading…</div>;
  if (rows.length === 0) return <div className="text-sm text-gray-400 p-8 text-center">No content awaiting review.</div>;
  return (
    <div className="space-y-2">
      {rows.map(d => (
        <div key={d.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between hover:border-orange-300 cursor-pointer"
             onClick={() => router.push(`/dashboard/campaigns/${d.campaign_id}?tab=content&deliverable=${d.id}`)}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-bold text-gray-900">@{d.influencer_handle}</span>
              <span className="text-xs text-gray-400">·</span>
              <span className="text-xs text-gray-500 capitalize">{d.type?.replace(/_/g, ' ')}</span>
              {d.revision_count > 0 && (
                <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">REV {d.revision_count}</span>
              )}
            </div>
            <div className="text-xs text-gray-500 truncate">
              {d.campaign_name}
              <span className="mx-2">·</span>
              submitted {fmtDate(d.submitted_at)}
            </div>
          </div>
          <span className="text-orange-600 font-bold text-xl ml-3">›</span>
        </div>
      ))}
    </div>
  );
}

function SignaturesTab() {
  // No dedicated endpoint yet — derive from contracts list per-campaign would be heavy.
  // Instead show inbox-summary count + link to campaigns list. Cheap placeholder.
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-500">
      Contracts requiring your signature appear inside each campaign's hierarchy.
      Open the campaign and click the influencer row marked <b>pending_brand</b> to sign.
    </div>
  );
}

function FailuresTab() {
  const [rows, setRows] = useState({ contracts_failed: 0, pdf_failed: 0 });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    brandInboxApi.summary().then(r => {
      setLoading(false);
      if (r.success) setRows(r.data?.summary || rows);
    });
  }, []);
  if (loading) return <div className="text-sm text-gray-400 p-8 text-center">Loading…</div>;
  return (
    <div className="space-y-3">
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="text-sm font-bold text-gray-900 mb-1">Contracts that failed to auto-create: {rows.contracts_failed}</div>
        <div className="text-xs text-gray-500">
          Open the affected campaign and click the influencer row — you'll see a <b>Retry contract</b> button when this happens.
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="text-sm font-bold text-gray-900 mb-1">Contracts whose PDF failed to generate: {rows.pdf_failed}</div>
        <div className="text-xs text-gray-500">
          Open the contract modal and click <b>Regenerate</b>. The error is shown beneath the PDF preview.
        </div>
      </div>
    </div>
  );
}

function InboxPageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = TABS.find(t => t.key === params.get('tab')) || TABS[0];

  const Body = {
    applications: ApplicationsTab,
    negotiations: NegotiationsTab,
    reviews:      ReviewsTab,
    signatures:   SignaturesTab,
    failures:     FailuresTab,
  }[tab.key];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-5">
        <h1 className="font-display text-xl font-bold text-gray-900">Inbox</h1>
        <p className="text-xs text-gray-400 mt-0.5">Items waiting on your action</p>
      </div>

      <div className="flex gap-2 mb-5 border-b border-gray-200 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key}
            onClick={() => router.push(`/dashboard/inbox?tab=${t.key}`)}
            className={`px-4 py-2.5 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${
              tab.key === t.key
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-400 mb-4">{tab.desc}</p>

      <Body />
    </div>
  );
}

export default function InboxPage() {
  return (
    <Suspense fallback={<div className="text-sm text-gray-400 p-8 text-center">Loading…</div>}>
      <InboxPageInner />
    </Suspense>
  );
}
