'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { campaignApi, brandApi, contractApi, fmtRupees } from '../../../lib/api';
import { contractLockAmount } from '../../../lib/contracts';
import { QuotaWallModal, useQuotaWall } from '../../../components/QuotaWallModal';

// ─── Status pill config (locked palette) ────────────────────────────────────

const STATUS_CFG = {
  draft:          { bg: 'bg-[#F4F4F5]',  text: 'text-[#52525B]',  dot: 'bg-[#A1A1AA]',  label: 'Draft' },
  pending_wallet: { bg: 'bg-[#FFF7CC]',  text: 'text-[#6B5A00]',  dot: 'bg-[#E0A800]',  label: 'Pending wallet' },
  published:      { bg: 'bg-[#FFF7CC]',  text: 'text-[#6B5A00]',  dot: 'bg-[#E0A800]',  label: 'Published' },
  active:         { bg: 'bg-[#D1FAE5]',  text: 'text-[#047857]',  dot: 'bg-[#10B981]',  label: 'Active' },
  live:           { bg: 'bg-[#D1FAE5]',  text: 'text-[#047857]',  dot: 'bg-[#10B981]',  label: 'Live' },
  completed:      { bg: 'bg-[#F4F4F5]',  text: 'text-[#1F1F22]',  dot: 'bg-[#71717A]',  label: 'Completed' },
  cancelled:      { bg: 'bg-[#FDEEE9]',  text: 'text-[#B91C1C]',  dot: 'bg-[#E8401A]',  label: 'Cancelled' },
};

const ALL_STATUSES = ['draft', 'pending_wallet', 'published', 'active', 'live', 'completed', 'cancelled'];

