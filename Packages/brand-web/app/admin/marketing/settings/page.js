'use client';

import { useEffect, useState } from 'react';
import { marketingApi, getStoredUser } from '../../../../lib/api';

const FIELDS = [
  { key: 'high_tier_threshold',       label: 'High-tier score threshold',       help: 'Score ≥ this = high-tier refresh cadence.',           unit: 'score' },
  { key: 'low_tier_threshold',        label: 'Low-tier score threshold',        help: 'Score < this = low-tier refresh cadence.',            unit: 'score' },
  { key: 'high_refresh_days',         label: 'High-tier refresh cadence',       help: 'High-priority creators rescraped every N days.',      unit: 'days' },
  { key: 'mid_refresh_days',          label: 'Mid-tier refresh cadence',        help: 'Mid creators rescraped every N days.',                unit: 'days' },
  { key: 'low_refresh_days',          label: 'Low-tier refresh cadence',        help: 'Low creators rescraped every N days.',                unit: 'days' },
  { key: 'brand_refresh_days',        label: 'Brand refresh cadence',           help: 'All brands rescraped every N days.',                  unit: 'days' },
  { key: 'skip_recent_scrape_hours',  label: 'Freshness gate',                  help: 'Skip rescrape if last scraped within N hours.',       unit: 'hours' },
  { key: 'posts_retention_days',      label: 'Post retention (influencer)',     help: 'Older posts pruned by the daily cleanup job.',        unit: 'days' },
  { key: 'brand_posts_retention_days', label: 'Brand-post retention',           help: 'Brand posts kept N days (0 = clean immediately).',    unit: 'days' },
];

