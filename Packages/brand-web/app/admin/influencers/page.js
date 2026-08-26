'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '../../../lib/api';

/**
 * Admin → Influencers.
 * Contract: features/admin-account-review (item 2)
 *
 * This page used to be a CSV upload box and nothing else. A creator's page existed but
 * nothing linked to it, so it could only be opened by typing an internal id into the
 * address bar — which means, in practice, never. The founder's 22 creators were
 * unreachable from the admin.
 *
 * It is now the list, built to match Admin → Brands exactly: same tabs, same search,
 * same status pills, same click-through. Two lists that do the same job should not
 * behave differently.
 *
 * The bulk upload is not gone — it moved into a panel that opens from the header. It is
 * something you do occasionally; browsing your creators is something you do every time.
 */

const TABS = [
  { key: 'all',       label: 'All' },
  { key: 'approved',  label: 'Approved' },
  { key: 'pending',   label: 'Pending' },
  { key: 'rejected',  label: 'Rejected' },
  { key: 'suspended', label: 'Suspended' },
];

const SAMPLE_CSV = `full_name,phone,instagram_handle,tier,followers_count,engagement_rate,niche,secondary_niche,city,state,gender,platform,avg_views,avg_likes,avg_comments,verified,language
Priya Sharma,+919000000001,priyacooks,micro,180000,6.2,Food,Lifestyle,Vijayawada,Andhra Pradesh,female,Instagram,22000,11160,890,true,Telugu;English
Arun Mehta,+919000000002,arunfashion,macro,240000,4.8,Fashion,Lifestyle,Mumbai,Maharashtra,male,Instagram,35000,11520,650,true,Hindi;English`;

