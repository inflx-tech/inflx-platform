'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { campaignApi, fmtRupees } from '../../../lib/api';

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_CFG = {
  draft:          { bg: 'bg-surface2 text-t3', dot: 'bg-border2' },
  pending_wallet: { bg: 'bg-gold-pale text-yellow-700', dot: 'bg-gold' },
  published:      { bg: 'bg-navy-pale text-navy', dot: 'bg-navy' },
  active:         { bg: 'bg-teal-pale text-teal-deep', dot: 'bg-teal' },
  live:           { bg: 'bg-teal-pale text-teal-deep', dot: 'bg-teal' },
  completed:      { bg: 'bg-navy-pale text-navy', dot: 'bg-navy-light' },
  cancelled:      { bg: 'bg-red-pale text-red', dot: 'bg-red' },
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
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${cfg.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {status?.replace(/_/g, ' ')}
    </span>
  );
}

function generateCSV(campaigns) {
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

function ConfirmModal({ open, title, message, confirmLabel, confirmColor, onConfirm, onCancel, loading }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6" onClick={e => e.stopPropagation()}>
        <h3 className="font-display text-lg font-bold text-t1 mb-2">{title}</h3>
        <p className="text-sm text-t3 mb-6">{message}</p>
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-semibold text-t3 hover:text-t1 rounded-lg hover:bg-surface2 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-sm font-bold text-white rounded-lg transition-colors ${confirmColor || 'bg-red hover:bg-red/90'} disabled:opacity-50`}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Campaign Card ──────────────────────────────────────────────────────────

function CampaignCard({ campaign, selected, onToggleSelect }) {
  const router = useRouter();
  const isDraft = campaign.status === 'draft';
  const budget = campaign.total_budget || 0;
  const spent = campaign.spent_budget || 0;
  const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0;
  const influencerCount = campaign.influencer_count || 0;

  return (
    <div className={`bg-white rounded-xl border p-4 hover:shadow-md transition-all flex flex-col gap-3 ${selected ? 'border-navy ring-2 ring-navy/20' : 'border-border hover:border-navy/20'}`}>
      {/* Header with checkbox */}
      <div className="flex items-start gap-2.5">
        <label className="flex items-center mt-0.5 cursor-pointer" onClick={e => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(campaign.id)}
            className="w-4 h-4 rounded border-border2 text-navy focus:ring-navy/30 cursor-pointer"
          />
        </label>
        <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-t1 text-sm truncate">{campaign.name}</div>
            <div className="text-[10px] text-t3 mt-0.5">
              {campaign.start_date ? new Date(campaign.start_date).toLocaleDateString('en-IN') : '—'} –{' '}
              {campaign.end_date ? new Date(campaign.end_date).toLocaleDateString('en-IN') : '—'}
            </div>
          </div>
          <StatusBadge status={campaign.status} />
        </div>
      </div>

      {/* Budget bar */}
      <div>
        <div className="flex justify-between text-[10px] text-t3 mb-1">
          <span>Budget used</span>
          <span className="font-semibold">{fmtRupees(spent)} / {fmtRupees(budget)}</span>
        </div>
        <div className="h-1.5 bg-surface2 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-orange to-gold rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-t3 mt-auto">
        <span>{influencerCount} influencer{influencerCount !== 1 ? 's' : ''}</span>
        {isDraft ? (
          <button
            onClick={() => router.push(`/dashboard/campaigns/new?id=${campaign.id}`)}
            className="text-[11px] font-bold text-orange border border-orange/30 rounded-lg px-2.5 py-1 hover:bg-orange/10 transition-colors"
          >
            Continue draft
          </button>
        ) : (
          <Link href={`/dashboard/campaigns/${campaign.id}`} className="text-navy font-semibold hover:underline">
            View details
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── Summary Stats ──────────────────────────────────────────────────────────

function SummaryStats({ campaigns }) {
  const counts = useMemo(() => {
    const c = { total: campaigns.length, draft: 0, active: 0, live: 0, completed: 0, cancelled: 0, published: 0 };
    campaigns.forEach(camp => { if (c[camp.status] !== undefined) c[camp.status]++; });
    return c;
  }, [campaigns]);

  const totalBudget = useMemo(() => campaigns.reduce((sum, c) => sum + (c.total_budget || 0), 0), [campaigns]);

  const stats = [
    { label: 'Total', value: counts.total, color: 'text-t1' },
    { label: 'Draft', value: counts.draft, color: 'text-t3' },
    { label: 'Active', value: counts.active + counts.live, color: 'text-teal-deep' },
    { label: 'Completed', value: counts.completed, color: 'text-navy' },
    { label: 'Total Budget', value: fmtRupees(totalBudget), color: 'text-t1' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
      {stats.map(s => (
        <div key={s.label} className="bg-white rounded-xl border border-border p-3 text-center">
          <div className={`font-display text-lg font-bold ${s.color}`}>{s.value}</div>
          <div className="text-[10px] text-t3 font-semibold uppercase tracking-wider">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Bulk Action Bar ────────────────────────────────────────────────────────

function BulkActionBar({ selectedIds, campaigns, onCancelSelected, onDeleteSelected, onExportSelected, onClearSelection }) {
  const selectedCampaigns = campaigns.filter(c => selectedIds.has(c.id));
  const cancellableCount = selectedCampaigns.filter(c => ['draft', 'published'].includes(c.status)).length;
  const deletableCount = selectedCampaigns.filter(c => c.status === 'draft').length;

  return (
    <div className="bg-navy-deep text-white rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-4 flex-wrap animate-in">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold">{selectedIds.size} campaign{selectedIds.size !== 1 ? 's' : ''} selected</span>
        <button onClick={onClearSelection} className="text-xs text-white/60 hover:text-white underline">
          Clear
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onExportSelected}
          className="px-3 py-1.5 text-xs font-bold bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
        >
          Export CSV
        </button>
        {cancellableCount > 0 && (
          <button
            onClick={onCancelSelected}
            className="px-3 py-1.5 text-xs font-bold bg-orange/80 hover:bg-orange rounded-lg transition-colors"
          >
            Cancel ({cancellableCount})
          </button>
        )}
        {deletableCount > 0 && (
          <button
            onClick={onDeleteSelected}
            className="px-3 py-1.5 text-xs font-bold bg-red/80 hover:bg-red rounded-lg transition-colors"
          >
            Delete ({deletableCount})
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Filter / Sort / Search Bar ─────────────────────────────────────────────

function FilterBar({ search, onSearchChange, statusFilter, onStatusFilterChange, sort, onSortChange }) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <input
          type="text"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search campaigns..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy/40 transition-all"
        />
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-t3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {/* Status filter */}
      <select
        value={statusFilter}
        onChange={e => onStatusFilterChange(e.target.value)}
        className="px-3 py-2 text-sm border border-border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 cursor-pointer"
      >
        <option value="all">All statuses</option>
        {ALL_STATUSES.map(s => (
          <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
        ))}
      </select>

      {/* Sort */}
      <select
        value={sort}
        onChange={e => onSortChange(e.target.value)}
        className="px-3 py-2 text-sm border border-border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 cursor-pointer"
      >
        {SORT_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function CampaignsPage() {
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

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(c => c.status === statusFilter);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(c => (c.name || '').toLowerCase().includes(q));
    }

    // Sort
    result.sort((a, b) => {
      switch (sort) {
        case 'oldest':
          return new Date(a.created_at || 0) - new Date(b.created_at || 0);
        case 'budget_desc':
          return (b.total_budget || 0) - (a.total_budget || 0);
        case 'name_asc':
          return (a.name || '').localeCompare(b.name || '');
        case 'newest':
        default:
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
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

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display text-xl font-bold text-t1">Campaigns</h1>
          <p className="text-xs text-t3 mt-0.5">{campaigns.length} total</p>
        </div>
        <Link href="/dashboard/campaigns/new" className="px-4 py-2 bg-gradient-to-r from-red to-orange text-white font-bold text-sm rounded-xl hover:shadow-lg transition-shadow">
          + New Campaign
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-12 text-t3 text-sm">Loading campaigns...</div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">📣</div>
          <div className="font-display text-lg font-bold text-t1 mb-2">No campaigns yet</div>
          <div className="text-sm text-t3 mb-5">Create your first campaign to start working with influencers</div>
          <Link href="/dashboard/campaigns/new" className="px-6 py-3 bg-gradient-to-r from-red to-orange text-white font-bold text-sm rounded-xl">Create Campaign</Link>
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
                  className="w-4 h-4 rounded border-border2 text-navy focus:ring-navy/30 cursor-pointer"
                />
                <span className="text-xs font-semibold text-t3">
                  {allFilteredSelected ? 'Deselect all' : `Select all ${filtered.length}`}
                </span>
              </label>
            </div>
          )}

          {/* Campaign Grid */}
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-t3">
              No campaigns match your filters.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
        confirmLabel="Cancel Campaigns"
        confirmColor="bg-orange hover:bg-orange/90"
        onConfirm={handleBulkCancel}
        onCancel={() => setModal({ open: false, type: null })}
        loading={bulkLoading}
      />
      <ConfirmModal
        open={modal.open && modal.type === 'delete'}
        title="Delete selected drafts?"
        message={`This will permanently delete ${campaigns.filter(c => selectedIds.has(c.id) && c.status === 'draft').length} draft campaign(s). Only drafts can be deleted. This action cannot be undone.`}
        confirmLabel="Delete Drafts"
        confirmColor="bg-red hover:bg-red/90"
        onConfirm={handleBulkDelete}
        onCancel={() => setModal({ open: false, type: null })}
        loading={bulkLoading}
      />
    </div>
  );
}