const SORT_OPTIONS = [
  { value: 'newest',     label: 'Newest first' },
  { value: 'oldest',     label: 'Oldest first' },
  { value: 'budget_desc', label: 'Budget: High to Low' },
  { value: 'name_asc',   label: 'Name: A to Z' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.3px] whitespace-nowrap flex-shrink-0 ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function generateCSV(campaigns) {
  // Note: spent_budget + influencer_count columns intentionally retained
  // in the CSV header for backward-compat with any external workflow that
  // ingests these files — values will be 0 since backend doesn't populate.
  // If/when a backend-enrichment contract lands, the CSV picks up real values
  // automatically without code change here.
  const headers = ['Name', 'Status', 'Total Budget', 'Spent Budget', 'Influencers', 'Start Date', 'End Date', 'Created At'];
  const rows = campaigns.map(c => [
    `"${(c.name || '').replace(/"/g, '""')}"`,
    c.status,
    c.total_budget || 0,
    c.spent_budget || 0,
    c.influencer_count || 0,
    c.start_date ? new Date(c.start_date).toLocaleDateString('en-IN') : '',
    c.end_date ? new Date(c.end_date).toLocaleDateString('en-IN') : '',
    c.created_at ? new Date(c.created_at).toLocaleDateString('en-IN') : '',
  ]);
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

function downloadCSV(csvContent, filename) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── Confirmation Modal ─────────────────────────────────────────────────────

function ConfirmModal({ open, title, message, confirmLabel, tone, onConfirm, onCancel, loading }) {
  if (!open) return null;
  const confirmClass = tone === 'danger'
    ? 'bg-[#E8401A] hover:bg-[#B91C1C] text-white'
    : 'bg-[#FFC107] hover:bg-[#E0A800] text-[#0A0A0A]';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm" onClick={onCancel}>
      <div className="bg-white rounded-[18px] shadow-2xl max-w-md w-full mx-4 p-6 font-body" onClick={e => e.stopPropagation()}>
        <h3 className="font-display text-[17px] font-bold text-[#0A0A0A] mb-2 -tracking-[0.2px]">{title}</h3>
        <p className="text-[13px] text-[#52525B] mb-6 leading-relaxed">{message}</p>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-[13px] font-semibold text-[#52525B] hover:text-[#0A0A0A] rounded-[10px] hover:bg-[#F4F4F5] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-[13px] font-display font-bold rounded-[10px] transition-colors disabled:opacity-50 ${confirmClass}`}
          >
            {loading ? 'Processing…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Campaign Card (simplified — no phantom fields) ─────────────────────────

function CampaignCard({ campaign, selected, onToggleSelect }) {
  const router = useRouter();
  const isDraft = campaign.status === 'draft';
  const budget = campaign.total_budget || 0;

  const goToDetail = () => {
    if (isDraft) router.push(`/dashboard/campaigns/new?id=${campaign.id}`);
    else router.push(`/dashboard/campaigns/${campaign.id}`);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={goToDetail}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToDetail(); } }}
      className={`bg-white rounded-[16px] border p-4 transition-all flex flex-col gap-3 cursor-pointer ${
        selected
          ? 'border-[#0A0A0A] shadow-[0_0_0_2px_rgba(10,10,10,0.08)]'
          : 'border-[#E4E4E7] hover:border-[#D4D4D8] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-16px_rgba(0,0,0,0.08)]'
      }`}
    >
      {/* Head: checkbox + title/dates + status badge */}
      <div className="flex items-start gap-2.5">
        <label
          className="flex items-center mt-0.5 cursor-pointer"
          onClick={e => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(campaign.id)}
            onClick={e => e.stopPropagation()}
            className="w-4 h-4 rounded cursor-pointer"
            style={{ accentColor: '#0A0A0A' }}
          />
        </label>
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-[#0A0A0A] text-[14.5px] truncate -tracking-[0.2px]">{campaign.name}</div>
          <div className="text-[10.5px] text-[#71717A] font-mono mt-0.5 tracking-[0.2px]">
            {campaign.start_date
              ? new Date(campaign.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
              : <span className="text-[#A1A1AA]">— no dates set —</span>}
            {campaign.end_date && <>
              <span className="text-[#D4D4D8] mx-1.5">→</span>
              {new Date(campaign.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </>}
          </div>
        </div>
        <StatusBadge status={campaign.status} />
      </div>

      {/* Budget (only real backend-backed amount) */}
      <div className="flex items-baseline gap-2 pt-2 border-t border-[#E4E4E7]">
        <span className="font-body font-semibold text-[10.5px] text-[#71717A] uppercase tracking-[0.4px]">Budget</span>
        <span className={`ml-auto font-mono font-bold text-[16px] -tracking-[0.3px] ${budget > 0 ? 'text-[#0A0A0A]' : 'text-[#A1A1AA]'}`}>
          {budget > 0 ? fmtRupees(budget) : '—'}
        </span>
      </div>

      {/* Footer CTA */}
      <div className="flex items-center justify-between pt-2 border-t border-[#E4E4E7]">
        <span className={`font-body text-[11.5px] ${isDraft ? 'text-[#E0A800] font-bold' : 'text-[#52525B] font-semibold'}`}>
          {isDraft ? 'Continue draft' : 'View details'}
        </span>
        <span className="font-mono font-bold text-[#0A0A0A]">→</span>
      </div>
    </div>
  );
}

// ─── Summary Stats ──────────────────────────────────────────────────────────

function SummaryStats({ campaigns }) {
  const counts = useMemo(() => {
    const c = { total: campaigns.length, draft: 0, active: 0, live: 0, completed: 0, cancelled: 0, published: 0, pending_wallet: 0 };
    campaigns.forEach(camp => { if (c[camp.status] !== undefined) c[camp.status]++; });
    return c;
  }, [campaigns]);

  const totalBudget = useMemo(() => campaigns.reduce((sum, c) => sum + (Number(c.total_budget) || 0), 0), [campaigns]);

  const tiles = [
    { label: 'Total',        value: counts.total,                  sub: 'All campaigns',          valueClass: 'text-[#0A0A0A]' },
    { label: 'Draft',        value: counts.draft,                  sub: 'Not yet published',      valueClass: 'text-[#52525B]' },
    { label: 'Active',       value: counts.active + counts.live,   sub: 'Currently live',         valueClass: 'text-[#047857]' },
    { label: 'Completed',    value: counts.completed,              sub: 'Wrapped up',             valueClass: 'text-[#1F1F22]' },
    { label: 'Total budget', value: fmtRupees(totalBudget),        sub: 'Across all campaigns',   valueClass: 'text-[#0A0A0A] text-[18px]', isAmount: true },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
      {tiles.map(t => (
        <div key={t.label} className="bg-white rounded-[14px] border border-[#E4E4E7] px-4 py-3.5">
          <div className="font-body font-semibold text-[10.5px] text-[#71717A] uppercase tracking-[0.4px] mb-1">{t.label}</div>
          <div className={`font-mono font-bold leading-tight ${t.isAmount ? 'text-[18px]' : 'text-[22px]'} ${t.valueClass}`}>{t.value}</div>
          <div className="font-body text-[10.5px] text-[#71717A] mt-1">{t.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Bulk Action Bar (ink chrome) ───────────────────────────────────────────

function BulkActionBar({ selectedIds, campaigns, onCancelSelected, onDeleteSelected, onExportSelected, onClearSelection }) {
  const selectedCampaigns = campaigns.filter(c => selectedIds.has(c.id));
  const cancellableCount = selectedCampaigns.filter(c => ['draft', 'published'].includes(c.status)).length;
  const deletableCount = selectedCampaigns.filter(c => c.status === 'draft').length;

  return (
    <div className="bg-[#0A0A0A] text-white rounded-[14px] px-4 py-3 mb-4 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3">
        <span className="font-display text-[13px] font-bold">{selectedIds.size} campaign{selectedIds.size !== 1 ? 's' : ''} selected</span>
        <button onClick={onClearSelection} className="text-[11.5px] text-[#A1A1AA] hover:text-white underline transition-colors">
          Clear
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onExportSelected}
          className="px-3 py-1.5 text-[11.5px] font-display font-bold bg-white/10 hover:bg-white/20 rounded-[8px] transition-colors"
        >
          Export CSV
        </button>
        {cancellableCount > 0 && (
          <button
            onClick={onCancelSelected}
            className="px-3 py-1.5 text-[11.5px] font-display font-bold bg-[#FFC107] hover:bg-[#E0A800] text-[#0A0A0A] rounded-[8px] transition-colors"
          >
            Cancel ({cancellableCount})
          </button>
        )}
        {deletableCount > 0 && (
          <button
            onClick={onDeleteSelected}
            className="px-3 py-1.5 text-[11.5px] font-display font-bold bg-[#E8401A] hover:bg-[#B91C1C] text-white rounded-[8px] transition-colors"
          >
            Delete ({deletableCount})
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Filter / Sort / Search Bar ─────────────────────────────────────────────

function FilterBar({ search, onSearchChange, statusFilter, onStatusFilterChange, sort, onSortChange, campaigns }) {
  // Per-status counts for the chip badges
  const statusCounts = useMemo(() => {
    const c = { all: campaigns.length };
    ALL_STATUSES.forEach(s => { c[s] = 0; });
    campaigns.forEach(camp => { if (c[camp.status] !== undefined) c[camp.status]++; });
    return c;
  }, [campaigns]);

  return (
    <div className="bg-white border border-[#E4E4E7] rounded-[14px] p-3 mb-5 flex flex-col lg:flex-row gap-3 lg:items-center">

      {/* Search */}
      <div className="relative flex-shrink-0" style={{ minWidth: '220px', maxWidth: '380px', flex: '1 1 280px' }}>
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#71717A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search campaigns…"
          className="w-full pl-9 pr-3 py-2.5 text-[13.5px] font-body text-[#0A0A0A] bg-[#FAFAFA] border border-[#E4E4E7] rounded-[10px] outline-none transition-all focus:border-[#FFC107] focus:bg-white focus:shadow-[0_0_0_3px_rgba(255,193,7,0.18)]"
        />
      </div>

      {/* Status chips */}
      <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
        <StatusChip label="All" count={statusCounts.all} active={statusFilter === 'all'} onClick={() => onStatusFilterChange('all')} />
        {ALL_STATUSES.map(s => (
          <StatusChip
            key={s}
            label={STATUS_CFG[s]?.label || s}
            count={statusCounts[s]}
            active={statusFilter === s}
            onClick={() => onStatusFilterChange(s)}
          />
        ))}
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <label className="font-body text-[11.5px] text-[#71717A] font-medium">Sort:</label>
        <select
          value={sort}
          onChange={e => onSortChange(e.target.value)}
          className="font-body text-[12.5px] font-semibold text-[#0A0A0A] px-3 pr-8 py-2 border border-[#E4E4E7] rounded-[10px] bg-white cursor-pointer focus:outline-none focus:border-[#FFC107] focus:shadow-[0_0_0_3px_rgba(255,193,7,0.18)] appearance-none bg-no-repeat"
          style={{
            backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717A' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>")`,
            backgroundPosition: 'right 10px center',
          }}
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function StatusChip({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px] font-body font-semibold transition-all whitespace-nowrap ${
        active
          ? 'bg-[#0A0A0A] text-white border border-[#0A0A0A]'
          : 'bg-[#F4F4F5] text-[#52525B] border border-[#E4E4E7] hover:border-[#0A0A0A] hover:text-[#0A0A0A]'
      }`}
    >
      {label}
      <span className={`font-mono font-bold text-[10.5px] ${active ? 'opacity-90' : 'opacity-65'}`}>{count}</span>
    </button>
  );
}

// ─── Contract signature strip (folded from the old /dashboard/contracts page) ─
// Uses the SAME data source (contractApi.listPending → /contracts/brand/pending)
// and the SAME bulk-sign action. Each row links to its campaign detail, whose
// Contracts tab shows the full per-creator breakdown.

// contractLockAmount now imported from lib/contracts (A3 — single source of the
// wallet-lock formula; was duplicated in the hub + influencers modal).

function ContractSignatureStrip() {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [signing, setSigning]     = useState(false);
  const [error, setError]         = useState('');

  const load = useCallback(() => {
    setLoading(true);
    contractApi.listPending().then(res => {
      setLoading(false);
      if (res.success) setContracts(res.data?.contracts || []);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalLock = useMemo(
    () => contracts.reduce((sum, c) => sum + contractLockAmount(c), 0),
    [contracts]
  );

  async function signAll() {
    const ids = contracts.map(c => c.id);
    if (ids.length === 0) return;
    if (!confirm(`Counter-sign ${ids.length} contract${ids.length !== 1 ? 's' : ''} for a total wallet lock of ${fmtRupees(totalLock)}?`)) return;
    setSigning(true);
    setError('');
    const res = await contractApi.bulkSign(ids);
    setSigning(false);
    if (!res.success) { setError(res.error?.message || 'Bulk sign failed'); return; }
    load();
  }

  if (loading || contracts.length === 0) return null;

  return (
    <div className="bg-[#0A0A0A] text-white rounded-[14px] px-5 py-4 mb-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-[#FFC107] text-[#0A0A0A] inline-flex items-center justify-center font-display font-extrabold text-[15px]">≡</span>
          <div>
            <div className="font-display font-bold text-[14px]">
              <span className="font-mono text-[#FFC107]">{contracts.length}</span> contract{contracts.length !== 1 ? 's' : ''} need your signature
            </div>
            <div className="text-[11.5px] text-[#A1A1AA] mt-0.5">
              Influencers have signed — counter-sign to lock funds and start. Total lock <span className="font-mono font-semibold text-white">{fmtRupees(totalLock)}</span>
            </div>
          </div>
        </div>
        <button
          onClick={signAll}
          disabled={signing}
          className="px-4 py-2 text-[12px] font-display font-bold bg-[#FFC107] hover:bg-[#E0A800] text-[#0A0A0A] rounded-[10px] transition-colors disabled:opacity-50"
        >
          {signing ? 'Signing…' : `Sign all (${contracts.length})`}
        </button>
      </div>

      {error && <div className="mt-3 text-[11.5px] text-[#FCA5A5] font-semibold">{error}</div>}

      <div className="mt-3 pt-3 border-t border-white/10 flex flex-col gap-1.5">
        {contracts.map(c => (
          <Link
            key={c.id}
            href={`/dashboard/campaigns/${c.campaign_id}?tab=contracts`}
            className="flex items-center justify-between gap-3 rounded-[8px] px-2.5 py-1.5 hover:bg-white/5 transition-colors no-underline"
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className="font-mono font-bold text-[12.5px] text-white">@{c.instagram_handle || '—'}</span>
              <span className="text-[#71717A]">·</span>
              <span className="text-[11.5px] text-[#A1A1AA] truncate">{c.campaign_name}</span>
            </span>
            <span className="flex items-center gap-3 flex-shrink-0">
              <span className="font-mono font-bold text-[12px] text-[#FFC107]">{fmtRupees(contractLockAmount(c))}</span>
              <span className="font-mono font-bold text-white">→</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  // Selection
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState('newest');

  // Modal state
  const [modal, setModal] = useState({ open: false, type: null });
  const [bulkLoading, setBulkLoading] = useState(false);

  // Phase A12.1.5 — preflight quota on "+ New campaign" entry click so the
  // upgrade popup fires BEFORE the brand fills out the campaign form.
  const { quota, show: showQuota, close: closeQuota } = useQuotaWall();
  const [preflighting, setPreflighting] = useState(false);
  async function goCreate() {
    if (preflighting) return;
    setPreflighting(true);
    try {
      const pf = await brandApi.quotaPreflight('createCampaign');
      if (pf?.success !== false && pf?.data?.would_block) {
        showQuota({
          action:       pf.data.action,
          used:         pf.data.used,
          limit:        pf.data.limit,
          current_tier: pf.data.current_tier,
          upgrade_to:   pf.data.upgrade_to || [],
          message:      `You've used ${pf.data.used} of ${pf.data.limit} active campaigns on the ${pf.data.current_tier?.toUpperCase()} plan. Upgrade to create more.`,
        });
        return;
      }
      router.push('/dashboard/campaigns/new');
    } catch (e) {
      // On any preflight error, fail-open: navigate to the form so the
      // brand isn't blocked by transient API hiccups; the form submit
      // will still hit the real gate.
      router.push('/dashboard/campaigns/new');
    } finally {
      setPreflighting(false);
    }
  }

  // Fetch campaigns
  const fetchCampaigns = useCallback(() => {
    setLoading(true);
    campaignApi.list().then(res => {
      setLoading(false);
      if (res.success) setCampaigns(res.data?.campaigns || res.data || []);
    });
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  // Filtered + sorted campaigns
  const filtered = useMemo(() => {
    let result = [...campaigns];

    if (statusFilter !== 'all') {
      result = result.filter(c => c.status === statusFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(c => (c.name || '').toLowerCase().includes(q));
    }

    result.sort((a, b) => {
      switch (sort) {
        case 'oldest':      return new Date(a.created_at || 0) - new Date(b.created_at || 0);
        case 'budget_desc': return (b.total_budget || 0) - (a.total_budget || 0);
        case 'name_asc':    return (a.name || '').localeCompare(b.name || '');
        case 'newest':
        default:            return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      }
    });

    return result;
  }, [campaigns, statusFilter, search, sort]);

  // Selection handlers
  const toggleSelect = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(c => c.id)));
    }
  }, [filtered, selectedIds.size]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // Bulk cancel
  const handleBulkCancel = useCallback(async () => {
    setBulkLoading(true);
    const targets = campaigns.filter(c => selectedIds.has(c.id) && ['draft', 'published'].includes(c.status));
    const results = await Promise.allSettled(targets.map(c => campaignApi.cancel(c.id)));
    const succeeded = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
    setBulkLoading(false);
    setModal({ open: false, type: null });
    setSelectedIds(new Set());
    fetchCampaigns();
    if (succeeded < targets.length) {
      alert(`${succeeded} of ${targets.length} campaigns cancelled. Some may have failed.`);
    }
  }, [selectedIds, campaigns, fetchCampaigns]);

  // Bulk delete
  const handleBulkDelete = useCallback(async () => {
    setBulkLoading(true);
    const targets = campaigns.filter(c => selectedIds.has(c.id) && c.status === 'draft');
    const results = await Promise.allSettled(targets.map(c => campaignApi.delete(c.id)));
    const succeeded = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
    setBulkLoading(false);
    setModal({ open: false, type: null });
    setSelectedIds(new Set());
    fetchCampaigns();
    if (succeeded < targets.length) {
      alert(`${succeeded} of ${targets.length} campaigns deleted. Some may have failed.`);
    }
  }, [selectedIds, campaigns, fetchCampaigns]);

  // Bulk export
  const handleExportSelected = useCallback(() => {
    const selected = campaigns.filter(c => selectedIds.has(c.id));
    if (selected.length === 0) return;
    const csv = generateCSV(selected);
    downloadCSV(csv, `inflx-campaigns-${new Date().toISOString().slice(0, 10)}.csv`);
  }, [selectedIds, campaigns]);

  const allFilteredSelected = filtered.length > 0 && selectedIds.size === filtered.length;

  // Header counts
  const liveCount  = campaigns.filter(c => ['active', 'live'].includes(c.status)).length;
  const draftCount = campaigns.filter(c => c.status === 'draft').length;

  return (
    <div className="max-w-6xl">

      {/* ── Page Header ─────────────────────────────────────── */}
      <div className="flex items-end justify-between mb-6 gap-5 flex-wrap">
        <div>
          <div className="font-mono text-[11px] font-medium text-[#71717A] uppercase tracking-[0.3px] mb-1">/dashboard / campaigns</div>
          <h1 className="font-display text-[28px] font-bold text-[#0A0A0A] -tracking-[0.6px]">Campaigns</h1>
          <div className="w-9 h-1 bg-[#FFC107] rounded-full mt-1.5"></div>
          <div className="font-body text-[12.5px] text-[#52525B] mt-2">
            <span className="font-mono font-semibold text-[#0A0A0A]">{campaigns.length}</span> total
            <span className="text-[#D4D4D8] mx-1.5">·</span>
            <span className="font-mono font-semibold text-[#0A0A0A]">{liveCount}</span> live
            <span className="text-[#D4D4D8] mx-1.5">·</span>
            <span className="font-mono font-semibold text-[#0A0A0A]">{draftCount}</span> draft{draftCount !== 1 ? 's' : ''}
          </div>
        </div>
        <button
          type="button"
          onClick={goCreate}
          disabled={preflighting}
          className="inline-flex items-center gap-1.5 bg-[#FFC107] hover:bg-[#E0A800] text-[#0A0A0A] font-display font-bold text-[13.5px] px-[18px] py-[11px] rounded-[12px] transition-colors disabled:opacity-60"
        >
          <span className="font-mono font-bold">+</span>
          {preflighting ? 'Checking…' : 'New campaign'}
        </button>
      </div>

      {/* Contracts awaiting signature (folded from the old Contracts tab) */}
      <ContractSignatureStrip />

      {loading ? (
        <div className="text-center py-12 text-[#71717A] text-sm font-body">Loading campaigns…</div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-[#F4F4F5] mx-auto mb-4 inline-flex items-center justify-center font-display font-bold text-[#71717A] text-[24px]">·</div>
          <div className="font-display text-[18px] font-bold text-[#0A0A0A] mb-1.5">No campaigns yet</div>
          <div className="font-body text-sm text-[#52525B] mb-5">Create your first campaign to start working with influencers</div>
          <button
            type="button"
            onClick={goCreate}
            disabled={preflighting}
            className="inline-flex items-center gap-1.5 px-6 py-3 bg-[#FFC107] hover:bg-[#E0A800] text-[#0A0A0A] font-display font-bold text-sm rounded-[12px] transition-colors disabled:opacity-60"
          >
            {preflighting ? 'Checking…' : 'Create campaign →'}
          </button>
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <SummaryStats campaigns={campaigns} />

          {/* Filter / Sort / Search */}
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={v => { setStatusFilter(v); clearSelection(); }}
            sort={sort}
            onSortChange={setSort}
            campaigns={campaigns}
          />

          {/* Bulk Action Bar */}
          {selectedIds.size > 0 && (
            <BulkActionBar
              selectedIds={selectedIds}
              campaigns={campaigns}
              onCancelSelected={() => setModal({ open: true, type: 'cancel' })}
              onDeleteSelected={() => setModal({ open: true, type: 'delete' })}
              onExportSelected={handleExportSelected}
              onClearSelection={clearSelection}
            />
          )}

          {/* Select All row */}
          {filtered.length > 0 && (
            <div className="flex items-center gap-2.5 mb-3 px-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded cursor-pointer"
                  style={{ accentColor: '#0A0A0A' }}
                />
                <span className="font-body text-[12px] font-semibold text-[#52525B]">
                  {allFilteredSelected ? 'Deselect all' : `Select all ${filtered.length}`}
                </span>
              </label>
            </div>
          )}

          {/* Campaign Grid */}
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-[#71717A] font-body">
              No campaigns match your filters.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {filtered.map(c => (
                <CampaignCard
                  key={c.id}
                  campaign={c}
                  selected={selectedIds.has(c.id)}
                  onToggleSelect={toggleSelect}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Confirmation Modals */}
      <ConfirmModal
        open={modal.open && modal.type === 'cancel'}
        title="Cancel selected campaigns?"
        message={`This will cancel ${campaigns.filter(c => selectedIds.has(c.id) && ['draft', 'published'].includes(c.status)).length} draft/published campaign(s). Active or completed campaigns will not be affected. This action cannot be undone.`}
        confirmLabel="Cancel campaigns"
        tone="primary"
        onConfirm={handleBulkCancel}
        onCancel={() => setModal({ open: false, type: null })}
        loading={bulkLoading}
      />
      <ConfirmModal
        open={modal.open && modal.type === 'delete'}
        title="Delete selected drafts?"
        message={`This will permanently delete ${campaigns.filter(c => selectedIds.has(c.id) && c.status === 'draft').length} draft campaign(s). Only drafts can be deleted. This action cannot be undone.`}
        confirmLabel="Delete drafts"
        tone="danger"
        onConfirm={handleBulkDelete}
        onCancel={() => setModal({ open: false, type: null })}
        loading={bulkLoading}
      />
      {/* Phase A12.1.5 — quota popup for "+ New campaign" preflight */}
      <QuotaWallModal quota={quota} onClose={closeQuota} />
    </div>
  );
}