function StatusBadge({ status }) {
  const cfg = {
    approved:  'bg-teal-pale text-teal-deep',
    pending:   'bg-gold-pale text-yellow-700',
    rejected:  'bg-red-pale text-red',
    suspended: 'bg-surface2 text-t3',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${cfg[status] || 'bg-surface2 text-t3'}`}>
      {status || '--'}
    </span>
  );
}

function StatCard({ label, value, color = 'navy' }) {
  const colors = { navy: 'text-navy', teal: 'text-teal', orange: 'text-orange', gold: 'text-yellow-600', red: 'text-red' };
  return (
    <div className="bg-white rounded-xl border border-border p-3.5">
      <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1">{label}</div>
      <div className={`font-display text-2xl font-extrabold ${colors[color] || 'text-t1'}`}>{value}</div>
    </div>
  );
}

const fmtNum = (n) => (n == null ? '--' : Number(n).toLocaleString('en-IN'));

export default function InfluencersPage() {
  const router = useRouter();
  const [tab, setTab] = useState('all');
  const [influencers, setInfluencers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Bulk upload, tucked behind a toggle.
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await adminApi.getInfluencers(tab, search, page);
    setLoading(false);
    if (res.success) {
      setInfluencers(res.data?.influencers || []);
      setSummary(res.data?.summary || null);
      const total = res.meta?.total || 0;
      const limit = res.meta?.limit || 20;
      setTotalPages(Math.max(1, Math.ceil(total / limit)));
    } else {
      setError(res.error?.message || 'Could not load creators');
    }
  }, [tab, search, page]);

  useEffect(() => { load(); }, [load]);

  function downloadTemplate() {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'influencer_upload_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true); setError(null); setResult(null);
    const res = await adminApi.bulkUploadInfluencers(file);
    setUploading(false);
    if (res.success) {
      setResult(res.data);
      setFile(null);
      load();                       // the list must reflect what was just added
    } else {
      setError(res.error?.message || 'Upload failed');
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="font-display text-xl font-extrabold text-t1">Influencers</h1>
          <p className="text-xs text-t3 mt-0.5">Everyone on the platform. Click a row to open their account.</p>
        </div>
        <button
          onClick={() => setUploadOpen(v => !v)}
          className="px-3.5 py-2 text-xs font-bold rounded-lg bg-white border border-border text-t2 hover:border-navy hover:text-navy transition-colors"
        >
          {uploadOpen ? 'Close' : 'Bulk upload CSV'}
        </button>
      </div>

      {/* Bulk upload — occasional work, so it stays folded away */}
      {uploadOpen && (
        <div className="bg-white rounded-xl border border-border p-4 mb-4">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <div className="text-xs font-bold text-t1">Add creators from a spreadsheet</div>
            <button onClick={downloadTemplate} className="text-xs text-orange border border-orange/30 rounded-lg px-3 py-1.5 hover:bg-orange/10 transition-colors">
              Download template CSV
            </button>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="file" accept=".csv"
              onChange={e => { setFile(e.target.files?.[0] || null); setResult(null); setError(null); }}
              className="text-xs text-t2"
            />
            <button
              onClick={handleUpload} disabled={!file || uploading}
              className="px-4 py-2 bg-navy text-white font-bold text-xs rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
          {result && (
            <div className="mt-3 p-3 bg-teal-pale rounded-lg text-xs text-teal-deep">
              Added {result.created ?? result.inserted ?? 0}
              {result.skipped ? ` · skipped ${result.skipped}` : ''}
            </div>
          )}
          {error && <div className="mt-3 p-3 bg-red-pale rounded-lg text-xs text-red">{error}</div>}
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <StatCard label="Total"     value={summary.total}     color="navy" />
          <StatCard label="Approved"  value={summary.approved}  color="teal" />
          <StatCard label="Pending"   value={summary.pending}   color="gold" />
          <StatCard label="Rejected"  value={summary.rejected}  color="red" />
          <StatCard label="Suspended" value={summary.suspended} color="orange" />
        </div>
      )}

      {/* Search */}
      <form
        onSubmit={(e) => { e.preventDefault(); setSearch(searchInput.trim()); setPage(1); }}
        className="flex gap-2 mb-3"
      >
        <input
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Name, handle, phone or city"
          className="flex-1 max-w-sm border border-border rounded-lg px-3 py-2 text-xs bg-white"
        />
        <button className="px-4 py-2 bg-navy text-white font-bold text-xs rounded-lg hover:opacity-90 transition-opacity">Search</button>
        {search && (
          <button type="button" onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }}
            className="px-3 py-2 text-xs text-t3 hover:text-t2">Clear</button>
        )}
      </form>

      {/* Tabs */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setPage(1); }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${tab === t.key ? 'bg-navy text-white' : 'bg-white border border-border text-t2 hover:border-navy hover:text-navy'}`}
          >
            {t.label}
            {summary && t.key !== 'all' && <span className="ml-1.5 opacity-60">({summary[t.key] || 0})</span>}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-border overflow-x-auto">
        <div className="min-w-[980px]">
          <div className="grid grid-cols-[1.6fr_1fr_0.8fr_0.6fr_0.7fr_0.7fr_0.6fr_0.8fr] gap-2 px-4 py-2.5 bg-surface2 border-b border-border text-[10px] font-bold uppercase tracking-wider text-t3">
            <div>Creator</div>
            <div>Contact</div>
            <div>City</div>
            <div>INFLX</div>
            <div>Instagram</div>
            {/* She is asked for a YouTube channel at signup. Until this column existed it
                was stored and never shown, so a YouTube-first creator was indistinguishable
                from one with no audience. Contract: features/admin-creator-review-completeness */}
            <div>YouTube</div>
            <div>Status</div>
            <div>Joined</div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-t3 text-sm">Loading...</div>
          ) : influencers.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-sm text-t3">
                {search ? 'No creators matching your search' : `No ${tab === 'all' ? '' : tab + ' '}creators found`}
              </div>
            </div>
          ) : (
            influencers.map(i => (
              <div
                key={i.id}
                onClick={() => router.push(`/admin/influencers/${i.id}`)}
                className="grid grid-cols-[1.6fr_1fr_0.8fr_0.6fr_0.7fr_0.7fr_0.6fr_0.8fr] gap-2 px-4 py-3 border-b border-border last:border-0 items-center cursor-pointer hover:bg-surface2/50 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-orange-pale flex items-center justify-center text-[10px] font-bold text-orange-deep font-display flex-shrink-0">
                    {(i.full_name || i.name || i.instagram_handle || '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-t1 truncate">{i.full_name || i.name || '--'}</div>
                    <div className="text-[10px] text-t3 truncate">
                      @{i.instagram_handle || '--'}
                      {i.youtube_handle && ` · yt/@${String(i.youtube_handle).replace(/^@+/, '')}`}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-t2 truncate">{i.phone || '--'}</div>
                <div className="text-xs text-t2 truncate">{i.city || '--'}</div>
                {/* INFLX leads, as it does everywhere else: reach on Instagram is who might
                    see a post; INFLX following is who can buy without leaving. */}
                <div className="text-xs font-semibold text-t1">{fmtNum(i.inflx_followers)}</div>
                {/* Never checked is not zero. A dash says "we have not looked"; a 0 would
                    claim we looked and found nobody. */}
                <div className="text-xs text-t2">
                  {i.scrape_last_run && i.followers_count != null
                    ? fmtNum(i.followers_count)
                    : <span className="text-t3">--</span>}
                </div>
                <div className="text-xs text-t2">
                  {!i.youtube_handle
                    ? <span className="text-t3">--</span>
                    : !i.youtube_scrape_last_run
                      ? <span className="text-t3 italic text-[10px]">not checked</span>
                      : i.youtube_subscribers == null
                        ? <span className="text-t3 italic text-[10px]">hidden</span>
                        : fmtNum(i.youtube_subscribers)}
                </div>
                <div><StatusBadge status={i.status} /></div>
                <div className="text-xs text-t3">
                  {i.created_at ? new Date(i.created_at).toLocaleDateString('en-IN') : '--'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-border text-t2 disabled:opacity-40"
          >Previous</button>
          <span className="text-xs text-t3">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-border text-t2 disabled:opacity-40"
          >Next</button>
        </div>
      )}
    </div>
  );
}