export default function MarketingSettingsPage() {
  const [settings, setSettings] = useState(null);
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const user = typeof window !== 'undefined' ? getStoredUser() : null;
  const canEdit = user?.admin_role === 'superadmin';

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await marketingApi.getSettings();
      setLoading(false);
      if (res.success) {
        setSettings(res.data);
        setDraft({});
      }
    })();
  }, []);

  function update(key, value) {
    setDraft(d => ({ ...d, [key]: value }));
  }

  async function save() {
    if (Object.keys(draft).length === 0) return;
    setSaving(true);
    const payload = {};
    for (const [k, v] of Object.entries(draft)) {
      payload[k] = k === 'discovery_enabled' ? !!v : Number(v);
    }
    const res = await marketingApi.updateSettings(payload);
    setSaving(false);
    if (res.success) {
      setSettings(res.data);
      setDraft({});
      setToast('Saved');
    } else {
      setToast(res.error?.message || 'Failed');
    }
    setTimeout(() => setToast(''), 3000);
  }

  if (loading) return <div className="text-t3 text-sm p-8 text-center">Loading…</div>;
  if (!settings) return <div className="text-t3 text-sm p-8 text-center">Settings not initialised.</div>;

  return (
    <div className="space-y-3 max-w-3xl mx-auto">
      <div className="bg-white rounded-xl border border-border p-4">
        <h1 className="font-display text-lg font-bold text-t1 mb-1">🛠️ Marketing Settings</h1>
        <p className="text-xs text-t3">Tunable thresholds for tier classification, refresh cadence, and retention.</p>
        {!canEdit && (
          <div className="mt-2 text-xs text-yellow-700 bg-gold-pale rounded-lg px-3 py-2">
            Read-only — only <span className="font-bold">superadmin</span> can edit these.
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-border p-4 space-y-3">
        {FIELDS.map(f => {
          const current = settings[f.key];
          const value = draft[f.key] !== undefined ? draft[f.key] : current;
          const changed = draft[f.key] !== undefined && draft[f.key] !== current;
          return (
            <div key={f.key} className="grid grid-cols-3 gap-3 items-start py-2 border-b border-border last:border-0">
              <div>
                <div className="text-sm font-semibold text-t1">{f.label}</div>
                <div className="text-[11px] text-t3 mt-0.5">{f.help}</div>
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <input type="number" disabled={!canEdit} value={value ?? ''}
                  onChange={e => update(f.key, e.target.value)}
                  className={`w-28 text-sm border rounded-lg px-2 py-1.5 tabular-nums text-right ${changed ? 'border-orange bg-orange/5' : 'border-border'} ${!canEdit ? 'bg-surface2 text-t3 cursor-not-allowed' : ''}`} />
                <span className="text-xs text-t3">{f.unit}</span>
                {changed && <span className="text-[10px] text-orange font-bold">unsaved</span>}
              </div>
            </div>
          );
        })}

        <div className="grid grid-cols-3 gap-3 items-start py-2">
          <div>
            <div className="text-sm font-semibold text-t1">Auto-discovery</div>
            <div className="text-[11px] text-t3 mt-0.5">Auto-scrape creators/brands from detected collabs. Killed by default per scope decision.</div>
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" disabled={!canEdit}
                checked={draft.discovery_enabled !== undefined ? draft.discovery_enabled : settings.discovery_enabled}
                onChange={e => update('discovery_enabled', e.target.checked)} />
              <span>Enable auto-discovery</span>
            </label>
            {draft.discovery_enabled !== undefined && draft.discovery_enabled !== settings.discovery_enabled && (
              <span className="text-[10px] text-orange font-bold">unsaved</span>
            )}
          </div>
        </div>
      </div>

      {canEdit && (
        <div className="flex gap-2">
          <button disabled={saving || Object.keys(draft).length === 0} onClick={save}
            className="bg-orange text-white font-bold text-sm px-5 py-2.5 rounded-lg hover:bg-orange/90 disabled:opacity-40">
            {saving ? 'Saving…' : `Save ${Object.keys(draft).length} change${Object.keys(draft).length === 1 ? '' : 's'}`}
          </button>
          <button disabled={Object.keys(draft).length === 0} onClick={() => setDraft({})}
            className="text-t3 text-sm px-4 py-2.5 hover:text-t1 disabled:opacity-40">
            Discard
          </button>
        </div>
      )}

      <MaintenancePanel onToast={(t) => { setToast(t); setTimeout(() => setToast(''), 6000); }} />

      {toast && (
        <div className="fixed bottom-4 right-4 bg-teal-deep text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

function MaintenancePanel({ onToast }) {
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  async function runBackfill(type) {
    if (running) return;
    if (!confirm(`Re-cache all ${type === 'all' ? 'creator + brand' : type} profile pictures to R2? Takes ~30s per 50 rows.`)) return;
    setRunning(true);
    setLastResult(null);
    const res = await marketingApi.backfillProfilePics({ type, force: true });
    setRunning(false);
    if (res.success) {
      setLastResult(res.data);
      onToast(`Backfill done — ${res.data.ok} ok · ${res.data.failed} failed · ${res.data.skipped} skipped`);
    } else {
      onToast(res.error?.message || 'Backfill failed');
    }
  }

  return (
    <div className="bg-white rounded-xl border border-border p-4 space-y-2">
      <h2 className="font-display text-sm font-bold text-t1">🧰 Maintenance</h2>
      <p className="text-[11px] text-t3">
        Re-cache profile pictures from Instagram to our R2 bucket. Instagram URLs expire ~14 days
        after a scrape; the cache prevents the admin queues + campaign wizard from showing broken
        images. Use after a fresh re-scrape if some pics weren't updated automatically.
      </p>
      <div className="flex gap-2 pt-1">
        <button onClick={() => runBackfill('creator')} disabled={running}
          className="text-xs font-bold bg-surface2 text-t1 hover:bg-gold/15 hover:text-gold px-3 py-1.5 rounded-lg disabled:opacity-40">
          {running ? 'Running…' : '↻ Re-cache creators'}
        </button>
        <button onClick={() => runBackfill('brand')} disabled={running}
          className="text-xs font-bold bg-surface2 text-t1 hover:bg-gold/15 hover:text-gold px-3 py-1.5 rounded-lg disabled:opacity-40">
          ↻ Re-cache brands
        </button>
        <button onClick={() => runBackfill('all')} disabled={running}
          className="text-xs font-bold bg-orange text-white hover:bg-orange/90 px-3 py-1.5 rounded-lg disabled:opacity-40">
          ↻ Re-cache everything
        </button>
      </div>
      {lastResult && (
        <pre className="text-[10px] text-t3 bg-surface2 rounded-lg p-2 mt-2 overflow-x-auto">
{JSON.stringify(lastResult, null, 2)}
        </pre>
      )}
    </div>
  );
}
